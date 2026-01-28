// src/app/stats/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface GetStatsDto {
  semaine: string;
  ligne: string;
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private apiUrl = 'http://102.207.250.53:3000';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Méthode pour obtenir les headers avec le token
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

  // Obtenir les statistiques pour une ligne et une semaine
  getStatsBySemaineAndLigne(data: GetStatsDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/stats`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }
}