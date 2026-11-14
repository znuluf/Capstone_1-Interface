// Hand-maintained proxies for the framework endpoints the shell needs (sign-in, session, farm lookup).
// FPMS feature endpoints are called through FpmsApiService (shared/fpms/api.service.ts).
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

function readBody<T>(response: HttpResponse<Blob>): Observable<T> {
    const blob = response.body;
    if (!blob) {
        return from(Promise.resolve(null as T));
    }
    return from(blob.text().then((text) => (text ? (JSON.parse(text) as T) : (null as T))));
}

abstract class ProxyBase {
    protected baseUrl: string;

    constructor(
        protected http: HttpClient,
        baseUrl?: string
    ) {
        this.baseUrl = baseUrl ?? '';
    }

    protected post<T>(path: string, body: unknown): Observable<T> {
        return this.http
            .post(this.baseUrl + path, JSON.stringify(body ?? {}), {
                observe: 'response',
                responseType: 'blob',
                headers: new HttpHeaders({ 'Content-Type': 'application/json-patch+json', Accept: 'text/plain' }),
            })
            .pipe(mergeMap((r) => readBody<T>(r)));
    }

    protected get<T>(path: string): Observable<T> {
        return this.http
            .get(this.baseUrl + path, { observe: 'response', responseType: 'blob', headers: new HttpHeaders({ Accept: 'text/plain' }) })
            .pipe(mergeMap((r) => readBody<T>(r)));
    }
}

// ---------------------------------------------------------------- models

export class AuthenticateModel {
    userNameOrEmailAddress: string;
    password: string;
    rememberClient: boolean;
}

export class AuthenticateResultModel {
    accessToken: string;
    encryptedAccessToken: string;
    expireInSeconds: number;
    userId: number;
    shouldChangePassword: boolean;
}

export class ApplicationInfoDto {
    version: string;
    releaseDate: string;
    features: { [key: string]: boolean };
}

export class UserLoginInfoDto {
    id: number;
    name: string;
    surname: string;
    userName: string;
    emailAddress: string;
    shouldChangePasswordOnNextLogin: boolean;
    roleName: string;
    roleDisplayName: string;
}

export class TenantLoginInfoDto {
    id: number;
    tenancyName: string;
    name: string;
    farmName: string;
    timeZone: string;
    /** 1 = Month first, 2 = Day first. */
    dateOrder: number;
    use24HourTime: boolean;
    /** The farm grades harvests by size (DEC-100); grades are left out of the screens when false. */
    usesSizeGrading: boolean;
}

export class GetCurrentLoginInformationsOutput {
    application: ApplicationInfoDto;
    user: UserLoginInfoDto;
    tenant: TenantLoginInfoDto;
}

export enum TenantAvailabilityState {
    _1 = 1, // Available
    _2 = 2, // InActive
    _3 = 3, // NotFound
}

export class IsTenantAvailableInput {
    tenancyName: string;
}

export class IsTenantAvailableOutput {
    state: TenantAvailabilityState;
    tenantId: number | undefined;
    /** The farm's current code when the one typed is an old code the farm has changed. */
    replacedByFarmCode: string | undefined;
}

// ---------------------------------------------------------------- proxies

@Injectable()
export class TokenAuthServiceProxy extends ProxyBase {
    constructor(@Inject(HttpClient) http: HttpClient, @Optional() @Inject(API_BASE_URL) baseUrl?: string) {
        super(http, baseUrl);
    }

    authenticate(model: AuthenticateModel): Observable<AuthenticateResultModel> {
        return this.post<AuthenticateResultModel>('/api/TokenAuth/Authenticate', model);
    }
}

@Injectable()
export class SessionServiceProxy extends ProxyBase {
    constructor(@Inject(HttpClient) http: HttpClient, @Optional() @Inject(API_BASE_URL) baseUrl?: string) {
        super(http, baseUrl);
    }

    getCurrentLoginInformations(): Observable<GetCurrentLoginInformationsOutput> {
        return this.get<GetCurrentLoginInformationsOutput>('/api/services/app/Session/GetCurrentLoginInformations');
    }
}

@Injectable()
export class AccountServiceProxy extends ProxyBase {
    constructor(@Inject(HttpClient) http: HttpClient, @Optional() @Inject(API_BASE_URL) baseUrl?: string) {
        super(http, baseUrl);
    }

    isTenantAvailable(input: IsTenantAvailableInput): Observable<IsTenantAvailableOutput> {
        return this.post<IsTenantAvailableOutput>('/api/services/app/Account/IsTenantAvailable', input);
    }
}
