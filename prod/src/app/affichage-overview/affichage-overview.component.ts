// src/app/affichage/overview/affichage-overview.component.ts
import { Component, OnInit, OnDestroy, LOCALE_ID } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr, 'fr');

export interface LigneOverview {
  ligne: string;
  lignePrefix: string;
  totalQtePlanifiee: number;
  totalQteProduite: number;
  productivite: number;
  nbScans: number;
  delta: number;
  statut: 'success' | 'warning' | 'danger';
}

export interface OverviewData {
  date: string;
  jour: string;
  semaine: { id: number; nom: string; dateDebut: string; dateFin: string };
  global: {
    nbLignes: number;
    totalQtePlanifiee: number;
    totalQteProduite: number;
    productiviteGlobale: number;
    delta: number;
  };
  lignes: LigneOverview[];
}

@Component({
  selector: 'app-affichage-overview',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, DatePipe, DecimalPipe],
  providers: [{ provide: LOCALE_ID, useValue: 'fr' }],
  templateUrl: './affichage-overview.component.html',
  styleUrls: ['./affichage-overview.component.css'],
})
export class AffichageOverviewComponent implements OnInit, OnDestroy {
  data: OverviewData | null = null;
  loading = false;
  error: string | null = null;
  lastUpdate: Date | null = null;
  today = new Date();
  selectedDate: string = this.formatDate(new Date());

  // ── Pagination ────────────────────────────────────────────
  readonly PAGE_SIZE = 27;          // lignes max par page
  readonly AUTO_ROTATE_MS = 10000;  // 10 secondes entre pages

  currentPage = 0;
  totalPages = 1;
  autoRotate = true;
  progressPct = 0;                  // avancement barre de rotation (0-100)

  private clockInterval: any;
  private rotateInterval: any;
  private progressInterval: any;
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.clockInterval = setInterval(() => { this.today = new Date(); }, 1000);
    this.loadOverview();
  }

  ngOnDestroy(): void {
    this.clearAllIntervals();
  }

  // ── Chargement ────────────────────────────────────────────
  loadOverview(): void {
    if (!this.selectedDate) return;
    this.loading = true;
    this.error = null;
    this.currentPage = 0;
    this.stopAutoRotate();

    const token = localStorage.getItem('access_token') || '';
    this.http
      .post<OverviewData>(
        `${this.apiUrl}/affichage/overview`,
        { date: this.selectedDate },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.lastUpdate = new Date();
          this.loading = false;
          this.initPagination();
        },
        error: (err) => {
          if (err.status === 401) {
            this.error = 'Session expirée. Veuillez vous reconnecter.';
            localStorage.removeItem('access_token');
          } else if (err.status === 404) {
            this.error = err.error?.message || 'Aucune planification trouvée pour cette date.';
          } else {
            this.error = err?.error?.message || 'Erreur lors du chargement.';
          }
          this.loading = false;
        },
      });
  }

  // ── Pagination ────────────────────────────────────────────
  private initPagination(): void {
    const nb = this.data?.lignes?.length ?? 0;
    this.totalPages = Math.max(1, Math.ceil(nb / this.PAGE_SIZE));
    this.currentPage = 0;
    if (this.totalPages > 1 && this.autoRotate) {
      this.startAutoRotate();
    }
  }

  /** Slice des lignes visibles sur la page courante */
  get currentPageLines(): LigneOverview[] {
    if (!this.data) return [];
    const start = this.currentPage * this.PAGE_SIZE;
    return this.data.lignes.slice(start, start + this.PAGE_SIZE);
  }

  /** Array d'indices pour les points indicateurs */
  get pageIndices(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.progressPct = 0;
  }

  nextPage(): void {
    this.currentPage = (this.currentPage + 1) % this.totalPages;
    this.progressPct = 0;
  }

  prevPage(): void {
    this.currentPage = (this.currentPage - 1 + this.totalPages) % this.totalPages;
    this.progressPct = 0;
  }

  // ── Auto-rotation ─────────────────────────────────────────
  private startAutoRotate(): void {
    this.progressPct = 0;
    const step = 100 / (this.AUTO_ROTATE_MS / 100);
    this.progressInterval = setInterval(() => {
      this.progressPct = Math.min(100, this.progressPct + step);
    }, 100);
    this.rotateInterval = setInterval(() => {
      this.currentPage = (this.currentPage + 1) % this.totalPages;
      this.progressPct = 0;
    }, this.AUTO_ROTATE_MS);
  }

  private stopAutoRotate(): void {
    clearInterval(this.rotateInterval);
    clearInterval(this.progressInterval);
    this.rotateInterval = null;
    this.progressInterval = null;
    this.progressPct = 0;
  }

  toggleAutoRotate(): void {
    this.autoRotate = !this.autoRotate;
    if (this.autoRotate && this.totalPages > 1) {
      this.startAutoRotate();
    } else {
      this.stopAutoRotate();
    }
  }

  private clearAllIntervals(): void {
    clearInterval(this.clockInterval);
    this.stopAutoRotate();
  }

  // ── Navigation détail ─────────────────────────────────────
  goToLigne(ligne: string): void {
    this.router.navigate(['/affichage'], {
      queryParams: { ligne, date: this.selectedDate },
    });
  }

  // ── Utilitaires ───────────────────────────────────────────
  clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  trackByLigne(_i: number, item: LigneOverview): string {
    return item.ligne;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}