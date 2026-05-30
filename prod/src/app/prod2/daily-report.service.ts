// src/app/daily-report/daily-report.service.ts  (FRONTEND Angular)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';
import { HttpHeaders } from '@angular/common/http';

export interface M1ReportResult {
  success: boolean;
  message: string;
  triggeredManually: boolean;
  targetDate: string;
  timestamp: string;
  stats?: {
    m1: {
      totalLignes: number;
      totalEntrees: number;
      totalM1: number;
    };
    m5: {
      totalLignes: number;
      totalEntrees: number;
      totalM5: number;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class DailyReportAngularService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /**
   * Déclenche manuellement l'envoi du rapport M1 pour aujourd'hui
   */
  triggerM1Report(date?: string): Observable<M1ReportResult> {
    const params = date ? `?date=${date}` : '';
    return this.http.post<M1ReportResult>(
      `${this.apiUrl}/daily-report/send-m1${params}`,
      {},
      { headers: this.getHeaders() },
    );
  }

  /**
   * Vérifie la connexion SMTP
   */
  testSmtp(): Observable<{ smtp: string; connected: boolean }> {
    return this.http.get<{ smtp: string; connected: boolean }>(
      `${this.apiUrl}/daily-report/test-smtp`,
      { headers: this.getHeaders() },
    );
  }

  /**
   * Statut du cron job
   */
  getCronStatus(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/daily-report/status`,
      { headers: this.getHeaders() },
    );
  }
}

