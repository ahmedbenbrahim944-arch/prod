// src/app/services/non-conf.service.ts - Version complète avec référence qualité
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface CreateOrUpdateNonConfDto {
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  matierePremiere?: number;
  absence?: number;
  rendement?: number;
  methode?: number;
  maintenance?: number;
  phasesMaintenance?: string;
  qualite?: number;
  environnement?: number;
  referenceMatierePremiere?: string;
  referenceQualite?: string; // AJOUT: Référence qualité
  commentaire?: string;
}

export interface GetNonConfDto {
  semaine?: string;
  jour?: string;
  ligne?: string;
  reference?: string;
}

export interface NonConformiteResponse {
  id: number;
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  total7M: number;
  details: {
    matierePremiere: number;
    referenceMatierePremiere: string | null;
    absence: number;
    rendement: number;
    methode: number;
    maintenance: number;
    phasesMaintenance: string[];
    qualite: number;
    environnement: number;
    referenceQualite: string | null; // AJOUT: Référence qualité
  };
  commentaire: string | null;
  declarePar: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetTotalEcartDto {
  semaine: string;
  ligne: string;
  reference: string;
}

@Injectable({
  providedIn: 'root'
})
export class NonConfService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  public getAuthHeaders(): HttpHeaders {
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

  // ==================== VALIDATION ====================
  validateNonConfDto(dto: CreateOrUpdateNonConfDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dto.semaine) errors.push('La semaine est obligatoire');
    if (!dto.jour) errors.push('Le jour est obligatoire');
    if (!dto.ligne) errors.push('La ligne est obligatoire');
    if (!dto.reference) errors.push('La référence est obligatoire');

    // Validation matière première
    if (dto.matierePremiere && dto.matierePremiere > 0 && !dto.referenceMatierePremiere) {
      errors.push('Une référence matière première est recommandée quand la quantité est > 0');
    }

    // AJOUT: Validation qualité
    if (dto.qualite && dto.qualite > 0 && !dto.referenceQualite) {
      errors.push('Une référence qualité est recommandée quand la quantité est > 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ==================== CREATE/UPDATE ====================
  createOrUpdateNonConformite(dto: CreateOrUpdateNonConfDto): Observable<any> {
    // Valider
    const validation = this.validateNonConfDto(dto);
    if (!validation.isValid) {
      return new Observable(observer => {
        observer.error({
          status: 400,
          message: 'Validation échouée',
          errors: validation.errors
        });
        observer.complete();
      });
    }

    // Nettoyer le DTO
    const cleanDto = { ...dto };
    
    // Supprimer les valeurs 0
    if (cleanDto.matierePremiere === 0) delete cleanDto.matierePremiere;
    if (cleanDto.absence === 0) delete cleanDto.absence;
    if (cleanDto.rendement === 0) delete cleanDto.rendement;
    if (cleanDto.methode === 0) delete cleanDto.methode;
    if (cleanDto.maintenance === 0) delete cleanDto.maintenance;
    if (cleanDto.qualite === 0) {
      delete cleanDto.qualite;
      delete cleanDto.referenceQualite;
    }

    if (cleanDto.environnement === 0) delete cleanDto.environnement; 
    
    // Nettoyer les références vides
    if (!cleanDto.referenceQualite || cleanDto.referenceQualite.trim() === '') {
      delete cleanDto.referenceQualite;
    }
    if (!cleanDto.referenceMatierePremiere || cleanDto.referenceMatierePremiere.trim() === '') {
      delete cleanDto.referenceMatierePremiere;
    }

    console.log('Envoi non-conformité avec références qualité:', cleanDto);

    return this.http.patch<any>(
      `${this.apiUrl}/nonconf`,
      cleanDto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== GET DETAIL ====================
  getNonConformite(dto: GetNonConfDto): Observable<NonConformiteResponse> {
    return this.http.post<NonConformiteResponse>(
      `${this.apiUrl}/nonconf/detail`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== CHECK EXISTS ====================
  checkNonConformiteExists(dto: GetNonConfDto): Observable<{ 
    exists: boolean; 
    data?: NonConformiteResponse;
    message?: string;
  }> {
    return this.http.post<{ 
      exists: boolean; 
      data?: NonConformiteResponse;
      message?: string;
    }>(
      `${this.apiUrl}/nonconf/exists`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== GET BY CRITERIA ====================
  getNonConformiteByCriteria(dto: GetNonConfDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/nonconf/recherche`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== GET ALL ====================
  getNonConformites(dto: GetNonConfDto): Observable<any> {
    const params: any = {};
    if (dto.semaine) params.semaine = dto.semaine;
    if (dto.jour) params.jour = dto.jour;
    if (dto.ligne) params.ligne = dto.ligne;
    if (dto.reference) params.reference = dto.reference;

    return this.http.get<any>(
      `${this.apiUrl}/nonconf`,
      { 
        headers: this.getAuthHeaders(),
        params: params 
      }
    );
  }

  // ==================== DELETE ====================
  deleteNonConformite(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/nonconf/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== STATISTIQUES ====================
  getStats(semaine?: string): Observable<any> {
    const params: any = {};
    if (semaine) params.semaine = semaine;

    return this.http.get<any>(
      `${this.apiUrl}/nonconf/stats/total`,
      { 
        headers: this.getAuthHeaders(),
        params: params 
      }
    );
  }

  // ==================== GET TOTAL ECART POURCENTAGE ====================
  getTotalEcartPourcentage(dto: GetTotalEcartDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/nonconf/vu/total-ecart`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== STATS QUALITÉ ====================
  getQualiteStats(semaine?: string): Observable<any> {
    const params: any = {};
    if (semaine) params.semaine = semaine;

    return this.http.get<any>(
      `${this.apiUrl}/nonconf/stats/qualite`,
      { 
        headers: this.getAuthHeaders(),
        params: params 
      }
    );
  }
}