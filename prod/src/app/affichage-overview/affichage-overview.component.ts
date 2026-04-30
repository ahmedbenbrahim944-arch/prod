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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Interface Détail ligne (réponse /affichage)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface AffichageData {
  date: string;
  jour: string;
  semaine: { nom: string; dateDebut: string; dateFin: string };
  ligne: string;
  kpis: {
    productivite: string;
    productiviteValeur: number;
    nbOuvriers: number;
    totalQtePlanifiee: number;
    totalQteProduite: number;
    delta: number;
  };
  planification: {
    nbReferences: number;
    references: Array<{
      reference: string;
      of: string;
      qteSource: number;
      emballage: string;
      nbOperateurs: number;
    }>;
  };
  ouvriers: {
    total: number;
    capitaine: { matricule: number; nomPrenom: string } | null;
    liste: Array<{ matricule: number; nomPrenom: string; estCapitaine: boolean }>;
  };
  production: {
    nbScans: number;
    enregistrements: Array<{
      id: number;
      reference: string;
      quantite: number;
      dateScan: string;
    }>;
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  /** Date sélectionnée (format YYYY-MM-DD) */
  selectedDate: string = this.formatDate(new Date());

  /** Données détaillées par ligne  { 'L24:RXT2': AffichageData, ... } */
  lineDataMap: { [ligne: string]: AffichageData } = {};

  /** État de chargement par ligne */
  lineLoadingMap: { [ligne: string]: boolean } = {};

  /** Compteur théorique par ligne (recalculé chaque seconde) */
  theoriquePiecesMap: { [ligne: string]: number } = {};

  private clockInterval: any;
  private autoRefreshInterval: any;          // â† NOUVEAU : Interval d'auto-refresh
  private readonly REFRESH_INTERVAL_MS = 5000; // â† 5 secondes
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient, private router: Router) {}

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ngOnInit(): void {
    // Horloge + recalcul théorique chaque seconde
    this.clockInterval = setInterval(() => {
      this.today = new Date();
      for (const ligne of Object.keys(this.lineDataMap)) {
        this.theoriquePiecesMap[ligne] = this.calculateTheorique(this.lineDataMap[ligne]);
      }
    }, 1000);

    // Auto-refresh des données toutes les 5 secondes
    this.startAutoRefresh();

    // Chargement initial
    this.loadOverview();
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.stopAutoRefresh();                  // â† Nettoyer l'interval d'auto-refresh
  }

  // â”€â”€ Auto-Refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Démarre le rafraîchissement automatique toutes les 5 secondes
   */
  private startAutoRefresh(): void {
    this.autoRefreshInterval = setInterval(() => {
      // Ne pas rafraîchir si un chargement est déjÃ  en cours
      if (!this.loading) {
        console.log('ðŸ”„ Auto-refresh des données...');
        this.loadOverview();
      } else {
        console.log('â³ Auto-refresh ignoré (chargement en cours)');
      }
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * Arrête le rafraîchissement automatique
   */
  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  /**
   * Force un rafraîchissement manuel (appelé par le bouton)
   */
  manualRefresh(): void {
    console.log('ðŸ”„ Rafraîchissement manuel...');
    this.loadOverview();
  }

  // â”€â”€ Chargement vue globale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  loadOverview(): void {
    if (!this.selectedDate) return;

    this.loading = true;
    this.error = null;
    // Réinitialiser les détails précédents
    this.lineDataMap = {};
    this.lineLoadingMap = {};
    this.theoriquePiecesMap = {};

    const token = localStorage.getItem('access_token') || '';

    this.http
      .post<OverviewData>(
        `${this.apiUrl}/affichage/overview`,
        { date: this.selectedDate },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.lastUpdate = new Date();
          this.loading = false;
          // Charger le détail pour toutes les lignes actives
          this.loadLineDetails();
        },
        error: (err) => {
          console.error('Erreur overview:', err);
          if (err.status === 401) {
            this.error = 'Session expirée. Veuillez vous reconnecter.';
            localStorage.removeItem('access_token');
          } else if (err.status === 404) {
            this.error =
              err.error?.message || 'Aucune planification trouvée pour cette date.';
          } else {
            this.error =
              err?.error?.message || 'Erreur lors du chargement des données.';
          }
          this.loading = false;
        },
      });
  }

  // â”€â”€ Chargement détail pour chaque ligne active â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  loadLineDetails(): void {
    if (!this.data) return;

    const activeLignes = this.data.lignes.filter((l) => l.productivite > 0);
    const token = localStorage.getItem('access_token') || '';

    for (const ligne of activeLignes) {
      this.lineLoadingMap[ligne.ligne] = true;

      this.http
        .post<AffichageData>(
          `${this.apiUrl}/affichage`,
          { date: this.selectedDate, ligne: ligne.ligne },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        )
        .subscribe({
          next: (res) => {
            this.lineDataMap[ligne.ligne] = res;
            this.theoriquePiecesMap[ligne.ligne] = this.calculateTheorique(res);
            this.lineLoadingMap[ligne.ligne] = false;
          },
          error: (err) => {
            console.error(`Erreur chargement détail ligne ${ligne.ligne}:`, err);
            this.lineLoadingMap[ligne.ligne] = false;
          },
        });
    }
  }

  // â”€â”€ Getter : lignes actives uniquement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  get activeLignes(): LigneOverview[] {
  // Afficher UNIQUEMENT les lignes avec productivité > 0 (en production)
  return this.data?.lignes.filter((l) => l.productivite > 0) ?? [];
}

  // â”€â”€ Calcul pièces théoriques â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  calculateTheorique(data: AffichageData): number {
    const objective = data?.kpis?.totalQtePlanifiee ?? 0;
    if (objective === 0) return 0;

    const now = new Date();
    const start = new Date(now);
    start.setHours(6, 0, 0, 0);

    const totalSeconds = 8 * 3600;
    const ratePerSecond = objective / totalSeconds;
    const elapsedSeconds = Math.max(0, (now.getTime() - start.getTime()) / 1000);

    return Math.round(elapsedSeconds * ratePerSecond);
  }

  clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  trackByLigne(_index: number, item: LigneOverview): string {
    return item.ligne;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

