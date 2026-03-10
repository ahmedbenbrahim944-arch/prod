// stats.service.ts (Angular)
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Interfaces existantes ─────────────────────────────────────────

export interface LigneStats {
  ligne: string;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
  pcsProdTotal: number;
  references: ReferenceStats[];
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

// ── Interface OuvrierSaisie — utilisée dans statistiques1 ET stats ─

export interface OuvrierSaisie {
  matricule: string;
  nomPrenom: string;
  ligne?: string;
  totalHeures?: number;
  nbPhases?: number;
  phases?: any;
  statut?: 'AB' | 'C' | 'S' | 'P' | null;
  libelleStatut?: string;
  commentaire?: string | null;
  statutId?: number;
  date?: string;
  semaine?: string;
  jour?: string;
}

// ── Interface réponse getStatutsByDate ────────────────────────────
// Même structure retournée par GET /statut/par-date?date=YYYY-MM-DD
// utilisée dans statistiques1 ET stats pour la modale personnel

export interface StatutsParDateResponse {
  message?: string;
  date?: string;
  statistiques: {
    totalOuvriers: number;
    repartitionStatuts: {
      P: number;
      AB: number;
      C: number;
      S: number;
      nonDefini: number;
    };
    // Liste complète des ouvriers avec leur statut
    // Filtrée par statut dans openPersonnelModal()
    ouvriers: OuvrierSaisie[];
  };
}

// ── Interface réponse getOuvriersNonSaisisAvecStatuts ─────────────

export interface OuvriersNonSaisisResponse {
  message?: string;
  date?: string;
  ouvriers: OuvrierSaisie[];
  total?: number;
}

// ── Interfaces productivité ouvriers ─────────────────────────────

export interface ProductiviteOuvriersResponse {
  message: string;
  periode: {
    dateDebut: string;
    dateFin: string;
    dateCalcul: string;
  };
  statistiques?: StatistiquesProductivite;
  tableau?: LigneProductivite[];
  donneesFormatees?: {
    entetes: string[];
    lignes: LigneProductivite[];
  };
  lignes?: LigneProductivite[];
  resume?: {
    nombreOuvriers: number;
    totalHeures: number;
    totalPieces: number;
    productiviteMoyenne: number;
  };
  ouvriers?: Array<{
    matricule: string;
    nomPrenom: string;
    totalHeures: number;
    totalPieces: number;
    productivite: number;
  }>;
}

export interface StatistiquesProductivite {
  periode: {
    dateDebut: string;
    dateFin: string;
    joursTotal: number;
  };
  resume: {
    nombreOuvriers: number;
    nombreRapports: number;
    nombreJoursCouverts: number;
    totalHeures: number;
    productiviteMoyenneGenerale: number;
  };
  repartitionParLigne: {
    [ligne: string]: {
      nombreRapports: number;
      totalHeures: number;
      productiviteMoyenne: number;
      nombreOuvriers: number;
    };
  };
  causes5MTotales: {
    totaux: { M1: number; M2: number; M3: number; M4: number; M5: number; M6: number; M7: number };
    moyennes: { M1: number; M2: number; M3: number; M4: number; M5: number; M6: number; M7: number };
    nombreLignesAvecCauses: number;
  };
  verificationTotaux: {
    statistiquesVerif: Array<{
      date: string;
      ligne: string;
      productivite: number;
      somme5M: number;
      total: number;
      difference: number;
      estValide: boolean;
    }>;
    resume: {
      totalLignesVerifiees: number;
      lignesValides: number;
      lignesInvalides: number;
      tauxValidite: number;
    };
  };
}

export interface LigneProductivite {
  JOURS: string;
  MAT: number;
  "NOM ET PRENOM": string;
  "N°HEURS": number;
  LIGNES: string;
  PRODUCTIVITE: number;
  M1: number;
  M2: number;
  M3: number;
  M4: number;
  M5: number;
  M6: number;
  M7: number;
  "PRODUCTIVITE MOYENNE": number | null;
  NOTE: string;
}

export interface NonConformiteDetail {
  matierePremiere: { quantite: number; pourcentage: number; reference: string | null };
  absence: { quantite: number; pourcentage: number };
  rendement: { quantite: number; pourcentage: number };
  maintenance: { quantite: number; pourcentage: number };
  qualite: { quantite: number; pourcentage: number };
  methode: { quantite: number; pourcentage: number };
  total5M: { quantite: number; pourcentage: number };
  commentaire: string | null;
}

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
    methode: DetailParCauseTotal;
    environnement: DetailParCauseTotal;
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
      environnement: DetailParCauseTotal;
    };
  };
  lignes: Ligne5MDate[];
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

export interface StatsParDateResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
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
    nombreLignesActives: number;
    nombreLignesNonActives: number;
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
    environnement: Pourcentage5MCause;
  };
  resumeTableau: Array<{
    cause: string;
    total: number;
    pourcentage: number;
    pourcentageDans5M: number;
  }>;
}

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
    environnement: any;
    matierePremiere: DetailParCause;
    absence: DetailParCause;
    rendement: DetailParCause;
    maintenance: DetailParCause;
    qualite: DetailParCause;
    methode: DetailParCause;
  };
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
  repartitionStatuts?: {
    P: number;
    AB: number;
    C: number;
    S: number;
    nonDefini: number;
  };
  ouvriersAvecSaisie: OuvrierSaisie[];
  ouvriersNonSaisis: OuvrierSaisie[];
  repartitionParLigne: {
    [ligne: string]: {
      nombreOuvriers: number;
      totalHeures: number;
    };
  };
}

export interface Pourcentage5MParLigneResponse {
  message: string;
  periode: {
    semaine: string;
    dateCalcul: string;
    nombreLignes: number;
  };
  resumeGlobal: {
    totalQuantiteSource: number;
    total5M: number;
    pourcentage5MGlobal: number;
  };
  lignes: Ligne5MStats[];
}

export interface Stats5M {
  matierePremiere: number;
  absence: number;
  rendement: number;
  maintenance: number;
  qualite: number;
  methode: number;
  environnement: number;
}

// ── Service ───────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class StatsService1 {
  private apiUrl = 'http://102.207.250.53:3000/stats';

  constructor(private http: HttpClient) {}

  // ── Token JWT ──────────────────────────────────────────────────

  private getToken(): string {
    return localStorage.getItem('access_token') || '';
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });
  }

  // ── Productivité ouvriers ─────────────────────────────────────

  getProductiviteOuvriers(dateDebut: string, dateFin: string): Observable<ProductiviteOuvriersResponse> {
    return this.http.get<ProductiviteOuvriersResponse>(
      `${this.apiUrl}/productivite-ouvriers`,
      { params: { dateDebut, dateFin }, headers: this.getHeaders() }
    );
  }

  getProductiviteOuvriersPost(dateDebut: string, dateFin: string): Observable<ProductiviteOuvriersResponse> {
    return this.http.post<ProductiviteOuvriersResponse>(
      `${this.apiUrl}/productivite-ouvriers`,
      { dateDebut, dateFin },
      { headers: this.getHeaders() }
    );
  }

  // ── Stats par semaine ─────────────────────────────────────────

  getPcsProdTotalParLigne(semaine: string): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/lignes`, {
      params: { semaine },
      headers: this.getHeaders()
    });
  }

  getPcsProdTotalParLignePost(semaine: string): Observable<StatsResponse> {
    return this.http.post<StatsResponse>(`${this.apiUrl}/lignes`,
      { semaine },
      { headers: this.getHeaders() }
    );
  }

  getStatsBySemaineAndLigne(semaine: string, ligne: string): Observable<any> {
    return this.http.post<any>(this.apiUrl,
      { semaine, ligne },
      { headers: this.getHeaders() }
    );
  }

  // ── 5M par semaine ────────────────────────────────────────────

  getPourcentage5MParSemaine(semaine: string): Observable<Pourcentage5MResponse> {
    return this.http.get<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`, {
      params: { semaine },
      headers: this.getHeaders()
    });
  }

  getPourcentage5MParSemainePost(semaine: string): Observable<Pourcentage5MResponse> {
    return this.http.post<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`,
      { semaine },
      { headers: this.getHeaders() }
    );
  }

  getPourcentage5MParLigne(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    return this.http.get<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`, {
      params: { semaine },
      headers: this.getHeaders()
    });
  }

  getPourcentage5MParLignePost(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    return this.http.post<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`,
      { semaine },
      { headers: this.getHeaders() }
    );
  }

  // ── Stats par date ────────────────────────────────────────────

  getStatsParDate(date: string): Observable<StatsParDateResponse> {
    return this.http.get<StatsParDateResponse>(`${this.apiUrl}/par-date`, {
      params: { date },
      headers: this.getHeaders()
    });
  }

  getStatsParDatePost(date: string): Observable<StatsParDateResponse> {
    return this.http.post<StatsParDateResponse>(`${this.apiUrl}/par-date`,
      { date },
      { headers: this.getHeaders() }
    );
  }

  getRapportsSaisieParDate(date: string): Observable<StatsSaisieResponse> {
    return this.http.get<StatsSaisieResponse>(`${this.apiUrl}/rapports-saisie-date`, {
      params: { date },
      headers: this.getHeaders()
    });
  }

  // ── 5M par date ───────────────────────────────────────────────

  getStats5MParDate(date: string): Observable<Stats5MParDateResponse> {
    return this.http.get<Stats5MParDateResponse>(`${this.apiUrl}/5m-par-date`, {
      params: { date },
      headers: this.getHeaders()
    });
  }

  getStats5MParDatePost(date: string): Observable<Stats5MParDateResponse> {
    return this.http.post<Stats5MParDateResponse>(`${this.apiUrl}/5m-par-date`,
      { date },
      { headers: this.getHeaders() }
    );
  }

  // ── Affectation personnel ─────────────────────────────────────

  getAffectationPersonnel(semaine: string): Observable<AffectationPersonnelResponse> {
    return this.http.get<AffectationPersonnelResponse>(
      `${this.apiUrl}/affectation-personnel`,
      { params: { semaine }, headers: this.getHeaders() }
    );
  }

  // ── NON-CONFORMITÉS ───────────────────────────────────────────

  getNonConfDetailsByDateLigne(date: string, ligne: string): Observable<any> {
    return this.http.post<any>(
      `http://102.207.250.53:3000/nonconf/filter/by-date-ligne`,
      { date, ligne },
      { headers: this.getHeaders() }
    );
  }

  // ── Statuts personnel ─────────────────────────────────────────
  // Ces deux méthodes sont utilisées dans statistiques1 ET stats
  // pour la modale "Voir la liste des présents / absents / congés"

  /**
   * Récupère la répartition des statuts par date
   * Utilisé pour remplir la modale personnel dans les deux composants
   *
   * Réponse : StatutsParDateResponse
   *   → response.statistiques.repartitionStatuts : { P, AB, C, S }
   *   → response.statistiques.ouvriers[]          : liste filtrée par statut
   */
  getStatutsByDate(date: string): Observable<StatutsParDateResponse> {
    return this.http.get<StatutsParDateResponse>('http://102.207.250.53:3000/statut/par-date', {
      params: { date },
      headers: this.getHeaders()
    });
  }

  /**
   * Récupère les ouvriers n'ayant pas saisi avec leur statut
   */
  getOuvriersNonSaisisAvecStatuts(date: string): Observable<OuvriersNonSaisisResponse> {
    return this.http.get<OuvriersNonSaisisResponse>('http://102.207.250.53:3000/statut/ouvriers-non-saisis', {
      params: { date },
      headers: this.getHeaders()
    });
  }

  // ── Méthodes utilitaires 5M ───────────────────────────────────

  getStats5MFormatSimple(stats: Pourcentage5MResponse): Stats5M {
    return {
      matierePremiere: stats.pourcentagesParCause.matierePremiere.pourcentageDansTotal5MNumber,
      absence: stats.pourcentagesParCause.absence.pourcentageDansTotal5MNumber,
      rendement: stats.pourcentagesParCause.rendement.pourcentageDansTotal5MNumber,
      maintenance: stats.pourcentagesParCause.maintenance.pourcentageDansTotal5MNumber,
      qualite: stats.pourcentagesParCause.qualite.pourcentageDansTotal5MNumber,
      methode: stats.pourcentagesParCause.methode.pourcentageDansTotal5MNumber,
      environnement: stats.pourcentagesParCause.environnement.pourcentageDansTotal5MNumber
    };
  }

  getStats5MDateFormatSimple(stats: Stats5MParDateResponse): Stats5M {
    return {
      matierePremiere: stats.resumeTotalJour.detailParCause.matierePremiere.pourcentageDans5M,
      absence: stats.resumeTotalJour.detailParCause.absence.pourcentageDans5M,
      rendement: stats.resumeTotalJour.detailParCause.rendement.pourcentageDans5M,
      maintenance: stats.resumeTotalJour.detailParCause.maintenance.pourcentageDans5M,
      qualite: stats.resumeTotalJour.detailParCause.qualite.pourcentageDans5M,
      methode: stats.resumeTotalJour.detailParCause.methode.pourcentageDans5M,
      environnement: stats.resumeTotalJour.detailParCause.environnement.pourcentageDans5M
    };
  }
}