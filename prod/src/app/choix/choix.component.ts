import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix.component.html',
  styleUrls: ['./choix.component.css']
})
export class ChoixComponent implements OnInit { // Ajoutez "implements OnInit"
  matriculeUtilisateur: string = '';
  showSaisButton: boolean = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Utilisez getUserMatricule() qui existe déjà dans AuthService
    const matricule = this.authService.getUserMatricule();
    
    console.log('Matricule de l\'utilisateur connecté:', matricule); // Pour debug
    
    if (matricule) {
      this.matriculeUtilisateur = matricule;
      this.showSaisButton = (this.matriculeUtilisateur === '2603');
    }
    
    console.log('showSaisButton:', this.showSaisButton); // Pour debug
  }

  retourLogin() {
    console.log('Déconnexion et retour au login...');
    this.authService.logout();
  }
}