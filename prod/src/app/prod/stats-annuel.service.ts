// src/app/prod/stats-annuel.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaces pour typer les données
export interface StatsMoisLigne {
  pcsProd: number;
  totalQteSource: number;
  totalDecProduction: number;
}

export interface StatsLigneAnnuelle {
  ligne: string;
  mois: Record<string, StatsMoisLigne>;
  moyenneAnnuelle: number;
  totalAnnuelQteSource: number;
  totalAnnuelDecProduction: number;
}

export interface StatsAnnuellesResponse {
  message: string;
  annee: number;
  dateCalcul: string;
  nombreLignes: number;
  productiviteMensuelle: Record<string, number>;
  moyenneAnnuelleGlobale: number;
  lignes: StatsLigneAnnuelle[];
}

@Injectable({
  providedIn: 'root'
})
export class StatsAnnuelService {
  private http = inject(HttpClient);
  // ✅ URL CORRIGÉE : Sans environment.apiUrl pour éviter le double http://
  private apiUrl = 'http://102.207.250.53:3000/stats';

  /**
   * Récupérer les statistiques PCS par mois pour toutes les lignes
   * @param date - Date au format 'YYYY-MM-DD' (ex: '2026-01-15')
   */
  getStatsPcsParMois(date: string): Observable<StatsAnnuellesResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    console.log('🔍 Appel API Stats Annuelles:', `${this.apiUrl}/pcs-par-mois`, { date });

    return this.http.post<StatsAnnuellesResponse>(
      `${this.apiUrl}/pcs-par-mois`,
      { date },
      { headers }
    );
  }

  /**
   * Version GET avec query param (alternative)
   */
  getStatsPcsParMoisQuery(date: string): Observable<StatsAnnuellesResponse> {
    return this.http.get<StatsAnnuellesResponse>(
      `${this.apiUrl}/pcs-par-mois`,
      { params: { date } }
    );
  }
}