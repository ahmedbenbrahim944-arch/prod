// employee-update.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as XLSX from 'xlsx';

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

  // ── Récupérer les employés de TOUS les services en une seule fois ────────
  getAllServicesEmployees(): Observable<{ service: string; employees: Employee[] }[]> {
    const calls = SERVICES.map(s =>
      this.getByService(s.label).pipe(
        map(employees => ({ service: s.label, employees }))
      )
    );
    return forkJoin(calls);
  }

  // ── Construire une feuille Excel à partir d'une liste d'employés ─────────
  private buildSheetData(employees: Employee[]) {
    return employees.map(emp => ({
      'Matricule': emp.matricule,
      'Nom & Prénom': emp.nomPrenom,
      'Date de naissance': emp.dateNaissance ?? '',
      'CIN': emp.cin ?? '',
      'Numéro Tél': emp.numTel ?? '',
      "Date d'embauche": emp.dateEmbauche ?? '',
      'Situation familiale': emp.situationFamiliale ?? '',
      'Bus': emp.bus ?? '',
      'Lieu': emp.lieu ?? '',
      'Service': emp.service ?? '',
    }));
  }

  private getColumnWidths() {
    return [
      { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 },
      { wch: 18 }, { wch: 15 },
    ];
  }

  // ── Export UN SEUL fichier Excel avec un onglet par service ──────────────
  exportAllServicesToExcel(groups: { service: string; employees: Employee[] }[]): void {
    const workbook = XLSX.utils.book_new();

    for (const group of groups) {
      // Onglet même si vide, pour garder trace du service
      const sheetData = this.buildSheetData(group.employees);
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = this.getColumnWidths();

      // Nom d'onglet max 31 caractères (limite Excel), sans caractères interdits
      const sheetName = group.service.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Service');
    }

    // Onglet récap "Tous" avec tout le monde ensemble
    const allEmployees = groups.flatMap(g => g.employees);
    const allSheet = XLSX.utils.json_to_sheet(this.buildSheetData(allEmployees));
    allSheet['!cols'] = this.getColumnWidths();
    XLSX.utils.book_append_sheet(workbook, allSheet, 'Tous');

    const fileName = `Employes_Tous_Services_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
}