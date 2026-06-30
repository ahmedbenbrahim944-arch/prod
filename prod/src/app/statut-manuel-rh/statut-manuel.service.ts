import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TypeStatutManuel =
  | 'conge'
  | 'maladie'
  | 'mission'
  | 'autre'
  | 'present'
  | 'badge_oublie'
  | 'absence_non_justifiee';

// ── Sous-types applicables uniquement quand statut === 'maladie' ──
export type TypeMaladie = 'accouchement' | 'certificat';

export interface StatutManuel {
  id: number;
  matricule: string;
  nomPrenom: string;
  statut: TypeStatutManuel;
  dateDebut: string;
  dateFin: string;
  commentaire: string | null;
  typeMaladie?: TypeMaladie | null;
  nomDocteur?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStatutManuelPayload {
  matricule: string;
  nomPrenom: string;
  statut: TypeStatutManuel;
  dateDebut: string;
  dateFin: string;
  commentaire?: string;
  typeMaladie?: TypeMaladie;
  nomDocteur?: string;
}

export type UpdateStatutManuelPayload = Partial<CreateStatutManuelPayload>;

@Injectable({ providedIn: 'root' })
export class StatutManuelService {
  private api = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    });
  }

  findAll(): Observable<StatutManuel[]> {
    return this.http.get<StatutManuel[]>(
      `${this.api}/statuts-manuels`,
      { headers: this.headers() }
    );
  }

  create(payload: CreateStatutManuelPayload): Observable<StatutManuel> {
    return this.http.post<StatutManuel>(
      `${this.api}/statuts-manuels`,
      payload,
      { headers: this.headers() }
    );
  }

  update(id: number, payload: UpdateStatutManuelPayload): Observable<StatutManuel> {
    return this.http.patch<StatutManuel>(
      `${this.api}/statuts-manuels/${id}`,
      payload,
      { headers: this.headers() }
    );
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.api}/statuts-manuels/${id}`,
      { headers: this.headers() }
    );
  }
}