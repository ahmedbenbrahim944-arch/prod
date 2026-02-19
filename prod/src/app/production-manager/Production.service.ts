import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

// Interfaces
export interface ProductLine {
  ligne: string;
  referenceCount: number;
  lastCreated: string;
  imageUrl?: string;
  references: string[];
  seconde?: number; // ✅ NOUVEAU - Temps en secondes pour produire 1 pièce
}

export interface MCategory {
  code: string;
  name: string;
  description: string;
  subCategories: string[];
  requiresReferences?: boolean;  // ✅ NOUVEAU
  referenceType?: string;         // ✅ NOUVEAU
}

export interface ProductionSession {
  id: number;
  ligne: string;
  startTime: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  productType?: string;
  currentPause?: PauseInfo;
}

export interface PauseInfo {
  id: number;
  mCategory: string;
  subCategory?: string;
  startTime: string;
  duration: string;
  matierePremierRefs?: string[];  // ✅ NOUVEAU
  phasesEnPanne?: string[];       // ✅ NOUVEAU
  productRefs?: string[];         // ✅ NOUVEAU
}

export interface PauseSession {
  id: number;
  mCategory: string;
  subCategory?: string;
  reason?: string;
  startTime: string;
  endTime?: string;
  duration: string;
  actionTaken?: string;
  recordedBy?: string;
  matierePremierRefs?: string[];
  phasesEnPanne?: string[];
  productRefs?: string[];
  lostPieces?: number;        // ✅ NOUVEAU
}

export interface SessionStats {
  session: {
    id: number;
    ligne: string;
    startTime: string;
    endTime?: string | null;
    status: string;
    totalDuration: string;
    productionTime: string;
    pauseTime: string;
    efficiency: string;
    startedBy: string;
    quantityProduced?: number | null;
    qualityStatus?: string | null;
  };
  timing: {  // ✅ AJOUTER timing
    totalDuration: string;
    productionTime: string;
    pauseTime: string;
    efficiency: string;
  };
  production: {  // ✅ AJOUTER production
    quantityProduced: number | null;
    lostPieces: number;
    theoreticalQuantity: number;
  };
  pauses: {  // ✅ CORRIGER - C'est un objet, pas un tableau
    total: number;
    byCategory: {
      [key: string]: {
        count: number;
        totalDuration: number;
        pauses: PauseSession[];  // ✅ ICI se trouve le vrai tableau des pauses
      }
    }
  };
  startedBy: string;
}
export interface RealTimeProduction {
  sessionId: number;
  ligne: string;
  productType: string;
  status: string;
  tempsParPiece: number;
  tempsTotal: string;
  tempsProduction: string;
  tempsPause: string;
  piecesProduites: number;
  piecesProduitesPrevisionnelles: number;
  tauxProduction: string;
  pauseEnCours: {
    id: number;
    mCategory: string;
    duree: string;
    piecesPerdues: number;
  } | null;
}

// ✅ NOUVELLE INTERFACE pour les références disponibles
export interface AvailableReferences {
  mCategory: string;
  references: string[];
  type: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://102.207.250.53:3000';

  // État global de la session active
  private activeSessionSubject = new BehaviorSubject<ProductionSession | null>(null);
  public activeSession$ = this.activeSessionSubject.asObservable();

  // Headers avec token JWT (à adapter selon votre auth)
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // ==================== PRODUCT API ====================
  
  /**
   * Récupérer toutes les lignes de production
   */
  getAllLines(): Observable<{ lines: ProductLine[], total: number }> {
    return this.http.get<{ lines: ProductLine[], total: number }>(
      `${this.API_URL}/products/lines`
    );
  }

  /**
   * ✅ MODIFIÉ - Récupérer une ligne spécifique (avec temps de production)
   */
  getLine(ligne: string): Observable<ProductLine> {
    return this.http.get<ProductLine>(`${this.API_URL}/products/lines/${ligne}`);
  }

  // ==================== PRODUCTION API ====================

  /**
   * Démarrer une nouvelle session de production
   */
  startProduction(ligne: string, productType?: string, notes?: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/start`,
      { ligne, productType, notes },
      { headers: this.getHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.session) {
          this.activeSessionSubject.next(response.session);
        }
      })
    );
  }

  /**
   * ✅ MODIFIÉ - Mettre en pause la production avec références
   */
  pauseProduction(
    sessionId: number, 
    mCategory: string, 
    subCategory?: string, 
    reason?: string,
    matierePremierRefs?: string[],   // ✅ NOUVEAU
    phasesEnPanne?: string[],        // ✅ NOUVEAU
    productRefs?: string[]           // ✅ NOUVEAU
  ): Observable<any> {
    const payload: any = {
      sessionId,
      mCategory,
      subCategory,
      reason
    };

    // ✅ Ajouter les références selon la catégorie
    if (mCategory === 'M1' && matierePremierRefs) {
      payload.matierePremierRefs = matierePremierRefs;
    }
    if (mCategory === 'M4' && phasesEnPanne) {
      payload.phasesEnPanne = phasesEnPanne;
    }
    if (mCategory === 'M5' && productRefs) {
      payload.productRefs = productRefs;
    }

    return this.http.post(
      `${this.API_URL}/production/pause`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.session) {
          this.activeSessionSubject.next(response.session);
        }
      })
    );
  }

  /**
   * Reprendre la production après une pause
   */
  resumeProduction(sessionId: number, actionTaken?: string, notes?: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/resume`,
      { sessionId, actionTaken, notes },
      { headers: this.getHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.session) {
          this.activeSessionSubject.next(response.session);
        }
      })
    );
  }

  /**
   * Terminer la session de production
   */
  endProduction(
    sessionId: number, 
    finalNotes?: string, 
    quantityProduced?: number, 
    qualityStatus?: string
  ): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/end`,
      { sessionId, finalNotes, quantityProduced, qualityStatus },
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.activeSessionSubject.next(null);
      })
    );
  }

  /**
   * Annuler une session
   */
  cancelSession(sessionId: number): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/cancel/${sessionId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.activeSessionSubject.next(null);
      })
    );
  }

  /**
   * Obtenir les statistiques d'une session
   */
  getSessionStats(sessionId: number): Observable<SessionStats> {
    return this.http.get<SessionStats>(
      `${this.API_URL}/production/session/${sessionId}/stats`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Obtenir les sessions actives
   */
  getActiveSessions(): Observable<ProductionSession[]> {
    return this.http.get<ProductionSession[]>(
      `${this.API_URL}/production/active`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Obtenir les catégories M disponibles
   */
  getMCategories(): Observable<{ categories: MCategory[] }> {
    return this.http.get<{ categories: MCategory[] }>(
      `${this.API_URL}/production/m-categories`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * ✅ NOUVEAU - Obtenir les références disponibles pour une catégorie M
   */
  getAvailableReferences(ligne: string, mCategory: string): Observable<AvailableReferences> {
    return this.http.get<AvailableReferences>(
      `${this.API_URL}/production/line/${ligne}/references/${mCategory}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Vérifier l'état d'une ligne
   */
  getLineStatus(ligne: string): Observable<any> {
    return this.http.get(
      `${this.API_URL}/production/line/${ligne}/status`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Mettre à jour l'état de la session active localement
   */
  setActiveSession(session: ProductionSession | null): void {
    this.activeSessionSubject.next(session);
  }

  /**
   * Obtenir l'état actuel de la session active
   */
  getActiveSession(): ProductionSession | null {
    return this.activeSessionSubject.value;
  }
  getRealTimeProduction(sessionId: number): Observable<RealTimeProduction> {
  return this.http.get<RealTimeProduction>(
    `${this.API_URL}/production/session/${sessionId}/realtime`,
    { headers: this.getHeaders() }
  );
}

/**
 * ✅ NOUVEAU - Obtenir les données temps réel pour toutes les lignes actives
 */
getAllRealTimeProduction(): Observable<RealTimeProduction[]> {
  return this.http.get<RealTimeProduction[]>(
    `${this.API_URL}/production/realtime/all`,
    { headers: this.getHeaders() }
  );
}
}