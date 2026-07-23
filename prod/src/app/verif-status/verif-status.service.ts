// src/app/features/verif-status/verif-status.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


export type StatutCode = 'P' | 'AB' | 'S' | 'C' | null;

export interface OuvrierInfo {
  matricule: number;
  nomPrenom: string;
}

export interface StatutOuvrierResponse {
  message: string;
  ouvrier: OuvrierInfo;
  date: string;
  statut: StatutCode;
  libelleStatut: string;
  source: 'statut_ouvrier' | 'saisie_rapport' | 'aucune_donnee';
  commentaire: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class VerifStatusService {
  private readonly apiUrl = `http://102.207.250.53:3000/statut/ouvrier`;

  constructor(private http: HttpClient) {}

  /**
   * Recherche le statut d'un ouvrier par matricule + date
   * GET /statut/ouvrier?matricule=XXXX&date=YYYY-MM-DD
   */
  getStatutOuvrier(
    matricule: number,
    date: string,
  ): Observable<StatutOuvrierResponse> {
    const params = new HttpParams()
      .set('matricule', matricule.toString())
      .set('date', date);

    return this.http.get<StatutOuvrierResponse>(this.apiUrl, { params });
  }
}

