// stats.service.ts (Angular)
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneStats {
  ligne: string;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
  pcsProdTotal: number;
  references: ReferenceStats[];
  // ✅ AJOUTER CES PROPRIÉTÉS POUR LES STATS PAR DATE
  actif?: boolean;
  totalQtePlanifiee?: number;
  total5M?: number;
  pourcentage5M?: number;
}

export interface ReferenceStats {
  reference: string;
  pcsProd: number;
}

export interface StatsResponse {
  message: string;
  semaine: string;
  dateCalcul: string;
  nombreLignes: number;
  lignes: LigneStats[];
  // ✅ AJOUTER CES PROPRIÉTÉS
  resumeGlobalSemaine?: {
    totalQteSource: number;
    totalDecProduction: number;
    pcsTotalSemaine: number;
    pcsTotalSemainePourcentage: string;
  };
}

export interface Pourcentage5MCause {
  total: number;
  pourcentage: string;
  pourcentageNumber: number;
  pourcentageDansTotal5M: string;
  pourcentageDansTotal5MNumber: number;
}

export interface OuvrierSaisie {
  matricule: string;
  nomPrenom: string;
  ligne?: string;
  totalHeures?: number;
  nbPhases?: number;
  phases?: any;
}

export interface NonConformiteDetail {
  matierePremiere: { quantite: number; pourcentage: number; reference: string | null };
  absence: { quantite: number; pourcentage: number };
  rendement: { quantite: number; pourcentage: number };
  maintenance: { quantite: number; pourcentage: number };
  qualite: { quantite: number; pourcentage: number };
  methode: { quantite: number; pourcentage: number }; // ✅ NOUVEAU
  environnement: { quantite: number; pourcentage: number }; // ✅ NOUVEAU
  total5M: { quantite: number; pourcentage: number };
  commentaire: string | null;
}

// Interface pour l'affectation du personnel
export interface JourAffectation {
  jour: string;
  nbPlanifie: number;
  nbSaisi: number;
  difference: number;
  statut: 'CONFORME' | 'NON_CONFORME';
  message: string;
}

export interface LigneAffectation {
  ligne: string;
  jours: JourAffectation[];
}

export interface ReferenceDetail5M {
  reference: string;
  of: string;
  qtePlanifiee: number;
  qteModifiee: number;
  qteSource: number;
  decProduction: number;
  pcsProd: number;
  nonConformite: NonConformiteDetail | null;
}

export interface DetailParCauseTotal {
  quantite: number;
  pourcentageSource: number;
  pourcentageDans5M: number;
}

export interface Ligne5MDate {
  ligne: string;
  nombreReferences: number;
  totalQteSource: number;
  total5M: number;
  pourcentage5M: number;
  detailTotalParCause: {
    matierePremiere: DetailParCauseTotal;
    absence: DetailParCauseTotal;
    rendement: DetailParCauseTotal;
    maintenance: DetailParCauseTotal;
    qualite: DetailParCauseTotal;
    methode: DetailParCauseTotal; // ✅ NOUVEAU
    environnement: DetailParCauseTotal; // ✅ NOUVEAU
  };
  references: ReferenceDetail5M[];
}

export interface Stats5MParDateResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
  resumeGlobal: {
    nombreLignes: number;
    nombreTotalReferences: number;
    totalQteSource: number;
    total5M: number;
    pourcentage5MGlobal: number;
  };
  resumeTotalJour: {
    totalQteSource: number;
    total5M: number;
    pourcentage5M: number;
    detailParCause: {
      matierePremiere: DetailParCauseTotal;
      absence: DetailParCauseTotal;
      rendement: DetailParCauseTotal;
      maintenance: DetailParCauseTotal;
      qualite: DetailParCauseTotal;
      methode: DetailParCauseTotal;
      environnement : DetailParCauseTotal; // ✅ NOUVEAU
    };
  };
  lignes: Ligne5MDate[];
}

export interface OuvrierNonSaisi {
  matricule: string;
  nomPrenom: string;
  statut?: 'AB' | 'C' | 'S' | null;
  statutId?: number;
  commentaire?: string;
}

export interface OuvriersNonSaisisResponse {
  message: string;
  date: string;
  jour: string;
  semaine: string;
  nombreTotalOuvriers: number;
  nombreOuvriersSaisis: number;
  nombreOuvriersNonSaisis: number;
  ouvriers: OuvrierNonSaisi[];
}

export interface UpdateStatutRequest {
  matricule: string;
  nomPrenom: string;
  date: string;
  statut: 'AB' | 'C' | 'S';
  commentaire?: string;
}

export interface UpdateStatutResponse {
  message: string;
  statut: {
    id: number;
    matricule: string;
    nomPrenom: string;
    date: string;
    statut: string;
    libelleStatut: string;
    commentaire: string;
    createdAt: string;
  };
}

export interface UpdateStatutsEnMasseRequest {
  statuts: UpdateStatutRequest[];
}

export interface AffectationPersonnelResponse {
  message: string;
  semaine: string;
  dateCalcul: string;
  statistiquesGlobales: {
    totalPlanifie: number;
    totalSaisi: number;
    difference: number;
    nbNonConformites: number;
    tauxConformite: string;
  };
  lignes: LigneAffectation[];
}

export interface StatsSaisieResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
  nombreRapportsSaisis: number;
  nombreTotalRapports: number;
  nombreOuvriersTotal: number;
  nombreOuvriersNonSaisis: number;
  tauxSaisie: number;
  ouvriersNonSaisis: OuvrierSaisie[];
  ouvriersAyantSaisi: OuvrierSaisie[];
  repartitionParLigne: {
    [ligne: string]: {
      nombreOuvriers: number;
      totalHeures: number;
      ouvriers: Array<{
        matricule: string;
        nomPrenom: string;
        heures: number;
      }>;
    };
  };
}

export interface StatsParDateResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
  // ✅ MODIFICATION : Remplacer productionParLigne par lignesActives et lignesNonActives
  lignesActives: Array<{
    ligne: string;
    actif: boolean;
    totalQtePlanifiee: number;
    nombrePlanifications: number;
    nombreReferences: number;
    totalQteSource: number;
    totalDecProduction: number;
    pcsProdTotal: number;
    total5M: number;
    pourcentage5M: number;
    references: Array<any>;
  }>;
  lignesNonActives: Array<{
    ligne: string;
    actif: boolean;
    totalQtePlanifiee: number;
    nombrePlanifications: number;
    nombreReferences: number;
    totalQteSource: number;
    totalDecProduction: number;
    pcsProdTotal: number;
    total5M: number;
    pourcentage5M: number;
    references: Array<any>;
  }>;
  resumeProduction: {
    nombreLignes: number;
    nombreLignesActives: number;  // ✅ NOUVEAU
    nombreLignesNonActives: number;  // ✅ NOUVEAU
    totalQteSource: number;
    totalDecProduction: number;
    pcsProdMoyen: number;
    total5M: number;
    pourcentage5MMoyen: number;
    pcsTotalToutesLignes: number;
  };
  rapportsSaisie: StatsSaisieResponse;
}

export interface Pourcentage5MResponse {
  message: string;
  periode: {
    semaine: string;
    dateCalcul: string;
    nombrePlanifications: number;
  };
  resume: {
    totalQuantitePlanifiee: number;
    total5M: number;
    pourcentageTotal5M: string;
    pourcentageTotal5MNumber: number;
  };
  pourcentagesParCause: {
    matierePremiere: Pourcentage5MCause;
    absence: Pourcentage5MCause;
    rendement: Pourcentage5MCause;
    maintenance: Pourcentage5MCause;
    qualite: Pourcentage5MCause;
    methode: Pourcentage5MCause; 
    // ✅ NOUVEAU
    environnement: Pourcentage5MCause; // ✅ NOUVEAU
  };
  resumeTableau: Array<{
    cause: string;
    total: number;
    pourcentage: number;
    pourcentageDans5M: number;
  }>;
}

// Nouvelle interface pour les 5M par ligne
export interface DetailParCause {
  quantite: number;
  pourcentage: number;
  pourcentageDuTotal: number;
}

export interface Ligne5MStats {
  ligne: string;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQuantiteSource: number;
  total5M: number;
  pourcentage5M: number;
  detailParCause: {
    matierePremiere: DetailParCause;
    absence: DetailParCause;
    rendement: DetailParCause;
    maintenance: DetailParCause;
    qualite: DetailParCause;
    methode: DetailParCause;
    environnement : DetailParCause; // ✅ NOUVEAU
  };
}

export interface Pourcentage5MParLigneResponse {
  message: string;
  periode: {
    semaine: string;
    dateCalcul: string;
    nombreTotalPlanifications: number;
    nombreLignes: number;
  };
  resumeGlobal: {
    totalQuantiteSource: number;
    total5M: number;
    pourcentage5MGlobal: number;
  };
  lignes: Ligne5MStats[];
}

// Interface Stats5M pour le composant
export interface Stats5M {
  matierePremiere: number;
  absence: number;
  rendement: number;
  maintenance: number;
  qualite: number;
  methode: number; // ✅ NOUVEAU
  environnement: number;
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private apiUrl = 'http://102.207.250.53:3000/stats';

  constructor(private http: HttpClient) {}

  /**
   * Récupère le PCS Prod Total par ligne pour une semaine donnée
   */
  getPcsProdTotalParLigne(semaine: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<StatsResponse>(`${this.apiUrl}/lignes`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST
   */
  getPcsProdTotalParLignePost(semaine: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<StatsResponse>(`${this.apiUrl}/lignes`, 
      { semaine },
      { headers }
    );
  }

  /**
   * Récupère les statistiques détaillées pour une ligne et une semaine
   */
  getStatsBySemaineAndLigne(semaine: string, ligne: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<any>(this.apiUrl, 
      { semaine, ligne },
      { headers }
    );
  }

  /**
   * Récupère les pourcentages des 5M pour une semaine donnée
   */
  getPourcentage5MParSemaine(semaine: string): Observable<Pourcentage5MResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST pour les pourcentages 5M
   */
  getPourcentage5MParSemainePost(semaine: string): Observable<Pourcentage5MResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`, 
      { semaine },
      { headers }
    );
  }

  /**
   * NOUVELLE MÉTHODE: Récupère les pourcentages des 5M par ligne pour une semaine donnée
   */
  getPourcentage5MParLigne(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST pour les pourcentages 5M par ligne
   */
  getPourcentage5MParLignePost(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`, 
      { semaine },
      { headers }
    );
  }

  /**
   * Récupère le token JWT depuis le localStorage
   */
  private getToken(): string {
    return localStorage.getItem('access_token') || '';
  }

  getStatsParDate(date: string): Observable<StatsParDateResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<StatsParDateResponse>(`${this.apiUrl}/par-date`, {
      params: { date },
      headers
    });
  }

  getStatsParDatePost(date: string): Observable<StatsParDateResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<StatsParDateResponse>(`${this.apiUrl}/par-date`, 
      { date },
      { headers }
    );
  }

  getRapportsSaisieParDate(date: string): Observable<StatsSaisieResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<StatsSaisieResponse>(`${this.apiUrl}/rapports-saisie-date`, {
      params: { date },
      headers
    });
  }

  getAffectationPersonnel(semaine: string): Observable<AffectationPersonnelResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<AffectationPersonnelResponse>(
      `${this.apiUrl}/affectation-personnel`,
      {
        params: { semaine },
        headers
      }
    );
  }

  getStats5MParDate(date: string): Observable<Stats5MParDateResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<Stats5MParDateResponse>(`${this.apiUrl}/5m-par-date`, {
      params: { date },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST pour les 5M par date
   */
  getStats5MParDatePost(date: string): Observable<Stats5MParDateResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<Stats5MParDateResponse>(`${this.apiUrl}/5m-par-date`, 
      { date },
      { headers }
    );
  }

  /**
   * Méthode utilitaire pour obtenir toutes les stats 5M dans un format simple
   */
  getStats5MFormatSimple(stats: Pourcentage5MResponse): Stats5M {
    return {
      matierePremiere: stats.pourcentagesParCause.matierePremiere.pourcentageDansTotal5MNumber,
      absence: stats.pourcentagesParCause.absence.pourcentageDansTotal5MNumber,
      rendement: stats.pourcentagesParCause.rendement.pourcentageDansTotal5MNumber,
      maintenance: stats.pourcentagesParCause.maintenance.pourcentageDansTotal5MNumber,
      qualite: stats.pourcentagesParCause.qualite.pourcentageDansTotal5MNumber,
      methode: stats.pourcentagesParCause.methode.pourcentageDansTotal5MNumber,
      environnement: stats.pourcentagesParCause.environnement.pourcentageDansTotal5MNumber,
    };
  }

  /**
   * Méthode utilitaire pour obtenir les stats 5M par date dans un format simple
   */
  getStats5MDateFormatSimple(stats: Stats5MParDateResponse): Stats5M {
    return {
      matierePremiere: stats.resumeTotalJour.detailParCause.matierePremiere.pourcentageDans5M,
      absence: stats.resumeTotalJour.detailParCause.absence.pourcentageDans5M,
      rendement: stats.resumeTotalJour.detailParCause.rendement.pourcentageDans5M,
      maintenance: stats.resumeTotalJour.detailParCause.maintenance.pourcentageDans5M,
      qualite: stats.resumeTotalJour.detailParCause.qualite.pourcentageDans5M,
      methode: stats.resumeTotalJour.detailParCause.methode.pourcentageDans5M,
      environnement: stats.resumeTotalJour.detailParCause.environnement.pourcentageDans5M,
    };
  }

  getOuvriersNonSaisisParDate(date: string): Observable<OuvriersNonSaisisResponse> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.get<OuvriersNonSaisisResponse>(
    `http://102.207.250.53:3000/statut/ouvriers-non-saisis`,
    {
      params: { date },
      headers
    }
  );
}

updateStatutOuvrier(statutData: UpdateStatutRequest): Observable<UpdateStatutResponse> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.post<UpdateStatutResponse>(
    `http://102.207.250.53:3000/statut`,
    statutData,
    { headers }
  );
}

updateStatutsEnMasse(statutsData: UpdateStatutsEnMasseRequest): Observable<any> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.post<any>(
    `http://102.207.250.53:3000/statut/en-masse`,
    statutsData,
    { headers }
  );
}
}