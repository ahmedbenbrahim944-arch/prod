// src/app/pointage/pointage.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PointageService } from './pointage.service';

export interface NumpadButton {
  value: string;
  type: 'number' | 'delete' | 'confirm';
}

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pointage.component.html',
  styleUrls: ['./pointage.component.css'],
})
export class PointageComponent implements OnInit, OnDestroy {

  /* ─────────────────────────────────────────
     ÉTAT PRINCIPAL
  ───────────────────────────────────────── */
  matricule: string = '';
  readonly MAX_DIGITS = 8;

  hasError: boolean = false;
  errorMessage: string = '';

  isLoading: boolean = false;

  /* ─────────────────────────────────────────
     RFID
  ───────────────────────────────────────── */
  rfidScanning: boolean = false;
  rfidSuccess: boolean = false;
  rfidLabel: string = 'PASSER VOTRE CARTE';

  private rfidBuffer: string = '';
  private rfidTimeout: ReturnType<typeof setTimeout> | null = null;

  /** true si la soumission provient du lecteur RFID, false si clavier manuel */
  private isRfidInput: boolean = false;

  /* ─────────────────────────────────────────
     HORLOGE
  ───────────────────────────────────────── */
  currentTime: string = '';
  currentDate: string = '';
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  /* ─────────────────────────────────────────
     FEEDBACK
  ───────────────────────────────────────── */
  showFeedback: boolean = false;
  feedbackType: 'success' | 'error' = 'success';
  feedbackName: string = '';
  feedbackLigne: string = '';
  feedbackMessage: string = '';
  feedbackTime: string = '';
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  /* ─────────────────────────────────────────
     CLAVIER NUMÉRIQUE
  ───────────────────────────────────────── */
  readonly numpadButtons: NumpadButton[] = [
    { value: '1', type: 'number' },
    { value: '2', type: 'number' },
    { value: '3', type: 'number' },
    { value: '4', type: 'number' },
    { value: '5', type: 'number' },
    { value: '6', type: 'number' },
    { value: '7', type: 'number' },
    { value: '8', type: 'number' },
    { value: '9', type: 'number' },
    { value: '⌫', type: 'delete' },
    { value: '0', type: 'number' },
    { value: '✓', type: 'confirm' },
  ];

  constructor(private pointageService: PointageService) {}

  /* ─────────────────────────────────────────
     LIFECYCLE
  ───────────────────────────────────────── */
  ngOnInit(): void {
    this.startClock();
  }

  ngOnDestroy(): void {
    if (this.clockInterval)   clearInterval(this.clockInterval);
    if (this.rfidTimeout)     clearTimeout(this.rfidTimeout);
    if (this.feedbackTimeout) clearTimeout(this.feedbackTimeout);
  }

  /* ─────────────────────────────────────────
     HORLOGE
  ───────────────────────────────────────── */
  private startClock(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    this.currentDate = now
      .toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
      .toUpperCase();
  }

  /* ─────────────────────────────────────────
     AFFICHAGE DES CASES
  ───────────────────────────────────────── */
  get displayDigits(): string[] {
    const digits = this.matricule.split('');
    while (digits.length < this.MAX_DIGITS) digits.push('');
    return digits;
  }

  /* ─────────────────────────────────────────
     CLAVIER NUMÉRIQUE
  ───────────────────────────────────────── */
  onKeyPress(btn: NumpadButton): void {
    if (this.isLoading) return;
    this.clearError();
    switch (btn.type) {
      case 'number':
        if (this.matricule.length < this.MAX_DIGITS) {
          this.matricule += btn.value;
        }
        break;
      case 'delete':
        this.matricule = this.matricule.slice(0, -1);
        break;
      case 'confirm':
        this.isRfidInput = false;  // saisie manuelle
        this.submit();
        break;
    }
  }

  /* ─────────────────────────────────────────
     CLAVIER PHYSIQUE (touches + RFID USB HID)
  ───────────────────────────────────────── */
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (this.isLoading) return;
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      this.handleRfidOrManual(key);
      event.preventDefault();
    } else if (key === 'Enter') {
      if (this.rfidBuffer.length >= 4) {
        // Lecteur RFID → extraire les 4 derniers chiffres
        this.matricule = String(parseInt(this.rfidBuffer.slice(-4), 10));        this.rfidBuffer = '';
        if (this.rfidTimeout) clearTimeout(this.rfidTimeout);
        this.isRfidInput = true;
        this.onRfidComplete();
      } else {
        this.isRfidInput = false;  // saisie manuelle
        this.submit();
      }
      event.preventDefault();
    } else if (key === 'Backspace') {
      this.matricule = this.matricule.slice(0, -1);
      event.preventDefault();
    }
  }

  /**
   * Distingue saisie RFID (rapide < 80 ms/char) de saisie humaine (lente).
   */
  private handleRfidOrManual(digit: string): void {
    this.rfidBuffer += digit;
    this.rfidScanning = true;
    this.rfidLabel = 'LECTURE EN COURS...';

    if (this.rfidTimeout) clearTimeout(this.rfidTimeout);

    this.rfidTimeout = setTimeout(() => {
      // Timeout dépassé → saisie humaine, on prend le dernier chiffre saisi
      if (this.rfidBuffer.length <= 2) {
        if (this.matricule.length < this.MAX_DIGITS) {
          this.matricule += this.rfidBuffer.slice(-1);
        }
      }
      this.rfidBuffer = '';
      this.rfidScanning = false;
      this.rfidLabel = 'PASSER VOTRE CARTE';
    }, 80);
  }

  /* ─────────────────────────────────────────
     RFID
  ───────────────────────────────────────── */
  onRfidClick(): void {
    this.simulateRfidScan();
  }

  private simulateRfidScan(): void {
    // Format réel RFID: préfixe fixe + 4 chiffres = n_badget
    const rfidRaw = '0067601152';
    const badgeExtrait = String(parseInt(rfidRaw.slice(-4), 10)); // → "1152"

    this.matricule = '';
    let i = 0;
    this.rfidScanning = true;
    this.rfidLabel = 'LECTURE EN COURS...';
    this.isRfidInput = true;

    const interval = setInterval(() => {
      if (i < badgeExtrait.length) {
        this.matricule += badgeExtrait[i++];
      } else {
        clearInterval(interval);
        this.onRfidComplete();
      }
    }, 60);
  }

  private onRfidComplete(): void {
    this.rfidSuccess = true;
    this.rfidScanning = false;
    this.rfidLabel = 'CARTE DÉTECTÉE ✓';

    setTimeout(() => {
      this.rfidSuccess = false;
      this.rfidLabel = 'PASSER VOTRE CARTE';
      this.submit();
    }, 500);
  }

  /* ─────────────────────────────────────────
     VALIDATION & SOUMISSION
  ───────────────────────────────────────── */
  private submit(): void {
    if (!this.matricule) {
      this.showError('Veuillez saisir votre matricule');
      return;
    }
    if (this.matricule.length < 3) {
  this.showError('Minimum 3 chiffres requis');
  return;
}

    this.isLoading = true;
    this.clearError();

    const appel$ = this.isRfidInput
      ? this.pointageService.pointerParBadge(this.matricule)    // RFID → n_badget
      : this.pointageService.pointerParMatricule(this.matricule); // Clavier → matricule

    appel$.subscribe({
      next: (res) => {
        this.isLoading = false;
        this.onSuccess(res.nomPrenom, res.ligne, res.message);
      },
      error: (err: Error) => {
        this.isLoading = false;
        if (err.message === 'MATRICULE_NOT_FOUND') {
          this.onNotFound();
        } else {
          this.showError(err.message ?? 'Erreur serveur, réessayez');
        }
      },
    });
  }

  /* ─────────────────────────────────────────
     SUCCÈS / INTROUVABLE
  ───────────────────────────────────────── */
  private onSuccess(name: string, ligne: string, message: string): void {
    this.feedbackType = 'success';
    this.feedbackName = name;
    this.feedbackLigne = ligne;
    this.feedbackMessage = message.toUpperCase();
    this.feedbackTime = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    this.showFeedback = true;
    this.matricule = '';
    this.scheduleFeedbackClose(3000);
  }

  private onNotFound(): void {
    this.feedbackType = 'error';
    this.feedbackName = `N° ${this.matricule}`;
    this.feedbackLigne = '';
    this.feedbackMessage = 'MATRICULE / BADGE NON RECONNU';
    this.feedbackTime = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    this.showFeedback = true;
    this.matricule = '';
    this.scheduleFeedbackClose(2500);
  }

  private scheduleFeedbackClose(delay: number): void {
    if (this.feedbackTimeout) clearTimeout(this.feedbackTimeout);
    this.feedbackTimeout = setTimeout(() => {
      this.showFeedback = false;
    }, delay);
  }

  /* ─────────────────────────────────────────
     UTILITAIRES
  ───────────────────────────────────────── */
  private showError(msg: string): void {
    this.hasError = true;
    this.errorMessage = msg;
  }

  private clearError(): void {
    this.hasError = false;
    this.errorMessage = '';
  }
}