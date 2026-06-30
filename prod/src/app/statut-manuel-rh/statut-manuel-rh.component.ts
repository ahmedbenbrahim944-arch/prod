import {
  Component, OnInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PointageService, PresenceData } from '../pointage-dashboard/pointage.service';
import {
  StatutManuelService, StatutManuel, TypeStatutManuel, CreateStatutManuelPayload
} from './statut-manuel.service';
import { ExportExcelService, ExportPeriodeData, ExportRecapRow } from './export-excel.service';
import { Observable, forkJoin } from 'rxjs';

interface PersonneRow {
  matricule: string | number;
  nomPrenom: string;
  service?: string;
  heureEntree?: string | null;
  timbratrice?: string | null;
  statut: string;
  commentaire?: string | null;
}

// ✅ NOUVEAU — un statut rapide applicable en 1 clic depuis la sélection multiple
interface QuickStatutOption {
  value: TypeStatutManuel;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-statut-manuel-rh',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statut-manuel-rh.component.html',
  styleUrls: ['./statut-manuel-rh.component.css'],
})
export class StatutManuelRhComponent implements OnInit {

  // ── Filtre dates ─────────────────────────────────────────────
  dateDebut: string = new Date().toISOString().split('T')[0];
  dateFin: string   = new Date().toISOString().split('T')[0];

  // ── Filtre service ───────────────────────────────────────────
  selectedService: string | null = null;
  readonly services = ['Administratif', 'Maintenance', 'Magasin', 'Qualité'];

  // ── Données présence ─────────────────────────────────────────
  data: PresenceData | null = null;
  loading = true;
  filterTab: 'tous' | 'presents' | 'absents' = 'absents';
  private _searchTerm = '';

  // ✅ NOUVEAU — dès qu'on tape une recherche, on bascule sur "Tous" pour retrouver n'importe qui
  // sans devoir changer d'onglet manuellement
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(value: string) {
    this._searchTerm = value;
    if (value.trim()) {
      this.filterTab = 'tous';
    }
  }

  // ── Sélection multiple ──────────────────────────────────────── ✅ NOUVEAU
  selectedMatricules = new Set<string>();
  applyingQuick = false;
  quickError: string | null = null;

  readonly quickStatutOptions: QuickStatutOption[] = [
    { value: 'present', label: 'Présent',  icon: '✅' },
    { value: 'conge',   label: 'Congé',    icon: '🏖️' },
    { value: 'maladie', label: 'Maladie',  icon: '🤒' },
    { value: 'mission', label: 'Mission',  icon: '🚗' },
  ];

  // ── Données statuts manuels (table de gestion) ───────────────
  statuts: StatutManuel[] = [];
  loadingStatuts = false;

  // ── Export Excel ──────────────────────────────────────────────
  exportingExcel = false;
  exportError: string | null = null;

  // ── Formulaire ────────────────────────────────────────────────
  showForm = false; // ✅ NOUVEAU — formulaire caché par défaut
  formModel: CreateStatutManuelPayload = this.emptyForm();
  editingId: number | null = null;
  savingForm = false;
  formError: string | null = null;
  formSelectionPersonnes: PersonneRow[] = []; // ✅ NOUVEAU — personnes du groupe quand le formulaire vient de la sélection multiple

  readonly statutOptions: { value: TypeStatutManuel; label: string }[] = [
    { value: 'present', label: ' Présent (badge oublié)' },
    { value: 'conge',   label: ' Congé' },
    { value: 'maladie', label: ' Maladie' },
    { value: 'mission', label: ' Mission' },
    { value: 'autre',   label: ' Autre' },
  ];

  constructor(
    private pointageSvc: PointageService,
    private statutSvc: StatutManuelService,
    private exportSvc: ExportExcelService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadStatuts();
  }

  // ════════════════════════════════════════════════════════════
  // Présence (ouvrier ou service) sur la période choisie
  // ════════════════════════════════════════════════════════════
  load(): void {
    this.loading = true;
    const obs: Observable<any> = this.selectedService
      ? this.pointageSvc.getPresencePeriodeEmployees(this.dateDebut, this.dateFin)
      : this.pointageSvc.getPresencePeriode(this.dateDebut, this.dateFin);

    obs.subscribe({
      next: (res: any) => {
        if (this.selectedService) {
          const presents = res.presents.filter((p: any) => p.service === this.selectedService);
          const absents = res.absents.filter((a: any) => a.service === this.selectedService);
          this.data = { total: presents.length, presents, absents };
        } else {
          this.data = res;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }

  loadToday(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dateDebut = today;
    this.dateFin = today;
    this.load();
  }

  loadPeriode(): void {
    if (!this.dateDebut || !this.dateFin) return;
    this.load();
  }

  selectService(service: string): void {
    this.selectedService = this.selectedService === service ? null : service;
    this.load();
  }

  clearServiceFilter(): void {
    this.selectedService = null;
    this.load();
  }

  // ════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Sélection multiple sur la liste "Présence du jour"
  // ════════════════════════════════════════════════════════════
  isSelected(matricule: string | number): boolean {
    return this.selectedMatricules.has(String(matricule));
  }

  toggleSelection(p: PersonneRow): void {
    const key = String(p.matricule);
    if (this.selectedMatricules.has(key)) {
      this.selectedMatricules.delete(key);
    } else {
      this.selectedMatricules.add(key);
    }
  }

  clearSelection(): void {
    this.selectedMatricules.clear();
    this.quickError = null;
  }

  get selectedCount(): number {
    return this.selectedMatricules.size;
  }

  /** Les objets PersonneRow correspondant aux matricules sélectionnés (pour pré-remplir le formulaire détaillé) */
  get selectedPersonnes(): PersonneRow[] {
    const all = [...(this.data?.presents || []), ...(this.data?.absents || [])];
    return all.filter(p => this.selectedMatricules.has(String(p.matricule)));
  }

  /**
   * ✅ NOUVEAU — Bouton rapide : applique un statut à toutes les personnes sélectionnées
   * pour aujourd'hui → aujourd'hui, sans ouvrir de formulaire.
   * Si un statut existe déjà pour la personne sur cette date exacte, il est mis à jour (update),
   * sinon un nouveau statut est créé.
   */
  applyQuickStatut(statut: TypeStatutManuel): void {
    if (this.selectedCount === 0 || this.applyingQuick) return;

    this.quickError = null;
    this.applyingQuick = true;

    const today = new Date().toISOString().split('T')[0];
    const personnes = this.selectedPersonnes;

    const requests = personnes.map(p => {
      const existant = this.statuts.find(s =>
        String(s.matricule) === String(p.matricule) &&
        s.dateDebut <= today && s.dateFin >= today
      );

      const payload: CreateStatutManuelPayload = {
        matricule: String(p.matricule),
        nomPrenom: p.nomPrenom,
        statut,
        dateDebut: today,
        dateFin: today,
        commentaire: existant?.commentaire || undefined,
      };

      return existant
        ? this.statutSvc.update(existant.id, payload)
        : this.statutSvc.create(payload);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.applyingQuick = false;
        this.clearSelection();
        this.loadStatuts();
        this.load();
      },
      error: (err) => {
        this.applyingQuick = false;
        this.quickError = err?.error?.message || "Erreur lors de l'application du statut.";
      }
    });
  }

  /** ✅ NOUVEAU — ouvre le formulaire détaillé pré-rempli avec toutes les personnes sélectionnées */
  openDetailedFormForSelection(): void {
    const personnes = this.selectedPersonnes;
    if (personnes.length === 0) return;

    this.editingId = null;
    this.formModel = {
      matricule: personnes.map(p => String(p.matricule)).join(', '),
      nomPrenom: personnes.map(p => p.nomPrenom).join(', '),
      statut: 'present',
      dateDebut: this.dateDebut,
      dateFin: this.dateFin,
      commentaire: '',
    };
    this.formSelectionPersonnes = personnes; // ✅ NOUVEAU — gardé pour le submit multi
    this.showForm = true;
    this.scrollToForm();
  }

  // ════════════════════════════════════════════════════════════
  // Export Excel — pointage de la période : services + ouvriers + récap
  // ════════════════════════════════════════════════════════════
  exportExcel(): void {
    if (!this.dateDebut || !this.dateFin) return;
    this.exportError = null;
    this.exportingExcel = true;

    forkJoin({
      employees: this.pointageSvc.getPresencePeriodeEmployees(this.dateDebut, this.dateFin),
      ouvriers: this.pointageSvc.getPresencePeriode(this.dateDebut, this.dateFin),
      recap: this.pointageSvc.getRecapPeriode(this.dateDebut, this.dateFin),
    }).subscribe({
      next: async ({ employees, ouvriers, recap }) => {
        try {
          const dataParService: Record<string, ExportPeriodeData> = {};
          this.services.forEach(service => {
            dataParService[service] = {
              presents: (employees.presents || []).filter((p: any) => p.service === service),
              absents: (employees.absents || []).filter((a: any) => a.service === service),
            };
          });

          const dataOuvriers: ExportPeriodeData = {
            presents: ouvriers.presents || [],
            absents: ouvriers.absents || [],
          };

          const recapRows: ExportRecapRow[] = [
            ...(recap.recapEmployees || []),
            ...(recap.recapOuvriers || []).map(o => ({ ...o, service: 'Ouvrier' })),
          ];

          await this.exportSvc.exportPointagePeriode(
            dataParService,
            dataOuvriers,
            recapRows,
            this.statuts,
            this.dateDebut,
            this.dateFin,
            this.services,
          );
        } catch (e) {
          this.exportError = "Erreur lors de la génération du fichier Excel.";
        } finally {
          this.exportingExcel = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.exportingExcel = false;
        this.exportError = "Impossible de récupérer les données de présence pour l'export.";
        this.cdr.markForCheck();
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // Liste des statuts manuels (CRUD)
  // ════════════════════════════════════════════════════════════
  loadStatuts(): void {
    this.loadingStatuts = true;
    this.statutSvc.findAll().subscribe({
      next: (res) => {
        this.statuts = res;
        this.loadingStatuts = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingStatuts = false; }
    });
  }

  // ════════════════════════════════════════════════════════════
  // Formulaire — création / édition
  // ════════════════════════════════════════════════════════════
  private emptyForm(): CreateStatutManuelPayload {
    const today = new Date().toISOString().split('T')[0];
    return {
      matricule: '',
      nomPrenom: '',
      statut: 'present',
      dateDebut: today,
      dateFin: today,
      commentaire: '',
    };
  }

  // Pré-remplit le formulaire depuis une ligne absente cliquée
  // ✅ NOUVEAU — c'est ce qui ouvre désormais le formulaire (il était caché)
  prefillFromPersonne(p: PersonneRow): void {
    this.editingId = null;
    this.formModel = {
      matricule: String(p.matricule),
      nomPrenom: p.nomPrenom,
      statut: 'present',
      dateDebut: this.dateDebut,
      dateFin: this.dateFin,
      commentaire: '',
    };
    this.formSelectionPersonnes = []; // ✅ NOUVEAU — formulaire mono-personne, pas de groupe
    this.showForm = true; // ✅ NOUVEAU
    this.scrollToForm();
  }

  editStatut(s: StatutManuel): void {
    this.editingId = s.id;
    this.formModel = {
      matricule: s.matricule,
      nomPrenom: s.nomPrenom,
      statut: s.statut,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      commentaire: s.commentaire || '',
    };
    this.formSelectionPersonnes = []; // ✅ NOUVEAU
    this.showForm = true; // ✅ NOUVEAU
    this.scrollToForm();
  }

  resetForm(): void {
    this.editingId = null;
    this.formModel = this.emptyForm();
    this.formError = null;
    this.formSelectionPersonnes = []; // ✅ NOUVEAU
    this.showForm = false; // ✅ NOUVEAU — referme le formulaire
  }

  submitForm(): void {
    this.formError = null;

    // ✅ NOUVEAU — soumission groupée (plusieurs personnes sélectionnées)
    if (this.formSelectionPersonnes.length > 0) {
      this.submitFormGroupe();
      return;
    }

    if (!this.formModel.matricule?.trim() || !this.formModel.nomPrenom?.trim()) {
      this.formError = 'Matricule et nom sont obligatoires.';
      return;
    }
    if (this.formModel.dateFin < this.formModel.dateDebut) {
      this.formError = 'La date de fin doit être après la date de début.';
      return;
    }

    this.savingForm = true;
    const payload = { ...this.formModel, commentaire: this.formModel.commentaire || undefined };

    const obs = this.editingId
      ? this.statutSvc.update(this.editingId, payload)
      : this.statutSvc.create(payload);

    obs.subscribe({
      next: () => {
        this.savingForm = false;
        this.resetForm(); // referme aussi le formulaire (showForm = false)
        this.loadStatuts();
        this.load();
      },
      error: (err) => {
        this.savingForm = false;
        this.formError = err?.error?.message || "Erreur lors de l'enregistrement.";
      }
    });
  }

  /** ✅ NOUVEAU — applique le statut/dates/commentaire du formulaire à tout le groupe sélectionné */
  private submitFormGroupe(): void {
    if (this.formModel.dateFin < this.formModel.dateDebut) {
      this.formError = 'La date de fin doit être après la date de début.';
      return;
    }

    this.savingForm = true;
    const commentaire = this.formModel.commentaire || undefined;

    const requests = this.formSelectionPersonnes.map(p => {
      const existant = this.statuts.find(s =>
        String(s.matricule) === String(p.matricule) &&
        s.dateDebut <= this.formModel.dateFin && s.dateFin >= this.formModel.dateDebut
      );

      const payload: CreateStatutManuelPayload = {
        matricule: String(p.matricule),
        nomPrenom: p.nomPrenom,
        statut: this.formModel.statut,
        dateDebut: this.formModel.dateDebut,
        dateFin: this.formModel.dateFin,
        commentaire,
      };

      return existant
        ? this.statutSvc.update(existant.id, payload)
        : this.statutSvc.create(payload);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.savingForm = false;
        this.clearSelection();
        this.resetForm();
        this.loadStatuts();
        this.load();
      },
      error: (err) => {
        this.savingForm = false;
        this.formError = err?.error?.message || "Erreur lors de l'enregistrement du groupe.";
      }
    });
  }

  deleteStatut(s: StatutManuel): void {
    if (!confirm(`Supprimer le statut "${this.statutLabel(s.statut)}" de ${s.nomPrenom} ?`)) return;
    this.statutSvc.remove(s.id).subscribe({
      next: () => {
        this.loadStatuts();
        this.load();
      }
    });
  }

  private scrollToForm(): void {
    setTimeout(() => {
      document.getElementById('rh-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  // ════════════════════════════════════════════════════════════
  // Getters / helpers
  // ════════════════════════════════════════════════════════════
  get totalPersonnes(): number {
    return (this.data?.presents.length || 0) + (this.data?.absents.length || 0);
  }
  get totalPresents(): number {
    return this.data?.presents.length || 0;
  }
  get totalAbsents(): number {
    return this.data?.absents.length || 0;
  }
  get tauxPresence(): number {
    if (!this.totalPersonnes) return 0;
    return Math.round((this.totalPresents / this.totalPersonnes) * 100);
  }

  get filteredList(): PersonneRow[] {
    let list: any[] = [];
    if (this.filterTab === 'tous') {
      list = [...(this.data?.presents || []), ...(this.data?.absents || [])];
    } else if (this.filterTab === 'presents') {
      list = this.data?.presents || [];
    } else {
      list = this.data?.absents || [];
    }

    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      list = list.filter(o =>
        o.nomPrenom.toLowerCase().includes(s) ||
        String(o.matricule).includes(s)
      );
    }
    return list;
  }

  statutLabel(statut: string): string {
    return this.statutOptions.find(o => o.value === statut)?.label || statut;
  }

  formatHeure(date: string | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  today(): string {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}