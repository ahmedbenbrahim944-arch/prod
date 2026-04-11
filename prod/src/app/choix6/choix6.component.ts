import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix6',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix6.component.html',
  styleUrls: ['./choix6.component.css']
})
export class Choix6Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    console.log('Déconnexion et retour au login...');
    this.authService.logout();
  }
}