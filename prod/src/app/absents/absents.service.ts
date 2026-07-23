// src/absents/absents.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AbsentOuvrier {
  id: number;
  matricule: number;
  nomPrenom: string;
  date: string;
  statut: string;
  libelleStatut: string;
  commentaire: string | null;
  nomDocteur: string | null;
  createdAt: string;
}

export interface AbsentsResponse {
  message: string;
  date?: string;      // Optionnel pour la période
  dateDebut?: string; // Nouveau
  dateFin?: string;   // Nouveau
  nombreAbsents: number;
  absents: AbsentOuvrier[];
}

export interface UpdateDocteurResponse {
  message: string;
  absent: AbsentOuvrier;
}

@Injectable({
  providedIn: 'root'
})
export class AbsentsService {

  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * GET /statut/absents?date=YYYY-MM-DD
   * Récupère tous les ouvriers absents pour une date donnée
   */
  getAbsentsByDate(date: string): Observable<AbsentsResponse> {
    return this.http.get<AbsentsResponse>(
      `${this.apiUrl}/statut/absents?date=${date}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * 🆕 GET /statut/absents/periode?dateDebut=YYYY-MM-DD&dateFin=YYYY-MM-DD
   * Récupère tous les ouvriers absents pour une période donnée
   */
  getAbsentsByPeriode(dateDebut: string, dateFin: string): Observable<AbsentsResponse> {
    return this.http.get<AbsentsResponse>(
      `${this.apiUrl}/statut/absents/periode?dateDebut=${dateDebut}&dateFin=${dateFin}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * PUT /statut/absents/:id/docteur
   * Met à jour le nom du docteur pour une absence donnée
   */
  updateNomDocteur(absenceId: number, nomDocteur: string): Observable<UpdateDocteurResponse> {
    return this.http.put<UpdateDocteurResponse>(
      `${this.apiUrl}/statut/absents/${absenceId}/docteur`,
      { nomDocteur },
      { headers: this.getHeaders() }
    );
  }
}