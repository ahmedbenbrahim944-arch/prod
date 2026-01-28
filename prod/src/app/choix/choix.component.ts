import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service'; // Importez AuthService

@Component({
  selector: 'app-choix',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix.component.html',
  styleUrls: ['./choix.component.css']
})
export class ChoixComponent {
  // Injection du AuthService
  constructor(private authService: AuthService) {}

  // Méthode pour le bouton Retour au Login
  retourLogin() {
    console.log('Déconnexion et retour au login...');
    
    // Utilisez la méthode logout() du AuthService
    // Cette méthode va:
    // 1. Supprimer le token du localStorage
    // 2. Supprimer les données utilisateur
    // 3. Rediriger vers /login
    this.authService.logout();
  }
}