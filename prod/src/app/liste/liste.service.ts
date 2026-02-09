import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

export interface ProductiviteOuvrier {
  JOURS: string;
  MAT: number;
  'NOM ET PRENOM': string;
  'N°HEURS': number;
  LIGNES: string;
  PRODUCTIVITE: number;
  M1: number;
  M2: number;
  M3: number;
  M4: number;
  M5: number;
  M6: number;
  M7: number;
}

@Injectable({
  providedIn: 'root'
})
export class ListeService {
  private apiUrl = 'http://102.207.250.53:3000/stats/productivite-ouvriers';

  constructor(private http: HttpClient) {}

  getProductiviteOuvriers(dateDebut: string, dateFin: string): Observable<ProductiviteOuvrier[]> {
    const params = new HttpParams()
      .set('dateDebut', dateDebut)
      .set('dateFin', dateFin);

    console.log('🌐 Appel API:', this.apiUrl);
    console.log('📅 Paramètres:', { dateDebut, dateFin });

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      tap(response => {
        console.log('✅ Réponse API COMPLÈTE:', response);
        console.log('📊 Type de réponse:', typeof response);
        console.log('📊 Est un tableau?', Array.isArray(response));
        
        if (response && typeof response === 'object') {
          console.log('🔍 Clés de l\'objet réponse:', Object.keys(response));
          
          // Vérifiez la structure du tableau
          if (response.tableau) {
            console.log('🔍 Structure tableau:', response.tableau);
            console.log('🔍 tableau est un tableau?', Array.isArray(response.tableau));
            console.log('🔍 Longueur du tableau:', Array.isArray(response.tableau) ? response.tableau.length : 'N/A');
          }
        }
      }),
      map(response => {
        // 1. Si la réponse est directement un tableau
        if (Array.isArray(response)) {
          console.log('✅ Extraction des données: tableau direct, longueur:', response.length);
          return this.formatData(response);
        }
        
        // 2. Si la réponse a une propriété 'tableau' qui est un tableau
        if (response && response.tableau && Array.isArray(response.tableau)) {
          console.log('✅ Extraction des données: via tableau, longueur:', response.tableau.length);
          return this.formatData(response.tableau);
        }
        
        // 3. Si la réponse a une propriété 'lignes' qui est un tableau
        if (response && response.lignes && Array.isArray(response.lignes)) {
          console.log('✅ Extraction des données: via lignes, longueur:', response.lignes.length);
          return this.formatData(response.lignes);
        }
        
        // 4. Si la réponse a une propriété 'data' qui est un tableau
        if (response && response.data && Array.isArray(response.data)) {
          console.log('✅ Extraction des données: via data, longueur:', response.data.length);
          return this.formatData(response.data);
        }
        
        console.warn('⚠️ Structure non reconnue, réponse:', response);
        return [];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Formate les données pour correspondre à l'interface ProductiviteOuvrier
   */
  private formatData(data: any[]): ProductiviteOuvrier[] {
    return data.map((item: any) => ({
      JOURS: item.JOURS || '',
      MAT: item.MAT || 0,
      'NOM ET PRENOM': item['NOM ET PRENOM'] || '',
      'N°HEURS': item['N°HEURS'] || 0,
      LIGNES: item.LIGNES || '',
      PRODUCTIVITE: item.PRODUCTIVITE || 0,
      M1: item.M1 || 0,
      M2: item.M2 || 0,
      M3: item.M3 || 0,
      M4: item.M4 || 0,
      M5: item.M5 || 0,
      M6: item.M6 || 0,
      M7: item.M7 || 0
    }));
  }

  private handleError(error: HttpErrorResponse) {
    console.error('❌ Erreur HTTP:', error);
    
    if (error.error instanceof ErrorEvent) {
      console.error('Erreur client:', error.error.message);
    } else {
      console.error(`Code erreur: ${error.status}, Message: ${error.message}`);
    }
    
    return throwError(() => error);
  }
}