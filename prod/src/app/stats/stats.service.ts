import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StatsPeriodeResponse {
  message: string;
  periode: {
    dateDebut: string;
    dateFin: string;
    nombreSemaines: number;
    dateCalcul: string;
  };
  productionGlobale: {
    pcsTotal: number;
    oee: null | number;
    totalQteSource: number;
    totalDecProduction: number;
    totalQtePlanifiee: number;
    nombreLignes: number;
    nombreReferences: number;
  };
  statsParLigne: Array<{
    ligne: string;
    pcs: number;
    totalQteSource: number;
    totalDecProduction: number;
    totalQtePlanifiee: number;
    nombreReferences: number;
    causes7M: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
    pourcentages7M: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
  }>;
  personnel: {
    totalOuvriers: number;
    presents: number;
    conges: number;
    absents: number;
  };
  resume7M: {
    total: number;
    pourcentageGlobal: number;
    details: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
    pourcentages: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  /**
   * Récupérer les statistiques pour une période donnée
   * @param dateDebut Date de début au format YYYY-MM-DD
   * @param dateFin Date de fin au format YYYY-MM-DD
   * @returns Observable contenant les statistiques
   */
  getStatsParPeriode(dateDebut: string, dateFin: string): Observable<StatsPeriodeResponse> {
    const params = new HttpParams()
      .set('dateDebut', dateDebut)
      .set('dateFin', dateFin);

    return this.http.get<StatsPeriodeResponse>(`${this.apiUrl}/stats/stats-periode`, { params });
  }

  /**
   * Version POST (alternative)
   */
  getStatsParPeriodePost(dateDebut: string, dateFin: string): Observable<StatsPeriodeResponse> {
    return this.http.post<StatsPeriodeResponse>(`${this.apiUrl}/stats/stats-periode`, {
      dateDebut,
      dateFin
    });
  }

  /**
   * Formater un nom de ligne pour l'affichage
   */
  formaterNomLigne(nomLigne: string): string {
    if (!nomLigne) return '';

    // Cas L04:RXT1 → L04 - RXT1
    if (nomLigne.includes(':')) {
      const parts = nomLigne.split(':');
      return `${parts[0]} - ${parts[1]}`;
    }

    // Cas UNION-M → Union (M)
    if (nomLigne.includes('-')) {
      const parts = nomLigne.split('-');
      if (parts[0].toUpperCase() === 'UNION') {
        return `Union (${parts[1]})`;
      }
      return nomLigne.replace('-', ' - ');
    }

    // Par défaut, capitaliser la première lettre
    return nomLigne.charAt(0).toUpperCase() + nomLigne.slice(1).toLowerCase();
  }

  /**
   * Calculer le statut de production basé sur le PCS
   */
  getStatutProduction(pcs: number): string {
    if (pcs >= 90) return 'Excellent';
    if (pcs >= 70) return 'Bon';
    if (pcs >= 50) return 'Moyen';
    return 'Faible';
  }

  /**
   * Obtenir la couleur correspondant au statut
   */
  getCouleurStatut(pcs: number): string {
    if (pcs >= 90) return '#10b981'; // Vert
    if (pcs >= 70) return '#f59e0b'; // Orange
    if (pcs >= 50) return '#ef4444'; // Rouge clair
    return '#dc2626'; // Rouge foncé
  }

  /**
   * Calculer le nombre de jours entre deux dates
   */
  getNombreJours(dateDebut: string, dateFin: string): number {
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    const diffTime = Math.abs(fin.getTime() - debut.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }
}