import { Component, HostListener, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffichageComponent } from '../affichage/affichage.component';
import { Choix4Component } from '../choix4/choix4.component';

@Component({
  selector: 'app-screen-saver1',
  standalone: true,
  imports: [CommonModule, AffichageComponent, Choix4Component],
  template: `
    <div class="screen-saver-container">

      <!-- Choix6 : visible quand l'utilisateur est actif -->
      <div *ngIf="showChoix6" class="fullscreen-component">
        <app-choix4></app-choix4>
      </div>

      <!-- Alerte : visible pendant le compte à rebours -->
      <div *ngIf="showAlert && !showChoix6 && !showAffichage" class="fullscreen-component alert-overlay">
        <div class="alert-card">

          <!-- Triangle + ! -->
          <div class="triangle-wrap">
            <svg class="triangle-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
              <polygon points="100,10 190,170 10,170" fill="#e00000" class="tri-shape"/>
              <text x="100" y="155" text-anchor="middle" font-size="110"
                    font-weight="900" fill="white" font-family="Arial Black, sans-serif">!</text>
            </svg>
          </div>

          <!-- Textes rouges style image -->
          <div class="alert-texts">
            <p class="alert-line">Alerte</p>
            <p class="alert-line">Lancer le</p>
            <p class="alert-line">temps de ligne</p>
          </div>

          <!-- Séparateur -->
          <div class="divider"></div>

          <!-- Message scanner -->
          <p class="scan-message">
            ⚡ Veuillez scanner le<br>
            <strong>ticket produit fini</strong>
          </p>

          <!-- Compte à rebours -->
          <div class="countdown-wrap">
            <div class="countdown-ring">
              <svg viewBox="0 0 120 120">
                <circle class="ring-bg"       cx="60" cy="60" r="50"/>
                <circle class="ring-progress" cx="60" cy="60" r="50"
                        [style.stroke-dashoffset]="ringOffset"/>
              </svg>
              <span class="countdown-number">{{ countdown }}</span>
            </div>
            <p class="countdown-label">secondes</p>
          </div>

        </div>
      </div>

      <!-- Affichage : visible après le compte à rebours -->
      <div *ngIf="showAffichage" class="fullscreen-component">
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
      top: 0; left: 0;
    }
    .fullscreen-component {
      width: 100%; height: 100%;
    }

    /* ── Fond alerte ── */
    .alert-overlay {
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Carte centrale ── */
    .alert-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      padding: 48px 64px;
      border: 6px solid #e00000;
      border-radius: 24px;
      box-shadow: 0 8px 48px rgba(220,0,0,0.18);
      background: #fff;
      animation: cardPop 0.4s cubic-bezier(.175,.885,.32,1.275) both;
    }

    @keyframes cardPop {
      0%   { transform: scale(0.7); opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }

    /* ── Triangle SVG ── */
    .triangle-wrap { width: 160px; }
    .triangle-svg {
      width: 100%; height: auto;
      animation: triShake 0.7s ease-in-out infinite alternate;
    }
    .tri-shape {
      filter: drop-shadow(0 4px 12px rgba(220,0,0,0.45));
    }
    @keyframes triShake {
      0%   { transform: rotate(-5deg) scale(1);    }
      100% { transform: rotate(5deg)  scale(1.05); }
    }

    /* ── Textes alerte ── */
    .alert-texts {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .alert-line {
      margin: 0;
      font-size: 52px;
      font-weight: 900;
      color: #e00000;
      font-family: 'Arial Black', 'Impact', sans-serif;
      letter-spacing: 2px;
      line-height: 1.15;
      text-transform: uppercase;
      animation: textPulse 1.2s ease-in-out infinite;
    }
    @keyframes textPulse {
      0%, 100% { opacity: 1;    }
      50%       { opacity: 0.7; }
    }

    /* ── Séparateur ── */
    .divider {
      width: 100%;
      height: 3px;
      background: #e00000;
      border-radius: 2px;
      opacity: 0.35;
    }

    /* ── Message scanner ── */
    .scan-message {
      margin: 0;
      font-size: 30px;
      font-weight: 600;
      color: #111;
      text-align: center;
      line-height: 1.6;
    }
    .scan-message strong {
      font-size: 36px;
      color: #e00000;
      font-weight: 900;
    }

    /* ── Compte à rebours ── */
    .countdown-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .countdown-ring {
      position: relative;
      width: 110px; height: 110px;
    }
    .countdown-ring svg {
      width: 110px; height: 110px;
      transform: rotate(-90deg);
    }
    .ring-bg {
      fill: none;
      stroke: #fde8e8;
      stroke-width: 10;
    }
    .ring-progress {
      fill: none;
      stroke: #e00000;
      stroke-width: 10;
      stroke-linecap: round;
      stroke-dasharray: 314;
      transition: stroke-dashoffset 1s linear;
    }
    .countdown-number {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 40px;
      font-weight: 900;
      color: #e00000;
      font-family: 'Arial Black', sans-serif;
    }
    .countdown-label {
      margin: 0;
      font-size: 16px;
      color: #999;
      letter-spacing: 1px;
    }
  `]
})
export class ScreenSaver1Component implements OnInit, OnDestroy {

  showChoix6    = true;
  showAlert     = false;
  showAffichage = false;

  countdown  = 10;
  ringOffset = 0;

  private inactivityTimer : any;
  private countdownTimer  : any;
  private readonly INACTIVITY_DELAY_MS = 5_000;  // 5s sans activité → alerte
  private readonly COUNTDOWN_SECONDS   = 10;     // 10s d'alerte → affichage

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.startInactivityTimer();
  }

  ngOnDestroy(): void {
    clearTimeout(this.inactivityTimer);
    clearInterval(this.countdownTimer);
  }

  @HostListener('window:mousemove')
  @HostListener('window:mousedown')
  @HostListener('window:keydown')
  @HostListener('window:touchstart')
  onUserActivity(): void {
    clearInterval(this.countdownTimer);
    this.showChoix6    = true;
    this.showAlert     = false;
    this.showAffichage = false;
    this.countdown     = this.COUNTDOWN_SECONDS;
    this.ringOffset    = 0;
    this.startInactivityTimer();
  }

  private startInactivityTimer(): void {
    clearTimeout(this.inactivityTimer);
    this.ngZone.runOutsideAngular(() => {
      this.inactivityTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.showChoix6    = false;
          this.showAlert     = true;
          this.showAffichage = false;
          this.startCountdown();
        });
      }, this.INACTIVITY_DELAY_MS);
    });
  }

  private startCountdown(): void {
    this.countdown  = this.COUNTDOWN_SECONDS;
    this.ringOffset = 0;
    const step = 314 / this.COUNTDOWN_SECONDS;

    this.ngZone.runOutsideAngular(() => {
      this.countdownTimer = setInterval(() => {
        this.ngZone.run(() => {
          this.countdown--;
          this.ringOffset = (this.COUNTDOWN_SECONDS - this.countdown) * step;
          if (this.countdown <= 0) {
            clearInterval(this.countdownTimer);
            this.showAlert     = false;
            this.showAffichage = true;
          }
        });
      }, 1_000);
    });
  }
}