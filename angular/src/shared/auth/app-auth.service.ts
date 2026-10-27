import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TokenService, UtilsService } from 'abp-ng2-module';
import { AppConsts } from '@shared/AppConsts';
import { UrlHelper } from '@shared/helpers/UrlHelper';
import {
    AccountServiceProxy,
    AuthenticateModel,
    AuthenticateResultModel,
    TenantAvailabilityState,
    TokenAuthServiceProxy,
} from '@shared/service-proxies/service-proxies';

export const LAST_FARM_CODE_KEY = 'fpms.lastFarmCode';

/**
 * Sign-in with farm code (blank = System Administrator), JWT storage and the forced password-change step.
 */
@Injectable()
export class AppAuthService {
    authenticateModel: AuthenticateModel;
    authenticateResult: AuthenticateResultModel;
    rememberMe: boolean;
    farmCode = '';

    /** Kept in memory only while a temporary password is being replaced. */
    pendingPasswordChange: { farmCode: string; userName: string } | null = null;

    constructor(
        private _tokenAuthService: TokenAuthServiceProxy,
        private _accountService: AccountServiceProxy,
        private _router: Router,
        private _utilsService: UtilsService,
        private _tokenService: TokenService
    ) {
        this.clear();
        try {
            this.farmCode = localStorage.getItem(LAST_FARM_CODE_KEY) ?? '';
        } catch {
            this.farmCode = '';
        }
    }

    logout(reload?: boolean): void {
        abp.auth.clearToken();
        abp.utils.deleteCookie(AppConsts.authorization.encryptedAuthTokenName);

        if (reload !== false) {
            location.href = AppConsts.appBaseUrl;
        }
    }

    /** Resolves the farm code to a tenant and sets the tenant cookie (empty code = host sign-in). */
    async selectFarm(farmCode: string): Promise<boolean> {
        const code = (farmCode ?? '').trim();
        if (!code) {
            abp.multiTenancy.setTenantIdCookie(undefined);
            return true;
        }

        const result = await firstValueFrom(this._accountService.isTenantAvailable({ tenancyName: code }));
        if (result.state === TenantAvailabilityState._1) {
            abp.multiTenancy.setTenantIdCookie(result.tenantId);
            try {
                localStorage.setItem(LAST_FARM_CODE_KEY, code);
            } catch {
                /* storage unavailable */
            }
            return true;
        }

        abp.message.error(
            result.state === TenantAvailabilityState._2
                ? 'This farm account is inactive. Contact the System Administrator.'
                : 'No farm account uses this farm code.',
            'Sign-in failed'
        );
        return false;
    }

    async authenticate(finallyCallback?: () => void): Promise<void> {
        try {
            if (!(await this.selectFarm(this.farmCode))) {
                return;
            }

            const result = await firstValueFrom(this._tokenAuthService.authenticate(this.authenticateModel));
            this.processAuthenticateResult(result);
        } catch {
            /* the interceptor shows the error */
        } finally {
            finallyCallback?.();
        }
    }

    private processAuthenticateResult(result: AuthenticateResultModel) {
        this.authenticateResult = result;
        if (!result?.accessToken) {
            this._router.navigate(['account/login']);
            return;
        }

        this.storeToken(result);
        if (result.shouldChangePassword) {
            this.pendingPasswordChange = { farmCode: this.farmCode, userName: this.authenticateModel.userNameOrEmailAddress };
            this._router.navigate(['account/change-password']);
            return;
        }

        let initialUrl = UrlHelper.initialUrl;
        if (initialUrl.indexOf('/login') > 0 || initialUrl.indexOf('/change-password') > 0 || initialUrl.indexOf('/register') > 0) {
            initialUrl = AppConsts.appBaseUrl;
        }

        location.href = initialUrl;
    }

    private storeToken(result: AuthenticateResultModel): void {
        const tokenExpireDate = this.rememberMe ? new Date(new Date().getTime() + 1000 * result.expireInSeconds) : undefined;
        this._tokenService.setToken(result.accessToken, tokenExpireDate);
        this._utilsService.setCookieValue(
            AppConsts.authorization.encryptedAuthTokenName,
            result.encryptedAccessToken,
            tokenExpireDate,
            abp.appPath
        );
    }

    private clear(): void {
        this.authenticateModel = new AuthenticateModel();
        this.authenticateModel.rememberClient = false;
        this.authenticateResult = null;
        this.rememberMe = false;
    }
}
