// src/app/services/commentaire.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Commentaire {
  id: number;
  commentaire: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommentaireService {
  private apiUrl = 'http://102.207.250.53:3000/commentaires';

  constructor(private http: HttpClient) {}

  // Récupérer tous les commentaires
  getAllCommentaires(): Observable<Commentaire[]> {
    return this.http.get<Commentaire[]>(this.apiUrl);
  }

  // Récupérer un commentaire par ID
  getCommentaireById(id: number): Observable<Commentaire> {
    return this.http.get<Commentaire>(`${this.apiUrl}/${id}`);
  }

  // Créer un nouveau commentaire
  createCommentaire(commentaire: string): Observable<Commentaire> {
    return this.http.post<Commentaire>(this.apiUrl, { commentaire });
  }

  // Mettre à jour un commentaire
  updateCommentaire(id: number, commentaire: string): Observable<Commentaire> {
    return this.http.put<Commentaire>(`${this.apiUrl}/${id}`, { commentaire });
  }

  // Supprimer un commentaire
  deleteCommentaire(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}