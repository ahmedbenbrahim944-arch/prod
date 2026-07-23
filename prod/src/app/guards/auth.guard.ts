// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../login/auth.service';

/**
 * Guard pour protéger les routes qui nécessitent une authentification
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Rediriger vers la page de login si non authentifié
  router.navigate(['/login']);
  return false;
};

/**
 * Guard pour les routes réservées aux admins
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  // Rediriger si pas admin
  if (authService.isLoggedIn()) {
    router.navigate(['/choix']); // Rediriger vers la page user
  } else {
    router.navigate(['/login']);
  }
  return false;
};

/**
 * Guard pour les routes réservées aux users (chefs secteur)
 */
export const userGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isUser()) {
    return true;
  }

  // Rediriger si pas user
  if (authService.isLoggedIn()) {
    router.navigate(['/prod']); // Rediriger vers la page admin
  } else {
    router.navigate(['/login']);
  }
  return false;
};