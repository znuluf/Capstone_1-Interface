/**
 * Per-user browser storage for unsaved forms and remembered choices (spec Section 6, AC-25; DEC-37).
 * Keys include the farm and the user, so another person signing in on the same tablet never sees them.
 * Drafts expire after 24 hours and are deleted on save or discard. Storage can be unavailable (private mode,
 * blocked site data); every access is wrapped so the forms still work without it. Never store passwords here.
 */
const PREFIX = 'fpms.';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface Draft<T> {
    savedAt: number;
    data: T;
}

function owner(): string | null {
    const s = (globalThis as any).abp?.session;
    return s?.userId ? `${s.tenantId ?? 'host'}.${s.userId}` : null;
}

function read(key: string): any {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or blocked: the form keeps working without a draft.
    }
}

function remove(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export const FormDrafts = {
    /** The current user's draft of a form, or null (expired drafts are deleted). */
    load<T>(form: string): Draft<T> | null {
        const who = owner();
        if (!who) {
            return null;
        }
        const key = `${PREFIX}draft.${who}.${form}`;
        const d = read(key) as Draft<T> | null;
        if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DRAFT_TTL_MS) {
            remove(key);
            return null;
        }
        return d;
    },

    save<T>(form: string, data: T): void {
        const who = owner();
        if (who) {
            write(`${PREFIX}draft.${who}.${form}`, { savedAt: Date.now(), data } as Draft<T>);
        }
    },

    clear(form: string): void {
        const who = owner();
        if (who) {
            remove(`${PREFIX}draft.${who}.${form}`);
        }
    },

    /** Deletes every expired draft on this device (any user). */
    purgeExpired(): void {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith(`${PREFIX}draft.`)) {
                    const d = read(key);
                    if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DRAFT_TTL_MS) {
                        remove(key);
                    }
                }
            }
        } catch {
            // ignore
        }
    },
};

/** The Operations choice (cycle, then pond/batch), remembered per user (Journey 4). */
export interface OpsChoice {
    cycleId?: string | null;
    batchId?: string | null;
}

export const OpsMemory = {
    get(): OpsChoice {
        const who = owner();
        return (who && read(`${PREFIX}ops.${who}`)) || {};
    },
    set(choice: OpsChoice): void {
        const who = owner();
        if (who) {
            write(`${PREFIX}ops.${who}`, choice);
        }
    },
};
