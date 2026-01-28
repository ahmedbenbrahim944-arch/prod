// src/app/product/product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';
import { catchError, tap } from 'rxjs/operators';

export interface ProductLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string | null;
  imageOriginalName: string | null;
  references: string[];
  lastCreated: string;
  totalReferences?: number;
  createdBy?: {
    id: number;
    nom: string;
    prenom: string;
  };
  createdAt?: string;
}

export interface CreateProductRequest {
  ligne: string;
  references: string[];
}

export interface AddReferencesRequest {
  ligne: string;
  references: string[];
}

export interface SearchResponse {
  lines: ProductLine[];
  total?: number;
  query?: string;
}

export interface CreateProductResponse {
  message: string;
  ligne: string;
  references: string[];
  imageUrl?: string;
}

export interface AddReferencesResponse {
  message: string;
  ligne: string;
  addedReferences: string[];
  existingReferences?: string[];
}

export interface LineExistsResponse {
  ligne: string;
  exists: boolean;
}

export interface StatsResponse {
  totalLines: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://102.207.250.53:3000/products';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Obtenir toutes les lignes avec leurs références
   */
  getAllLines(): Observable<{ lines: ProductLine[], total: number }> {
    return this.http.get<{ lines: ProductLine[], total: number }>(`${this.apiUrl}/lines`);
  }

  /**
   * Obtenir une ligne spécifique
   */
  getLine(ligne: string): Observable<ProductLine> {
    return this.http.get<ProductLine>(`${this.apiUrl}/lines/${ligne}`);
  }

  /**
   * Rechercher des lignes
   */
  searchLines(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${this.apiUrl}/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Rechercher une ligne spécifique (POST)
   */
  searchLine(ligne: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/search`, { ligne });
  }

  /**
   * Créer une nouvelle ligne avec image
   */
  createLineWithImage(createData: CreateProductRequest, imageFile: File | null): Observable<CreateProductResponse> {
    const formData = new FormData();
    formData.append('ligne', createData.ligne);
    formData.append('references', JSON.stringify(createData.references));
    
    if (imageFile) {
      formData.append('image', imageFile);
    }

    return this.http.post<CreateProductResponse>(
      this.apiUrl,
      formData,
      { headers: this.getAuthHeaders(true) }
    );
  }

  /**
   * Créer une nouvelle ligne sans image
   */
  createLine(createData: CreateProductRequest): Observable<CreateProductResponse> {
    return this.http.post<CreateProductResponse>(
      this.apiUrl,
      createData,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Ajouter des références à une ligne existante
   */
  addReferences(ligne: string, references: string[]): Observable<AddReferencesResponse> {
    const body = { ligne, references };
    return this.http.post<AddReferencesResponse>(
      `${this.apiUrl}/ajouterref`,
      body,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Ajouter une image à une ligne existante
   */
  // Dans product.service.ts - Méthode addImageToLine()
addImageToLine(ligne: string, imageFile: File): Observable<any> {
  console.log('Tentative d\'upload pour ligne:', ligne); // DEBUG
  console.log('Fichier image:', imageFile.name, imageFile.size, imageFile.type); // DEBUG
  
  const formData = new FormData();
  formData.append('image', imageFile);

  console.log('Headers d\'authentification:', this.getAuthHeaders(true)); // DEBUG

  return this.http.post<any>(
    `${this.apiUrl}/lines/${ligne}/image`,
    formData,
    { 
      headers: this.getAuthHeaders(true),
      reportProgress: true // Pour le débogage
    }
  ).pipe(
    tap(response => console.log('Réponse du backend:', response)), // DEBUG
    catchError(error => {
      console.error('Erreur HTTP:', error);
      console.error('Statut:', error.status);
      console.error('Message:', error.message);
      console.error('Erreur complète:', error);
      throw error;
    })
  );
}

  /**
   * Vérifier si une ligne existe
   */
  checkLineExists(ligne: string): Observable<LineExistsResponse> {
    return this.http.get<LineExistsResponse>(`${this.apiUrl}/lines/${ligne}/exists`);
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/stats`);
  }

  /**
   * Obtenir l'URL complète de l'image
   */
  // src/app/product/product.service.ts - MÉTHODE CORRIGÉE
getImageUrl(imagePath: string | null): string {
  console.log('getImageUrl appelé avec:', imagePath); // DEBUG
  
  if (!imagePath || imagePath.trim() === '') {
    console.log('Image path vide, retourne image par défaut');
    return 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&fit=crop&auto=format';
  }
  
  // Si c'est déjà une URL complète
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    console.log('URL complète détectée:', imagePath);
    return imagePath;
  }
  
  // Si c'est un chemin local qui commence par /uploads
  if (imagePath.startsWith('/uploads/')) {
    const fullUrl = `http://102.207.250.53:3000${imagePath}`;
    console.log('Chemin local converti en URL complète:', fullUrl);
    return fullUrl;
  }
  
  // Si c'est juste un nom de fichier
  const fullUrl = `http://102.207.250.53:3000/uploads/products/${imagePath}`;
  console.log('Nom de fichier converti en URL:', fullUrl);
  return fullUrl;
}

  /**
   * Obtenir les headers d'authentification
   */
  private getAuthHeaders(isFormData: boolean = false): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    if (!isFormData) {
      headers = headers.set('Content-Type', 'application/json');
    }
    
    return headers;
  }

  /**
   * Supprimer une ligne
   */
  deleteLine(ligne: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/lines/${ligne}`,
      { headers: this.getAuthHeaders() }
    );
  }
  

  /**
   * Parser les références depuis une chaîne de caractères
   */
  parseReferences(referencesString: string): string[] {
    if (!referencesString.trim()) {
      return [];
    }
    
    // Séparer par virgules, points-virgules ou retours à la ligne
    return referencesString
      .split(/[,;\n]/)
      .map(ref => ref.trim())
      .filter(ref => ref.length > 0);
  }

  /**
   * Formater les références pour l'affichage
   */
  formatReferences(references: string[]): string {
    return references.join(', ');
  }
}