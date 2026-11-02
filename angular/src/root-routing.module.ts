import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { signedOutGuard } from '@shared/auth/signed-out-guard';

const routes: Routes = [
    // Home page for visitors: Sign in and Create account. A signed-in user goes straight to their start page
    // in the app instead. The tab shows just "Farm.Shrimp.io".
    {
        path: '',
        pathMatch: 'full',
        canActivate: [signedOutGuard],
        loadComponent: () => import('welcome/welcome.component').then((m) => m.WelcomeComponent),
    },
    // Old address of the home page
    { path: 'welcome', redirectTo: '', pathMatch: 'full' },
    {
        path: 'account',
        loadChildren: () => import('account/account.module').then((m) => m.AccountModule), // Lazy load account module
        data: { preload: true },
    },
    {
        path: 'app',
        loadChildren: () => import('app/app.module').then((m) => m.AppModule), // Lazy load app module
        data: { preload: true },
    },
    // Unknown addresses (including /app/... pages that no longer exist) go to the home page, or into the app
    // for a signed-in user.
    { path: '**', redirectTo: '' },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    providers: [],
})
export class RootRoutingModule {}
