// src/app/scanner/scanner.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Semaine {
  id: number;
  nom: string;
  dateDebut: string;
  dateFin: string;
}

export interface ScanRecord {
  id: number;
  fullnumber: string;
  annee: string;
  semaineParsed: string;
  compteur: string;
  codeProduitParsed: string;
  fournisseur: string;
  indice: string;
  reference: string | null;
  ligne: string | null;
  semaineId: number;
  scanneParId: number;
  scannedAt: string;
  ligneChoix: 'L1' | 'L2' | null;
}

export interface CreateScanDto {
  fullnumber: string;
  semaineId: number;
  scanneParId: number;
  ligneChoix?: 'L1' | 'L2' | null;
}

export type ScanStatus = 'idle' | 'scanning' | 'success' | 'error' | 'duplicate';

export interface ProductionRecord {
  id: number;
  ligne: string;
  reference: string;
  quantite: number;
  codeOriginal: string;
  dernierePartie: string | null;
  dateScan: string;
  scanneParId: number | null;
}

export interface CreateProductionDto {
  qrCode: string;
  quantite?: number;
  scanneParId?: number;
}

export interface ParsedProductionQR {
  valid: boolean;
  reference?: string;
  quantite?: number;
  dernierePartie?: string | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getSemaines(): Observable<Semaine[]> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`).pipe(
      map(r => Array.isArray(r) ? r : r?.data ?? r?.semaines ?? []),
      catchError(this.handleError)
    );
  }

  submitScan(dto: CreateScanDto): Observable<ScanRecord> {
    return this.http.post<ScanRecord>(`${this.apiUrl}/scanner`, dto, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getScansBySemaine(semaineId: number): Observable<ScanRecord[]> {
    return this.http
      .get<ScanRecord[]>(`${this.apiUrl}/scanner/semaine/${semaineId}`, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  deleteScan(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/scanner/${id}`, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  checkFullnumber(fullnumber: string): Observable<ScanRecord> {
    return this.http
      .get<ScanRecord>(`${this.apiUrl}/scanner/fullnumber/${fullnumber}`, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  parseFullnumber(fn: string): {
    valid: boolean;
    error?: string;
    annee?: string;
    semaine?: string;
    compteur?: string;
    codeProduit?: string;
    fournisseur?: string;
    indice?: string;
  } {
    if (!fn || fn.length !== 16) {
      return { valid: false, error: `Longueur invalide : ${fn?.length ?? 0} caractères (16 attendus)` };
    }
    const annee = fn.slice(0, 1);
    const semaine = fn.slice(1, 3);
    const compteur = fn.slice(3, 7);
    const codeProduit = fn.slice(7, 11);
    const fournisseur = fn.slice(11, 13);
    const indice = fn.slice(13, 16);

    if (!/^[A-Z]$/.test(annee)) return { valid: false, error: `Année invalide : "${annee}"` };
    if (!/^\d{2}$/.test(semaine)) return { valid: false, error: `Semaine invalide : "${semaine}"` };
    if (!/^\d{4}$/.test(compteur)) return { valid: false, error: `Compteur invalide : "${compteur}"` };
    if (!/^\d{4}$/.test(codeProduit)) return { valid: false, error: `Code produit invalide : "${codeProduit}"` };
    if (!/^[A-Z]\d$/.test(fournisseur)) return { valid: false, error: `Fournisseur invalide : "${fournisseur}"` };
    if (!/^[A-Z0-9]{3}$/.test(indice)) return { valid: false, error: `Indice invalide : "${indice}"` };

    return { valid: true, annee, semaine, compteur, codeProduit, fournisseur, indice };
  }

  scanProduction(dto: CreateProductionDto): Observable<ProductionRecord> {
    return this.http
      .post<ProductionRecord>(`${this.apiUrl}/production/scan`, dto, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  getRecentProductions(page = 1, limit = 50): Observable<{
    data: ProductionRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.http
      .get<any>(`${this.apiUrl}/production?page=${page}&limit=${limit}`, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  deleteProduction(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/production/${id}`, {
        headers: this.getAuthHeaders()
      })
      .pipe(catchError(this.handleError));
  }

  parseProductionQR(qrCode: string): ParsedProductionQR {
  const trimmed = qrCode.trim();
  if (!trimmed) {
    return { valid: false, error: 'QR code vide' };
  }

  // Normalise em-dash â†’ slash
  const normalized = trimmed.replace(/"”/g, '/');

  let parts: string[];

  if (normalized.includes('/')) {
    // Séparateur slash : split normal
    parts = normalized.split('/');
  } else {
    // Séparateur tiret : on split depuis la droite (max 2 coupes)
    // pour préserver les éventuels tirets dans la référence
    const last = normalized.lastIndexOf('-');
    if (last === -1) {
      parts = [normalized];
    } else {
      const secondLast = normalized.lastIndexOf('-', last - 1);
      if (secondLast !== -1) {
        parts = [
          normalized.slice(0, secondLast),
          normalized.slice(secondLast + 1, last),
          normalized.slice(last + 1),
        ];
      } else {
        parts = [normalized.slice(0, last), normalized.slice(last + 1)];
      }
    }
  }

  if (parts.length < 2) {
    return {
      valid: false,
      error: 'Format invalide "” attendu : REFERENCE/QUANTITE[/DERNIERE_PARTIE] ou REFERENCE-QUANTITE[-DERNIERE_PARTIE]',
    };
  }


    const reference = parts[0].trim();
    const quantiteStr = parts[1].trim();
    const dernierePartie = parts[2]?.trim() || null;

    if (!reference) {
      return { valid: false, error: 'Référence manquante' };
    }

    if (reference.length < 2) {
      return { valid: false, error: `Référence trop courte : "${reference}"` };
    }

    const quantite = parseInt(quantiteStr, 10);
    if (isNaN(quantite) || quantite <= 0) {
      return { valid: false, error: `Quantité invalide : "${quantiteStr}" doit être un nombre positif` };
    }

    return { valid: true, reference, quantite, dernierePartie };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Une erreur est survenue';
    if (error.status === 401) message = 'Non authentifié. Veuillez vous reconnecter.';
    else if (error.status === 409) message = 'Ce ticket a déjÃ  été scanné (doublon)';
    else if (error.status === 404) message = error.error?.message ?? 'Ressource introuvable';
    else if (error.status === 400) message = error.error?.message ?? 'Données invalides';
    else if (error.status === 0) message = 'Impossible de joindre le serveur';
    return throwError(() => ({ status: error.status, message }));
  }
  // À ajouter dans scanner.service.ts

getProductionsBySemaine(semaineId: number): Observable<ProductionRecord[]> {
  return this.http
    .get<ProductionRecord[]>(`${this.apiUrl}/production/semaine/${semaineId}`, {
      headers: this.getAuthHeaders()
    })
    .pipe(catchError(this.handleError));
}

scanProductionForSemaine(dto: { qrCode: string; semaineId: number; scanneParId: number }): Observable<ProductionRecord> {
  return this.http
    .post<ProductionRecord>(`${this.apiUrl}/production/scan-with-semaine`, dto, {
      headers: this.getAuthHeaders()
    })
    .pipe(catchError(this.handleError));
}
}

