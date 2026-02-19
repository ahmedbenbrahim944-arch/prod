// src/app/ouvrier/ouvrier.component.ts
import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { OuvrierService,Ouvrier, CreateOuvrierDto } from '../prod/ouvrier.service';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-ouvrier',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ouvrier.component.html',
  styleUrls: ['./ouvrier.component.css']
})
export class OuvrierComponent implements OnInit {
  // Services injectés
  private ouvrierService = inject(OuvrierService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Signals pour la réactivité
  loading = signal(false);
  ouvriers = signal<Ouvrier[]>([]);
  showSuccess = signal(false);
  successMessage = signal('');
  errorMessage = signal<string | null>(null);
  checkingMatricule = signal(false);
  
  // Ajout de la propriété particles
  particles = signal<any[]>([]);

  // Formulaire
  workerForm = {
    matricule: null as number | null,
    nomPrenom: '',
    errors: {
      matricule: '',
      nomPrenom: ''
    }
  };

  // Résultat de vérification du matricule
  matriculeCheckResult: {
    available: boolean;
    message: string;
    existingWorker?: { matricule: number; nomPrenom: string };
  } | null = null;

  ngOnInit() {
    this.generateParticles(); // Générer les particules
    this.loadOuvriers();
  }

  /**
   * Générer les particules pour l'arrière-plan
   */
  private generateParticles() {
    const particles = [];
    for (let i = 0; i < 25; i++) {
      particles.push({
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 8 + 2}px`,
        animationDelay: `${Math.random() * 15}s`,
        opacity: `${Math.random() * 0.4 + 0.1}`
      });
    }
    this.particles.set(particles);
  }

  /**
   * Obtenir le nombre de matricules uniques
   */
  getUniqueMatricules(): number {
    const matricules = new Set(this.ouvriers().map(ouvrier => ouvrier.matricule));
    return matricules.size;
  }

  /**
   * Charger la liste des ouvriers
   */
  private loadOuvriers() {
    this.loading.set(true);
    
    this.ouvrierService.findAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des ouvriers:', error);
          this.errorMessage.set('Impossible de charger la liste des ouvriers');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (ouvriers) => {
          this.ouvriers.set(ouvriers);
        }
      });
  }

  /**
   * Vérifier si un matricule est disponible
   */
  async onCheckMatricule() {
    if (!this.workerForm.matricule || this.workerForm.matricule < 1) {
      return;
    }

    this.checkingMatricule.set(true);
    this.matriculeCheckResult = null;

    try {
      // Vérifier si l'ouvrier existe
      const exists = await this.checkIfWorkerExists(this.workerForm.matricule);
      
      if (exists) {
        // Si existe, essayer de récupérer ses informations
        try {
          const existingWorker = await this.ouvrierService.searchByMatricule(this.workerForm.matricule!).toPromise();
          
          this.matriculeCheckResult = {
            available: false,
            message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`,
            existingWorker: existingWorker
          };
        } catch (error) {
          this.matriculeCheckResult = {
            available: false,
            message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`
          };
        }
      } else {
        this.matriculeCheckResult = {
          available: true,
          message: `✅ Le matricule ${this.workerForm.matricule} est disponible`
        };
      }
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      this.matriculeCheckResult = {
        available: false,
        message: '⚠️ Erreur lors de la vérification du matricule'
      };
    } finally {
      this.checkingMatricule.set(false);
    }
  }

  /**
   * Ajouter un nouvel ouvrier
   */
  async onAddWorker() {
    // Validation
    this.workerForm.errors = { matricule: '', nomPrenom: '' };
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

    // VÉRIFICATION SI L'OUVRIER EXISTE DÉJÀ
    this.loading.set(true);
    this.errorMessage.set(null);
    
    try {
      // Vérifier si l'ouvrier existe déjà
      const ouvrierExists = await this.checkIfWorkerExists(this.workerForm.matricule!);
      
      if (ouvrierExists) {
        this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
        this.loading.set(false);
        return;
      }

      // Si l'ouvrier n'existe pas, procéder à la création
      const createOuvrierDto: CreateOuvrierDto = {
        matricule: this.workerForm.matricule!,
        nomPrenom: this.workerForm.nomPrenom
      };

      this.ouvrierService.create(createOuvrierDto)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Erreur lors de l\'ajout de l\'ouvrier:', error);
            
            // Gestion spécifique des erreurs de conflit (matricule déjà existant)
            if (error.status === 409) {
              this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
            } else {
              this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de l\'ouvrier');
            }
            
            return of(null);
          }),
          finalize(() => this.loading.set(false))
        )
        .subscribe({
          next: (response) => {
            if (response) {
              this.showSuccessMessage(`Ouvrier "${this.workerForm.nomPrenom}" (${this.workerForm.matricule}) ajouté avec succès !`);
              this.resetWorkerForm();
              this.loadOuvriers(); // Recharger la liste
            }
          }
        });
        
    } catch (error) {
      this.loading.set(false);
      console.error('Erreur lors de la vérification:', error);
    }
  }

  /**
   * Vérifier si un ouvrier existe déjà
   */
  private async checkIfWorkerExists(matricule: number): Promise<boolean> {
    try {
      await this.ouvrierService.searchByMatricule(matricule).toPromise();
      return true; // Si pas d'erreur, l'ouvrier existe
    } catch (error: any) {
      if (error.status === 404) {
        return false; // Si erreur 404, l'ouvrier n'existe pas
      }
      console.log('Erreur lors de la vérification:', error);
      return false;
    }
  }

  /**
   * Suggérer un autre matricule
   */
  suggestDifferentMatricule() {
    // Générer un matricule aléatoire dans la plage 1000-9999
    const suggestedMatricule = Math.floor(Math.random() * 9000) + 1000;
    this.workerForm.matricule = suggestedMatricule;
    this.matriculeCheckResult = null;
    
    // Vérifier automatiquement le nouveau matricule après un délai
    setTimeout(() => {
      this.onCheckMatricule();
    }, 500);
  }

  /**
   * Rafraîchir la liste des ouvriers
   */
  refreshOuvriers() {
    this.loadOuvriers();
    this.showSuccessMessage('Liste des ouvriers rafraîchie !');
  }

  /**
   * Éditer un ouvrier (pré-remplit le formulaire)
   */
  editOuvrier(ouvrier: Ouvrier) {
    this.workerForm.matricule = ouvrier.matricule;
    this.workerForm.nomPrenom = ouvrier.nomPrenom;
    
    // Vérifier automatiquement le matricule
    setTimeout(() => {
      this.onCheckMatricule();
    }, 300);
    
    // Faire défiler vers le formulaire
    setTimeout(() => {
      const formElement = document.querySelector('.creation-card');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    this.showSuccessMessage(`Formulaire pré-rempli pour ${ouvrier.nomPrenom} (${ouvrier.matricule})`);
  }

  /**
   * Supprimer un ouvrier
   */
  onDeleteOuvrier(matricule: number) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'ouvrier avec le matricule ${matricule} ?`)) {
      this.loading.set(true);
      
      this.ouvrierService.remove(matricule)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Erreur lors de la suppression:', error);
            
            if (error.status === 404) {
              this.errorMessage.set(`Ouvrier avec le matricule ${matricule} introuvable`);
            } else if (error.status === 403) {
              this.errorMessage.set('Vous n\'avez pas les permissions pour supprimer un ouvrier');
            } else {
              this.errorMessage.set(error.error?.message || 'Erreur lors de la suppression de l\'ouvrier');
            }
            
            return of(null);
          }),
          finalize(() => this.loading.set(false))
        )
        .subscribe({
          next: (response) => {
            if (response) {
              this.showSuccessMessage(`Ouvrier avec le matricule ${matricule} supprimé avec succès !`);
              this.loadOuvriers(); // Recharger la liste
            }
          }
        });
    }
  }

  /**
   * Annuler et réinitialiser le formulaire
   */
  onCancelWorker() {
    this.resetWorkerForm();
  }

  /**
   * Retour au menu principal
   */
  goBackToProd() {
    this.router.navigate(['/ch2']);
  }

  /**
   * Déconnexion
   */
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.authService.getUserType() === 'admin';
  }

  /**
   * Réinitialiser le formulaire
   */
  private resetWorkerForm() {
    this.workerForm = {
      matricule: null,
      nomPrenom: '',
      errors: { matricule: '', nomPrenom: '' }
    };
    this.matriculeCheckResult = null;
  }

  /**
   * Afficher un message de succès
   */
  private showSuccessMessage(message: string) {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => {
      this.showSuccess.set(false);
    }, 3000);
  }
}