import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix1',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix1.component.html',
  styleUrls: ['./choix1.component.css']
})
export class Choix1Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    console.log('Déconnexion et retour au login...');
    this.authService.logout();
  }
}