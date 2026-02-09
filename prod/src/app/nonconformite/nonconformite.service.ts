// services/nonconformite.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface SaisieNonConf {
  id?: number;
  sourceType: string;
  typeInterne?: string;
  ligne: string;
  reference: string;
  qteRebut: number;
  defauts: string;
  type: 'MP' | 'SE';
  sortieLigne: number;
  date: string | Date;
  statut: string;
  createdById?: number;
  createdAt?: Date;
  updatedAt?: Date;
  isEditingStatut?: boolean;
  tempStatut?: string; // AJOUT: propriété temporaire pour l'édition
}

export interface CreateSaisieNonConfDto {
  sourceType: string;
  typeInterne?: string;
  ligne: string;
  reference: string;
  qteRebut: number;
  defauts: string;
  type: 'MP' | 'SE';
  sortieLigne: number;
  date: string;
  statut?: string;
  createdById?: number;
}

export interface UpdateSaisieNonConfDto {
  sourceType?: string;
  typeInterne?: string;
  ligne?: string;
  reference?: string;
  qteRebut?: number;
  defauts?: string;
  type?: 'MP' | 'SE';
  sortieLigne?: number;
  date?: string;
  statut?: string;
  createdById?: number;
}

export interface ReferenceWithLine {
  reference: string;
  ligne: string;
  type: 'MP' | 'SE';
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  total?: number;
}

export interface Commentaire {
  id: number;
  commentaire: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NonconformiteService {
  private http = inject(HttpClient);
  private apiUrl = 'http://102.207.250.53:3000/saisie-non-conf';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getAllLines(): Observable<string[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/lines`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('❌ Erreur récupération lignes:', error);
        return of([]);
      })
    );
  }

  getReferencesByLine(ligne: string): Observable<ReferenceWithLine[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/references/by-line/${ligne}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('❌ Erreur récupération références par ligne:', error);
        return of([]);
      })
    );
  }

  create(data: CreateSaisieNonConfDto): Observable<SaisieNonConf> {
    return this.http.post<any>(
      this.apiUrl,
      data,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('❌ Erreur création non-conformité:', error);
        throw error;
      })
    );
  }

  findAll(): Observable<SaisieNonConf[]> {
    return this.http.get<any>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('❌ Erreur récupération saisies:', error);
        return of([]);
      })
    );
  }

  findOne(id: number): Observable<SaisieNonConf> {
    return this.http.get<ApiResponse<SaisieNonConf>>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur récupération saisie:', error);
        throw error;
      })
    );
  }

  update(id: number, data: UpdateSaisieNonConfDto): Observable<SaisieNonConf> {
    return this.http.patch<ApiResponse<SaisieNonConf>>(
      `${this.apiUrl}/${id}`,
      data,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur mise à jour saisie:', error);
        throw error;
      })
    );
  }

  updateStatut(id: number, statut: string): Observable<SaisieNonConf> {
    return this.http.patch<ApiResponse<SaisieNonConf>>(
      `${this.apiUrl}/${id}/statut`,
      { statut },
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('❌ Erreur mise à jour statut:', error);
        throw error;
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('❌ Erreur suppression saisie:', error);
        throw error;
      })
    );
  }

  getAvailableReferences(): Observable<ReferenceWithLine[]> {
    return this.http.get<ApiResponse<ReferenceWithLine[]>>(
      `${this.apiUrl}/all-references`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur récupération références:', error);
        return of([]);
      })
    );
  }

  getDefautsList(): Observable<string[]> {
    return this.http.get<any[]>(
      'http://102.207.250.53:3000/commentaires',
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(commentaires => {
        return commentaires.map(c => c.commentaire);
      }),
      catchError(error => {
        console.error('❌ Erreur récupération commentaires:', error);
        return of([]);
      })
    );
  }

  findByPeriod(startDate: string, endDate: string): Observable<SaisieNonConf[]> {
    return this.http.get<ApiResponse<SaisieNonConf[]>>(
      `${this.apiUrl}/api/date-range?startDate=${startDate}&endDate=${endDate}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur recherche par période:', error);
        return of([]);
      })
    );
  }

  getStats(): Observable<any> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/api/stats`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur récupération statistiques:', error);
        return of({ totalSaisies: 0, totalQteRebut: 0 });
      })
    );
  }
}