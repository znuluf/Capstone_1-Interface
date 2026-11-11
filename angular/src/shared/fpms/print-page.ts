import { DestroyRef, inject } from '@angular/core';

/**
 * A4 portrait page for a printed document, with a footer naming it and "Page x of y" (DEC-85 step 6; Chrome and Edge
 * print margin boxes). Call it in a field initializer of the page; the returned function sets the footer text once the
 * document is loaded (`initialFooter` is used until then, so Ctrl+P works at once). The rule is removed when the page is
 * left, so other prints keep their own page set-up.
 */
export function printPage(id: string, initialFooter = ''): (footer: string) => void {
    const el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
    inject(DestroyRef).onDestroy(() => el.remove());
    const quote = (v: string) => '"' + (v ?? '').replace(/["\\]/g, '').replace(/\s+/g, ' ') + '"';
    const set = (footer: string) => {
        const boxes =
            `@bottom-left { content: ${quote(footer)}; font-size: 8pt; color: #555; } ` +
            `@bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #555; }`;
        // The default page is A4 portrait. An element with the class fpms-page-wide (a sheet with many columns) prints on
        // A4 landscape instead, through the named page below.
        el.textContent =
            `@page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; ${boxes} } ` +
            `@page fpms-wide { size: A4 landscape; margin: 12mm 12mm 16mm 12mm; ${boxes} }`;
    };
    set(initialFooter);
    return set;
}
