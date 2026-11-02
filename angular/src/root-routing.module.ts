import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
    // Home page, for everyone. Signed-out visitors get Sign in and Create account; signed-in users get a
    // button into the app. The tab shows just "Farm.Shrimp.io".
    {
        path: '',
        pathMatch: 'full',
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
    // Unknown addresses (including /app/... pages that no longer exist) go to the home page.
    { path: '**', redirectTo: '' },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    providers: [],
})
export class RootRoutingModule {}
