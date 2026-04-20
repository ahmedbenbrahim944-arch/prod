// src/app/scannerpfin/scannerpfin.component.ts
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
import {
  ScannerService,
  Semaine,
  ProductionRecord,
  ScanStatus,
} from '../scanner/scanner.service';

@Component({
  selector: 'app-scannerpfin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [ScannerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scannerpfin.component.html',
  styleUrls: ['./scannerpfin.component.css'],
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
export class ScannerpfinComponent implements OnInit, OnDestroy {

  @ViewChild('prodInput') prodInputRef!: ElementRef<HTMLInputElement>;

  // ─── Semaine State ──────────────────────────────────────────────────────
  semaines: Semaine[] = [];
  selectedSemaine: Semaine | null = null;
  loadingSemaines = false;
  sidebarOpen = true;

  // ─── Production (Produit Fini) State ────────────────────────────────────
  productionRecords: ProductionRecord[] = [];
  loadingProductions = false;

  prodPanelOpen = false;
  prodQrCode = '';
  prodStatus: ScanStatus = 'idle';
  prodErrorMessage = '';
  prodLastRecord: ProductionRecord | null = null;
  prodIsSubmitting = false;

  prodParsedPreview: {
    reference: string;
    quantite: number;
    dernierePartie: string | null;
  } | null = null;
  prodParseError = '';

  // ─── Doublon ─────────────────────────────────────────────────────────────
  prodDuplicateWarning = false;

  // ─── Shared ─────────────────────────────────────────────────────────────
  readonly currentUserId = 1;
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

    const currentSemaine = this.semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      return today >= debut && today <= fin;
    });

    const toSelect = currentSemaine ?? this.semaines[0];
    this.selectedSemaine = toSelect;
    this.loadProductionsForSemaine(toSelect.id);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  selectSemaine(s: Semaine): void {
    if (this.selectedSemaine?.id === s.id) return;
    this.selectedSemaine = s;
    this.closeProdPanel();
    this.loadProductionsForSemaine(s.id);
    if (window.innerWidth < 768) this.sidebarOpen = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // ─── PRODUCTION (PRODUIT FINI) ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  loadProductionsForSemaine(semaineId: number): void {
    this.loadingProductions = true;
    this.scannerService.getRecentProductions(1, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.productionRecords = result.data;
          this.loadingProductions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingProductions = false;
          this.cdr.markForCheck();
        },
      });
  }

  openProdPanel(): void {
    this.prodPanelOpen = true;
    this.resetProd();
    setTimeout(() => this.prodInputRef?.nativeElement?.focus(), 100);
  }

  closeProdPanel(): void {
    this.prodPanelOpen = false;
    this.resetProd();
  }

  resetProd(): void {
    this.prodQrCode = '';
    this.prodStatus = 'idle';
    this.prodErrorMessage = '';
    this.prodLastRecord = null;
    this.prodParsedPreview = null;
    this.prodParseError = '';
    this.prodIsSubmitting = false;
    this.prodDuplicateWarning = false; // ← reset doublon
  }

  // ─── Helper : détection doublon par dernierePartie ───────────────────────
  private isDuplicatePart(dernierePartie: string | null): boolean {
    if (!dernierePartie) return false;
    return this.productionRecords.some(
      r => r.dernierePartie?.trim() === dernierePartie.trim()
    );
  }

  onProdInput(): void {
    const qr = this.prodQrCode.trim();
    this.prodStatus = 'idle';
    this.prodErrorMessage = '';
    this.prodDuplicateWarning = false; // reset à chaque frappe

    if (!qr) {
      this.prodParsedPreview = null;
      this.prodParseError = '';
      return;
    }

    const result = this.scannerService.parseProductionQR(qr);
    if (result.valid) {
      this.prodParsedPreview = {
        reference: result.reference!,
        quantite: result.quantite!,
        dernierePartie: result.dernierePartie ?? null,
      };
      this.prodParseError = '';

      // ─── Vérification doublon live ───────────────────────────────────────
      this.prodDuplicateWarning = this.isDuplicatePart(result.dernierePartie ?? null);

    } else {
      this.prodParsedPreview = null;
      this.prodParseError = (qr.includes('/') || qr.includes('—')) ? (result.error ?? '') : '';
    }
  }

  onProdKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!this.prodIsSubmitting && this.prodStatus !== 'success') {
        this.submitProd();
      }
    }
    if (event.key === 'Escape') {
      this.closeProdPanel();
    }
  }

  submitProd(): void {
    if (!this.selectedSemaine || this.prodIsSubmitting || this.prodStatus === 'success') return;

    const qr = this.prodQrCode.trim();

    const parseResult = this.scannerService.parseProductionQR(qr);
    if (!parseResult.valid) {
      this.prodStatus = 'error';
      this.prodErrorMessage = parseResult.error ?? 'QR code invalide';
      this.cdr.markForCheck();
      return;
    }

    // ─── Blocage doublon à la soumission ─────────────────────────────────
    if (this.isDuplicatePart(parseResult.dernierePartie ?? null)) {
      this.prodStatus = 'error';
      this.prodErrorMessage = `La partie "${parseResult.dernierePartie}" a déjà été scannée cette semaine.`;
      this.cdr.markForCheck();
      return;
    }

    this.prodIsSubmitting = true;
    this.prodStatus = 'scanning';
    this.cdr.markForCheck();

    this.scannerService.scanProduction({
      qrCode: qr,
      scanneParId: this.currentUserId,
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (record: ProductionRecord) => {
          this.prodIsSubmitting = false;
          this.prodStatus = 'success';
          this.prodLastRecord = record;
          this.loadProductionsForSemaine(this.selectedSemaine!.id);
          this.resetProd();
          this.cdr.markForCheck();
          setTimeout(() => this.prodInputRef?.nativeElement?.focus(), 50);
        },
        error: (err) => {
          this.prodIsSubmitting = false;
          this.prodStatus = 'error';
          this.prodErrorMessage = err.message ?? 'Erreur lors du scan produit fini';
          this.cdr.markForCheck();
          setTimeout(() => this.prodInputRef?.nativeElement?.focus(), 50);
        },
      });
  }

  deleteProduction(record: ProductionRecord): void {
    if (!confirm(`Supprimer l'enregistrement ${record.reference} (×${record.quantite}) ?`)) return;

    this.scannerService.deleteProduction(record.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.productionRecords = this.productionRecords.filter(r => r.id !== record.id);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Erreur suppression production', err);
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Shared Helpers ─────────────────────────────────────────────────────
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
}