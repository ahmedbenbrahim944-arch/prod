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

  // Méthode pour obtenir les headers avec le token
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    
    if (!token) {
      console.warn('Aucun token d\'authentification trouvé');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ============ ROUTES PUBLIQUES (sans authentification) ============

  getSemainesPublic(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`);
  }

  // ============ ROUTES PROTÉGÉES (avec authentification) ============

  // Semaines
  createSemaine(semaine: CreateSemaineDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/semaines`,
      semaine,
      { headers: this.getAuthHeaders() }
    );
  }

  getSemaines(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/semaines`,
      { headers: this.getAuthHeaders() }
    );
  }
  
  getSemainesForPlanning(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/semaines`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Erreur chargement semaines:', error);
        
        // Si erreur 401 (non autorisé), essayer la route publique
        if (error.status === 401) {
          console.log('Tentative avec route publique...');
          return this.getSemainesPublic();
        }
        
        throw error;
      })
    );
  }

  deleteSemaine(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/semaines/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Planifications
  createPlanification(planification: CreatePlanificationDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/planifications`,
      planification,
      { headers: this.getAuthHeaders() }
    );
  }

  getPlanificationsBySemaine(semaine: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/planifications/semaine/${semaine}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getPlanificationsForWeek(semaineNom: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/planifications/vue`,
      { semaine: semaineNom },
      { headers: this.getAuthHeaders() }
    );
  }

  getAllPlanifications(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/planifications`,
      { headers: this.getAuthHeaders() }
    );
  }

  updatePlanificationByCriteria(planification: any): Observable<any> {
    console.log('Envoi de la planification:', planification);
    
    return this.http.patch<any>(
      `${this.apiUrl}/planifications`,
      planification,
      { headers: this.getAuthHeaders() }
    ).pipe(
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
    return this.http.patch<any>(
      `${this.apiUrl}/planifications/prod`,
      production,
      { headers: this.getAuthHeaders() }
    );
  }

  getPlanificationsVuProd(semaine: string, ligne: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/planifications/vuprod`,
      { semaine, ligne },
      { headers: this.getAuthHeaders() }
    );
  }

  // ============ MÉTHODES UTILITAIRES ============

  // Méthode pour convertir une semaine au format API
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
      decMagasin: weekData.decMagasin || 0
    };
  }

  // Méthode pour sauvegarder plusieurs planifications en une seule requête
  saveMultiplePlanifications(planifications: any[]): Observable<any> {
    // Si vous avez une route pour sauvegarder en batch
    return this.http.post<any>(
      `${this.apiUrl}/planifications/batch`,
      { planifications },
      { headers: this.getAuthHeaders() }
    );
  }

  // Helper methods pour les dates de semaine
  // Dans votre SemaineService (frontend)

getWeekDates(year: number, weekNumber: number): WeekInfo {
  // Méthode ISO 8601 pour calculer les dates de semaine
  
  // 1. Trouver le 4 janvier de l'année (c'est toujours dans la semaine 1)
  const january4 = new Date(year, 0, 4);
  
  // 2. Trouver le lundi de la semaine contenant le 4 janvier
  const dayOfWeek = january4.getDay(); // 0=dimanche, 1=lundi, etc.
  const mondayOfWeek1 = new Date(january4);
  mondayOfWeek1.setDate(january4.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  // 3. Calculer le lundi de la semaine demandée
  const weekStart = new Date(mondayOfWeek1);
  weekStart.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
  
  // 4. Calculer le samedi (fin de semaine)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5); // Lundi + 5 jours = samedi
  
  // 5. Formater le nom
  const semaineNom = `semaine${weekNumber}`;
  
  return {
    number: weekNumber,
    startDate: weekStart,
    endDate: weekEnd,
    display: semaineNom
  };
}

  // Méthode pour parser les semaines depuis l'API
  parseWeeksFromAPI(response: any): WeekInfo[] {
    let semainesArray: any[] = [];
    
    // Vérifier différents formats de réponse
    if (response && response.semaines && Array.isArray(response.semaines)) {
      semainesArray = response.semaines;
    } else if (Array.isArray(response)) {
      semainesArray = response;
    } else {
      console.warn('Format de réponse inattendu:', response);
      return [];
    }
    
    const weeks: WeekInfo[] = [];
    
    semainesArray.forEach((semaine: any) => {
      let weekNumber = 0;
      
      // Extraire le numéro de semaine du nom (ex: "semaine1" -> 1)
      if (semaine.nom && typeof semaine.nom === 'string') {
        const match = semaine.nom.match(/semaine(\d+)/i);
        if (match && match[1]) {
          weekNumber = parseInt(match[1], 10);
        }
      }
      
      // Si on a un numéro valide, créer l'objet WeekInfo
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
    
    // Trier par numéro de semaine (décroissant - les plus récentes d'abord)
    weeks.sort((a, b) => b.number - a.number);
    
    return weeks;
  }

  // Méthode pour vérifier si l'utilisateur est admin
  isAdmin(): boolean {
    const userType = this.authService.getUserType();
    return userType === 'admin';
  }

  // Méthode pour vérifier si l'utilisateur est connecté
  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }
    updateMagasinPlanification(data: any): Observable<any> {
  return this.http.patch(`${this.apiUrl}/planifications/magasin`, data);
}
}