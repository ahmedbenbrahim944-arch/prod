// src/app/plaquettes/plaquettes.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../login/auth.service';

export interface Semaine {
  id: number; nom: string; dateDebut: string; dateFin: string;
}
export interface MatriculeMachine {
  id: number; matricule: string; description: string | null;
}
export interface TypePlaquette {
  id: number; nom: string;
}
export interface Plaquette {
  id: number;
  date: string;
  semaine: Semaine;
  ligne: string;
  reference: string;
  matriculeMachine: MatriculeMachine;
  typePlaquette: TypePlaquette;
  quantiteDonnee: number;
  reste: number;
  produitFini: number;
  rebut: number;
  consommation: number;
  createdAt: string;
}
export interface TypeResume {
  typeId: number;
  typeNom: string;
  quantiteTotale: number;
  resteTotale: number;
  produitFiniTotal: number;
  rebutTotal: number;
  consommationTotale: number;
}
export interface TypeStat {
  typeId: number;
  typeNom: string;
  quantiteTotale: number;
  resteTotale: number;
  produitFiniTotal: number;
  rebutTotal: number;
  consommationTotale: number;
  pourcentageConsommation: number;
  pourcentageReste: number;
  pourcentageRebut: number;
}
export interface StatsResult {
  dateDebut: string;
  dateFin: string;
  statsParType: TypeStat[];
}
export interface CreatePlaquetteDto {
  semaineId: number; ligne: string; reference: string;
  matriculeMachineId: number; typePlaquetteId: number; quantiteDonnee: number;
}
export interface UpdatePlaquetteDto {
  reste?: number; produitFini?: number; rebut?: number; quantiteDonnee?: number;
}
export interface LigneAvecReferences {
  ligne: string; references: string[]; imageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PlaquettesService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
  }

  getSemaines(): Observable<Semaine[]> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`).pipe(
      map(r => Array.isArray(r) ? r : r?.data ?? r?.semaines ?? [])
    );
  }

  getLignes(): Observable<LigneAvecReferences[]> {
    return this.http.get<any>(`${this.apiUrl}/products/lines`, { headers: this.getAuthHeaders() }).pipe(
      map(r => r?.lines ?? (Array.isArray(r) ? r : []))
    );
  }

  getMatricules(): Observable<MatriculeMachine[]> {
    return this.http.get<any>(`${this.apiUrl}/plaquettes/matricules`, { headers: this.getAuthHeaders() }).pipe(
      map(r => r?.matricules ?? (Array.isArray(r) ? r : []))
    );
  }

  getTypesPlaquettes(): Observable<TypePlaquette[]> {
    return this.http.get<any>(`${this.apiUrl}/plaquettes/types`, { headers: this.getAuthHeaders() }).pipe(
      map(r => r?.types ?? (Array.isArray(r) ? r : []))
    );
  }

  getPlaquettes(semaineId: number): Observable<Plaquette[]> {
    const params = new HttpParams().set('semaineId', semaineId.toString());
    return this.http.get<any>(`${this.apiUrl}/plaquettes`, { headers: this.getAuthHeaders(), params }).pipe(
      map(r => r?.data ?? (Array.isArray(r) ? r : []))
    );
  }

  createPlaquette(dto: CreatePlaquetteDto): Observable<{ message: string; plaquette: Plaquette }> {
    return this.http.post<any>(`${this.apiUrl}/plaquettes`, dto, { headers: this.getAuthHeaders() });
  }

  updatePlaquette(id: number, dto: UpdatePlaquetteDto): Observable<{ message: string; plaquette: Plaquette }> {
    return this.http.patch<any>(`${this.apiUrl}/plaquettes/${id}`, dto, { headers: this.getAuthHeaders() });
  }

  deletePlaquette(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.apiUrl}/plaquettes/${id}`, { headers: this.getAuthHeaders() });
  }

  // â”€â”€ Stats par plage de dates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getStats(dateDebut: string, dateFin: string): Observable<StatsResult> {
    return this.http.post<StatsResult>(
      `${this.apiUrl}/plaquettes/stats`,
      { dateDebut, dateFin },
      { headers: this.getAuthHeaders() }
    );
  }
}

