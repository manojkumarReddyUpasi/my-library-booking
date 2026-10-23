import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LoginRequest } from '../models/login.model';

export interface CurrentUser {
  name: string;
  email: string;
}

const SESSION_KEY = 'library_auth_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly authUrl = 'http://localhost:8081/api/auth';
  private readonly user = signal<CurrentUser | null>(this.readUser());
  private readonly loggedIn = signal(this.user() !== null);

  readonly isLoggedIn = this.loggedIn.asReadonly();
  readonly currentUser = this.user.asReadonly();

  login(request: LoginRequest): Observable<unknown> {
    return this.http.post<unknown>(this.authUrl + '/login', request).pipe(
      tap((response) => {
        if (!this.isBrowser) return;
        const user = this.extractUser(response, request.email);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user, response }));
        this.user.set(user);
        this.loggedIn.set(true);
      }),
    );
  }

  logout(): void {
    if (this.isBrowser) localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
    this.loggedIn.set(false);
  }

  getAuthorizationHeader(): string | null {
    const token = this.readAccessToken();
    if (!token) return null;
    return /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
  }

  private readAccessToken(): string | null {
    if (!this.isBrowser) return null;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      if (!stored || typeof stored !== 'object') return null;

      const session = stored as Record<string, unknown>;
      const response = session['response'];
      const data =
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)
          : session;
      const nestedData = data['data'];
      const candidates = [
        data['token'],
        data['accessToken'],
        data['access_token'],
        data['jwt'],
        ...(nestedData && typeof nestedData === 'object'
          ? [
              (nestedData as Record<string, unknown>)['token'],
              (nestedData as Record<string, unknown>)['accessToken'],
              (nestedData as Record<string, unknown>)['access_token'],
              (nestedData as Record<string, unknown>)['jwt'],
            ]
          : []),
      ];
      return candidates.find((value): value is string => typeof value === 'string' && !!value.trim()) ?? null;
    } catch {
      return null;
    }
  }

  private extractUser(response: unknown, fallbackEmail: string): CurrentUser {
    const body = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
    const nested = (body['user'] && typeof body['user'] === 'object' ? body['user'] : {}) as Record<
      string,
      unknown
    >;
    const pick = (key: string) => [body[key], nested[key]].find((v) => typeof v === 'string' && v) as string | undefined;
    const email = pick('email') ?? fallbackEmail;
    return { name: pick('name') ?? email.split('@')[0], email };
  }

  private readUser(): CurrentUser | null {
    if (!this.isBrowser) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      if (stored?.user?.email) return stored.user as CurrentUser;
      localStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      return null;
    }
  }

  register(request: LoginRequest): Observable<unknown> {
    return this.http.post<unknown>(this.authUrl + '/register', request);
  }
}
