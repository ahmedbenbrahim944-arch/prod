import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix2',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix2.component.html',
  styleUrls: ['./choix2.component.css']
})
export class Choix2Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    console.log('Déconnexion et retour au login...');
    this.authService.logout();
  }
}