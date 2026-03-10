// src/app/choix3/choix3.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix3',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix3.component.html',
  styleUrls: ['./choix3.component.css']
})
export class Choix3Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    this.authService.logout();
  }
}