// src/app/services/selection.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../login/auth.service';

export interface Ouvrier {
  matricule: number;
  nom?: string;
  prenom?: string;
  nomPrenom?: string;
  ligne?: string;
}

export interface Product {
  reference: string;
  ligneRef: string;
  designation?: string;
}

export interface MatierePremier {
  id: number;
  ligne: string;
  refMatierePremier: string;
}

// Interface unifiée pour les références (Product + MatierePremier)
export interface ReferenceItem {
  reference: string;
  ligneRef: string;
  designation?: string;
  type: 'product' | 'matiere_premier';
  sourceId?: number;
}

export interface PlanningSelection {
  id?: number;
  date: string;
  semaine: number;
  semaineId: number;
  semaineNom: string;
  matricule: number;
  nomPrenom: string;
  ligne: string;
  reference: string;
  ligneRef: string;
  typeReference: 'product' | 'matiere_premier';
  statut: string;
  numTicket?: string;
  qteASelectionne: number;
  objectifHeure: number;
  qteSelection?: number;
  rebut?: number;
  nHeures?: number;
  rendement?: number;
}

export interface CreatePlanningSelectionDto {
  date: string;
  matricule: number;
  reference: string;
  qteASelectionne: number;
  objectifHeure: number;
  qteSelection?: number;
  nHeures?: number;
  numTicket?: string;
  rebut?: number;
}

export interface UpdatePlanningSelectionDto {
  nHeures?: number;
  qteSelection?: number;
  rebut?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SelectionService {
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Récupérer les ouvriers
  getOuvriers(): Observable<Ouvrier[]> {
    return this.http.get<Ouvrier[]>(
      `${this.apiUrl}/ouvrier`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer un ouvrier par matricule
  getOuvrierByMatricule(matricule: number): Observable<Ouvrier> {
    return this.http.get<Ouvrier>(
      `${this.apiUrl}/ouvrier/${matricule}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les produits depuis /products/lines
  getProducts(): Observable<Product[]> {
    return this.http.get<any>(
      `${this.apiUrl}/products/lines`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        console.log('📦 Réponse API products/lines:', response);
        
        if (response && response.lines) {
          const products: Product[] = [];
          response.lines.forEach((line: any) => {
            if (line.references && Array.isArray(line.references)) {
              line.references.forEach((ref: string) => {
                products.push({
                  reference: ref,
                  ligneRef: line.ligne,
                  designation: line.imageOriginalName || line.ligne || ''
                });
              });
            }
          });
          console.log('✅ Products transformés:', products.length, 'produits');
          return products;
        }
        console.warn('⚠️ Format de réponse inattendu:', response);
        return [];
      }),
      catchError(error => {
        console.error('❌ Erreur chargement produits:', error);
        return of([]);
      })
    );
  }

  // Récupérer les matières premières
  getMatieresPremieres(): Observable<MatierePremier[]> {
    return this.http.get<MatierePremier[]>(
      `${this.apiUrl}/matiere-pre`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('❌ Erreur chargement matières premières:', error);
        return of([]);
      })
    );
  }

  // Récupérer toutes les références (Products + MatièresPremieres)
  getAllReferences(): Observable<ReferenceItem[]> {
    return forkJoin({
      products: this.getProducts(),
      matieresPremieres: this.getMatieresPremieres()
    }).pipe(
      map(({ products, matieresPremieres }) => {
        const references: ReferenceItem[] = [];

        products.forEach(product => {
          references.push({
            reference: product.reference,
            ligneRef: product.ligneRef,
            designation: product.designation,
            type: 'product',
            sourceId: undefined
          });
        });

        matieresPremieres.forEach(mp => {
          references.push({
            reference: mp.refMatierePremier,
            ligneRef: mp.ligne,
            designation: `Matière Première - ${mp.ligne}`,
            type: 'matiere_premier',
            sourceId: mp.id
          });
        });

        console.log('🔗 Références combinées:', references.length, 'au total');
        return references;
      }),
      catchError(error => {
        console.error('❌ Erreur combinaison références:', error);
        return of([]);
      })
    );
  }

  // Récupérer un produit par référence
  getProductByReference(reference: string): Observable<Product> {
    return this.getProducts().pipe(
      map(products => {
        const product = products.find(p => p.reference === reference);
        if (!product) {
          throw new Error(`Produit avec la référence "${reference}" introuvable`);
        }
        return product;
      })
    );
  }

  // Créer un planning de sélection
  createPlanningSelection(data: CreatePlanningSelectionDto): Observable<PlanningSelection> {
    return this.http.post<PlanningSelection>(
      `${this.apiUrl}/planning-selection`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les plannings par semaine
  getPlanningsBySemaine(semaine: number): Observable<PlanningSelection[]> {
    return this.http.get<PlanningSelection[]>(
      `${this.apiUrl}/planning-selection/semaine/${semaine}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Mettre à jour par matricule, référence et date
  updatePlanningByInfo(
    matricule: number,
    reference: string,
    date: string,
    data: UpdatePlanningSelectionDto
  ): Observable<PlanningSelection> {
    return this.http.patch<PlanningSelection>(
      `${this.apiUrl}/planning-selection/update/by-info?matricule=${matricule}&reference=${reference}&date=${date}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  // 🆕 Mettre à jour par ID
  updatePlanningById(id: number, data: any): Observable<PlanningSelection> {
    return this.http.patch<PlanningSelection>(
      `${this.apiUrl}/planning-selection/${id}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  // 🆕 Récupérer les plannings incomplets (en attente)
  getPlanningsIncomplets(): Observable<PlanningSelection[]> {
    return this.http.get<PlanningSelection[]>(
      `${this.apiUrl}/planning-selection/incomplets`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Supprimer un planning
  deletePlanning(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/planning-selection/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les statistiques par semaine
  getStatsBySemaine(semaine: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/planning-selection/stats/semaine/${semaine}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les semaines
  getSemaines(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/semaines`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer les semaines depuis la route publique
  getSemainesPublic(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semaines/public`);
  }

  // Récupérer les semaines pour le planning
  getSemainesForPlanning(): Observable<any> {
    return this.getSemaines().pipe(
      catchError(error => {
        console.error('Erreur chargement semaines:', error);
        
        if (error.status === 401) {
          console.log('Tentative avec route publique...');
          return this.getSemainesPublic();
        }
        
        throw error;
      })
    );
  }
}