import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FpmsLogoComponent } from '@shared/fpms/fpms-logo.component';

/** Home page ("/") for visitors: what Farm.Shrimp.io keeps track of, with Sign in and Create account. */
@Component({
    selector: 'fpms-welcome',
    templateUrl: './welcome.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterLink, FpmsLogoComponent],
})
export class WelcomeComponent implements OnInit, OnDestroy {
    constructor(private renderer: Renderer2) {}

    ngOnInit(): void {
        // Reached from the sign-in page by client-side navigation, so clear its body classes.
        this.renderer.removeClass(document.body, 'login-page');
        this.renderer.removeClass(document.body, 'fpms-account');
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
