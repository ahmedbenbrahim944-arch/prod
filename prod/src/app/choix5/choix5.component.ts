import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix5',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix5.component.html',
  styleUrls: ['./choix5.component.css']
})
export class Choix5Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    console.log('Déconnexion et retour au login...');
    this.authService.logout();
  }
}