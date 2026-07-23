// src/app/plann-mag-search/plann-mag-search.service.ts
import { Injectable }                    from '@angular/core';
import { HttpClient, HttpHeaders }       from '@angular/common/http';
import { Observable }                    from 'rxjs';

// â”€â”€â”€ Interfaces (ancien endpoint /search "” conservé) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface MpSearchItem {
  semaine:       string;
  dateDebut:     string;
  dateFin:       string;
  jour:          string;
  dateFormatee:  string;
  codeDocument:  string;
  ligne:         string;
  reference:     string;
  of:            string;
  qtePlanifiee:  number;
  refMp:         string;
  descriptionMp: string;
  coeffImpiego:  number;
  qteNecessaire: number;
}

export interface SearchResponse {
  codeDocument: string;
  annee:        string;
  of:           string;
  date:         string;
  dateFormatee: string;
  jour:         string;
  semaine:      string;
  totalMp:      number;
  planning:     MpSearchItem[];
}

// â”€â”€â”€ Interfaces (nouveau endpoint /search-by-date) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface MpRowItem {
  refMp:         string;
  descriptionMp: string;
  coeffImpiego:  number;
  qteNecessaire: number;
}

export interface OfsDetail {
  of:           string;
  qtePlanifiee: number;
  codeDocument: string;
}

export interface RefDetail {
  ligne:        string;
  reference:    string;
  ofs:          OfsDetail[];
  totalQte:     number;
  codeDocument: string;
  mpRows:       MpRowItem[];
}

export interface LigneGroupItem {
  ligne: string;
  refs:  RefDetail[];
}

export interface SearchByDateResponse {
  annee:       string;
  date:        string;
  dateFormatee:string;
  jour:        string;
  semaine:     string;
  totalMp:     number;
  totalOfs:    number;
  ofFilter:    string | null;
  ligneGroups: LigneGroupItem[];
}

// â”€â”€â”€ Interface OF par date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface OfsByDateResponse {
  ofs:          string[];
  dateFormatee: string;
  jour:         string;
  semaine:      string;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@Injectable({ providedIn: 'root' })
export class PlannMagSearchService {
  private apiUrl = `http://102.207.250.53:3000/plann-mag`;

  constructor(private http: HttpClient) {}

  private getHeaders(): { headers: any } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  /** Récupère les OF disponibles pour une année + date (DDMM) */
  getOfsByDate(annee: string, date: string): Observable<OfsByDateResponse> {
    return this.http.post<OfsByDateResponse>(
      `${this.apiUrl}/ofs-by-date`,
      { annee, date },
      this.getHeaders(),
    );
  }

  /**
   * Nouveau endpoint principal : retourne TOUS les plannings d'une date
   * groupés par ligne â†’ référence.
   * Le paramètre `of` est optionnel (filtre).
   */
  searchByDate(annee: string, date: string, of?: string): Observable<SearchByDateResponse> {
    const body: any = { annee, date };
    if (of) body.of = of;
    return this.http.post<SearchByDateResponse>(
      `${this.apiUrl}/search-by-date`,
      body,
      this.getHeaders(),
    );
  }

  /** Ancien endpoint OF + date obligatoires (conservé pour compatibilité) */
  search(annee: string, of: string, date: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(
      `${this.apiUrl}/search`,
      { annee, of, date },
      this.getHeaders(),
    );
  }
}

