/** Colour theme choice, kept per browser. 'farm' is the default look; 'neutral' is graphite with a blue accent. */
export type ThemeMode = 'farm' | 'neutral';

export const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
    { value: 'farm', label: 'Farm', hint: 'Slate navy and teal. The default look.' },
    { value: 'neutral', label: 'Neutral', hint: 'Graphite and blue, with higher contrast.' },
];

const KEY = 'fpms.theme';

export function savedTheme(): ThemeMode {
    try {
        return localStorage.getItem(KEY) === 'neutral' ? 'neutral' : 'farm';
    } catch {
        return 'farm';
    }
}

/** Sets or clears <html data-theme>. Call once at start-up, then again whenever the person changes it. */
export function applyTheme(mode: ThemeMode, remember = false): void {
    if (mode === 'neutral') {
        document.documentElement.setAttribute('data-theme', 'neutral');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    if (remember) {
        try {
            localStorage.setItem(KEY, mode);
        } catch {
            // Storage can be blocked; the choice then lasts until the page is reloaded.
        }
    }
}
