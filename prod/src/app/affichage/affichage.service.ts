// src/app/services/affichage.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AffichageData {
  date: string;
  jour: string;
  semaine: {
    nom: string;
    dateDebut: string;
    dateFin: string;
  };
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
    enregistrements: Array<{ id: number; reference: string; quantite: number; dateScan: string }>;
  };
}

export interface Ligne {
  name: string;
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class AffichageService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') ?? '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

 getLignes(): Observable<string[]> {
  return this.http.get<string[]>(`${this.apiUrl}/affichage/lignes`, { 
    headers: this.getAuthHeaders() 
  });
}

  getAffichage(date: string, ligne: string): Observable<AffichageData> {
    return this.http.post<AffichageData>(
      `${this.apiUrl}/affichage`,
      { date, ligne },
      { headers: this.getAuthHeaders() }
    );
  }
}