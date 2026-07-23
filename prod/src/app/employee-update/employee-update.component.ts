// employee-update.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  EmployeeUpdateService,
  Employee,
  SERVICES,
  SITUATIONS,
} from './employee-update.service';

@Component({
  selector: 'app-employee-update',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './employee-update.component.html',
  styleUrls: ['./employee-update.component.css'],
})
export class EmployeeUpdateComponent implements OnInit, OnDestroy {
  services = SERVICES;
  situations = SITUATIONS;

  activeService: string | null = null;

  // ── État global pour l'export Excel unique ────────────────────────────────
  loadingExportAll = false;
  exportAllError = '';

  serviceState: Record<string, {
    employees: Employee[];
    selectedEmployee: Employee | null;
    form: Partial<Employee>;
    matriculeInput: string;
    nomPrenom: string;
    loadingMatricule: boolean;
    loadingSave: boolean;
    success: string;
    error: string;
    notFound: boolean;
  }> = {};

  // Un Subject debounce par service
  private subjects: Record<string, Subject<string>> = {};
  private subs: Subscription[] = [];

  constructor(private svc: EmployeeUpdateService) {}

  ngOnInit(): void {
    for (const s of this.services) {
      // Initialiser l'état
      this.serviceState[s.key] = {
        employees: [],
        selectedEmployee: null,
        form: {},
        matriculeInput: '',
        nomPrenom: '',
        loadingMatricule: false,
        loadingSave: false,
        success: '',
        error: '',
        notFound: false,
      };

      // Subject avec debounce 700ms — appel API seulement après arrêt de frappe
      const subject = new Subject<string>();
      this.subjects[s.key] = subject;

      const sub = subject.pipe(
        debounceTime(700),
        distinctUntilChanged(),
      ).subscribe((value) => {
        this._doSearch(s.key, value);
      });

      this.subs.push(sub);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Appelé à chaque frappe clavier (ne fait PAS d'appel API direct) ──────
  onMatriculeChange(key: string, value: string): void {
    const state = this.serviceState[key];

    // Reset immédiat de l'affichage
    state.nomPrenom = '';
    state.selectedEmployee = null;
    state.success = '';
    state.error = '';
    state.notFound = false;

    if (!value || value.trim().length < 1) {
      state.loadingMatricule = false;
      const serviceLabel = this.services.find(s => s.key === key)?.label ?? key;
      state.form = { service: serviceLabel };
      return;
    }

    // Afficher le loader, puis attendre le debounce
    state.loadingMatricule = true;
    this.subjects[key].next(value.trim());
  }

  // ── Appel API réel (déclenché seulement après 700ms sans frappe) ──────────
  private _doSearch(key: string, value: string): void {
    const state = this.serviceState[key];
    const serviceLabel = this.services.find(s => s.key === key)?.label ?? key;

    this.svc.getByMatricule(value).subscribe((emp) => {
      state.loadingMatricule = false;
      if (emp) {
        state.selectedEmployee = emp;
        state.nomPrenom = emp.nomPrenom;
        state.form = {
          matricule: emp.matricule,
          nomPrenom: emp.nomPrenom,
          dateNaissance: emp.dateNaissance ?? '',
          cin: emp.cin ?? '',
          numTel: emp.numTel ?? '',
          dateEmbauche: emp.dateEmbauche ?? '',
          situationFamiliale: emp.situationFamiliale ?? '',
          bus: emp.bus ?? '',
          lieu: emp.lieu ?? '',
          service: serviceLabel,
        };
      } else {
        state.notFound = true;
        state.form = { service: serviceLabel };
      }
    });
  }

  // ── Ouvrir / fermer une zone ──────────────────────────────────────────────
  toggleService(key: string): void {
    this.activeService = this.activeService === key ? null : key;
    if (this.activeService === key) {
      const state = this.serviceState[key];
      const serviceLabel = this.services.find(s => s.key === key)?.label ?? key;
      state.matriculeInput = '';
      state.nomPrenom = '';
      state.form = { service: serviceLabel };
      state.selectedEmployee = null;
      state.success = '';
      state.error = '';
      state.notFound = false;
      state.loadingMatricule = false;
    }
  }

  // ── Enregistrer ───────────────────────────────────────────────────────────
  onSubmit(key: string): void {
    const state = this.serviceState[key];
    if (!state.selectedEmployee?.id) {
      state.error = 'Aucun employé sélectionné.';
      return;
    }

    state.loadingSave = true;
    state.success = '';
    state.error = '';

    this.svc.update(state.selectedEmployee.id, state.form).subscribe({
      next: () => {
        state.loadingSave = false;
        state.success = `✅ ${state.nomPrenom} mis à jour avec succès !`;
      },
      error: () => {
        state.loadingSave = false;
        state.error = '❌ Erreur lors de la mise à jour. Vérifiez les données.';
      },
    });
  }

  // ── Export Excel GLOBAL : un seul bouton, un seul fichier, tous services ──
  exportAllToExcel(): void {
    this.loadingExportAll = true;
    this.exportAllError = '';

    this.svc.getAllServicesEmployees().subscribe({
      next: (groups) => {
        this.loadingExportAll = false;
        const totalCount = groups.reduce((sum, g) => sum + g.employees.length, 0);
        if (totalCount === 0) {
          this.exportAllError = 'Aucun employé trouvé.';
          return;
        }
        this.svc.exportAllServicesToExcel(groups);
      },
      error: () => {
        this.loadingExportAll = false;
        this.exportAllError = '❌ Erreur lors de la récupération des employés.';
      },
    });
  }
}