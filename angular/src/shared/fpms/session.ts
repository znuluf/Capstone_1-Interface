import { AppConsts } from '@shared/AppConsts';

/** Full URL of a page in this app, for example appUrl('account/login'). */
export function appUrl(path = ''): string {
    return AppConsts.appBaseUrl.replace(/\/?$/, '/') + path;
}

/** Clears the JWT and returns to the sign-in page (same steps as AppAuthService.logout, usable anywhere). */
export function signOutLocally(): void {
    abp.auth.clearToken();
    abp.utils.deleteCookie(AppConsts.authorization.encryptedAuthTokenName);
    location.href = appUrl('account/login');
}
