import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const isBackendRequest = request.url.startsWith('/backend/');
  const isAuthRequest = /\/api\/auth\/(login|register)$/.test(request.url);
  const authorization = inject(AuthService).getAuthorizationHeader();

  if (!isBackendRequest || isAuthRequest || !authorization) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: authorization } }));
};
