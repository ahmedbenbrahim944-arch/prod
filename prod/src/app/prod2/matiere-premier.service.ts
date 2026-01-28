// src/app/services/matiere-premier.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface MatierePremier {
  id?: number;
  ligne: string;
  refMatierePremier: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatierePremierService {
  private apiUrl = 'http://102.207.250.53:3000/matiere-pre';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  // Récupérer toutes les matières premières
  findAll(): Observable<MatierePremier[]> {
    return this.http.get<MatierePremier[]>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les matières premières par ligne
  findByLigne(ligne: string): Observable<MatierePremier[]> {
    return this.http.get<MatierePremier[]>(
      `${this.apiUrl}/ligne/${ligne}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer toutes les lignes distinctes
  findAllLignes(): Observable<{ lignes: string[] }> {
    return this.http.get<{ lignes: string[] }>(
      `${this.apiUrl}/lignes`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer toutes les références distinctes
  findAllRefs(): Observable<{ refMatierePremier: string[] }> {
    return this.http.get<{ refMatierePremier: string[] }>(
      `${this.apiUrl}/refs`,
      { headers: this.getAuthHeaders() }
    );
  }
}