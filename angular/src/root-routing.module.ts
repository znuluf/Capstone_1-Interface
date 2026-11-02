import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
    { path: '', redirectTo: '/app/dashboard', pathMatch: 'full' },
    {
        path: 'welcome',
        title: 'Welcome',
        loadComponent: () => import('welcome/welcome.component').then((m) => m.WelcomeComponent),
    },
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
    // Unknown or old addresses (including /app/... pages that no longer exist) go to the home page,
    // which sends a signed-out user to sign-in and a signed-in user to their start page.
    { path: '**', redirectTo: '/app/dashboard' },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    providers: [],
})
export class RootRoutingModule {}
