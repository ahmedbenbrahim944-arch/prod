// src/app/scanner/scanner.component.ts
import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef,
  Pipe, PipeTransform,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { ScannerService, Semaine, ScanRecord, ScanStatus } from './scanner.service';

// ─── Pipe pure : formatage date — calculé UNE SEULE FOIS par valeur ──────────
@Pipe({ name: 'frDate', standalone: true, pure: true })
export class FrDatePipe implements PipeTransform {
  private cache = new Map<string, string>();
  transform(value: string, withTime = false): string {
    if (!value) return '';
    const key = value + withTime;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const d = new Date(value);
    const result = withTime
      ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    this.cache.set(key, result);
    return result;
  }
}

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, FrDatePipe],
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
    // ✅ SUPPRIMÉ : listStagger et rowEnter sur tbody
    // Ils animaient les 900 lignes à chaque ajout = freeze UI
    // Remplacé par newRowPulse uniquement sur la 1ère ligne
    trigger('newRowPulse', [
      transition(':enter', [
        style({ opacity: 0, background: 'rgba(56,189,248,0.15)', transform: 'translateX(8px)' }),
        animate('250ms ease-out', style({ opacity: 1, background: 'transparent', transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class ScannerComponent implements OnInit, OnDestroy {

  @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

  semaines: Semaine[] = [];
  selectedSemaine: Semaine | null = null;
  scans: ScanRecord[] = [];

  // ✅ Set pour lookup doublon O(1) — pas de .find() sur 900 éléments
  private scansSet = new Set<string>();

  loadingSemaines = false;
  loadingScans    = false;
  sidebarOpen     = true;

  scanPanelOpen    = false;
  fullnumber       = '';
  scanStatus: ScanStatus = 'idle';
  scanErrorMessage = '';
  lastScanRecord: ScanRecord | null = null;

  ligneChoix: 'L1' | 'L2' | null = null;
  isSubmitting = false;

  parsedPreview: {
    annee: string; semaine: string; compteur: string;
    codeProduit: string; fournisseur: string; indice: string;
  } | null = null;
  parseError = '';

  // ✅ Id du scan le plus récent — pour animer SEULEMENT la nouvelle ligne
  newestScanId: number | null = null;

  readonly currentUserId = 1;

  private destroy$ = new Subject<void>();
  private successResetTimer: any = null;

  constructor(
    private scannerService: ScannerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadSemaines(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.successResetTimer) clearTimeout(this.successResetTimer);
  }

  // ─── Semaines ─────────────────────────────────────────────────────────────
  loadSemaines(): void {
    this.loadingSemaines = true;
    this.scannerService.getSemaines().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.semaines = data;
        this.loadingSemaines = false;
        this.autoSelectCurrentSemaine();
        this.cdr.markForCheck();
      },
      error: () => { this.loadingSemaines = false; this.cdr.markForCheck(); },
    });
  }

  private autoSelectCurrentSemaine(): void {
    if (!this.semaines.length) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const found = this.semaines.find(s => {
      const d = new Date(s.dateDebut); d.setHours(0, 0, 0, 0);
      const f = new Date(s.dateFin);   f.setHours(23, 59, 59, 999);
      return today >= d && today <= f;
    });
    const toSelect = found ?? this.semaines[0];
    this.selectedSemaine = toSelect;
    this.scans = [];
    this.loadScans(toSelect.id, true);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  selectSemaine(s: Semaine): void {
    if (this.selectedSemaine?.id === s.id) return;
    this.selectedSemaine = s;
    this.scans = [];
    this.scansSet.clear();
    this.newestScanId = null;
    this.closeScanPanel();
    this.loadScans(s.id);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  loadScans(semaineId: number, autoOpenPanel = false): void {
    this.loadingScans = true;
    this.scannerService.getScansBySemaine(semaineId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.scans = data;
        this.scansSet = new Set(data.map(s => s.fullnumber));
        this.loadingScans = false;
        if (autoOpenPanel) {
          this.scanPanelOpen = true;
          setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 150);
        }
        this.cdr.markForCheck();
      },
      error: () => { this.loadingScans = false; this.cdr.markForCheck(); },
    });
  }

  // ─── Scan Panel ───────────────────────────────────────────────────────────
  openScanPanel(): void {
    this.scanPanelOpen = true;
    this.resetScan();
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 100);
  }

  closeScanPanel(): void {
    this.ligneChoix    = null;
    this.scanPanelOpen = false;
    this.resetScan();
  }

  resetScan(): void {
    if (this.successResetTimer) { clearTimeout(this.successResetTimer); this.successResetTimer = null; }
    this.fullnumber       = '';
    this.scanStatus       = 'idle';
    this.scanErrorMessage = '';
    this.lastScanRecord   = null;
    this.parsedPreview    = null;
    this.parseError       = '';
    this.isSubmitting     = false;
  }

  // ─── Live parsing ─────────────────────────────────────────────────────────
  onFullnumberInput(): void {
    const fn = this.fullnumber.trim().toUpperCase();
    this.fullnumber = fn;
    if (fn.length === 16) { this.submitScan(); return; }
    if (fn.length > 0) {
      const r = this.scannerService.parseFullnumber(fn);
      this.parsedPreview = r.valid ? ({ ...r } as any) : null;
      this.parseError    = (!r.valid && fn.length >= 4) ? (r.error ?? '') : '';
    } else {
      this.parsedPreview = null;
      this.parseError = '';
    }
  }

  // ─── Submit — Optimistic UI ───────────────────────────────────────────────
  submitScan(): void {
    const fn = this.fullnumber.trim().toUpperCase();
    if (!this.selectedSemaine || fn.length !== 16) return;

    const parsed = this.scannerService.parseFullnumber(fn);
    if (!parsed.valid) {
      this.scanStatus = 'error';
      this.scanErrorMessage = parsed.error ?? 'Format invalide';
      this.fullnumber = '';
      this.cdr.markForCheck();
      return;
    }

    if (this.scansSet.has(fn)) {
      this.scanStatus = 'duplicate';
      this.scanErrorMessage = 'Ce ticket a déjà été scanné';
      this.fullnumber = '';
      this.focusInput();
      this.cdr.markForCheck();
      return;
    }

    const tempId = -(Date.now());
    const tempRecord: ScanRecord = {
      id: tempId, fullnumber: fn,
      annee: parsed.annee!, semaineParsed: parsed.semaine!,
      compteur: parsed.compteur!, codeProduitParsed: parsed.codeProduit!,
      fournisseur: parsed.fournisseur!, indice: parsed.indice!,
      reference: null, ligne: null,
      semaineId: this.selectedSemaine.id,
      scanneParId: this.currentUserId,
      scannedAt: new Date().toISOString(),
      ligneChoix: this.ligneChoix,
    };

    // ✅ Mise à jour UI immédiate
    this.scans       = [tempRecord, ...this.scans];
    this.scansSet.add(fn);
    this.newestScanId   = tempId;     // anime SEULEMENT cette ligne
    this.lastScanRecord = tempRecord;
    this.scanStatus     = 'success';
    this.fullnumber     = '';
    this.parsedPreview  = null;

    this.focusInput();
    this.cdr.markForCheck();

    if (this.successResetTimer) clearTimeout(this.successResetTimer);
    this.successResetTimer = setTimeout(() => {
      this.scanStatus     = 'idle';
      this.lastScanRecord = null;
      this.cdr.markForCheck();
    }, 2000);

    // HTTP en arrière-plan
    this.scannerService.submitScan({
      fullnumber: fn, semaineId: this.selectedSemaine.id,
      scanneParId: this.currentUserId, ligneChoix: this.ligneChoix,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (real) => {
        this.scans = this.scans.map(s => s.id === tempId ? real : s);
        if (this.newestScanId === tempId) this.newestScanId = real.id;
        if (this.lastScanRecord?.id === tempId) this.lastScanRecord = real;
        this.cdr.markForCheck();
      },
      error: (err) => {
        // Rollback
        this.scans = this.scans.filter(s => s.id !== tempId);
        this.scansSet.delete(fn);
        if (this.successResetTimer) { clearTimeout(this.successResetTimer); this.successResetTimer = null; }
        this.newestScanId   = null;
        this.lastScanRecord = null;
        this.scanStatus     = err.status === 409 ? 'duplicate' : 'error';
        this.scanErrorMessage = err.message ?? 'Erreur serveur';
        this.fullnumber = fn;
        this.cdr.markForCheck();
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') { event.preventDefault(); if (this.scanStatus !== 'scanning') this.submitScan(); }
    if (event.key === 'Escape') this.closeScanPanel();
  }

  private focusInput(): void {
    requestAnimationFrame(() => this.scanInputRef?.nativeElement?.focus());
  }

  // ✅ Ces méthodes restent pour compatibilité HTML existant
  // mais dans le template, remplacez par le pipe | frDate et | frDate:true
  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  trackById(_: number, item: { id: number }): number { return item.id; }
}