import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Renderer2, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FpmsLogoComponent } from '@shared/fpms/fpms-logo.component';
import { AppSessionService } from '@shared/session/app-session.service';

/**
 * Home page ("/"): what Farm.Shrimp.io keeps track of. Signed-out visitors get Sign in and Create account;
 * signed-in users get a button back into the app instead.
 */
@Component({
    selector: 'fpms-welcome',
    templateUrl: './welcome.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterLink, FpmsLogoComponent],
})
export class WelcomeComponent implements OnInit, OnDestroy {
    private readonly session = inject(AppSessionService);

    readonly signedIn = !!this.session.user;
    readonly userName = this.session.user?.name || this.session.user?.userName || '';
    /** The System Administrator starts in Farms; farm users start on the Dashboard (see AppRouteGuard). */
    readonly startLabel = this.session.tenant ? 'Go to dashboard' : 'Go to Farms';

    constructor(private renderer: Renderer2) {}

    ngOnInit(): void {
        // Reached from the sign-in page by client-side navigation, so clear its body classes.
        this.renderer.removeClass(document.body, 'login-page');
        this.renderer.removeClass(document.body, 'fpms-account');
        // Reached from the app: drop its layout classes (the app puts them back when it opens again).
        this.renderer.removeClass(document.body, 'sidebar-mini');
        this.renderer.removeClass(document.body, 'sidebar-open');
        this.renderer.addClass(document.body, 'fpms-welcome-page');
    }

    ngOnDestroy(): void {
        this.renderer.removeClass(document.body, 'fpms-welcome-page');
    }

    /** Smooth scroll to a section. Anchor hrefs are avoided because <base href="/"> would reload the root route. */
    scrollTo(id: string): void {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
