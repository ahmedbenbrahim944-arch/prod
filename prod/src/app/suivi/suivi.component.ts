// src/app/suivi/suivi.component.ts
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
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import {
  ScannerService,
  Semaine,
  ProductionRecord,
} from '../scanner/scanner.service';

@Component({
  selector: 'app-suivi',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [ScannerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suivi.component.html',
  styleUrls: ['./suivi.component.css'],
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
        style({ opacity: 0, transform: 'scale(0.92)' }),
        animate('300ms cubic-bezier(0.34,1.56,0.64,1)', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
    trigger('listStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(-12px)' }),
          stagger(30, animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))),
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
export class SuiviComponent implements OnInit, OnDestroy {

  // ─── Semaine State ──────────────────────────────────────────────────────
  semaines: Semaine[] = [];
  selectedSemaine: Semaine | null = null;
  loadingSemaines = false;
  sidebarOpen = true;

  // ─── Production Records ─────────────────────────────────────────────────
  allProductionRecords: ProductionRecord[] = [];
  filteredRecords: ProductionRecord[] = [];
  loadingProductions = false;

  // ─── Filtres ────────────────────────────────────────────────────────────
  filterLigne = '';
  filterDateDebut = '';
  filterDateFin = '';
  filterDernierePartie = '';
  filterReference = '';
  filtersVisible = false;

  // ─── Options dynamiques ─────────────────────────────────────────────────
  ligneOptions: string[] = [];
  dernierePartieOptions: string[] = [];
  referenceOptions: string[] = [];

  // ─── Stats ──────────────────────────────────────────────────────────────
  get totalQuantite(): number {
    return this.filteredRecords.reduce((acc, r) => acc + (r.quantite || 0), 0);
  }

  get activeFiltersCount(): number {
    let c = 0;
    if (this.filterLigne) c++;
    if (this.filterDateDebut || this.filterDateFin) c++;
    if (this.filterDernierePartie) c++;
    if (this.filterReference) c++;
    return c;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private scannerService: ScannerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSemaines();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ════════════════════════════════════════════════════════════════════════
  // ─── SEMAINE ────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  loadSemaines(): void {
    this.loadingSemaines = true;
    this.scannerService.getSemaines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.semaines = data;
          this.loadingSemaines = false;
          this.autoSelectCurrentSemaine();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingSemaines = false;
          this.cdr.markForCheck();
        },
      });
  }

  private autoSelectCurrentSemaine(): void {
    if (!this.semaines.length) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = this.semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      return today >= debut && today <= fin;
    });
    const toSelect = current ?? this.semaines[0];
    this.selectedSemaine = toSelect;
    this.loadProductions(toSelect.id);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  selectSemaine(s: Semaine): void {
    if (this.selectedSemaine?.id === s.id) return;
    this.selectedSemaine = s;
    this.resetFilters();
    this.loadProductions(s.id);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // ─── PRODUCTIONS ────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  loadProductions(semaineId: number): void {
    this.loadingProductions = true;
    this.scannerService.getRecentProductions(1, 500)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.allProductionRecords = result.data;
          this.buildFilterOptions();
          this.applyFilters();
          this.loadingProductions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingProductions = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // ─── FILTRES ────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  private buildFilterOptions(): void {
    const lignes = new Set<string>();
    const parties = new Set<string>();
    const refs = new Set<string>();

    this.allProductionRecords.forEach(r => {
      if (r.ligne) lignes.add(r.ligne);
      if (r.dernierePartie) parties.add(r.dernierePartie);
      if (r.reference) refs.add(r.reference);
    });

    this.ligneOptions = Array.from(lignes).sort();
    this.dernierePartieOptions = Array.from(parties).sort();
    this.referenceOptions = Array.from(refs).sort();
  }

  applyFilters(): void {
    let records = [...this.allProductionRecords];

    if (this.filterLigne) {
      records = records.filter(r => r.ligne === this.filterLigne);
    }

    if (this.filterReference) {
      records = records.filter(r => r.reference === this.filterReference);
    }

    if (this.filterDateDebut) {
      const debut = new Date(this.filterDateDebut);
      debut.setHours(0, 0, 0, 0);
      records = records.filter(r => new Date(r.dateScan) >= debut);
    }

    if (this.filterDateFin) {
      const fin = new Date(this.filterDateFin);
      fin.setHours(23, 59, 59, 999);
      records = records.filter(r => new Date(r.dateScan) <= fin);
    }

    if (this.filterDernierePartie) {
      records = records.filter(r => r.dernierePartie === this.filterDernierePartie);
    }

    this.filteredRecords = records;
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.filterLigne = '';
    this.filterDateDebut = '';
    this.filterDateFin = '';
    this.filterDernierePartie = '';
    this.filterReference = '';
    this.applyFilters();
  }

  // ─── Delete ─────────────────────────────────────────────────────────────
  deleteProduction(record: ProductionRecord): void {
    if (!confirm(`Supprimer ${record.reference} (×${record.quantite}) ?`)) return;
    this.scannerService.deleteProduction(record.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.allProductionRecords = this.allProductionRecords.filter(r => r.id !== record.id);
          this.buildFilterOptions();
          this.applyFilters();
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Erreur suppression', err),
      });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  toggleFilters(): void {
    this.filtersVisible = !this.filtersVisible;
  }
}