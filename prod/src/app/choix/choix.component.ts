import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../login/auth.service';
import { OuvrierService } from '../prod/ouvrier.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

interface WorkerForm {
  matricule: number | null;
  nomPrenom: string;
  errors: { matricule?: string; nomPrenom?: string };
}

@Component({
  selector: 'app-choix',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './choix.component.html',
  styleUrls: ['./choix.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ChoixComponent implements OnInit {
  matriculeUtilisateur: string = '';
  showSaisButton: boolean = false;

  // ── Modal Ouvrier ──────────────────────────────────────────
  showOuvrierModal: boolean = false;
  loading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showSuccess: boolean = false;

  ouvriers: any[] = [];

  workerForm: WorkerForm = {
    matricule: null,
    nomPrenom: '',
    errors: {}
  };

  matriculeCheckResult: {
    available: boolean;
    message: string;
    existingWorker?: any;
  } | null = null;

  checkingMatricule: boolean = false;

  constructor(
    private authService: AuthService,
    private ouvrierService: OuvrierService
  ) {}

  ngOnInit(): void {
    const matricule = this.authService.getUserMatricule();
    if (matricule) {
      this.matriculeUtilisateur = matricule;
      this.showSaisButton = (this.matriculeUtilisateur === '2603');
    }
  }

  retourLogin() {
    this.authService.logout();
  }

  // ── Ouvrir / Fermer la modal ───────────────────────────────
  openOuvrierModal() {
    this.showOuvrierModal = true;
    this.loadOuvriers();
  }

  closeOuvrierModal() {
    this.showOuvrierModal = false;
    this.resetWorkerForm();
    this.errorMessage = null;
    this.successMessage = null;
    this.showSuccess = false;
  }

  // ── Chargement de la liste ─────────────────────────────────
  private loadOuvriers() {
    this.loading = true;
    this.ouvrierService.findAll()
      .pipe(
        catchError(() => {
          this.errorMessage = 'Impossible de charger la liste des ouvriers';
          return of([]);
        }),
        finalize(() => this.loading = false)
      )
      .subscribe(ouvriers => {
        this.ouvriers = ouvriers;
      });
  }

  refreshOuvriers() {
    this.loadOuvriers();
  }

  // ── Vérification du matricule ──────────────────────────────
  async checkIfWorkerExists(matricule: number): Promise<boolean> {
    try {
      await this.ouvrierService.searchByMatricule(matricule).toPromise();
      return true;
    } catch (error: any) {
      if (error.status === 404) return false;
      return false;
    }
  }

  async onCheckMatricule() {
    if (!this.workerForm.matricule || this.workerForm.matricule < 1) {
      this.matriculeCheckResult = null;
      return;
    }

    this.checkingMatricule = true;
    this.matriculeCheckResult = null;

    try {
      const exists = await this.checkIfWorkerExists(this.workerForm.matricule);
      if (exists) {
        try {
          const existingWorker = await this.ouvrierService
            .searchByMatricule(this.workerForm.matricule!).toPromise();
          this.matriculeCheckResult = {
            available: false,
            message: ` Le matricule ${this.workerForm.matricule} est déjà utilisé`,
            existingWorker
          };
        } catch {
          this.matriculeCheckResult = {
            available: false,
            message: ` Le matricule ${this.workerForm.matricule} est déjà utilisé`
          };
        }
      } else {
        this.matriculeCheckResult = {
          available: true,
          message: ` Le matricule ${this.workerForm.matricule} est disponible`
        };
      }
    } finally {
      this.checkingMatricule = false;
    }
  }

  suggestDifferentMatricule() {
    const suggestedMatricule = (this.workerForm.matricule || 1000) + 1;
    this.workerForm.matricule = suggestedMatricule;
    this.matriculeCheckResult = null;
    setTimeout(() => { this.onCheckMatricule(); }, 300);
  }

  // ── Ajout d'un ouvrier ─────────────────────────────────────
  async onAddWorker() {
    this.workerForm.errors = {};
    let hasErrors = false;

    if (!this.workerForm.matricule) {
      this.workerForm.errors.matricule = 'Le matricule est requis';
      hasErrors = true;
    } else if (this.workerForm.matricule < 1 || this.workerForm.matricule > 999999) {
      this.workerForm.errors.matricule = 'Le matricule doit être entre 1 et 999999';
      hasErrors = true;
    }

    if (!this.workerForm.nomPrenom.trim()) {
      this.workerForm.errors.nomPrenom = 'Le nom et prénom sont requis';
      hasErrors = true;
    }

    if (hasErrors) return;

    this.loading = true;
    this.errorMessage = null;

    try {
      const ouvrierExists = await this.checkIfWorkerExists(this.workerForm.matricule!);
      if (ouvrierExists) {
        this.errorMessage = `Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`;
        this.loading = false;
        return;
      }

      this.ouvrierService.create({
        matricule: this.workerForm.matricule!,
        nomPrenom: this.workerForm.nomPrenom
      })
        .pipe(
          catchError(error => {
            if (error.status === 409) {
              this.errorMessage = `Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`;
            } else {
              this.errorMessage = error.error?.message || 'Erreur lors de l\'ajout de l\'ouvrier';
            }
            return of(null);
          }),
          finalize(() => this.loading = false)
        )
        .subscribe(response => {
          if (response) {
            this.showSuccessMessage(
              `Ouvrier "${this.workerForm.nomPrenom}" (${this.workerForm.matricule}) ajouté avec succès !`
            );
            this.resetWorkerForm();
            this.loadOuvriers();
          }
        });

    } catch {
      this.loading = false;
    }
  }

  onCancelWorker() {
    this.resetWorkerForm();
    this.errorMessage = null;
  }

  // ── Édition d'un ouvrier ───────────────────────────────────
  editOuvrier(ouvrier: any) {
    this.workerForm.matricule = ouvrier.matricule;
    this.workerForm.nomPrenom = ouvrier.nomPrenom;
    setTimeout(() => { this.onCheckMatricule(); }, 300);
    this.showSuccessMessage(`Formulaire pré-rempli pour ${ouvrier.nomPrenom} (${ouvrier.matricule})`);
  }

  // ── Suppression d'un ouvrier ───────────────────────────────
  onDeleteOuvrier(matricule: number) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'ouvrier avec le matricule ${matricule} ?`)) {
      this.loading = true;
      this.ouvrierService.remove(matricule)
        .pipe(
          catchError(error => {
            if (error.status === 404) {
              this.errorMessage = `Ouvrier avec le matricule ${matricule} introuvable`;
            } else if (error.status === 403) {
              this.errorMessage = 'Vous n\'avez pas les permissions pour supprimer un ouvrier';
            } else {
              this.errorMessage = error.error?.message || 'Erreur lors de la suppression de l\'ouvrier';
            }
            return of(null);
          }),
          finalize(() => this.loading = false)
        )
        .subscribe(response => {
          if (response !== null) {
            this.showSuccessMessage(`Ouvrier avec le matricule ${matricule} supprimé avec succès !`);
            this.loadOuvriers();
          }
        });
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  private resetWorkerForm() {
    this.workerForm = { matricule: null, nomPrenom: '', errors: {} };
    this.matriculeCheckResult = null;
  }

  private showSuccessMessage(message: string) {
    this.successMessage = message;
    this.showSuccess = true;
    setTimeout(() => { this.showSuccess = false; }, 3000);
  }
}