// components/nonconformite/nonconformite.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NonconformiteService } from './nonconformite.service';
import { SaisieNonConf, CreateSaisieNonConfDto, ReferenceWithLine } from './nonconformite.service';
import * as XLSX from 'xlsx';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nonconformite',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './nonconformite.component.html',
  styleUrls: ['./nonconformite.component.css']
})
export class NonconformiteComponent implements OnInit {
  private fb = inject(FormBuilder);
  private nonconfService = inject(NonconformiteService);

  // Formulaire d'ajout
  nonconfForm!: FormGroup;
  
  // Formulaire de filtrage
  filterForm!: FormGroup;
  
  // Données
  availableLines: string[] = [];
  availableReferences: ReferenceWithLine[] = [];
  defautsList: string[] = [];
  saisies: SaisieNonConf[] = [];
  filteredSaisies: SaisieNonConf[] = [];
  
  // États
  isLoading = false;
  isSubmitting = false;
  isFiltering = false;
  isFiltered = false;
  errorMessage = '';
  successMessage = '';
  selectedLigne = '';
  totalSaisiesCount = 0;

  // Options pour le sélecteur de dates
  dateOptions = {
    today: this.getTodayDate(),
    yesterday: this.getYesterdayDate(),
    lastWeek: this.getLastWeekDate(),
    lastMonth: this.getLastMonthDate(),
    custom: ''
  };
  selectedDateRange = 'today';

  ngOnInit(): void {
    this.initAddForm();
    this.initFilterForm();
    this.loadLines();
    this.loadDefauts();
    this.loadSaisies();
  }

  // ============ INITIALISATION DES FORMULAIRES ============

  initAddForm(): void {
    this.nonconfForm = this.fb.group({
      sourceType: ['fournisseur', [Validators.required]],
      typeInterne: [{ value: '', disabled: true }],
      ligne: ['', [Validators.required]],
      reference: [{ value: '', disabled: true }, [Validators.required]],
      qteRebut: [0, [Validators.required, Validators.min(0)]],
      defauts: ['', [Validators.required]],
      type: ['MP', [Validators.required]],
      sortieLigne: [0, [Validators.required, Validators.min(0)]],
      date: [this.getTodayDate(), [Validators.required]]
    });

    // Écouteurs pour le formulaire d'ajout
    this.nonconfForm.get('sourceType')?.valueChanges.subscribe(value => {
      this.onSourceTypeChange(value);
    });

    this.nonconfForm.get('ligne')?.valueChanges.subscribe(ligne => {
      this.onLigneChange(ligne);
    });

    this.nonconfForm.get('reference')?.valueChanges.subscribe(reference => {
      this.onReferenceChange(reference);
    });
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      date: [''],
      dateRange: ['today'],
      startDate: [''],
      endDate: [''],
      ligne: [''],
      type: [''],
      reference: [''],
      defaut: [''],
      sourceType: [''],
      typeInterne: [''],
      statut: ['']
    });

    // Écouter les changements de plage de dates
    this.filterForm.get('dateRange')?.valueChanges.subscribe(range => {
      this.onDateRangeChange(range);
    });
  }

  // ============ GESTION DES DATES ============

  getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  getLastWeekDate(): string {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  }

  getLastMonthDate(): string {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return lastMonth.toISOString().split('T')[0];
  }

  onDateRangeChange(range: string): void {
    switch(range) {
      case 'today':
        this.filterForm.patchValue({
          date: this.getTodayDate(),
          startDate: '',
          endDate: ''
        });
        break;
      case 'yesterday':
        this.filterForm.patchValue({
          date: this.getYesterdayDate(),
          startDate: '',
          endDate: ''
        });
        break;
      case 'lastWeek':
        this.filterForm.patchValue({
          date: '',
          startDate: this.getLastWeekDate(),
          endDate: this.getTodayDate()
        });
        break;
      case 'lastMonth':
        this.filterForm.patchValue({
          date: '',
          startDate: this.getLastMonthDate(),
          endDate: this.getTodayDate()
        });
        break;
      case 'custom':
        this.filterForm.patchValue({
          date: '',
          startDate: '',
          endDate: ''
        });
        break;
    }
  }

  // ============ GESTION DU FORMULAIRE D'AJOUT ============

  onSourceTypeChange(sourceType: string): void {
    const typeInterneControl = this.nonconfForm.get('typeInterne');
    
    if (sourceType === 'interne') {
      typeInterneControl?.enable();
      typeInterneControl?.setValidators([Validators.required]);
    } else {
      typeInterneControl?.disable();
      typeInterneControl?.clearValidators();
      typeInterneControl?.setValue('');
    }
    
    typeInterneControl?.updateValueAndValidity();
  }

  onLigneChange(ligne: string): void {
    const referenceControl = this.nonconfForm.get('reference');
    
    if (ligne) {
      this.selectedLigne = ligne;
      this.loadReferencesByLine(ligne);
      referenceControl?.enable();
      referenceControl?.setValue('');
    } else {
      this.selectedLigne = '';
      referenceControl?.disable();
      referenceControl?.setValue('');
      this.availableReferences = [];
    }
  }

  onReferenceChange(reference: string): void {
    const ref = this.availableReferences.find(r => r.reference === reference);
    
    if (ref) {
      this.nonconfForm.patchValue({
        type: ref.type
      });
      console.log(`📍 Type auto-rempli: ${ref.type}`);
    } else {
      this.nonconfForm.patchValue({
        type: 'MP'
      });
    }
  }

  // ============ CHARGEMENT DES DONNÉES ============

  loadLines(): void {
    this.isLoading = true;
    this.nonconfService.getAllLines().subscribe({
      next: (lines) => {
        this.availableLines = lines;
        console.log('✅ Lignes chargées:', lines.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement lignes:', error);
        this.errorMessage = 'Erreur lors du chargement des lignes';
        this.isLoading = false;
      }
    });
  }

  loadReferencesByLine(ligne: string): void {
    this.isLoading = true;
    this.nonconfService.getReferencesByLine(ligne).subscribe({
      next: (references) => {
        this.availableReferences = references;
        console.log(`✅ Références chargées pour ligne ${ligne}:`, references.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement références:', error);
        this.errorMessage = `Erreur lors du chargement des références pour la ligne ${ligne}`;
        this.isLoading = false;
        this.availableReferences = [];
      }
    });
  }

  loadDefauts(): void {
    this.nonconfService.getDefautsList().subscribe({
      next: (defauts) => {
        this.defautsList = defauts;
        console.log('✅ Défauts chargés:', defauts.length);
      },
      error: (error) => {
        console.error('❌ Erreur chargement défauts:', error);
      }
    });
  }

  loadSaisies(): void {
    this.isLoading = true;
    this.nonconfService.findAll().subscribe({
      next: (saisies) => {
        // Ajouter des propriétés pour l'édition
        this.saisies = saisies.map(s => ({
          ...s,
          isEditingStatut: false
        }));
        this.filteredSaisies = [...this.saisies];
        this.totalSaisiesCount = saisies.length;
        console.log('✅ Saisies chargées:', saisies.length);
        this.isLoading = false;
        
        // Appliquer les filtres initiaux s'il y en a
        if (this.isFiltered) {
          this.applyFilters();
        }
      },
      error: (error) => {
        console.error('❌ Erreur chargement saisies:', error);
        this.errorMessage = 'Erreur lors du chargement des saisies';
        this.isLoading = false;
      }
    });
  }

  // ============ SOUMISSION DU FORMULAIRE D'AJOUT ============

  onSubmit(): void {
    if (this.nonconfForm.invalid) {
      this.markFormGroupTouched(this.nonconfForm);
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.nonconfForm.getRawValue();
    const data: CreateSaisieNonConfDto = {
      sourceType: formValue.sourceType,
      typeInterne: formValue.sourceType === 'interne' ? formValue.typeInterne : undefined,
      ligne: formValue.ligne,
      reference: formValue.reference,
      qteRebut: parseInt(formValue.qteRebut),
      defauts: formValue.defauts,
      type: formValue.type,
      sortieLigne: parseInt(formValue.sortieLigne),
      date: formValue.date,
      statut: 'en attente' // Statut par défaut
    };

    console.log('📤 Envoi données:', data);

    this.nonconfService.create(data).subscribe({
      next: (result) => {
        console.log('✅ Saisie créée avec succès:', result);
        this.successMessage = 'Saisie de non-conformité créée avec succès !';
        this.resetAddForm();
        this.loadSaisies(); // Recharger les données
        this.isSubmitting = false;

        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error) => {
        console.error('❌ Erreur création saisie:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la création de la saisie';
        this.isSubmitting = false;
      }
    });
  }

  resetAddForm(): void {
    this.nonconfForm.reset({
      sourceType: 'fournisseur',
      type: 'MP',
      date: this.getTodayDate(),
      qteRebut: 0,
      sortieLigne: 0,
      ligne: '',
      reference: ''
    });
    
    this.onSourceTypeChange('fournisseur');
    this.selectedLigne = '';
    this.availableReferences = [];
    this.nonconfForm.get('reference')?.disable();
  }

  // ============ GESTION DU STATUT ============

  // Démarrer l'édition du statut
  startEditStatut(saisie: any): void {
    // Arrêter l'édition précédente
    this.filteredSaisies.forEach(s => {
      s.isEditingStatut = false;
    });
    
    // Démarrer l'édition pour cette ligne
    saisie.isEditingStatut = true;
    saisie.tempStatut = saisie.statut;
    
    // Focus sur le select après un délai
    setTimeout(() => {
      const select = document.querySelector(`#statut-select-${saisie.id}`) as HTMLSelectElement;
      if (select) select.focus();
    }, 50);
  }

  // Sauvegarder le statut
  saveStatut(saisie: any): void {
    const newStatut = saisie.tempStatut;
    
    // Vérifier si le statut a changé
    if (newStatut === saisie.statut) {
      saisie.isEditingStatut = false;
      return;
    }
    
    // Validation : on ne peut pas repasser de "déclaré" à "en attente"
    if (saisie.statut === 'déclaré' && newStatut === 'en attente') {
      this.errorMessage = 'Impossible de repasser un rapport déclaré en "en attente"';
      setTimeout(() => this.errorMessage = '', 3000);
      saisie.isEditingStatut = false;
      return;
    }
    
    // Appeler l'API pour mettre à jour
    this.updateStatutInBackend(saisie.id, newStatut);
  }

  // Mettre à jour directement à "déclaré" (bouton D)
  updateStatutToDeclare(saisie: any): void {
    if (saisie.statut === 'déclaré') {
      return; // Déjà déclaré
    }
    
    // Confirmation
    if (!confirm('Marquer cette non-conformité comme "déclaré" ?')) {
      return;
    }
    
    this.updateStatutInBackend(saisie.id, 'déclaré');
  }

  // Méthode commune pour mettre à jour le statut dans le backend
  updateStatutInBackend(id: number, newStatut: string): void {
    this.isLoading = true;
    
    this.nonconfService.updateStatut(id, newStatut).subscribe({
      next: (updatedSaisie) => {
        // Mettre à jour localement
        const index = this.saisies.findIndex(s => s.id === id);
        if (index !== -1) {
          this.saisies[index].statut = newStatut;
          this.saisies[index].isEditingStatut = false;
        }
        
        // Rafraîchir la liste filtrée
        this.filteredSaisies = [...this.saisies];
        
        this.successMessage = `Statut mis à jour: ${newStatut}`;
        this.isLoading = false;
        
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Erreur mise à jour statut:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la mise à jour du statut';
        this.isLoading = false;
        
        // Annuler l'édition en cas d'erreur
        const index = this.saisies.findIndex(s => s.id === id);
        if (index !== -1) {
          this.saisies[index].isEditingStatut = false;
        }
        
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }

  // Annuler l'édition du statut
  cancelEditStatut(saisie: any): void {
    saisie.isEditingStatut = false;
    delete saisie.tempStatut;
  }

  // ============ FILTRAGE DES DONNÉES ============

  applyFilters(): void {
    this.isFiltering = true;
    this.isFiltered = true;
    
    const filters = this.filterForm.value;
    
    // Filtrer localement
    this.filteredSaisies = this.saisies.filter(saisie => {
      // Filtre par date exacte
      if (filters.date) {
        const saisieDate = new Date(saisie.date).toISOString().split('T')[0];
        if (saisieDate !== filters.date) return false;
      }
      
      // Filtre par plage de dates
      if (filters.startDate && filters.endDate) {
        const saisieDate = new Date(saisie.date);
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        
        if (saisieDate < startDate || saisieDate > endDate) return false;
      }
      
      // Filtre par ligne
      if (filters.ligne && saisie.ligne !== filters.ligne) return false;
      
      // Filtre par type
      if (filters.type && saisie.type !== filters.type) return false;
      
      // Filtre par référence (recherche partielle)
      if (filters.reference && !saisie.reference.toLowerCase().includes(filters.reference.toLowerCase())) {
        return false;
      }
      
      // Filtre par défaut
      if (filters.defaut && saisie.defauts !== filters.defaut) return false;
      
      // Filtre par source type
      if (filters.sourceType && saisie.sourceType !== filters.sourceType) return false;
      
      // Filtre par type interne
      if (filters.typeInterne && saisie.typeInterne !== filters.typeInterne) return false;
      
      // Filtre par statut
      if (filters.statut && saisie.statut !== filters.statut) return false;
      
      return true;
    });
    
    this.isFiltering = false;
  }

  resetFilters(): void {
    this.filterForm.reset({
      date: '',
      dateRange: 'today',
      startDate: '',
      endDate: '',
      ligne: '',
      type: '',
      reference: '',
      defaut: '',
      sourceType: '',
      typeInterne: '',
      statut: ''
    });
    
    this.isFiltered = false;
    this.filteredSaisies = [...this.saisies];
    this.selectedDateRange = 'today';
    this.onDateRangeChange('today');
  }

  // ============ EXPORT DES DONNÉES ============

  exportToExcel(): void {
    if (this.filteredSaisies.length === 0) {
      this.errorMessage = 'Aucune donnée à exporter';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    try {
      // Préparer les données pour Excel
      const excelData = this.filteredSaisies.map(saisie => ({
        'Date': new Date(saisie.date).toLocaleDateString('fr-FR'),
        'Ligne': saisie.ligne,
        'Référence': saisie.reference,
        'Quantité Rebut': saisie.qteRebut,
        'Défauts': saisie.defauts,
        'Statut': saisie.statut,
        'Source': saisie.sourceType === 'fournisseur' ? 'Fournisseur' : 'Interne',
        'Type Interne': saisie.typeInterne || '',
        'Type': saisie.type,
        'Sortie Ligne': saisie.sortieLigne,
        'Créé le': saisie.createdAt ? new Date(saisie.createdAt).toLocaleString('fr-FR') : ''
      }));

      // Créer la feuille de calcul
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
      
      // Ajuster la largeur des colonnes
      const wscols = [
        { wch: 12 }, // Date
        { wch: 15 }, // Source
        { wch: 20 }, // Type Interne
        { wch: 10 }, // Ligne
        { wch: 20 }, // Référence
        { wch: 10 }, // Type
        { wch: 15 }, // Qte Rebut
        { wch: 15 }, // Sortie Ligne
        { wch: 30 }, // Défauts
        { wch: 12 }, // Statut
        { wch: 20 }  // Créé le
      ];
      ws['!cols'] = wscols;

      // Ajouter un en-tête avec les informations de filtrage
      if (this.isFiltered) {
        const filterInfo = this.getFilterInfo();
        XLSX.utils.sheet_add_aoa(ws, [[`Données exportées avec les filtres suivants:`]], { origin: -1 });
        XLSX.utils.sheet_add_aoa(ws, [[filterInfo]], { origin: -1 });
        XLSX.utils.sheet_add_aoa(ws, [[]], { origin: -1 });
      }

      // Créer le classeur
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Non-Conformités');

      // Générer le nom du fichier
      const date = new Date().toISOString().split('T')[0];
      const fileName = `non-conformites_${date}_${this.filteredSaisies.length}_elements.xlsx`;

      // Télécharger le fichier
      XLSX.writeFile(wb, fileName);
      
      this.successMessage = `Fichier Excel "${fileName}" téléchargé avec succès`;
      setTimeout(() => this.successMessage = '', 5000);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'export Excel:', error);
      this.errorMessage = 'Erreur lors de l\'export vers Excel';
      setTimeout(() => this.errorMessage = '', 5000);
    }
  }

  exportToCSV(): void {
    if (this.filteredSaisies.length === 0) {
      this.errorMessage = 'Aucune donnée à exporter';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    try {
      // En-têtes CSV
      const headers = ['Date','Ligne','Référence','Quantité Rebut', 'Défauts','Statut','Source','Type Interne','Type','Sortie Ligne'];
      
      // Données CSV
      const rows = this.filteredSaisies.map(saisie => [
        new Date(saisie.date).toLocaleDateString('fr-FR'),
        saisie.ligne,
        saisie.reference,
        saisie.qteRebut,
        `"${saisie.defauts.replace(/"/g, '""')}"`,
        saisie.statut,
        saisie.sourceType === 'fournisseur' ? 'Fournisseur' : 'Interne',
        saisie.typeInterne || '',
        saisie.type,
        saisie.sortieLigne,
      ]);

      // Convertir en CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Créer et télécharger le fichier
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `non-conformites_${date}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.successMessage = 'Fichier CSV téléchargé avec succès';
      setTimeout(() => this.successMessage = '', 5000);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'export CSV:', error);
      this.errorMessage = 'Erreur lors de l\'export vers CSV';
      setTimeout(() => this.errorMessage = '', 5000);
    }
  }

  getFilterInfo(): string {
    const filters = this.filterForm.value;
    const info = [];
    
    if (filters.date) info.push(`Date: ${filters.date}`);
    if (filters.startDate && filters.endDate) info.push(`Période: ${filters.startDate} au ${filters.endDate}`);
    if (filters.ligne) info.push(`Ligne: ${filters.ligne}`);
    if (filters.type) info.push(`Type: ${filters.type}`);
    if (filters.reference) info.push(`Référence contenant: ${filters.reference}`);
    if (filters.defaut) info.push(`Défaut: ${filters.defaut}`);
    if (filters.sourceType) info.push(`Source: ${filters.sourceType}`);
    if (filters.typeInterne) info.push(`Type interne: ${filters.typeInterne}`);
    if (filters.statut) info.push(`Statut: ${filters.statut}`);
    
    return info.length > 0 ? info.join(' | ') : 'Aucun filtre appliqué';
  }

  // ============ SUPPRESSION DES SAISIES ============

  deleteSaisie(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette saisie ? Cette action est irréversible.')) {
      return;
    }

    this.isLoading = true;
    this.nonconfService.delete(id).subscribe({
      next: () => {
        console.log('✅ Saisie supprimée');
        this.successMessage = 'Saisie supprimée avec succès';
        this.loadSaisies(); // Recharger les données
        
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Erreur suppression:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la suppression';
        this.isLoading = false;
        
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }

  // ============ UTILITAIRES ============

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  hasError(fieldName: string): boolean {
    const field = this.nonconfForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.nonconfForm.get(fieldName);
    
    if (field?.hasError('required')) {
      return 'Ce champ est obligatoire';
    }
    
    if (field?.hasError('min')) {
      return 'La valeur doit être supérieure ou égale à 0';
    }
    
    if (field?.hasError('maxlength')) {
      const maxLength = field.errors?.['maxlength'].requiredLength;
      return `Maximum ${maxLength} caractères`;
    }
    
    return '';
  }

  // ============ STATISTIQUES ============

  getStats(): any {
    if (this.filteredSaisies.length === 0) return null;

    const stats = {
      totalQteRebut: 0,
      totalSortieLigne: 0,
      byType: {} as Record<string, { count: number, qteRebut: number }>,
      byLigne: {} as Record<string, { count: number, qteRebut: number }>,
      bySource: {} as Record<string, { count: number, qteRebut: number }>,
      byStatut: {} as Record<string, { count: number, qteRebut: number }>
    };

    this.filteredSaisies.forEach(saisie => {
      // Totaux
      stats.totalQteRebut += saisie.qteRebut;
      stats.totalSortieLigne += saisie.sortieLigne;

      // Par type
      if (!stats.byType[saisie.type]) {
        stats.byType[saisie.type] = { count: 0, qteRebut: 0 };
      }
      stats.byType[saisie.type].count++;
      stats.byType[saisie.type].qteRebut += saisie.qteRebut;

      // Par ligne
      if (!stats.byLigne[saisie.ligne]) {
        stats.byLigne[saisie.ligne] = { count: 0, qteRebut: 0 };
      }
      stats.byLigne[saisie.ligne].count++;
      stats.byLigne[saisie.ligne].qteRebut += saisie.qteRebut;

      // Par source
      if (!stats.bySource[saisie.sourceType]) {
        stats.bySource[saisie.sourceType] = { count: 0, qteRebut: 0 };
      }
      stats.bySource[saisie.sourceType].count++;
      stats.bySource[saisie.sourceType].qteRebut += saisie.qteRebut;

      // Par statut
      if (!stats.byStatut[saisie.statut]) {
        stats.byStatut[saisie.statut] = { count: 0, qteRebut: 0 };
      }
      stats.byStatut[saisie.statut].count++;
      stats.byStatut[saisie.statut].qteRebut += saisie.qteRebut;
    });

    return stats;
  }
  
  resetForm(): void {
    this.nonconfForm.reset();
  }
}