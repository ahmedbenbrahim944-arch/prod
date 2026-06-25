import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PresenceData {
  total: number;
  presents: Present[];
  absents: Absent[];
}

export interface Present {
  matricule: number | string; // ✅ élargi pour accepter Employee (string)
  nomPrenom: string;
  heureEntree: string;
  timbratrice: string;
  statut: string;
  commentaire?: string
}

export interface Absent {
  matricule: number | string; // ✅ élargi
  nomPrenom: string;
   statut: string;
   commentaire?: string | null;
}

// ✅ NOUVEAU — types pour la réponse /pointage/employes/today
export interface PresenceEmployeeItem {
  matricule: string;
  nomPrenom: string;
  service: string;
  heureEntree?: string | null;
  heureSortie?: string | null;
  timbratrice?: string | null;
  statut: string;
  commentaire?: string | null;
}

export interface PresenceEmployeeData {
  totalEmployes: number;
  totalPresents: number;
  totalAbsents: number;
  presents: PresenceEmployeeItem[];
  absents: PresenceEmployeeItem[];
}

@Injectable({ providedIn: 'root' })
export class PointageService {
  private api = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    });
  }

  getPresenceToday(): Observable<PresenceData> {
    return this.http.get<PresenceData>(
      `${this.api}/pointage/today`,
      { headers: this.headers() }
    );
  }

  getPresencePeriode(debut: string, fin: string): Observable<PresenceData> {
    return this.http.get<PresenceData>(
      `${this.api}/pointage/periode?debut=${debut}&fin=${fin}`,
      { headers: this.headers() }
    );
  }

  // ✅ NOUVEAU — présence du jour basée sur Employee (4 services)
  getPresenceTodayEmployees(): Observable<PresenceEmployeeData> {
    return this.http.get<PresenceEmployeeData>(
      `${this.api}/pointage/employes/today`,
      { headers: this.headers() }
    );
  }
   getPresencePeriodeEmployees(debut: string, fin: string): Observable<PresenceEmployeeData> {
    return this.http.get<PresenceEmployeeData>(
      `${this.api}/pointage/employes/periode?debut=${debut}&fin=${fin}`,
      { headers: this.headers() }
    );
  }
}