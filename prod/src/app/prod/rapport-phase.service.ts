import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RapportPhaseService {
  private apiUrl = 'http://102.207.250.53:3000/saisie-rapport';

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

  // Récupérer tous les rapports d'une semaine
  getRapportsBySemaine(semaine: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/vu`,
      { semaine },
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les statistiques d'une semaine
  getStatsSemaine(semaine: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/semaine/${semaine}/stats`,
      { headers: this.getAuthHeaders() }
    );
  }
}