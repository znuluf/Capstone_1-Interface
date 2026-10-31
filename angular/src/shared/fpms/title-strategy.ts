import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BRAND } from './brand';

/** Browser tab title: "Page name · Shrimp.io", or "Shrimp.io FPMS" for a page without a title. */
@Injectable({ providedIn: 'root' })
export class FpmsTitleStrategy extends TitleStrategy {
    private readonly title = inject(Title);

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const page = this.buildTitle(snapshot);
        this.title.setTitle(page ? `${page} · ${BRAND.name}` : BRAND.full);
    }
}
