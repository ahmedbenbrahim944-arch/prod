// src/app/affectation/affectation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ouvrier {
  matricule: number;
  nomPrenom: string;
}

export interface PhaseHeures {
  id?: number;
  phase: string;
  heures: number;
}

export interface Affectation {
  id?: number;
  matricule: number;
  nomPrenom: string;
  ligne: string;
  estCapitaine?: boolean;
  poste: '1ere poste' | '2eme poste'; // ← modifié
  phases: PhaseHeures[];
  totalHeures: number;
  createdAt?: string;
}

export interface CreateAffectationDto {
  matricule: number;
  ligne: string;
  estCapitaine?: boolean;
  poste: '1ere poste' | '2eme poste'; // ← modifié
  phases: PhaseHeures[];
}

export interface UpdateAffectationDto {
  ligne?: string;
  estCapitaine?: boolean;
  poste?: '1ere poste' | '2eme poste'; // ← modifié
  phases?: PhaseHeures[];
}

@Injectable({ providedIn: 'root' })
export class AffectationService {
  private api = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    });
  }

  getAllOuvriers(): Observable<Ouvrier[]> {
    return this.http.get<Ouvrier[]>(`${this.api}/ouvrier`, { headers: this.headers() });
  }

  getAllLignes(): Observable<{ lignes: string[] }> {
    return this.http.get<{ lignes: string[] }>(`${this.api}/phase/lignes`, { headers: this.headers() });
  }

  getPhasesByLigne(ligne: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/phase/ligne/${ligne}`, { headers: this.headers() });
  }

  getAllAffectations(): Observable<{ total: number; data: Affectation[] }> {
    return this.http.get<{ total: number; data: Affectation[] }>(`${this.api}/affectation`, { headers: this.headers() });
  }

  createAffectation(dto: CreateAffectationDto): Observable<{ message: string; data: Affectation }> {
    return this.http.post<{ message: string; data: Affectation }>(`${this.api}/affectation`, dto, { headers: this.headers() });
  }

  updateAffectation(matricule: number, dto: UpdateAffectationDto): Observable<{ message: string; data: Affectation }> {
    return this.http.patch<{ message: string; data: Affectation }>(`${this.api}/affectation/${matricule}`, dto, { headers: this.headers() });
  }

  addPhase(matricule: number, phase: string, heures: number): Observable<{ message: string; data: Affectation }> {
    return this.http.post<{ message: string; data: Affectation }>(
      `${this.api}/affectation/${matricule}/phases`,
      { phase, heures },
      { headers: this.headers() }
    );
  }

  updatePhaseHeures(matricule: number, phase: string, heures: number): Observable<{ message: string; data: Affectation }> {
    return this.http.patch<{ message: string; data: Affectation }>(
      `${this.api}/affectation/${matricule}/phases/${phase}`,
      { heures },
      { headers: this.headers() }
    );
  }

  removePhase(matricule: number, phase: string): Observable<{ message: string; data: Affectation }> {
    return this.http.delete<{ message: string; data: Affectation }>(
      `${this.api}/affectation/${matricule}/phases/${phase}`,
      { headers: this.headers() }
    );
  }

  deleteAffectation(matricule: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/affectation/${matricule}`, { headers: this.headers() });
  }

  nommerCapitaine(matricule: number): Observable<{ message: string; data: Affectation }> {
    return this.http.post<{ message: string; data: Affectation }>(
      `${this.api}/affectation/${matricule}/nommer-capitaine`,
      {},
      { headers: this.headers() }
    );
  }

  retirerCapitaine(matricule: number): Observable<{ message: string; data: Affectation }> {
    return this.http.delete<{ message: string; data: Affectation }>(
      `${this.api}/affectation/${matricule}/retirer-capitaine`,
      { headers: this.headers() }
    );
  }

  getAllCapitaines(): Observable<{ total: number; data: Affectation[] }> {
    return this.http.get<{ total: number; data: Affectation[] }>(
      `${this.api}/affectation/capitaines`,
      { headers: this.headers() }
    );
  }
}