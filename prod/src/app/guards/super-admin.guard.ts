import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    const user = this.authService.getCurrentUser();
    const matricule = user?.nom;
    
    // ✅ Seul l'admin avec le matricule 1423 peut accéder
    if (user?.type === 'admin' && matricule === '1423') {
      console.log('✅ Accès autorisé pour super admin 1423');
      return true;
    }

    // ❌ Accès refusé
    console.log('❌ Accès refusé - réservé à l\'admin 1423');
    
    // Rediriger vers la page de login ou une page d'erreur
    if (!this.authService.isLoggedIn()) {
      return this.router.parseUrl('/login');
    }
    
    // Rediriger vers le dashboard admin standard
    return this.router.parseUrl('/prod');
  }
}