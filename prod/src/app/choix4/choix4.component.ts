import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-choix4',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './choix4.component.html',
  styleUrls: ['./choix4.component.css']
})
export class Choix4Component {
  constructor(private authService: AuthService) {}

  retourLogin() {
    this.authService.logout();
  }
}