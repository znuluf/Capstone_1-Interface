import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AccountComponent } from './account.component';
import { ChangePasswordComponent } from './change-password/change-password.component';

@NgModule({
    imports: [
        RouterModule.forChild([
            {
                path: '',
                component: AccountComponent,
                children: [
                    { path: 'login', title: 'Sign in', component: LoginComponent },
                    { path: 'register', title: 'Register a farm', component: RegisterComponent },
                    { path: 'change-password', title: 'Change password', component: ChangePasswordComponent },
                    { path: '', redirectTo: 'login', pathMatch: 'full' },
                ],
            },
        ]),
    ],
    exports: [RouterModule],
})
export class AccountRoutingModule {}
