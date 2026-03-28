// src/app/scanner/scanner.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ScannerService , Semaine, ScanRecord, ScanStatus} from './scanner.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [ScannerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('280ms cubic-bezier(0.4,0,0.2,1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(-6px)' })),
      ]),
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.90)' }),
        animate('320ms cubic-bezier(0.34,1.56,0.64,1)', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
    trigger('listStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(-12px)' }),
          stagger(35, animate('220ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))),
        ], { optional: true }),
      ]),
    ]),
    trigger('rowEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(16px)' }),
        animate('260ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class ScannerComponent implements OnInit, OnDestroy {

  @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

  // ─── State ───────────────────────────────────────────────────────────────
  semaines: Semaine[] = [];
  selectedSemaine: Semaine | null = null;
  scans: ScanRecord[] = [];

  loadingSemaines = false;
  loadingScans    = false;
  sidebarOpen     = true;  // desktop default open

  // Scan panel
  scanPanelOpen = false;
  fullnumber    = '';
  scanStatus: ScanStatus = 'idle';
  scanErrorMessage = '';
  lastScanRecord: ScanRecord | null = null;

  // Choix L1 / L2 / null avant chaque scan
  ligneChoix: 'L1' | 'L2' | null = null;
  isSubmitting = false;

  // Parsed preview (live)
  parsedPreview: {
    annee: string; semaine: string; compteur: string;
    codeProduit: string; fournisseur: string; indice: string;
  } | null = null;
  parseError = '';

  // Current user id (adapt to your auth service)
  readonly currentUserId = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private scannerService: ScannerService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSemaines();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Semaines ─────────────────────────────────────────────────────────────
  loadSemaines(): void {
    this.loadingSemaines = true;
    this.scannerService.getSemaines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.semaines = data;
          this.loadingSemaines = false;
          // ✅ AUTO-SELECT : sélectionne la semaine correspondant à la date du jour
          this.autoSelectCurrentSemaine();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingSemaines = false;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Sélectionne automatiquement la semaine
   * dont la plage de dates contient la date du jour.
   * Si aucune semaine ne correspond, sélectionne la première de la liste.
   */
  private autoSelectCurrentSemaine(): void {
    if (!this.semaines.length) return;

    const today = new Date();
    // Normaliser à minuit pour éviter les problèmes d'heure
    today.setHours(0, 0, 0, 0);

    const currentSemaine = this.semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin   = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      return today >= debut && today <= fin;
    });

    // Utilise la semaine trouvée, sinon repli sur la première de la liste
    const toSelect = currentSemaine ?? this.semaines[0];
    // ✅ Sélection auto : on force autoOpenPanel = true
    this.selectedSemaine = toSelect;
    this.scans = [];
    this.loadScans(toSelect.id, true);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  selectSemaine(s: Semaine): void {
    if (this.selectedSemaine?.id === s.id) return;
    this.selectedSemaine = s;
    this.scans = [];
    this.closeScanPanel();
    this.loadScans(s.id); // false par défaut = pas d'auto-open
    // Close sidebar on mobile
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  loadScans(semaineId: number, autoOpenPanel = false): void {
    this.loadingScans = true;
    this.scannerService.getScansBySemaine(semaineId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.scans = data;
          this.loadingScans = false;
          // ✅ AUTO-OPEN : ouvre le panel et focus l'input automatiquement
          // uniquement au premier chargement (sélection auto de la semaine courante)
          if (autoOpenPanel) {
            this.scanPanelOpen = true;
            setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 150);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingScans = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Scan Panel ───────────────────────────────────────────────────────────
  openScanPanel(): void {
    this.scanPanelOpen = true;
    this.resetScan();
    // ✅ AUTO-FOCUS : le cursor se place automatiquement dans l'input dès l'ouverture
    // Le setTimeout est nécessaire pour laisser Angular rendre le DOM d'abord
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 100);
  }

  closeScanPanel(): void {
    this.ligneChoix   = null;  // reset L1/L2 seulement à la fermeture du panel
    this.scanPanelOpen = false;
    this.resetScan();
  }

  resetScan(): void {
    this.fullnumber       = '';
    this.scanStatus       = 'idle';
    this.scanErrorMessage = '';
    this.lastScanRecord   = null;
    this.parsedPreview    = null;
    this.parseError       = '';
    this.isSubmitting     = false;
    // ⚠️ ligneChoix intentionnellement NON réinitialisé :
    // le choix L1/L2 reste fixé pour tous les scans suivants.
    // L'user doit changer manuellement via les boutons.
  }

  // Réinitialisation complète (fermeture du panel)
  closeScanPanelFull(): void {
    this.ligneChoix = null;
    this.resetScan();
    this.scanPanelOpen = false;
  }

  // ─── Live parsing while typing ───────────────────────────────────────────
  onFullnumberInput(): void {
    const fn = this.fullnumber.trim().toUpperCase();
    this.fullnumber = fn;
    this.scanStatus = 'idle';
    this.scanErrorMessage = '';

    if (fn.length === 0) {
      this.parsedPreview = null;
      this.parseError = '';
      return;
    }

    const result = this.scannerService.parseFullnumber(fn);
    if (result.valid) {
      this.parsedPreview = {
        annee:       result.annee!,
        semaine:     result.semaine!,
        compteur:    result.compteur!,
        codeProduit: result.codeProduit!,
        fournisseur: result.fournisseur!,
        indice:      result.indice!,
      };
      this.parseError = '';
    } else {
      this.parsedPreview = null;
      this.parseError = fn.length < 16 ? '' : (result.error ?? '');
    }
  }

  // ─── Submit scan (called by Enter key or scan button) ────────────────────
  submitScan(): void {
    // ── Guard triple : pas de semaine, déjà en cours, déjà réussi ──
    if (!this.selectedSemaine || this.isSubmitting || this.scanStatus === 'success') return;

    const fn = this.fullnumber.trim().toUpperCase();

    // ── Vérification doublon côté frontend avant même d'appeler l'API ──
    const alreadyScanned = this.scans.find(s => s.fullnumber === fn);
    if (alreadyScanned) {
      this.scanStatus = 'duplicate';
      this.scanErrorMessage = `Ce ticket a déjà été scanné dans cette session (${alreadyScanned.fullnumber})`;
      this.cdr.markForCheck();
      // Focus pour que l'user puisse scanner le prochain immédiatement
      setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 50);
      return;
    }

    const parseResult = this.scannerService.parseFullnumber(fn);
    if (!parseResult.valid) {
      this.scanStatus = 'error';
      this.scanErrorMessage = parseResult.error ?? 'Fullnumber invalide';
      this.cdr.markForCheck();
      return;
    }

    // ── Bloquer immédiatement toute nouvelle soumission ──
    this.isSubmitting = true;
    this.scanStatus   = 'scanning';
    this.cdr.markForCheck();

    this.scannerService.submitScan({
      fullnumber:   fn,
      semaineId:    this.selectedSemaine.id,
      scanneParId:  this.currentUserId,
      ligneChoix:   this.ligneChoix,   // 'L1', 'L2', ou null
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (record: ScanRecord) => {
          this.isSubmitting   = false;
          this.scanStatus     = 'success';
          this.lastScanRecord = record;
          this.scans = [record, ...this.scans];
          // ✅ 0ms : reset immédiat, prêt pour le scan suivant sans attente
          this.resetScan();
          this.cdr.markForCheck();
          setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 50);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err.status === 409) {
            this.scanStatus = 'duplicate';
            this.scanErrorMessage = err.message;
          } else {
            this.scanStatus = 'error';
            this.scanErrorMessage = err.message ?? 'Erreur lors du scan';
          }
          this.cdr.markForCheck();
          // Focus sur l'input même après erreur pour permettre correction immédiate
          setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 50);
        },
      });
  }

  // ─── Keyboard : Enter submits scan ───────────────────────────────────────
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Ne pas soumettre si déjà en cours ou succès
      if (!this.isSubmitting && this.scanStatus !== 'success') {
        this.submitScan();
      }
    }
    if (event.key === 'Escape') {
      this.closeScanPanel();
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }
}