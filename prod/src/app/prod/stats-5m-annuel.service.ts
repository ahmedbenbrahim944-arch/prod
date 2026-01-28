// src/app/prod/stats-5m-annuel.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface Stats5MAnnuellesResponse {
  message: string;
  annee: number;
  dateCalcul: string;
  mois: {
    [moisNom: string]: {
      totalQteSource: number;
      total5M: number;
      pourcentageTotal5M: number;
      matierePremiere: {
        quantite: number;
        pourcentage: number;
      };
      absence: {
        quantite: number;
        pourcentage: number;
      };
      rendement: {
        quantite: number;
        pourcentage: number;
      };
      methode: {
        quantite: number;
        pourcentage: number;
      };
      maintenance: {
        quantite: number;
        pourcentage: number;
      };
      qualite: {
        quantite: number;
        pourcentage: number;
      };
    };
  };
  moyennesAnnuelles: {
    totalQteSource: number;
    total5M: number;
    pourcentageTotal5M: number;
    matierePremiere: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
    absence: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
    rendement: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
    methode: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
    maintenance: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
    qualite: {
      quantite: number;
      pourcentage: number;
      pourcentageDans5M: number;
    };
  };
  donneesGraphiques: {
    graphiqueCirculaire: {
      labels: string[];
      values: number[];
    };
    graphiqueBarres: {
      labels: string[];
      values: number[];
    };
  };
  tableauRecapitulatif: Array<{
    mois: string;
    matierePremiere: number;
    absence: number;
    rendement: number;
    methode: number;
    maintenance: number;
    qualite: number;
    total5M: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class Stats5MAnnuelService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://102.207.250.53:3000/stats';

  /**
   * Récupérer les stats 5M par mois pour toute l'année
   * @param date Date au format YYYY-MM-DD (ex: "2026-01-15")
   */
  getStats5MParMois(date: string): Observable<Stats5MAnnuellesResponse> {
    const headers = this.getAuthHeaders();
    
    return this.http.post<Stats5MAnnuellesResponse>(
      `${this.apiUrl}/5m-par-mois`,
      { date },
      { headers }
    );
  }

  /**
   * Obtenir les en-têtes d'authentification
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }
}