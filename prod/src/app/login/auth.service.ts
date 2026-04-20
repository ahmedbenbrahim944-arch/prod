// src/app/login/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';

export interface LoginCredentials {
  nom: string;
  password: string;
}

export interface RegisterData {
  nom: string;
  prenom: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: number;
    nom: string;
    prenom: string;
    type: 'admin' | 'user';
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://102.207.250.53:3000';
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'current_user';
  
  private readonly SPECIAL_MATRICULE_DM = '2603';
  private readonly SPECIAL_MATRICULE_LISTP = '7777';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

 
  adminLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/admin/login`, credentials)
      .pipe(
        tap(response => {
          this.saveAuthData(response);
          
          const matricule = response.user.nom;
          const choix1Matricules = ['9001', '1194'];
          
          if (matricule === '0929') {
            this.router.navigate(['/ch3']);
          }
          else if (matricule === '1411') {
            this.router.navigate(['/ch5']);
          }
          else if (matricule === '1952') {
            this.router.navigate(['/ecran']);
          }
          else if (matricule === '1922') {
            this.router.navigate(['/video']);
          }
          else if (matricule === this.SPECIAL_MATRICULE_LISTP) {
            this.router.navigate(['/listP']);
          }
          else if (choix1Matricules.includes(matricule)) {
            this.router.navigate(['/choix1']);
          }
          else {
            this.router.navigate(['/prod']);
          }
        }),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getUserData(): any {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Connexion User (Chef Secteur)
   */
  userLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/user/login`, credentials)
      .pipe(
        tap(response => {
          this.saveAuthData(response);

          const matricule = response.user.nom;

          // ── Matricule 1234 → choix4 (/ch4) ──────────────────────────────
          if (matricule === '1234') {
            this.router.navigate(['/ch4']);
          }
          else if (matricule === '1212') {
            this.router.navigate(['/dashboard']);
          }
          else if (matricule === '1313') {
            this.router.navigate(['/dashboard']);
          }
          else if (matricule === '1414') {
            this.router.navigate(['/dashboard']);
          }
          else if (matricule === '1515') {
            this.router.navigate(['/dashboard']);
          }
          else if (matricule === '1616') {
            this.router.navigate(['/dashboard']);
          }
          else if (matricule === '1717') {
            this.router.navigate(['/dashboard']);
          }
          // ── Matricule 9999 → stat2 ───────────────────────────────────────
          else if (matricule === '9999') {
            this.router.navigate(['/stat2']);
          }
          else {
            this.router.navigate(['/choix']);
          }
        }),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Inscription Admin (première création)
   */
  registerAdmin(data: RegisterData): Observable<any> {
    return this.http.post(`${this.API_URL}/admin/register`, data)
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Sauvegarder les données d'authentification
   */
  private saveAuthData(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
  }

  /**
   * Récupérer le token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Récupérer les infos utilisateur
   */
  getCurrentUser(): any {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Récupérer le type d'utilisateur
   */
  getUserType(): 'admin' | 'user' | null {
    const user = this.getCurrentUser();
    return user ? user.type : null;
  }

  /**
   * Récupérer le matricule de l'utilisateur connecté
   */
  getUserMatricule(): string | null {
    const user = this.getCurrentUser();
    return user ? user.nom : null;
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.getUserType() === 'admin';
  }

  /**
   * Vérifier si l'utilisateur est user (chef secteur)
   */
  isUser(): boolean {
    return this.getUserType() === 'user';
  }

  /**
   * Vérifier si l'utilisateur peut modifier DP (Production)
   */
  canEditDP(): boolean {
    if (!this.isUser()) {
      return false;
    }
    const matricule = this.getUserMatricule();
    return matricule !== this.SPECIAL_MATRICULE_DM;
  }

  /**
   * Vérifier si l'utilisateur peut modifier DM (Magasin)
   */
  canEditDM(): boolean {
    if (!this.isUser()) {
      return false;
    }
    const matricule = this.getUserMatricule();
    return matricule === this.SPECIAL_MATRICULE_DM;
  }

  /**
   * Vérifier si c'est le matricule spécial pour DM
   */
  isSpecialMatriculeDM(): boolean {
    const matricule = this.getUserMatricule();
    return matricule === this.SPECIAL_MATRICULE_DM;
  }

  /**
   * Vérifier si c'est le matricule spécial pour listP
   */
  isSpecialMatriculeListP(): boolean {
    const matricule = this.getUserMatricule();
    return matricule === this.SPECIAL_MATRICULE_LISTP;
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('matricule');
    this.router.navigate(['/login']);
  }

  /**
   * Obtenir les headers avec le token
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
}