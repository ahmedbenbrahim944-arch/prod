// src/app/selection/selection.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  SelectionService, 
  Ouvrier, 
  ReferenceItem, 
  PlanningSelection, 
  CreatePlanningSelectionDto 
} from './selection.service';
import { AuthService } from '../login/auth.service';

export interface WeekInfo {
  number: number;
  startDate: Date;
  endDate: Date;
  display: string;
  data?: any;
}

@Component({
  selector: 'app-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selection.component.html',
  styleUrls: ['./selection.component.css']
})
export class SelectionComponent implements OnInit {
  // Données
  semaines: WeekInfo[] = [];
  ouvriers: Ouvrier[] = [];
  references: ReferenceItem[] = [];
  plannings: PlanningSelection[] = [];
  planningsEnAttente: PlanningSelection[] = []; // 🆕 Plannings incomplets
  
  // Sélections
  selectedSemaine: WeekInfo | null = null;
  
  // Formulaire
  formData = {
    date: '',
    matricule: null as number | null,
    nomPrenom: '',
    ligne: 'selection',
    reference: '',
    ligneRef: '',
    qteASelectionne: null as number | null,
    objectifHeure: null as number | null,
    numTicket: ''
  };
  
  // 🆕 Formulaire de complétion (modal)
  completionFormData = {
    planningId: null as number | null,
    reference: '',
    qteASelectionne: null as number | null,
    objectifHeure: null as number | null,
    numTicket: ''
  };
  
  // Recherche de référence
  searchReference = '';
  filteredReferences: ReferenceItem[] = [];
  showReferenceDropdown = false;
  
  // Recherche de matricule
  searchMatricule = '';
  filteredOuvriers: Ouvrier[] = [];
  showOuvrierDropdown = false;
  
  // 🆕 Modal de complétion
  showCompletionModal = false;
  selectedPlanningEnAttente: PlanningSelection | null = null;
  
  // 🆕 Recherche de référence dans le modal
  searchReferenceModal = '';
  filteredReferencesModal: ReferenceItem[] = [];
  showReferenceDropdownModal = false;
  
  // État
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private selectionService: SelectionService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSemaines();
    this.loadOuvriers();
    this.loadReferences();
    this.setDefaultDate();
    this.loadPlanningsEnAttente(); // 🆕 Charger les plannings incomplets
  }

  setDefaultDate(): void {
    const today = new Date();
    this.formData.date = today.toISOString().split('T')[0];
  }

  // Charger les semaines
  loadSemaines(): void {
    this.selectionService.getSemainesForPlanning().subscribe({
      next: (response) => {
        this.semaines = this.parseWeeksFromAPI(response);
        console.log('Semaines chargées:', this.semaines);
      },
      error: (error) => {
        console.error('Erreur chargement semaines:', error);
        this.showError('Erreur lors du chargement des semaines');
      }
    });
  }

  // Charger les ouvriers
  loadOuvriers(): void {
    this.selectionService.getOuvriers().subscribe({
      next: (ouvriers) => {
        this.ouvriers = ouvriers;
        console.log('✅ Ouvriers chargés:', ouvriers.length);
      },
      error: (error) => {
        console.error('Erreur chargement ouvriers:', error);
      }
    });
  }

  // Charger toutes les références (Products + MatièresPremieres)
  loadReferences(): void {
    this.selectionService.getAllReferences().subscribe({
      next: (references) => {
        this.references = references;
        console.log('✅ Références chargées:', references.length);
      },
      error: (error) => {
        console.error('Erreur chargement références:', error);
        this.showError('Erreur lors du chargement des références');
      }
    });
  }

  // 🆕 Charger les plannings en attente (statut = "en attente")
  loadPlanningsEnAttente(): void {
    this.selectionService.getPlanningsIncomplets().subscribe({
      next: (plannings) => {
        this.planningsEnAttente = plannings;
        console.log('🔔 Plannings en attente:', plannings.length);
      },
      error: (error) => {
        console.error('Erreur chargement plannings en attente:', error);
      }
    });
  }

  // Sélectionner une semaine
  selectSemaine(semaine: WeekInfo): void {
    this.selectedSemaine = semaine;
    this.loadPlanningsBySemaine(semaine.number);
  }

  // Charger les plannings de la semaine
  loadPlanningsBySemaine(semaineNumber: number): void {
    this.isLoading = true;
    this.selectionService.getPlanningsBySemaine(semaineNumber).subscribe({
      next: (plannings) => {
        // 🆕 Filtrer les plannings complets uniquement
        this.plannings = plannings.filter(p => p.statut !== 'en attente');
        console.log('✅ Plannings chargés:', this.plannings.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur chargement plannings:', error);
        this.showError('Erreur lors du chargement des plannings');
        this.isLoading = false;
      }
    });
  }

  // Recherche de matricule
  onMatriculeSearch(event: any): void {
    const value = event.target.value;
    this.searchMatricule = value;
    
    if (value) {
      this.filteredOuvriers = this.ouvriers.filter(o => {
        const searchLower = value.toLowerCase();
        
        if (o.matricule.toString().includes(value)) {
          return true;
        }
        
        if (o.nomPrenom && o.nomPrenom.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        if (o.nom && o.prenom) {
          const fullName = `${o.nom} ${o.prenom}`.toLowerCase();
          if (fullName.includes(searchLower)) {
            return true;
          }
        }
        
        if (o.nom && o.nom.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        return false;
      });
      
      this.showOuvrierDropdown = this.filteredOuvriers.length > 0;
    } else {
      this.showOuvrierDropdown = false;
    }
  }

  // Sélectionner un ouvrier
  selectOuvrier(ouvrier: Ouvrier): void {
    this.formData.matricule = ouvrier.matricule;
    
    if (ouvrier.nomPrenom) {
      this.formData.nomPrenom = ouvrier.nomPrenom;
    } else if (ouvrier.nom && ouvrier.prenom) {
      this.formData.nomPrenom = `${ouvrier.nom} ${ouvrier.prenom}`;
    } else if (ouvrier.nom) {
      this.formData.nomPrenom = ouvrier.nom;
    } else {
      this.formData.nomPrenom = `Ouvrier ${ouvrier.matricule}`;
    }
    
    this.formData.ligne = ouvrier.ligne || 'selection';
    this.searchMatricule = ouvrier.matricule.toString();
    this.showOuvrierDropdown = false;
  }

  // Recherche de référence (formulaire principal)
  onReferenceSearch(event: any): void {
    const value = event.target.value;
    this.searchReference = value;
    
    if (value) {
      this.filteredReferences = this.references.filter(ref => 
        ref.reference.toLowerCase().includes(value.toLowerCase()) ||
        (ref.designation && ref.designation.toLowerCase().includes(value.toLowerCase())) ||
        ref.ligneRef.toLowerCase().includes(value.toLowerCase())
      );
      this.showReferenceDropdown = this.filteredReferences.length > 0;
    } else {
      this.showReferenceDropdown = false;
    }
  }

  // Sélectionner une référence (formulaire principal)
  selectReference(refItem: ReferenceItem): void {
    this.formData.reference = refItem.reference;
    this.formData.ligneRef = refItem.ligneRef;
    this.searchReference = refItem.reference;
    this.showReferenceDropdown = false;
  }

  // 🆕 Recherche de référence dans le modal
  onReferenceSearchModal(event: any): void {
    const value = event.target.value;
    this.searchReferenceModal = value;
    
    if (value) {
      this.filteredReferencesModal = this.references.filter(ref => 
        ref.reference.toLowerCase().includes(value.toLowerCase()) ||
        (ref.designation && ref.designation.toLowerCase().includes(value.toLowerCase())) ||
        ref.ligneRef.toLowerCase().includes(value.toLowerCase())
      );
      this.showReferenceDropdownModal = this.filteredReferencesModal.length > 0;
    } else {
      this.showReferenceDropdownModal = false;
    }
  }

  // 🆕 Sélectionner une référence dans le modal
  selectReferenceModal(refItem: ReferenceItem): void {
    this.completionFormData.reference = refItem.reference;
    this.searchReferenceModal = refItem.reference;
    this.showReferenceDropdownModal = false;
  }

  // Valider le formulaire
  isFormValid(): boolean {
    return !!(
      this.formData.date &&
      this.formData.matricule &&
      this.formData.nomPrenom &&
      this.formData.reference &&
      this.formData.qteASelectionne && this.formData.qteASelectionne > 0 &&
      this.formData.objectifHeure && this.formData.objectifHeure > 0
    );
  }

  // 🆕 Valider le formulaire de complétion
  isCompletionFormValid(): boolean {
    return !!(
      this.completionFormData.reference &&
      this.completionFormData.qteASelectionne && this.completionFormData.qteASelectionne > 0 &&
      this.completionFormData.objectifHeure && this.completionFormData.objectifHeure > 0
    );
  }

  // Ajouter un planning
  addPlanning(): void {
    if (!this.isFormValid()) {
      this.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const dto: CreatePlanningSelectionDto = {
      date: this.formData.date,
      matricule: this.formData.matricule!,
      reference: this.formData.reference,
      qteASelectionne: this.formData.qteASelectionne!,
      objectifHeure: this.formData.objectifHeure!,
      numTicket: this.formData.numTicket || undefined
    };
    
    this.isLoading = true;
    this.selectionService.createPlanningSelection(dto).subscribe({
      next: (result) => {
        this.showSuccess('Planning ajouté avec succès');
        this.resetForm();
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur création planning:', error);
        
        let errorMessage = 'Erreur lors de la création du planning';
        
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 404) {
          if (error.error?.includes('semaine')) {
            errorMessage = 'La date sélectionnée ne correspond à aucune semaine définie';
          } else if (error.error?.includes('Ouvrier')) {
            errorMessage = 'Ouvrier introuvable';
          } else if (error.error?.includes('Référence')) {
            errorMessage = 'Référence introuvable';
          }
        }
        
        this.showError(errorMessage);
        this.isLoading = false;
      }
    });
  }

  // 🆕 Ouvrir le modal de complétion
  openCompletionModal(planning: PlanningSelection): void {
    this.selectedPlanningEnAttente = planning;
    this.completionFormData = {
      planningId: planning.id || null,
      reference: '',
      qteASelectionne: null,
      objectifHeure: null,
      numTicket: ''
    };
    this.searchReferenceModal = '';
    this.showCompletionModal = true;
  }

  // 🆕 Fermer le modal de complétion
  closeCompletionModal(): void {
    this.showCompletionModal = false;
    this.selectedPlanningEnAttente = null;
    this.completionFormData = {
      planningId: null,
      reference: '',
      qteASelectionne: null,
      objectifHeure: null,
      numTicket: ''
    };
  }

  // 🆕 Compléter un planning en attente
  completePlanning(): void {
    if (!this.isCompletionFormValid() || !this.selectedPlanningEnAttente) {
      this.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const planningId = this.selectedPlanningEnAttente.id;
    if (!planningId) return;

    const updateData = {
      reference: this.completionFormData.reference,
      qteASelectionne: this.completionFormData.qteASelectionne!,
      objectifHeure: this.completionFormData.objectifHeure!,
      numTicket: this.completionFormData.numTicket || 'non num',
      statut: 'selection' // Changer le statut de "en attente" à "selection"
    };

    this.isLoading = true;
    this.selectionService.updatePlanningById(planningId, updateData).subscribe({
      next: (result) => {
        this.showSuccess('Planning complété avec succès !');
        this.closeCompletionModal();
        this.loadPlanningsEnAttente(); // Recharger la liste des plannings en attente
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number); // Recharger le tableau principal
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur complétion planning:', error);
        this.showError('Erreur lors de la complétion du planning');
        this.isLoading = false;
      }
    });
  }

  // Mettre à jour les heures
  updateHeures(planning: PlanningSelection, newHeures: number): void {
    if (!newHeures || newHeures < 0.1) {
      this.showError('Le nombre d\'heures doit être supérieur à 0');
      return;
    }

    this.selectionService.updatePlanningByInfo(
      planning.matricule,
      planning.reference,
      planning.date,
      { nHeures: newHeures }
    ).subscribe({
      next: (result) => {
        this.showSuccess('Heures mises à jour');
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
      },
      error: (error) => {
        console.error('Erreur mise à jour heures:', error);
        this.showError('Erreur lors de la mise à jour des heures');
      }
    });
  }

  // Mettre à jour qteSelection
  updateQteSelection(planning: PlanningSelection, newQteSelection: number): void {
    if (newQteSelection < 0) {
      this.showError('La quantité sélectionnée ne peut pas être négative');
      return;
    }

    this.selectionService.updatePlanningByInfo(
      planning.matricule,
      planning.reference,
      planning.date,
      { qteSelection: newQteSelection }
    ).subscribe({
      next: (result) => {
        this.showSuccess('Quantité sélectionnée mise à jour');
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
      },
      error: (error) => {
        console.error('Erreur mise à jour qteSelection:', error);
        this.showError('Erreur lors de la mise à jour de la quantité');
      }
    });
  }

  // Mettre à jour rebut
  updateRebut(planning: PlanningSelection, newRebut: number): void {
    if (newRebut < 0) {
      this.showError('Le rebut ne peut pas être négatif');
      return;
    }

    this.selectionService.updatePlanningByInfo(
      planning.matricule,
      planning.reference,
      planning.date,
      { rebut: newRebut }
    ).subscribe({
      next: (result) => {
        this.showSuccess('Rebut mis à jour');
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
      },
      error: (error) => {
        console.error('Erreur mise à jour rebut:', error);
        this.showError('Erreur lors de la mise à jour du rebut');
      }
    });
  }

  // Supprimer un planning
  deletePlanning(planning: PlanningSelection): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce planning ?')) {
      return;
    }

    if (!planning.id) return;

    this.selectionService.deletePlanning(planning.id).subscribe({
      next: () => {
        this.showSuccess('Planning supprimé');
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
      },
      error: (error) => {
        console.error('Erreur suppression:', error);
        this.showError('Erreur lors de la suppression');
      }
    });
  }

  // Réinitialiser le formulaire
  resetForm(): void {
    this.formData = {
      date: new Date().toISOString().split('T')[0],
      matricule: null,
      nomPrenom: '',
      ligne: 'selection',
      reference: '',
      ligneRef: '',
      qteASelectionne: null,
      objectifHeure: null,
      numTicket: ''
    };
    this.searchMatricule = '';
    this.searchReference = '';
  }

  // Messages
  showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 5000);
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 3000);
  }

  // Navigation
  goBack(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.router.navigate(['/choix']);
      return;
    }
    
    const matricule = currentUser.nom;
    const typeUser = currentUser.type;
    
    if (typeUser === 'admin') {
      if (matricule === '1194' || matricule === '9001') {
        this.router.navigate(['/choix1']);
      } else {
        this.router.navigate(['/prod']);
      }
    }
  }

  // Retourner le badge de type de référence
  getReferenceTypeBadge(type: string): string {
    return type === 'product' ? 'PROD' : 'MP';
  }

  // Retourner la classe CSS pour le badge
  getReferenceTypeBadgeClass(type: string): string {
    return type === 'product' ? 'badge-product' : 'badge-matiere';
  }

  // Parser les semaines depuis l'API
  parseWeeksFromAPI(response: any): WeekInfo[] {
    let semainesArray: any[] = [];
    
    if (response && response.semaines && Array.isArray(response.semaines)) {
      semainesArray = response.semaines;
    } else if (Array.isArray(response)) {
      semainesArray = response;
    } else {
      console.warn('Format de réponse inattendu:', response);
      return [];
    }
    
    const weeks: WeekInfo[] = [];
    
    semainesArray.forEach((semaine: any) => {
      let weekNumber = 0;
      
      if (semaine.nom && typeof semaine.nom === 'string') {
        const match = semaine.nom.match(/semaine(\d+)/i);
        if (match && match[1]) {
          weekNumber = parseInt(match[1], 10);
        }
      }
      
      if (weekNumber > 0) {
        weeks.push({
          number: weekNumber,
          startDate: semaine.dateDebut ? new Date(semaine.dateDebut) : new Date(),
          endDate: semaine.dateFin ? new Date(semaine.dateFin) : new Date(),
          display: semaine.nom || `semaine${weekNumber}`,
          data: semaine
        });
      }
    });
    
    weeks.sort((a, b) => b.number - a.number);
    
    return weeks;
  }
}