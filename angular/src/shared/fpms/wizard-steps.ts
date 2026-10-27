import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

/**
 * Keeps a wizard's step in the address (?step=n), so the browser Back button goes one step back and
 * the in-page Back button and the browser agree. Create it in a field initializer (it uses inject()).
 *
 * A step the user cannot be on yet (after a reload, say, when the earlier answers are gone) falls back
 * to the furthest step the current answers allow.
 */
export class WizardSteps {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private location = inject(Location);
    current: number;

    constructor(
        private readonly first: number,
        private readonly allowed: () => number,
        private readonly show: (step: number) => void
    ) {
        this.current = first;
    }

    /** Starts again at the first step (for example when the wizard is reloaded with new data). */
    reset(): void {
        this.current = this.first;
    }

    /** Applies the step in the address. Call it whenever the query string changes. */
    sync(q: ParamMap = this.route.snapshot.queryParamMap): void {
        const raw = Number(q.get('step'));
        const wanted = Number.isInteger(raw) && raw >= this.first ? raw : this.first;
        const step = Math.min(wanted, Math.max(this.first, this.allowed()));
        if (step !== wanted) {
            this.write(step, true); // the address changes and sync runs again
            return;
        }
        if (step !== this.current) {
            this.current = step;
            this.show(step);
        }
    }

    /**
     * Moves to a step. One step back returns through browser history when that step was opened here,
     * so Back never piles up entries; forward steps add a history entry unless `replace` is set
     * (used after a final submit, so Back cannot return to the review step).
     */
    go(step: number, replace = false): void {
        const state = this.location.getState() as { fpmsStep?: number } | null;
        if (!replace && step === this.current - 1 && state?.fpmsStep === this.current) {
            this.location.back();
            return;
        }
        this.write(step, replace);
    }

    private write(step: number, replace: boolean): void {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { step: step === this.first ? null : step },
            queryParamsHandling: 'merge',
            replaceUrl: replace,
            state: { fpmsStep: step },
        });
    }
}
