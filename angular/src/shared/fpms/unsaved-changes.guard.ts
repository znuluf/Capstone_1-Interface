import { CanDeactivateFn } from '@angular/router';

/** A page that can tell whether leaving now would lose typed changes (see FpmsPage.hasUnsavedChanges). */
export interface LeavePrompt {
    hasUnsavedChanges(): boolean;
}

/** Asks before leaving a page with unsaved form changes. Pages that keep browser drafts never ask. */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = (component) => {
    const page = component as Partial<LeavePrompt> | null;
    if (!page?.hasUnsavedChanges?.()) {
        return true;
    }
    return new Promise<boolean>((resolve) =>
        abp.message.confirm('Your changes on this page are not saved yet. Leave without saving?', 'Leave this page?', (ok: boolean) => resolve(!!ok))
    );
};
