# Working in this repo

Farm Production Management System for shrimp farms. ASP.NET Boilerplate 10.2 (.NET 9) API in `aspnet-core/`, Angular 19.2 client in `angular/`. Read `architecture.md` for the system and `decisions.md` before changing a behaviour that has a DEC number.

## UI work (Angular client)

### Design system: use it, don't add to it ad hoc
- Styles live in `angular/src/shared/fpms/fpms.less` (tokens, base) and `theme.less` (AdminLTE/Bootstrap 4 overrides), loaded through `shared/core.less`. Components use inline templates and Bootstrap/AdminLTE classes plus the `fpms-*` classes in those files.
- Colors, radii, shadows and motion come from the `--fpms-*` variables. Do not write a new hex value in a component or a new rule outside those files. A second theme (`html[data-theme='neutral']`, `theme-neutral.less`) only redefines the same variables, so anything that skips a variable looks wrong in one theme.
- Status colors keep their meaning: success green, warning gold, error red, info blue. The brand orange and the logo's green are never used as a status. A state is never shown by color alone; it also has text or an icon.
- Radius follows role (`--fpms-r-control`, `-tile`, `-card`), not one value for everything.
- Type is system fonts only (`--fpms-font`). The farm network has no Internet, so no web fonts, CDN links or remote assets. Add libraries with npm so they are bundled.
- Text is never below 14px. Controls and buttons keep the tablet-size touch targets already set in `fpms.less`. Contrast stays at WCAG 2.2 AA. Respect `prefers-reduced-motion`; motion is small (about 160ms) and answers a person's action.
- Check any UI change in both themes (My account > Appearance).

### Angular conventions in use
- Standalone components with `imports: FPMS_IMPORTS` (`app/fpms/shared-imports.ts`). Pages extend `FpmsPage` (`shared/fpms/fpms-page.ts`) for the API client, permissions, labels, `busy()` and drafts. Do not add NgModules; the existing ones are root and shared plumbing only.
- Built-in control flow (`@if`, `@for` with `track`, `@let`). No `*ngIf` or `*ngFor`.
- The app is zoneless (`provideExperimentalZonelessChangeDetection`). Do not assume zone.js; follow how neighbouring pages refresh the view after an async call. New component state uses signals where the page already does. New shared components use `OnPush`.
- Every list or sheet handles its states: `<fpms-loading>`, `@empty` with `<fpms-empty>`, an error the person can act on, and a disabled action while `busy()` is true, so a double tap cannot save twice.
- Reuse `fpms-page-header`, `fpms-badge`, `fpms-empty`, `fpms-loading` and the pipes in `FPMS_PIPES` before building a new one.
- Pages are also shown in the log drawer and the logging wizard (`embedded`). Anything fixed or sticky must not break there.

### Writing in the interface
Sentence case, plain verbs, the same word for an action throughout (a button that says "Save" produces "Saved"). Errors say what happened and what to do next. No apologies, no filler.

### Checking a change
From `angular/`: `yarn lint`, `yarn build` (or `ng build`) and `yarn test`. Fix template binding errors before reporting a change as done. If you cannot build (no `node_modules`), say so and list what is unchecked.

## Notable decisions
Record behaviour or design decisions in `decisions.md` in its existing DEC format, and user-visible changes in `changelog.md`.
