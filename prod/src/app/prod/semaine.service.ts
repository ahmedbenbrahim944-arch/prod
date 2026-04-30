// src/app/services/semaine.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';
import { catchError } from 'rxjs/operators';

export interface Semaine {
  id?: number;
  nom: string;
  dateDebut: Date | string;
  dateFin: Date | string;
  creePar?: any;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateSemaineDto {
  nom: string;
  dateDebut: string;
  dateFin: string;
}

export interface Planification {
  id?: number;
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  of?: string;
  qtePlanifiee: number;
  qteModifiee: number;
  emballage?: string;
  nbOperateurs: number;
  nbHeuresPlanifiees: number;
  decProduction: number;
  decMagasin: number;
  deltaProd: number;
  pcsProd: number;
  note?: string; // NOUVEAU
}

export interface CreatePlanificationDto {
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  of?: string;
  qtePlanifiee?: number;
  qteModifiee?: number;
  emballage?: string;
  note?: string; // NOUVEAU
}

export interface WeekInfo {
  number: number;
  startDate: Date;
  endDate: Date;
  display: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SemaineService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('Aucun token d\'authentification trouvé');
      return new HttpHeaders({ 'Content-Type': 'application/json' });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ============ ROUTES PUBLIQUES ============

  getSemainesPublic(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`);
  }

  // ============ ROUTES PROTÉGÉES ============

  createSemaine(semaine: CreateSemaineDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/semaines`, semaine, { headers: this.getAuthHeaders() });
  }

  getSemaines(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semaines`, { headers: this.getAuthHeaders() });
  }

  getSemainesForPlanning(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semaines`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur chargement semaines:', error);
        if (error.status === 401) {
          console.log('Tentative avec route publique...');
          return this.getSemainesPublic();
        }
        throw error;
      })
    );
  }

  deleteSemaine(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/semaines/${id}`, { headers: this.getAuthHeaders() });
  }

  createPlanification(planification: CreatePlanificationDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/planifications`, planification, { headers: this.getAuthHeaders() });
  }

  getPlanificationsBySemaine(semaine: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/planifications/semaine/${semaine}`, { headers: this.getAuthHeaders() });
  }

  getPlanificationsForWeek(semaineNom: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/planifications/vue`, { semaine: semaineNom }, { headers: this.getAuthHeaders() });
  }

  getAllPlanifications(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/planifications`, { headers: this.getAuthHeaders() });
  }

  updatePlanificationByCriteria(planification: any): Observable<any> {
    console.log('Envoi de la planification:', planification);
    return this.http.patch<any>(`${this.apiUrl}/planifications`, planification, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Erreur détaillée sauvegarde:', {
          status: error.status,
          message: error.message,
          error: error.error,
          planification: planification
        });
        throw error;
      })
    );
  }

  updateProductionPlanification(production: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/planifications/prod`, production, { headers: this.getAuthHeaders() });
  }

  getPlanificationsVuProd(semaine: string, ligne: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/planifications/vuprod`, { semaine, ligne }, { headers: this.getAuthHeaders() });
  }

  // ============ MÉTHODES UTILITAIRES ============

  /**
   * Formate les données d'une planification pour l'API.
   * Inclut le champ `note` si présent.
   */
  formatWeekForAPI(weekData: any): any {
    return {
      semaine: weekData.semaine,
      jour: weekData.jour,
      ligne: weekData.ligne,
      reference: weekData.reference,
      of: weekData.of || '',
      nbOperateurs: weekData.nbOperateurs || 0,
      qtePlanifiee: weekData.qtePlanifiee || 0,
      qteModifiee: weekData.qteModifiee || 0,
      emballage: weekData.emballage || '200',
      decProduction: weekData.decProduction || 0,
      decMagasin: weekData.decMagasin || 0,
      note: weekData.note ?? null  // NOUVEAU : inclure la note
    };
  }

  saveMultiplePlanifications(planifications: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/planifications/batch`, { planifications }, { headers: this.getAuthHeaders() });
  }

  getWeekDates(year: number, weekNumber: number): WeekInfo {
    const january4 = new Date(year, 0, 4);
    const dayOfWeek = january4.getDay();
    const mondayOfWeek1 = new Date(january4);
    mondayOfWeek1.setDate(january4.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const weekStart = new Date(mondayOfWeek1);
    weekStart.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);

    return {
      number: weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      display: `semaine${weekNumber}`
    };
  }

  parseWeeksFromAPI(response: any): WeekInfo[] {
    let semainesArray: any[] = [];
    if (response && response.semaines && Array.isArray(response.semaines)) {
      semainesArray = response.semaines;
    } else if (Array.isArray(response)) {
      semainesArray = response;
    } else {
      return [];
    }

    const weeks: WeekInfo[] = [];
    semainesArray.forEach((semaine: any) => {
      let weekNumber = 0;
      if (semaine.nom && typeof semaine.nom === 'string') {
        const match = semaine.nom.match(/semaine(\d+)/i);
        if (match && match[1]) weekNumber = parseInt(match[1], 10);
      }
      if (weekNumber > 0) {
        weeks.push({
          number: weekNumber,
          startDate: semaine.dateDebut ? new Date(semaine.dateDebut) : new Date(),
          endDate: semaine.dateFin ? new Date(semaine.dateFin) : new Date(),
          display: semaine.nom || `semaine${weekNumber}`,
          data: semaine
        });
      }
    });

    weeks.sort((a, b) => b.number - a.number);
    return weeks;
  }

  isAdmin(): boolean {
    return this.authService.getUserType() === 'admin';
  }

  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }

  updateMagasinPlanification(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/planifications/magasin`, data);
  }
}

