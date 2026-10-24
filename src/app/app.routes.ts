import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

@Component({
  standalone: true,
  template: '',
})
class DashboardRouteComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DashboardRouteComponent, canActivate: [authGuard] },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login/login').then((module) => module.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/auth/register/register').then((module) => module.RegisterComponent),
    canActivate: [guestGuard],
  },
  { path: '**', redirectTo: '' },
];
