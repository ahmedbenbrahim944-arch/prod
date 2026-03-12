// src/app/scanner/scanner.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  ligneChoix?: 'L1' | 'L2' | null; // optionnel — fourni après choix manuel de ligne
}
 
export type ScanStatus = 'idle' | 'scanning' | 'success' | 'error' | 'duplicate';
 
export interface ScanResult {
  status: ScanStatus;
  record?: ScanRecord;
  errorMessage?: string;
  parsedInfo?: {
    annee: string;
    semaine: string;
    compteur: string;
    codeProduit: string;
    fournisseur: string;
    indice: string;
  };
}


@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly apiUrl = 'http://102.207.250.53:3000';
 
  constructor(private http: HttpClient) {}
 
  // ─── Semaines ─────────────────────────────────────────────────────────────
  getSemaines(): Observable<Semaine[]> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`).pipe(
      map(r => Array.isArray(r) ? r : r?.data ?? r?.semaines ?? []),
      catchError(this.handleError)
    );
  }
 
  // ─── Scanner un ticket ────────────────────────────────────────────────────
  submitScan(dto: CreateScanDto): Observable<ScanRecord> {
    return this.http.post<ScanRecord>(`${this.apiUrl}/scanner`, dto).pipe(
      catchError(this.handleError)
    );
  }
 
  // ─── Scans d'une semaine ──────────────────────────────────────────────────
  getScansBySemaine(semaineId: number): Observable<ScanRecord[]> {
    return this.http
      .get<ScanRecord[]>(`${this.apiUrl}/scanner/semaine/${semaineId}`)
      .pipe(catchError(this.handleError));
  }
 
  // ─── Vérifier si fullnumber existe déjà ──────────────────────────────────
  checkFullnumber(fullnumber: string): Observable<ScanRecord> {
    return this.http
      .get<ScanRecord>(`${this.apiUrl}/scanner/fullnumber/${fullnumber}`)
      .pipe(catchError(this.handleError));
  }
 
  // ─── Parse le fullnumber localement (validation front) ───────────────────
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
    const annee       = fn.slice(0, 1);
    const semaine     = fn.slice(1, 3);
    const compteur    = fn.slice(3, 7);
    const codeProduit = fn.slice(7, 11);
    const fournisseur = fn.slice(11, 13);
    const indice      = fn.slice(13, 16);
 
    if (!/^[A-Z]$/.test(annee))       return { valid: false, error: `Année invalide : "${annee}" (lettre majuscule attendue)` };
    if (!/^\d{2}$/.test(semaine))     return { valid: false, error: `Semaine invalide : "${semaine}" (2 chiffres attendus)` };
    if (!/^\d{4}$/.test(compteur))    return { valid: false, error: `Compteur invalide : "${compteur}" (4 chiffres attendus)` };
    if (!/^\d{4}$/.test(codeProduit)) return { valid: false, error: `Code produit invalide : "${codeProduit}" (4 chiffres attendus)` };
    if (!/^[A-Z]\d$/.test(fournisseur)) return { valid: false, error: `Fournisseur invalide : "${fournisseur}" (lettre + chiffre attendus)` };
    if (!/^[A-Z0-9]{3}$/.test(indice)) return { valid: false, error: `Indice invalide : "${indice}" (3 chars alphanumériques ex: 115, M10, 04S)` };
 
    return { valid: true, annee, semaine, compteur, codeProduit, fournisseur, indice };
  }
 
  // ─── Gestion d'erreur HTTP ────────────────────────────────────────────────
  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Une erreur est survenue';
    if (error.status === 409) message = 'Ce ticket a déjà été scanné (doublon)';
    else if (error.status === 404) message = 'Ressource introuvable';
    else if (error.status === 400) message = error.error?.message ?? 'Données invalides';
    else if (error.status === 0)   message = 'Impossible de joindre le serveur';
    return throwError(() => ({ status: error.status, message }));
  }
}