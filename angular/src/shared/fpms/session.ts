import { AppConsts } from '@shared/AppConsts';

/** Clears the JWT and returns to the sign-in page (same steps as AppAuthService.logout, usable anywhere). */
export function signOutLocally(): void {
    abp.auth.clearToken();
    abp.utils.deleteCookie(AppConsts.authorization.encryptedAuthTokenName);
    location.href = AppConsts.appBaseUrl;
}
