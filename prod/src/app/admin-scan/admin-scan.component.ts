// src/app/admin-scan/admin-scan.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ScannerService , Semaine, ScanRecord  } from '../scanner/scanner.service';

interface Filters {
  fullnumber: string;
  reference:  string;
  ligne:      string;
  ligneChoix: '' | 'L1' | 'L2' | 'vide';
  dateDebut:  string;
  dateFin:    string;
}

@Component({
  selector: 'app-admin-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [ScannerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-scan.component.html',
  styleUrls: ['./admin-scan.component.css'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('280ms cubic-bezier(0.4,0,0.2,1)', style({ opacity: 1, transform: 'translateY(0)' })),
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
        animate('240ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class AdminScanComponent implements OnInit, OnDestroy {

  // ─── State ───────────────────────────────────────────────────────────────
  semaines: Semaine[]    = [];
  selectedSemaine: Semaine | null = null;
  scans: ScanRecord[]    = [];
  loadingSemaines        = false;
  loadingScans           = false;
  sidebarOpen            = true;

  // ─── Filtres ─────────────────────────────────────────────────────────────
  filters: Filters = {
    fullnumber: '',
    reference:  '',
    ligne:      '',
    ligneChoix: '',
    dateDebut:  '',
    dateFin:    '',
  };

  readonly REFRESH_INTERVAL = 30; // secondes
  refreshCountdown = 30;
  private refreshTimer: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private scannerService: ScannerService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit(): void { this.loadSemaines(); }
  ngOnDestroy(): void { this.stopAutoRefresh(); this.destroy$.next(); this.destroy$.complete(); }

  // ─── Semaines ─────────────────────────────────────────────────────────────
  loadSemaines(): void {
    this.loadingSemaines = true;
    this.scannerService.getSemaines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.semaines = data; this.loadingSemaines = false; this.cdr.markForCheck(); },
        error: ()    => { this.loadingSemaines = false; this.cdr.markForCheck(); },
      });
  }

  selectSemaine(s: Semaine): void {
    if (this.selectedSemaine?.id === s.id) return;
    this.selectedSemaine = s;
    this.scans = [];
    this.resetFilters();
    this.loadScans(s.id);
    this.startAutoRefresh();
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  loadScans(semaineId: number, silent = false): void {
    if (!silent) this.loadingScans = true;
    this.scannerService.getScansBySemaine(semaineId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.scans = data;
          this.loadingScans = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loadingScans = false; this.cdr.markForCheck(); },
      });
  }

  // ─── Auto-refresh toutes les 30s ─────────────────────────────────────────
  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshCountdown = this.REFRESH_INTERVAL;

    this.refreshTimer = setInterval(() => {
      this.refreshCountdown--;
      if (this.refreshCountdown <= 0) {
        this.refreshCountdown = this.REFRESH_INTERVAL;
        if (this.selectedSemaine) {
          this.loadScans(this.selectedSemaine.id, true); // silent = pas de spinner
        }
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────
  get filteredScans(): ScanRecord[] {
    return this.scans.filter(s => {

      // ── Fullnumber ──
      if (this.filters.fullnumber.trim()) {
        const fn = s.fullnumber.toLowerCase();
        if (!fn.includes(this.filters.fullnumber.trim().toLowerCase())) return false;
      }

      // ── Référence ──
      if (this.filters.reference.trim()) {
        const ref = (s.reference ?? '').toLowerCase();
        if (!ref.includes(this.filters.reference.trim().toLowerCase())) return false;
      }

      // ── Ligne ──
      if (this.filters.ligne.trim()) {
        const lg = (s.ligne ?? '').toLowerCase();
        if (!lg.includes(this.filters.ligne.trim().toLowerCase())) return false;
      }

      // ── L1 / L2 / vide ──
      if (this.filters.ligneChoix !== '') {
        if (this.filters.ligneChoix === 'vide') {
          if (s.ligneChoix !== null && s.ligneChoix !== undefined) return false;
        } else {
          if (s.ligneChoix !== this.filters.ligneChoix) return false;
        }
      }

      // ── Date début ──
      if (this.filters.dateDebut) {
        const scanDate = new Date(s.scannedAt);
        const debut    = new Date(this.filters.dateDebut);
        debut.setHours(0, 0, 0, 0);
        if (scanDate < debut) return false;
      }

      // ── Date fin ──
      if (this.filters.dateFin) {
        const scanDate = new Date(s.scannedAt);
        const fin      = new Date(this.filters.dateFin);
        fin.setHours(23, 59, 59, 999);
        if (scanDate > fin) return false;
      }

      return true;
    });
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.filters.fullnumber ||
      this.filters.reference  ||
      this.filters.ligne      ||
      this.filters.ligneChoix ||
      this.filters.dateDebut  ||
      this.filters.dateFin
    );
  }

  resetFilters(): void {
    this.filters = { fullnumber: '', reference: '', ligne: '', ligneChoix: '', dateDebut: '', dateFin: '' };
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

  trackById(_: number, item: { id: number }): number { return item.id; }
}