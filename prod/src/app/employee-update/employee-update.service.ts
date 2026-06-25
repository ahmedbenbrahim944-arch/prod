// employee-update.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Employee {
  id?: number;
  matricule: string;
  nomPrenom: string;
  dateNaissance?: string;
  cin?: string;
  numTel?: string;
  dateEmbauche?: string;
  situationFamiliale?: string;
  bus?: string;
  lieu?: string;
  service: string;
}

export const SERVICES = [
  { key: 'production',     label: 'Production',     icon: '', color: '#3B82F6' },
  { key: 'magasin',        label: 'Magasin',         icon: '', color: '#10B981' },
  { key: 'maintenance',    label: 'Maintenance',     icon: '', color: '#F59E0B' },
  { key: 'qualite',        label: 'Qualité',         icon: '', color: '#8B5CF6' },
  { key: 'administratif',  label: 'Administratif',   icon: '', color: '#EF4444' },
];

export const SITUATIONS = ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve'];

@Injectable({ providedIn: 'root' })
export class EmployeeUpdateService {
  private apiUrl = 'http://102.207.250.53:3000/employees';

  constructor(private http: HttpClient) {}

  // Chercher un employé par matricule → retourne nomPrenom
  getByMatricule(matricule: string): Observable<Employee | null> {
  return this.http
    .get<Employee>(`${this.apiUrl}/by-matricule/${matricule}`)
    .pipe(
      catchError(() => of(null))
    );
}

  // Récupérer les employés par service
  getByService(service: string): Observable<Employee[]> {
    return this.http
      .get<Employee[]>(`${this.apiUrl}?search=${service}`)
      .pipe(catchError(() => of([])));
  }

  // Mettre à jour un employé
  update(id: number, data: Partial<Employee>): Observable<Employee> {
    return this.http.patch<Employee>(`${this.apiUrl}/${id}`, data);
  }
}