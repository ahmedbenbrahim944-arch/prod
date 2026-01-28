// src/app/services/ouvrier.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface Ouvrier {
  matricule: number;
  nomPrenom: string;
}

export interface CreateOuvrierDto {
  matricule: number;
  nomPrenom: string;
}

export interface SearchOuvrierDto {
  matricule: number;
}

@Injectable({
  providedIn: 'root'
})
export class OuvrierService {
  private apiUrl = 'http://102.207.250.53:3000/ouvrier';

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

  create(ouvrier: CreateOuvrierDto): Observable<Ouvrier> {
    return this.http.post<Ouvrier>(
      this.apiUrl,
      ouvrier,
      { headers: this.getAuthHeaders() }
    );
  }

  findAll(): Observable<Ouvrier[]> {
    return this.http.get<Ouvrier[]>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    );
  }

  searchByMatricule(matricule: number): Observable<{ matricule: number; nomPrenom: string }> {
    const searchDto: SearchOuvrierDto = { matricule };
    return this.http.post<{ matricule: number; nomPrenom: string }>(
      `${this.apiUrl}/search`,
      searchDto,
      { headers: this.getAuthHeaders() }
    );
  }

  remove(matricule: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${matricule}`,
      { headers: this.getAuthHeaders() }
    );
  }
}