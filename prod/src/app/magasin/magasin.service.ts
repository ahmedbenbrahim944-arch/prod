// src/app/magasin/magasin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface GetPlanificationRequest {
  ligne: string;
  semaine: string;
}

export interface PlanificationMagasin {
  id?: number;
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  qtePlanifiee: number;
  qteModifiee: number;
  quantiteSource: number;
  decMagasin: number;
  exp: number;
  of?: string;
  emballage?: string;
  updatedAt?: Date;
  typeQuantite: string;
}

export interface PlanificationMagasinResponse {
  message: string;
  semaine: {
    id: number;
    nom: string;
    dateDebut: string;
    dateFin: string;
  };
  filtre: string;
  totals: {
    totalQtePlanifiee: number;
    totalQteModifiee: number;
    totalQuantiteSource: number;
    totalDecMagasin: number;
    totalExp: number;
    nombreLignes: number;
    nombrePlanifications: number;
  };
  lignes: any[];
  details: PlanificationMagasin[];
}

export interface UpdateDeclarationRequest {
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  decMagasin: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MagasinService {
  private apiUrl = 'http://102.207.250.53:3000/magasin';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getPlanificationsMagasin(request: GetPlanificationRequest): Observable<PlanificationMagasinResponse> {
    return this.http.post<PlanificationMagasinResponse>(
      this.apiUrl,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  updateDeclarationMagasin(request: UpdateDeclarationRequest): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/declaration`,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  // Mettre à jour uniquement EXP (decMagasin est requis par le DTO, on passe la valeur existante)
  updateExp(
    semaine: string,
    jour: string,
    ligne: string,
    reference: string,
    exp: number,
    decMagasin: number
  ): Observable<any> {
    const request: UpdateDeclarationRequest = { semaine, jour, ligne, reference, decMagasin, exp };
    return this.http.patch<any>(
      `${this.apiUrl}/declaration`,
      request,
      { headers: this.getAuthHeaders() }
    );
  }
}