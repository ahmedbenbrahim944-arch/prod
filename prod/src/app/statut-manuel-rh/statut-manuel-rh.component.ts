import {
  Component, OnInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PointageService, PresenceData } from '../pointage-dashboard/pointage.service';
import {
  StatutManuelService, StatutManuel, TypeStatutManuel, TypeMaladie, CreateStatutManuelPayload
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

// ✅ NOUVEAU — les 4 gros boutons affichés sur CHAQUE ligne d'absence
interface RowActionButton {
  statut: TypeStatutManuel;
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
  readonly String = String;

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
    { value: 'present',                label: 'Présent',                 icon: '✅' },
    { value: 'badge_oublie',           label: 'Badge oublié',            icon: '🪪' },
    { value: 'conge',                  label: 'Congé',                   icon: '🏖️' },
    { value: 'maladie',                label: 'Maladie',                 icon: '🤒' },
    { value: 'absence_non_justifiee',  label: 'Absence non justifiée',   icon: '🚫' },
    { value: 'mission',                label: 'Mission',                 icon: '🚗' },
  ];

  // ════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — 4 gros boutons d'action affichés sur chaque ligne
  // d'absence dans la liste "Présence". Cliquer dessus enregistre
  // immédiatement le statut pour la période affichée (dateDebut → dateFin).
  // ════════════════════════════════════════════════════════════
  readonly rowActionButtons: RowActionButton[] = [
    { statut: 'conge',                 label: 'Congé',                  icon: '🏖️' },
    { statut: 'badge_oublie',          label: 'Présent (badge oublié)', icon: '🪪' },
    { statut: 'absence_non_justifiee', label: 'Absence non justifiée',  icon: '🚫' },
    { statut: 'maladie',               label: 'Congé maladie',          icon: '🤒' },
  ];

  // Matricule de la personne dont on enregistre actuellement un statut rapide (désactive ses boutons)
  rowSaving: string | null = null;
  // Erreur d'enregistrement rapide, par matricule
  rowErrors = new Map<string, string>();

  // ── Sous-formulaire "Congé maladie" ouvert sur une ligne ────── ✅ NOUVEAU
  // Matricule de la ligne pour laquelle le sous-panneau Accouchement/Certificat est ouvert
  maladieFormMatricule: string | null = null;
  maladieSubModel: { typeMaladie: TypeMaladie | null; dateDebut: string; dateFin: string; nomDocteur: string } = this.emptyMaladieSubModel();

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
    { value: 'present',                label: ' Présent' },
    { value: 'badge_oublie',           label: ' Présent (badge oublié)' },
    { value: 'conge',                  label: ' Congé' },
    { value: 'maladie',                label: ' Congé maladie' },
    { value: 'absence_non_justifiee',  label: ' Absence non justifiée' },
    { value: 'mission',                label: ' Mission' },
    { value: 'autre',                  label: ' Autre' },
  ];

  readonly typeMaladieOptions: { value: TypeMaladie; label: string }[] = [
    { value: 'accouchement', label: 'Accouchement' },
    { value: 'certificat',   label: 'Certificat médical' },
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
  // ✅ NOUVEAU — Action rapide en 1 clic, DIRECTEMENT depuis une ligne
  // d'absence (les 4 gros boutons : Congé / Présent badge oublié /
  // Absence non justifiée / Congé maladie). Utilise la période affichée
  // (dateDebut → dateFin). "maladie" ouvre un sous-panneau au lieu
  // d'enregistrer directement (il faut choisir accouchement/certificat).
  // ════════════════════════════════════════════════════════════
  onRowAction(p: PersonneRow, statut: TypeStatutManuel): void {
    if (statut === 'maladie') {
      this.toggleMaladieForm(p);
      return;
    }
    this.saveQuickStatutPourPersonne(p, { statut });
  }

  private saveQuickStatutPourPersonne(
    p: PersonneRow,
    extra: { statut: TypeStatutManuel; typeMaladie?: TypeMaladie; nomDocteur?: string; dateDebut?: string; dateFin?: string },
  ): void {
    const matricule = String(p.matricule);
    this.rowSaving = matricule;
    this.rowErrors.delete(matricule);

    const dateDebut = extra.dateDebut || this.dateDebut;
    const dateFin = extra.dateFin || this.dateFin;

    // Si un statut existe déjà pour cette personne sur une période qui chevauche → on le met à jour
    const existant = this.statuts.find(s =>
      String(s.matricule) === matricule &&
      s.dateDebut <= dateFin && s.dateFin >= dateDebut
    );

    const payload: CreateStatutManuelPayload = {
      matricule,
      nomPrenom: p.nomPrenom,
      statut: extra.statut,
      dateDebut,
      dateFin,
      typeMaladie: extra.typeMaladie,
      nomDocteur: extra.nomDocteur,
    };

    const obs = existant
      ? this.statutSvc.update(existant.id, payload)
      : this.statutSvc.create(payload);

    obs.subscribe({
      next: () => {
        this.rowSaving = null;
        this.maladieFormMatricule = null;
        this.loadStatuts();
        this.load();
      },
      error: (err) => {
        this.rowSaving = null;
        this.rowErrors.set(matricule, err?.error?.message || "Erreur lors de l'enregistrement.");
        this.cdr.markForCheck();
      }
    });
  }

  // ── Sous-panneau "Congé maladie" (accouchement / certificat) ──── ✅ NOUVEAU
  private emptyMaladieSubModel() {
    return {
      typeMaladie: null as TypeMaladie | null,
      dateDebut: this.dateDebut,
      dateFin: this.dateFin,
      nomDocteur: '',
    };
  }

  toggleMaladieForm(p: PersonneRow): void {
    const matricule = String(p.matricule);
    if (this.maladieFormMatricule === matricule) {
      this.maladieFormMatricule = null; // referme si déjà ouvert
      return;
    }
    this.maladieFormMatricule = matricule;
    this.maladieSubModel = this.emptyMaladieSubModel();
    this.rowErrors.delete(matricule);
  }

  closeMaladieForm(): void {
    this.maladieFormMatricule = null;
  }

  selectTypeMaladie(type: TypeMaladie): void {
    this.maladieSubModel.typeMaladie = type;
  }

  submitMaladieForm(p: PersonneRow): void {
    const matricule = String(p.matricule);
    if (!this.maladieSubModel.typeMaladie) {
      this.rowErrors.set(matricule, 'Choisissez Accouchement ou Certificat.');
      return;
    }
    if (!this.maladieSubModel.dateDebut || !this.maladieSubModel.dateFin) {
      this.rowErrors.set(matricule, 'Date début et date fin sont obligatoires.');
      return;
    }
    if (this.maladieSubModel.dateFin < this.maladieSubModel.dateDebut) {
      this.rowErrors.set(matricule, 'La date de fin doit être après la date de début.');
      return;
    }

    this.saveQuickStatutPourPersonne(p, {
      statut: 'maladie',
      typeMaladie: this.maladieSubModel.typeMaladie,
      dateDebut: this.maladieSubModel.dateDebut,
      dateFin: this.maladieSubModel.dateFin,
      nomDocteur: this.maladieSubModel.typeMaladie === 'certificat'
        ? (this.maladieSubModel.nomDocteur || undefined)
        : undefined,
    });
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
    this.formSelectionPersonnes = [];
    this.showForm = true;
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
      typeMaladie: s.typeMaladie || undefined,
      nomDocteur: s.nomDocteur || '',
    };
    this.formSelectionPersonnes = [];
    this.showForm = true;
    this.scrollToForm();
  }

  resetForm(): void {
    this.editingId = null;
    this.formModel = this.emptyForm();
    this.formError = null;
    this.formSelectionPersonnes = [];
    this.showForm = false;
  }

  submitForm(): void {
    this.formError = null;

    // ✅ soumission groupée (plusieurs personnes sélectionnées)
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
    if (this.formModel.statut === 'maladie' && !this.formModel.typeMaladie) {
      this.formError = 'Précisez le type : Accouchement ou Certificat.';
      return;
    }

    this.savingForm = true;
    const payload: CreateStatutManuelPayload = {
      ...this.formModel,
      commentaire: this.formModel.commentaire || undefined,
      typeMaladie: this.formModel.statut === 'maladie' ? this.formModel.typeMaladie : undefined,
      nomDocteur: this.formModel.statut === 'maladie' && this.formModel.typeMaladie === 'certificat'
        ? (this.formModel.nomDocteur || undefined)
        : undefined,
    };

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

  /** ✅ applique le statut/dates/commentaire du formulaire à tout le groupe sélectionné */
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

  /**
   * ✅ NOUVEAU — Absences qui n'ont PAS encore de statut manuel enregistré
   * sur la période affichée. Dès qu'un statut est ajouté pour une personne,
   * elle disparaît de cette liste (et apparaît dans "Statuts manuels
   * enregistrés" en bas, où elle reste modifiable/supprimable).
   */
  get absencesATraiter(): PersonneRow[] {
    return (this.data?.absents || []).filter((a: any) => a.statut === 'absent');
  }

  get filteredList(): PersonneRow[] {
    let list: any[] = [];
    if (this.filterTab === 'tous') {
      list = [...(this.data?.presents || []), ...(this.data?.absents || [])];
    } else if (this.filterTab === 'presents') {
      list = this.data?.presents || [];
    } else {
      list = this.absencesATraiter; // ✅ NOUVEAU — uniquement les absences non traitées
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

  typeMaladieLabel(type?: string | null): string {
    if (!type) return '';
    return this.typeMaladieOptions.find(o => o.value === type)?.label || type;
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