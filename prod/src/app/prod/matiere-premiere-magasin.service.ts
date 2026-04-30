// src/app/prod/matiere-premiere-magasin.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';


export interface MatierePremiereMagasin {
  id?: number;
  ligne: string;
  referenceLigne: string;
  refMp: string;
  description: string;
  coeffImpiego: number;
}

export interface CreateMatierePremiereMagasinDto {
  ligne: string;
  referenceLigne: string;
  refMp: string;
  description: string;
  coeffImpiego: number;
}

export interface UpdateMatierePremiereMagasinDto {
  ligne?: string;
  referenceLigne?: string;
  refMp?: string;
  description?: string;
  coeffImpiego?: number;
}

export interface SearchMatierePremiereMagasinDto {
  ligne?: string;
  referenceLigne?: string;
  refMp?: string;
  description?: string;
}

export interface SearchResult {
  total: number;
  data: MatierePremiereMagasin[];
}

@Injectable({ providedIn: 'root' })
export class MatierePremiereMagasinService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly BASE_URL = `http://102.207.250.53:3000/plann-mag/matieres`;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  /** GET /plann-mag/matieres "” liste complète */
  findAll(): Observable<MatierePremiereMagasin[]> {
    return this.http.get<MatierePremiereMagasin[]>(this.BASE_URL, {
      headers: this.getHeaders(),
    });
  }

  /** POST /plann-mag/matieres/search "” recherche multicritères */
  search(dto: SearchMatierePremiereMagasinDto): Observable<SearchResult> {
    return this.http.post<SearchResult>(`${this.BASE_URL}/search`, dto, {
      headers: this.getHeaders(),
    });
  }

  /** GET /plann-mag/matieres/:id */
  findOne(id: number): Observable<MatierePremiereMagasin> {
    return this.http.get<MatierePremiereMagasin>(`${this.BASE_URL}/${id}`, {
      headers: this.getHeaders(),
    });
  }

  /** POST /plann-mag/matieres "” créer */
  create(dto: CreateMatierePremiereMagasinDto): Observable<MatierePremiereMagasin> {
    return this.http.post<MatierePremiereMagasin>(this.BASE_URL, dto, {
      headers: this.getHeaders(),
    });
  }

  /** PATCH /plann-mag/matieres/:id "” modifier */
  update(id: number, dto: UpdateMatierePremiereMagasinDto): Observable<MatierePremiereMagasin> {
    return this.http.patch<MatierePremiereMagasin>(`${this.BASE_URL}/${id}`, dto, {
      headers: this.getHeaders(),
    });
  }

  /** DELETE /plann-mag/matieres/:id "” supprimer */
  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.BASE_URL}/${id}`, {
      headers: this.getHeaders(),
    });
  }
}

