// src/app/pointage/pointage.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/* â”€â”€â”€ Interfaces réponse backend â”€â”€â”€ */
export interface PointageResult {
  nomPrenom: string;
  ligne: string;
  message: string;
  semaine: string;
  jour: string;
}

interface AutosaisieResponse {
  message: string;
  data: {
    ligne: string;
    matricule: number;
    badge?: {
      n_badget: string;
      matricule: number;
      nomPrenom: string;
    };
    nomPrenom?: string;        // présent uniquement via /autosaisie/matricule
    date: {
      semaine: string;
      jour: string;
    };
  };
}

/* â”€â”€â”€ Service â”€â”€â”€ */
@Injectable({ providedIn: 'root' })
export class PointageService {
  private readonly API = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  /* â”€â”€ JWT depuis localStorage â”€â”€ */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /* â”€â”€ Normalise les deux formats de réponse â”€â”€ */
  private normalize(res: AutosaisieResponse): PointageResult {
    const nomPrenom =
      res.data.badge?.nomPrenom ??
      res.data.nomPrenom ??
      `Ouvrier ${res.data.matricule}`;

    return {
      nomPrenom,
      ligne: res.data.ligne,
      message: res.message,
      semaine: res.data.date.semaine,
      jour: res.data.date.jour,
    };
  }

  /**
   * Pointage via badge RFID
   * POST /autosaisie  â†’  { n_badget: "1152" }
   */
  pointerParBadge(n_badget: string): Observable<PointageResult> {
    return this.http
      .post<AutosaisieResponse>(
        `${this.API}/autosaisie`,
        { n_badget },
        { headers: this.getHeaders() },
      )
      .pipe(
        map((res) => this.normalize(res)),
        catchError(this.handleError),
      );
  }

  /**
   * Pointage via saisie manuelle du matricule
   * POST /autosaisie/matricule  â†’  { matricule: 1234 }
   */
  pointerParMatricule(matricule: string): Observable<PointageResult> {
    return this.http
      .post<AutosaisieResponse>(
        `${this.API}/autosaisie/matricule`,
        { matricule: parseInt(matricule, 10) },
        { headers: this.getHeaders() },
      )
      .pipe(
        map((res) => this.normalize(res)),
        catchError(this.handleError),
      );
  }

  /* â”€â”€ Gestion d'erreurs HTTP â”€â”€ */
  private handleError(err: HttpErrorResponse): Observable<never> {
    if (err.status === 404) {
      return throwError(() => new Error('MATRICULE_NOT_FOUND'));
    }
    if (err.status === 400) {
      const msg: string = err.error?.message ?? 'BAD_REQUEST';
      return throwError(() => new Error(msg));
    }
    if (err.status === 401) {
      return throwError(() => new Error('NON_AUTORISÉ'));
    }
    return throwError(() => new Error('ERREUR_SERVEUR'));
  }
}

