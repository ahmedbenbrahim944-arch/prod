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
  seconde?: number;
}

export interface MCategory {
  code: string;
  name: string;
  description: string;
  subCategories: string[];
  requiresReferences?: boolean;
  referenceType?: string;
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
  matierePremierRefs?: string[];
  phasesEnPanne?: string[];
  productRefs?: string[];
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
  lostPieces?: number;
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
  timing: {
    totalDuration: string;
    productionTime: string;
    pauseTime: string;
    efficiency: string;
  };
  production: {
    quantityProduced: number | null;
    lostPieces: number;
    theoreticalQuantity: number;
  };
  pauses: {
    total: number;
    byCategory: {
      [key: string]: {
        count: number;
        totalDuration: number;
        pauses: PauseSession[];
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
  // ✅ Compteurs par référence planifiée
  refsCompteurs?: RefCompteur[];
  productionSeconds?: number;
  pauseSeconds?: number;
}

export interface AvailableReferences {
  mCategory: string;
  references: string[];
  type: string;
  message?: string;
}

// ✅ NOUVELLE INTERFACE - Référence planifiée (avec OF non null)
export interface PlannedReference {
  id: number;
  reference: string;
  of: string;
  jour: string;
  semaine: string;
  qtePlanifiee: number;
  qteModifiee: number;
}

export interface PlannedReferencesResponse {
  planifications: PlannedReference[];
  total: number;
}

// ✅ NOUVEAU - Compteur temps+pièces par référence
export interface RefCompteur {
  id: number;
  reference: string;
  of: string;
  qtePlanifiee: number;
  qteModifiee: number;
  secondesParPiece: number;
  piecesProduites: number;
  piecesPerdues: number;       // ✅ pièces perdues pendant la pause
  estEnPause: boolean;         // ✅ true si cette ref est en pause
  tempsProduction: string;
  tempsProductionSeconds: number;
}

export interface SavedSessionData {
  ligne: string | null;
  refSessions: any[];
  selectedStartRefIds: number[];
  startRefs: PlannedReference[];
  savedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://102.207.250.53:3000';

  private activeSessionSubject = new BehaviorSubject<ProductionSession | null>(null);
  public activeSession$ = this.activeSessionSubject.asObservable();

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // ==================== PRODUCT API ====================

  getAllLines(): Observable<{ lines: ProductLine[], total: number }> {
    return this.http.get<{ lines: ProductLine[], total: number }>(
      `${this.API_URL}/products/lines`
    );
  }

  getLine(ligne: string): Observable<ProductLine> {
    return this.http.get<ProductLine>(`${this.API_URL}/products/lines/${ligne}`);
  }

  // ==================== PRODUCTION API ====================

  startProduction(
    ligne: string,
    productType?: string,
    notes?: string,
    planificationIds?: number[]  // ✅ NOUVEAU
  ): Observable<any> {
    const payload: any = { ligne, productType, notes };
    if (planificationIds && planificationIds.length > 0) payload.planificationIds = planificationIds;
    return this.http.post(
      `${this.API_URL}/production/start`,
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
   * ✅ MODIFIÉ - Pause avec planificationIds en plus
   */
  pauseProduction(
    sessionId: number,
    mCategory: string,
    subCategory?: string,
    reason?: string,
    matierePremierRefs?: string[],
    phasesEnPanne?: string[],
    productRefs?: string[],
    planificationIds?: number[]   // ✅ NOUVEAU
  ): Observable<any> {
    const payload: any = { sessionId, mCategory, subCategory, reason };

    if (mCategory === 'M1' && matierePremierRefs) payload.matierePremierRefs = matierePremierRefs;
    if (mCategory === 'M4' && phasesEnPanne) payload.phasesEnPanne = phasesEnPanne;
    if (mCategory === 'M5' && productRefs) payload.productRefs = productRefs;

    // ✅ Toujours envoyer les planificationIds si fournis (indépendant de M)
    if (planificationIds && planificationIds.length > 0) {
      payload.planificationIds = planificationIds;
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

  endProduction(sessionId: number, finalNotes?: string, quantityProduced?: number, qualityStatus?: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/end`,
      { sessionId, finalNotes, quantityProduced, qualityStatus },
      { headers: this.getHeaders() }
    ).pipe(tap(() => this.activeSessionSubject.next(null)));
  }

  cancelSession(sessionId: number): Observable<any> {
    return this.http.post(
      `${this.API_URL}/production/cancel/${sessionId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(tap(() => this.activeSessionSubject.next(null)));
  }

  getSessionStats(sessionId: number): Observable<SessionStats> {
    return this.http.get<SessionStats>(
      `${this.API_URL}/production/session/${sessionId}/stats`,
      { headers: this.getHeaders() }
    );
  }

  getActiveSessions(): Observable<ProductionSession[]> {
    return this.http.get<ProductionSession[]>(
      `${this.API_URL}/production/active`,
      { headers: this.getHeaders() }
    );
  }

  getMCategories(): Observable<{ categories: MCategory[] }> {
    return this.http.get<{ categories: MCategory[] }>(
      `${this.API_URL}/production/m-categories`,
      { headers: this.getHeaders() }
    );
  }

  getAvailableReferences(ligne: string, mCategory: string): Observable<AvailableReferences> {
    return this.http.get<AvailableReferences>(
      `${this.API_URL}/production/line/${ligne}/references/${mCategory}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * ✅ NOUVEAU - Récupérer les références planifiées d'une ligne (OF non null)
   * À appeler à l'ouverture du modal de pause
   */
  getPlannedReferences(ligne: string): Observable<PlannedReferencesResponse> {
    return this.http.get<PlannedReferencesResponse>(
      `${this.API_URL}/production/line/${ligne}/planned-references`,
      { headers: this.getHeaders() }
    );
  }

  getLineStatus(ligne: string): Observable<any> {
    return this.http.get(
      `${this.API_URL}/production/line/${ligne}/status`,
      { headers: this.getHeaders() }
    );
  }

  setActiveSession(session: ProductionSession | null): void {
    this.activeSessionSubject.next(session);
  }

  getActiveSession(): ProductionSession | null {
    return this.activeSessionSubject.value;
  }

  getRealTimeProduction(sessionId: number): Observable<RealTimeProduction> {
    return this.http.get<RealTimeProduction>(
      `${this.API_URL}/production/session/${sessionId}/realtime`,
      { headers: this.getHeaders() }
    );
  }

  getAllRealTimeProduction(): Observable<RealTimeProduction[]> {
    return this.http.get<RealTimeProduction[]>(
      `${this.API_URL}/production/realtime/all`,
      { headers: this.getHeaders() }
    );
  }

  saveLastSession(sessionData: any): void {
  try {
    localStorage.setItem('last_production_session', JSON.stringify({
      ...sessionData,
      savedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Erreur sauvegarde session:', error);
  }
}

clearLastSession(): void {
  localStorage.removeItem('last_production_session');
}

loadLastSession(): any {
  try {
    const saved = localStorage.getItem('last_production_session');
    if (!saved) return null;
    
    const session = JSON.parse(saved);
    
    // Vérifier si la session est récente (moins de 24h)
    const savedTime = new Date(session.savedAt).getTime();
    const now = new Date().getTime();
    const hoursSinceSaved = (now - savedTime) / (1000 * 60 * 60);
    
    if (hoursSinceSaved > 24) {
      // Session trop ancienne
      this.clearLastSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Erreur chargement session:', error);
    return null;
  }
}
// Production.service.ts - AJOUTEZ cette méthode

/**
 * 🔑 Récupérer la session active de l'utilisateur connecté
 */
getMyActiveSession(): Observable<{
  hasActiveSession: boolean;
  message?: string;
  session?: {
    id: number;
    ligne: string;
    status: string;
    startTime: string;
    productType: string;
    planifications: PlannedReference[];
    realtime: any;
  };
}> {
  return this.http.get<any>(
    `${this.API_URL}/production/my-active-session`,
    { headers: this.getHeaders() }
  );
}
}