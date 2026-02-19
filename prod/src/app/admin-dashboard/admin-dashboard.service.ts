// admin-dashboard.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminDashboardOverview {
  timestamp: Date;
  filters: {
    startDate: string | null;
    endDate: string | null;
    ligne: string;
  };
  overview: {
    totalLines: number;
    activeLines: number;
    pausedLines: number;
    inactiveLines: number;
    totalSessions: number;
    totalPauses: number;
    totalLostPieces: number;
  };
  lines: LineStatusAdmin[];
}

export interface LineStatusAdmin {
  ligne: string;
  status: 'active' | 'paused' | 'inactive';
  activeSession: {
    id: number;
    startTime: string;
    currentPause?: any;
    productType: string;
    startedBy: any;
  } | null;
  realTime: {
    piecesProduites: number;
    piecesProduitesPrevisionnelles: number;
    tempsProduction: string;
    tempsPause: string;
    tauxProduction: string;
    pauseEnCours: any;
  } | null;
  historicalStats: any;
}

export interface AdminPeriodStats {
  period: {
    startDate: string;
    endDate: string;
  };
  totalSessions: number;
  lines: LineStatistics[];
  globalStats: {
    totalProductionTime: number;
    totalPauseTime: number;
    totalPauses: number;
    totalLostPieces: number;
    totalProduced: number;
  };
}

export interface LineStatistics {
  ligne: string;
  totalSessions: number;
  completedSessions: number;
  totalProductionTime: string;
  totalPauseTime: string;
  totalPauses: number;
  totalLostPieces: number;
  totalProduced: number;
  efficiency: string;
  pausesByCategory: { [key: string]: any };
}

export interface AdminPauseHistory {
  pauses: PauseDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PauseDetail {
  id: number;
  ligne: string;
  sessionId: number;
  mCategory: string;
  subCategory?: string;
  startTime: string;
  endTime?: string;
  duration: string;
  durationSeconds: number;
  reason?: string;
  actionTaken?: string;
  lostPieces: number;
  matierePremierRefs?: string[];
  phasesEnPanne?: string[];
  productRefs?: string[];
  recordedBy: string;
}

export interface MCategoryStats {
  categories: {
    category: string;
    count: number;
    totalDuration: string;
    totalDurationSeconds: number;
    totalLostPieces: number;
    averageDuration: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://102.207.250.53:3000';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * 📊 Obtenir la vue d'ensemble du dashboard admin
   */
  getDashboardOverview(filters?: {
    startDate?: string;
    endDate?: string;
    ligne?: string;
    status?: string;
  }): Observable<AdminDashboardOverview> {
    let params = new HttpParams();
    
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.ligne) params = params.set('ligne', filters.ligne);
    if (filters?.status) params = params.set('status', filters.status);

    return this.http.get<AdminDashboardOverview>(
      `${this.API_URL}/production/admin/dashboard`,
      { headers: this.getHeaders(), params }
    );
  }

  /**
   * 📈 Obtenir les statistiques de période
   */
  getPeriodStats(startDate?: string, endDate?: string): Observable<AdminPeriodStats> {
    let params = new HttpParams();
    
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<AdminPeriodStats>(
      `${this.API_URL}/production/admin/period-stats`,
      { headers: this.getHeaders(), params }
    );
  }

  /**
   * 📋 Obtenir l'historique des pauses
   */
  getPauseHistory(filters?: {
    startDate?: string;
    endDate?: string;
    ligne?: string;
    mCategory?: string;
    page?: number;
    limit?: number;
  }): Observable<AdminPauseHistory> {
    let params = new HttpParams();
    
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.ligne) params = params.set('ligne', filters.ligne);
    if (filters?.mCategory) params = params.set('mCategory', filters.mCategory);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<AdminPauseHistory>(
      `${this.API_URL}/production/admin/pause-history`,
      { headers: this.getHeaders(), params }
    );
  }

  /**
   * 📊 Obtenir les statistiques par catégorie M
   */
  getMCategoryStats(startDate?: string, endDate?: string): Observable<MCategoryStats> {
    let params = new HttpParams();
    
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<MCategoryStats>(
      `${this.API_URL}/production/admin/m-category-stats`,
      { headers: this.getHeaders(), params }
    );
  }

  /**
   * 📥 Exporter les données
   */
  exportData(startDate?: string, endDate?: string, format: 'json' | 'csv' = 'json'): Observable<any> {
    let params = new HttpParams().set('format', format);
    
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get(
      `${this.API_URL}/production/admin/export`,
      { headers: this.getHeaders(), params }
    );
  }
}