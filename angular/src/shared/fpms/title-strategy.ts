import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Browser tab title: "Page name · Capstone", or just "Capstone" for a page without a title. */
@Injectable({ providedIn: 'root' })
export class FpmsTitleStrategy extends TitleStrategy {
    private readonly title = inject(Title);
    private static readonly app = 'Capstone';

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const page = this.buildTitle(snapshot);
        this.title.setTitle(page ? `${page} · ${FpmsTitleStrategy.app}` : FpmsTitleStrategy.app);
    }
}
