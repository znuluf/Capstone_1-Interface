import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppSessionService } from '../session/app-session.service';

/** Home, sign-in and register pages: a user who is already signed in goes straight into the app. */
export const signedOutGuard: CanActivateFn = () => {
    const router = inject(Router);
    return inject(AppSessionService).user ? router.parseUrl('/app') : true;
};
