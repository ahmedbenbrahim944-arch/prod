// src/app/services/phase.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface Phase {
  id?: number;
  ligne: string;
  phase: string;
}

export interface CreatePhaseDto {
  ligne: string;
  phase: string;
}

export interface UpdatePhaseDto {
  phase: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhaseService {
  private apiUrl = 'http://102.207.250.53:3000/phase';

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

  create(phase: CreatePhaseDto): Observable<Phase> {
    return this.http.post<Phase>(
      this.apiUrl,
      phase,
      { headers: this.getAuthHeaders() }
    );
  }

  findAll(): Observable<Phase[]> {
    return this.http.get<Phase[]>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    );
  }

  findAllLignes(): Observable<{ lignes: string[] }> {
    return this.http.get<{ lignes: string[] }>(
      `${this.apiUrl}/lignes`,
      { headers: this.getAuthHeaders() }
    );
  }

  findByLigne(ligne: string): Observable<Phase[]> {
    return this.http.get<Phase[]>(
      `${this.apiUrl}/ligne/${ligne}`,
      { headers: this.getAuthHeaders() }
    );
  }

  update(id: number, phase: UpdatePhaseDto): Observable<Phase> {
    return this.http.patch<Phase>(
      `${this.apiUrl}/${id}`,
      phase,
      { headers: this.getAuthHeaders() }
    );
  }

  remove(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  removeByLigneAndPhase(ligne: string, phase: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/ligne/${ligne}/phase/${phase}`,
      { headers: this.getAuthHeaders() }
    );
  }
}