// src/app/services/saisie-rapport.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface PhaseHeure {
  phase: string;
  heures: number;
}

export interface CreateSaisieRapportDto {
  semaine: string;
  jour: string;
  ligne: string;
  matricule: number;
  phases: PhaseHeure[];
  // Supprimer nomPrenom si le backend ne l'accepte pas
}

export interface SaisieRapport {
  id: number;
  semaine: string;
  jour: string;
  ligne: string;
  matricule: number;
  nomPrenom: string;
  phases: PhaseHeure[];
  totalHeuresJour: number;
  heuresRestantes: number;
  nbPhasesJour: number;
  pcsProdLigne: number;
  pourcentageTotalEcart: number;
  createdAt: string;
  updatedAt: string;
}
export interface UpdateSaisieRapportDto {
  semaine: string;
  jour: string;
  ligne: string;
  matricule: number;
  phases: PhaseHeure[];
}

export interface VoirRapportsDto {
  semaine: string;
  jour?: string;
  ligne?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SaisieRapportService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

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

  // Créer un nouveau rapport
  createRapport(dto: CreateSaisieRapportDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/saisie-rapport`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les rapports par semaine et jour
  getRapportsBySemaineJour(semaine: string, jour: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/saisie-rapport/semaine/${semaine}/jour/${jour}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les rapports par ligne
  getRapportsByLigne(ligne: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/saisie-rapport/ligne/${ligne}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Supprimer un rapport
  deleteRapport(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/saisie-rapport/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer tous les rapports
  getAllRapports(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/saisie-rapport`,
      { headers: this.getAuthHeaders() }
    );
  }
  voirRapportsFiltres(dto: VoirRapportsDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/saisie-rapport/filtres`,  // ✅ CORRECTION: utiliser la route correcte
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // Mettre à jour un rapport (nouvelle méthode - sans ID)
  updateRapport(dto: UpdateSaisieRapportDto): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/saisie-rapport`,  // ✅ CORRECTION: sans ID dans l'URL
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // Obtenir un rapport par semaine/jour/ligne/matricule (nouvelle méthode)
  getRapportParCriteres(
    semaine: string, 
    jour: string, 
    ligne: string, 
    matricule: number
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/saisie-rapport/semaine/${semaine}/jour/${jour}/ligne/${ligne}/matricule/${matricule}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les rapports par semaine uniquement
  getRapportsBySemaine(semaine: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/saisie-rapport/semaine/${semaine}`,
      { headers: this.getAuthHeaders() }
    );
  }
}