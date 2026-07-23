// statistique-selection.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';


export interface StatGlobal {
  startDate: string;
  endDate: string;
  totalPlannings: number;
  totalOuvriers: number;
  totalReferences: number;
  totalQteSelection: number;
  totalQteASelectionne: number;
  totalHeures: number;
  rendementMoyen: number;
}

export interface StatOuvrier {
  matricule: number;
  nomPrenom: string;
  totalPlannings: number;
  totalQteSelection: number;
  totalQteASelectionne: number;
  totalHeures: number;
  rendementMoyen: number;
}

export interface StatJour {
  date: string;
  totalOuvriers: number;
  totalPlannings: number;
  totalQteSelection: number;
  totalQteASelectionne: number;
  totalHeures: number;
  rendementMoyen: number;
}

export interface StatReference {
  reference: string;
  ligneRef: string;
  typeReference: string;
  totalOuvriers: number;
  totalPlannings: number;
  totalQteSelection: number;
  totalQteASelectionne: number;
  totalHeures: number;
  rendementMoyen: number;
}

export interface StatsResponse {
  startDate: string;
  endDate: string;
  totalPlannings: number;
  global: StatGlobal | null;
  parOuvrier: StatOuvrier[];
  parJour: StatJour[];
  parReference: StatReference[];
}

@Component({
  selector: 'app-statistique-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statistique-selection.component.html',
  styleUrls: ['./statistique-selection.component.css'],
})
export class StatistiqueSelectionComponent {
  startDate: string = '';
  endDate: string = '';
  loading = false;
  erreur = '';
  stats: StatsResponse | null = null;

  private apiUrl = `http://102.207.250.53:3000/planning-selection`;

  constructor(private http: HttpClient) {}

  chargerStats(): void {
    if (!this.startDate || !this.endDate) return;

    this.loading = true;
    this.erreur = '';
    this.stats = null;

    const params = new HttpParams()
      .set('startDate', this.startDate)
      .set('endDate', this.endDate);

    this.http.get<StatsResponse>(`${this.apiUrl}/stats/periode`, { params }).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        this.erreur = err?.error?.message || 'Erreur lors du chargement des statistiques.';
        this.loading = false;
      },
    });
  }

  reinitialiser(): void {
    this.stats = null;
    this.startDate = '';
    this.endDate = '';
    this.erreur = '';
  }

  getRendementClass(rendement: number): string {
    if (rendement >= 90) return 'rendement-green';
    if (rendement >= 70) return 'rendement-yellow';
    return 'rendement-red';
  }

  getBadgeClass(rendement: number): string {
    if (rendement >= 90) return 'badge-green';
    if (rendement >= 70) return 'badge-yellow';
    return 'badge-red';
  }
}

