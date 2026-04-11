import { Component, HostListener, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffichageComponent } from '../affichage/affichage.component';
import { Choix6Component } from '../choix6/choix6.component';

@Component({
  selector: 'app-screen-saver',
  standalone: true,
  imports: [CommonModule, AffichageComponent, Choix6Component],
  template: `
    <div class="screen-saver-container">

      <!-- Choix6 : visible quand l'utilisateur est actif -->
      <div *ngIf="showChoix6" class="fullscreen-component">
        <app-choix6></app-choix6>
      </div>

      <!-- Affichage : visible après 10s d'inactivité -->
      <div *ngIf="!showChoix6" class="fullscreen-component">
        <app-affichage></app-affichage>
      </div>

    </div>
  `,
  styles: [`
    .screen-saver-container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: fixed;
      top: 0;
      left: 0;
    }
    .fullscreen-component {
      width: 100%;
      height: 100%;
    }
  `]
})
export class ScreenSaverComponent implements OnInit, OnDestroy {

  showChoix6 = true;
  private inactivityTimer: any;
  private readonly INACTIVITY_DELAY_MS = 5_000; // 10 secondes

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.startInactivityTimer();
  }

  ngOnDestroy(): void {
    clearTimeout(this.inactivityTimer);
  }

  @HostListener('window:mousemove')
  @HostListener('window:mousedown')
  @HostListener('window:keydown')
  @HostListener('window:touchstart')
  onUserActivity(): void {
    if (!this.showChoix6) {
      this.showChoix6 = true;
    }
    this.startInactivityTimer();
  }

  private startInactivityTimer(): void {
    clearTimeout(this.inactivityTimer);

    // ✅ Lancer le timer EN DEHORS d'Angular pour les performances
    this.ngZone.runOutsideAngular(() => {
      this.inactivityTimer = setTimeout(() => {

        // ✅ Mais rentrer DANS Angular pour mettre à jour le template
        this.ngZone.run(() => {
          this.showChoix6 = false;
        });

      }, this.INACTIVITY_DELAY_MS);
    });
  }
}