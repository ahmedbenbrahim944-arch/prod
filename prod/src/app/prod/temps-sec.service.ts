// src/app/services/temps-sec.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface TempsSec {
  id?: number;
  ligne: string;
  reference: string;
  seconde: number;
}

export interface CreateTempsSecDto {
  ligne: string;
  reference: string;
  seconde: number;
}

export interface UpdateTempsSecDto {
  ligne?: string;
  reference?: string;
  seconde?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TempsSecService {
  private apiUrl = 'http://102.207.250.53:3000/temps';

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

  create(tempsSec: CreateTempsSecDto): Observable<TempsSec> {
    return this.http.post<TempsSec>(
      this.apiUrl,
      tempsSec,
      { headers: this.getAuthHeaders() }
    );
  }

  createOrUpdate(tempsSec: CreateTempsSecDto): Observable<TempsSec> {
    return this.http.post<TempsSec>(
      `${this.apiUrl}/upsert`,
      tempsSec,
      { headers: this.getAuthHeaders() }
    );
  }

  findAll(): Observable<TempsSec[]> {
    return this.http.get<TempsSec[]>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    );
  }

  findByLigne(ligne: string): Observable<TempsSec[]> {
    return this.http.get<TempsSec[]>(
      `${this.apiUrl}/ligne/${ligne}`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateByLigneAndReference(data: { ligne: string; reference: string; seconde: number }): Observable<TempsSec> {
    return this.http.patch<TempsSec>(
      this.apiUrl,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  removeByLigneAndReference(ligne: string, reference: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/ligne/${ligne}/reference/${reference}`,
      { headers: this.getAuthHeaders() }
    );
  }
  // Ajoutez cette méthode dans temps-sec.service.ts
findByLigneAndReference(ligne: string, reference: string): Observable<TempsSec[]> {
  return this.http.get<TempsSec[]>(
    `${this.apiUrl}/ligne/${ligne}/reference/${reference}`,
    { headers: this.getAuthHeaders() }
  );
}
}