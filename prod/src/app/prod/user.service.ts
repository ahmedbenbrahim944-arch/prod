// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface User {
  id?: number;
  nom: string;
  prenom: string;
  password?: string;
  isActive?: boolean;
  createdBy?: any;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateUserDto {
  nom: string;
  prenom: string;
  password: string;
}

export interface UpdateUserDto {
  nom?: string;
  prenom?: string;
  password?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://102.207.250.53:3000/user';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  create(user: CreateUserDto): Observable<any> {
    return this.http.post<any>(
      this.apiUrl,
      user,
      { headers: this.getAuthHeaders() }
    );
  }

  findAll(): Observable<User[]> {
    return this.http.get<User[]>(
      this.apiUrl,
      { headers: this.getAuthHeaders() }
    );
  }

  findOne(id: number): Observable<User> {
    return this.http.get<User>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  update(id: number, user: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/${id}`,
      user,
      { headers: this.getAuthHeaders() }
    );
  }

  toggleActive(id: number): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/${id}/toggle-active`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  remove(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }
}