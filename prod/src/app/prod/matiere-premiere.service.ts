// src/app/prod/matiere-premiere.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';


export interface MatierePremiere {
  id: number;
  ligne: string;
  refMatierePremier: string;
}

export interface CreateMatierePremiereDto {
  ligne: string;
  refMatierePremier: string;
}

export interface UpdateMatierePremiereDto {
  ligne?: string;
  refMatierePremier?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatierePremiereService {
  private http = inject(HttpClient);
  private apiUrl = `http://102.207.250.53:3000/matiere-pre`;

  /**
   * Créer une nouvelle matière première
   */
  create(createDto: CreateMatierePremiereDto): Observable<MatierePremiere> {
    return this.http.post<MatierePremiere>(this.apiUrl, createDto);
  }

  /**
   * Récupérer toutes les matières premières
   */
  findAll(): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(this.apiUrl);
  }

  /**
   * Récupérer toutes les lignes distinctes
   */
  findAllLignes(): Observable<{ lignes: string[] }> {
    return this.http.get<{ lignes: string[] }>(`${this.apiUrl}/lignes`);
  }

  /**
   * Récupérer toutes les références matière première distinctes
   */
  findAllRefs(): Observable<{ refMatierePremier: string[] }> {
    return this.http.get<{ refMatierePremier: string[] }>(`${this.apiUrl}/refs`);
  }

  /**
   * Récupérer les matières premières par ligne
   */
  findByLigne(ligne: string): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(`${this.apiUrl}/ligne/${ligne}`);
  }

  /**
   * Récupérer une matière première par ID
   */
  findOne(id: number): Observable<MatierePremiere> {
    return this.http.get<MatierePremiere>(`${this.apiUrl}/${id}`);
  }

  /**
   * Modifier une matière première
   */
  update(id: number, updateDto: UpdateMatierePremiereDto): Observable<MatierePremiere> {
    return this.http.patch<MatierePremiere>(`${this.apiUrl}/${id}`, updateDto);
  }

  /**
   * Supprimer une matière première par ID
   */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Supprimer par ligne et référence
   */
  removeByLigneAndRef(ligne: string, ref: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/ligne/${ligne}/ref/${ref}`);
  }

  /**
   * Vérifier si une matière première existe déjà
   */
  checkIfExists(ligne: string, refMatierePremier: string): Observable<boolean> {
    return this.http.get<MatierePremiere[]>(`${this.apiUrl}/ligne/${ligne}`).pipe(
      map(matieres => matieres.some(m => m.refMatierePremier === refMatierePremier)),
      catchError(() => of(false))
    );
  }

  /**
   * Rechercher par ligne ou référence
   */
  search(query: string): Observable<MatierePremiere[]> {
    return this.http.get<MatierePremiere[]>(`${this.apiUrl}`).pipe(
      map(matieres => matieres.filter(m => 
        m.ligne.toLowerCase().includes(query.toLowerCase()) ||
        m.refMatierePremier.toLowerCase().includes(query.toLowerCase())
      ))
    );
  }
}