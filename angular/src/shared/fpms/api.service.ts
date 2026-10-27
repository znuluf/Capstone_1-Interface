import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Observable, Subject, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AppConsts } from '@shared/AppConsts';

/**
 * Thin client for FPMS application services (ABP dynamic API: /api/services/app/{Service}/{Method}).
 * Requests use blob responses so abp-ng2-module's interceptor unwraps results and shows server errors.
 * ABP conventions: Get* = GET (query string), Update* = PUT, Delete* = DELETE, everything else = POST.
 */
@Injectable({ providedIn: 'root' })
export class FpmsApiService {
    private http = inject(HttpClient);

    /**
     * The app runs zoneless. Emits after every response, once the awaiting page code has run (macrotask after
     * the microtasks), so pages that keep state in plain fields can mark themselves for check (see FpmsPage).
     */
    readonly settled = new Subject<void>();

    private settle<T>(promise: Promise<T>): Promise<T> {
        return promise.finally(() => setTimeout(() => this.settled.next()));
    }

    private url(service: string, method: string): string {
        return `${AppConsts.remoteServiceBaseUrl}/api/services/app/${service}/${method}`;
    }

    get<T>(service: string, method: string, params?: Record<string, unknown>): Promise<T> {
        return this.settle(firstValueFrom(
            this.http
                .get(this.url(service, method), { params: toParams(params), observe: 'response', responseType: 'blob', headers: jsonAccept() })
                .pipe(mergeMap((r) => read<T>(r)))
        ));
    }

    post<T>(service: string, method: string, body?: unknown): Promise<T> {
        return this.send<T>('POST', this.url(service, method), body);
    }

    put<T>(service: string, method: string, body?: unknown): Promise<T> {
        return this.send<T>('PUT', this.url(service, method), body);
    }

    delete<T>(service: string, method: string, params?: Record<string, unknown>): Promise<T> {
        return this.settle(firstValueFrom(
            this.http
                .delete(this.url(service, method), { params: toParams(params), observe: 'response', responseType: 'blob', headers: withXsrf(jsonAccept()) })
                .pipe(mergeMap((r) => read<T>(r)))
        ));
    }


    private send<T>(method: string, url: string, body: unknown): Promise<T> {
        return this.settle(firstValueFrom(
            this.http
                .request(method, url, {
                    body: JSON.stringify(body ?? {}),
                    observe: 'response',
                    responseType: 'blob',
                    headers: withXsrf(new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' })),
                })
                .pipe(mergeMap((r) => read<T>(r as HttpResponse<Blob>)))
        ));
    }
}

/**
 * ABP validates its anti-forgery token whenever the browser sends cookies (for example when the built app is
 * served from the same host as the API). Send the XSRF-TOKEN cookie value back as the header in that case.
 */
function withXsrf(headers: HttpHeaders): HttpHeaders {
    const af = (globalThis as any).abp?.security?.antiForgery;
    const token = af?.getToken?.();
    return token ? headers.set(af.tokenHeaderName || 'X-XSRF-TOKEN', token) : headers;
}

function jsonAccept(): HttpHeaders {
    return new HttpHeaders({ Accept: 'application/json' });
}

function read<T>(response: HttpResponse<Blob>): Observable<T> {
    const blob = response.body;
    if (!blob) {
        return from(Promise.resolve(null as T));
    }
    return from(blob.text().then((text) => (text ? (JSON.parse(text) as T) : (null as T))));
}

function toParams(params?: Record<string, unknown>): HttpParams {
    let p = new HttpParams();
    if (!params) {
        return p;
    }
    for (const key of Object.keys(params)) {
        const value = params[key];
        if (value === undefined || value === null || value === '') {
            continue;
        }
        if (Array.isArray(value)) {
            value.forEach((v) => (p = p.append(key, String(v))));
        } else {
            p = p.set(key, String(value));
        }
    }
    return p;
}
