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
  CreatePlanningSelectionDto,
  UpdatePlanningSelectionDto
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
  semaines: WeekInfo[] = [];
  ouvriers: Ouvrier[] = [];
  references: ReferenceItem[] = [];
  plannings: PlanningSelection[] = [];
  planningsEnAttente: PlanningSelection[] = [];

  selectedSemaine: WeekInfo | null = null;

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

  completionFormData = {
    planningId: null as number | null,
    reference: '',
    qteASelectionne: null as number | null,
    objectifHeure: null as number | null,
    numTicket: ''
  };

  searchReference = '';
  filteredReferences: ReferenceItem[] = [];
  showReferenceDropdown = false;

  searchMatricule = '';
  filteredOuvriers: Ouvrier[] = [];
  showOuvrierDropdown = false;

  showCompletionModal = false;
  selectedPlanningEnAttente: PlanningSelection | null = null;

  searchReferenceModal = '';
  filteredReferencesModal: ReferenceItem[] = [];
  showReferenceDropdownModal = false;

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
    this.loadPlanningsEnAttente();
  }

  setDefaultDate(): void {
    const today = new Date();
    this.formData.date = today.toISOString().split('T')[0];
  }

  loadSemaines(): void {
    this.selectionService.getSemainesForPlanning().subscribe({
      next: (response) => {
        this.semaines = this.parseWeeksFromAPI(response);
      },
      error: () => {
        this.showError('Erreur lors du chargement des semaines');
      }
    });
  }

  loadOuvriers(): void {
    this.selectionService.getOuvriers().subscribe({
      next: (ouvriers) => {
        this.ouvriers = ouvriers;
      },
      error: () => {}
    });
  }

  loadReferences(): void {
    this.selectionService.getAllReferences().subscribe({
      next: (references) => {
        this.references = references;
      },
      error: () => {
        this.showError('Erreur lors du chargement des références');
      }
    });
  }

  loadPlanningsEnAttente(): void {
    this.selectionService.getPlanningsIncomplets().subscribe({
      next: (plannings) => {
        this.planningsEnAttente = plannings;
      },
      error: () => {}
    });
  }

  selectSemaine(semaine: WeekInfo): void {
    this.selectedSemaine = semaine;
    this.loadPlanningsBySemaine(semaine.number);
  }

  loadPlanningsBySemaine(semaineNumber: number): void {
    this.isLoading = true;
    this.selectionService.getPlanningsBySemaine(semaineNumber).subscribe({
      next: (plannings) => {
        this.plannings = plannings.filter(p => p.statut !== 'en attente');
        this.isLoading = false;
      },
      error: () => {
        this.showError('Erreur lors du chargement des plannings');
        this.isLoading = false;
      }
    });
  }

  onMatriculeSearch(event: any): void {
    const value = event.target.value;
    this.searchMatricule = value;
    if (value) {
      this.filteredOuvriers = this.ouvriers.filter(o => {
        const searchLower = value.toLowerCase();
        if (o.matricule.toString().includes(value)) return true;
        if (o.nomPrenom && o.nomPrenom.toLowerCase().includes(searchLower)) return true;
        if (o.nom && o.prenom) {
          if (`${o.nom} ${o.prenom}`.toLowerCase().includes(searchLower)) return true;
        }
        if (o.nom && o.nom.toLowerCase().includes(searchLower)) return true;
        return false;
      });
      this.showOuvrierDropdown = this.filteredOuvriers.length > 0;
    } else {
      this.showOuvrierDropdown = false;
    }
  }

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

  selectReference(refItem: ReferenceItem): void {
    this.formData.reference = refItem.reference;
    this.formData.ligneRef = refItem.ligneRef;
    this.searchReference = refItem.reference;
    this.showReferenceDropdown = false;
  }

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

  selectReferenceModal(refItem: ReferenceItem): void {
    this.completionFormData.reference = refItem.reference;
    this.searchReferenceModal = refItem.reference;
    this.showReferenceDropdownModal = false;
  }

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

  isCompletionFormValid(): boolean {
    return !!(
      this.completionFormData.reference &&
      this.completionFormData.qteASelectionne && this.completionFormData.qteASelectionne > 0 &&
      this.completionFormData.objectifHeure && this.completionFormData.objectifHeure > 0
    );
  }

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
      next: () => {
        this.showSuccess('Planning ajouté avec succès');
        this.resetForm();
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
        this.isLoading = false;
      },
      error: (error) => {
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

  completePlanning(): void {
    if (!this.isCompletionFormValid() || !this.selectedPlanningEnAttente) {
      this.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    const planningId = this.selectedPlanningEnAttente.id;
    if (!planningId) return;

    const updateData: UpdatePlanningSelectionDto = {
      reference: this.completionFormData.reference,
      qteASelectionne: this.completionFormData.qteASelectionne!,
      objectifHeure: this.completionFormData.objectifHeure!,
      numTicket: this.completionFormData.numTicket || 'non num',
      statut: 'selection'
    };
    this.isLoading = true;
    this.selectionService.updatePlanningById(planningId, updateData).subscribe({
      next: () => {
        this.showSuccess('Planning complété avec succès !');
        this.closeCompletionModal();
        this.loadPlanningsEnAttente();
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
        this.isLoading = false;
      },
      error: () => {
        this.showError('Erreur lors de la complétion du planning');
        this.isLoading = false;
      }
    });
  }

  updateQteASelectionne(planning: PlanningSelection, value: any): void {
    const parsed = Number(value);
    if (!parsed || parsed < 1) {
      this.showError('La quantité à sélectionner doit être supérieure à 0');
      return;
    }
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { qteASelectionne: parsed }
    ).subscribe({
      next: () => {
        planning.qteASelectionne = parsed;
        this.showSuccess('Quantité à sélectionner mise à jour');
      },
      error: () => { this.showError('Erreur lors de la mise à jour'); }
    });
  }

  updateObjectifHeure(planning: PlanningSelection, value: any): void {
    const parsed = Number(value);
    if (!parsed || parsed < 1) {
      this.showError("L'objectif par heure doit être supérieur à 0");
      return;
    }
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { objectifHeure: parsed }
    ).subscribe({
      next: () => {
        planning.objectifHeure = parsed;
        this.showSuccess('Objectif par heure mis à jour');
      },
      error: () => { this.showError('Erreur lors de la mise à jour'); }
    });
  }

  updateHeures(planning: PlanningSelection, value: any): void {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0.1) {
      this.showError("Le nombre d'heures doit être supérieur à 0");
      return;
    }
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { nHeures: parsed }
    ).subscribe({
      next: (result) => {
        planning.nHeures = parsed;
        planning.rendement = result.rendement;
        this.showSuccess('Heures mises à jour');
      },
      error: () => { this.showError('Erreur lors de la mise à jour des heures'); }
    });
  }

  updateQteSelection(planning: PlanningSelection, value: any): void {
    const parsed = Number(value);
    if (isNaN(parsed) || parsed < 0) {
      this.showError('La quantité sélectionnée ne peut pas être négative');
      return;
    }
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { qteSelection: parsed }
    ).subscribe({
      next: (result) => {
        planning.qteSelection = parsed;
        planning.rendement = result.rendement;
        this.showSuccess('Quantité sélectionnée mise à jour');
      },
      error: () => { this.showError('Erreur lors de la mise à jour de la quantité'); }
    });
  }

  updateRebut(planning: PlanningSelection, value: any): void {
    const parsed = Number(value);
    if (isNaN(parsed) || parsed < 0) {
      this.showError('Le rebut ne peut pas être négatif');
      return;
    }
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { rebut: parsed }
    ).subscribe({
      next: (result) => {
        planning.rebut = parsed;
        planning.rendement = result.rendement;
        this.showSuccess('Rebut mis à jour');
      },
      error: () => { this.showError('Erreur lors de la mise à jour du rebut'); }
    });
  }

  updateTerminer(planning: PlanningSelection, value: string): void {
    this.selectionService.updatePlanningByInfo(
      planning.matricule, planning.reference, planning.date,
      { terminer: value }
    ).subscribe({
      next: () => {
        planning.terminer = value;
        this.showSuccess(`Planning marqué comme "${value === 'oui' ? 'Terminé' : 'Non terminé'}"`);
      },
      error: () => { this.showError('Erreur lors de la mise à jour'); }
    });
  }

  deletePlanning(planning: PlanningSelection): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce planning ?')) return;
    if (!planning.id) return;
    this.selectionService.deletePlanning(planning.id).subscribe({
      next: () => {
        this.showSuccess('Planning supprimé');
        if (this.selectedSemaine) {
          this.loadPlanningsBySemaine(this.selectedSemaine.number);
        }
      },
      error: () => { this.showError('Erreur lors de la suppression'); }
    });
  }

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

  getReferenceTypeBadge(type: string): string {
    return type === 'product' ? 'PROD' : 'MP';
  }

  getReferenceTypeBadgeClass(type: string): string {
    return type === 'product' ? 'badge-product' : 'badge-matiere';
  }

  parseWeeksFromAPI(response: any): WeekInfo[] {
    let semainesArray: any[] = [];
    if (response && response.semaines && Array.isArray(response.semaines)) {
      semainesArray = response.semaines;
    } else if (Array.isArray(response)) {
      semainesArray = response;
    } else {
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