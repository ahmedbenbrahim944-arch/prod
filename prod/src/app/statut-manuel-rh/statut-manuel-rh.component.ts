import {
  Component, OnInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  PointageService, PresenceData, RecapPoste, RecapPosteItem
} from '../pointage-dashboard/pointage.service';
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

// ✅ un statut rapide applicable en 1 clic depuis la sélection multiple
interface QuickStatutOption {
  value: TypeStatutManuel;
  label: string;
  icon: string; // clé vers le registre d'icônes SVG (this.icons)
}

// ✅ les gros boutons affichés sur CHAQUE ligne d'absence
interface RowActionButton {
  statut: TypeStatutManuel;
  label: string;
  icon: string; // clé vers le registre d'icônes SVG (this.icons)
}

@Component({
  selector: 'app-statut-manuel-rh',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statut-manuel-rh.component.html',
  styleUrls: ['./statut-manuel-rh.component.css'],
})
export class StatutManuelRhComponent implements OnInit {

  // ✅ Expose String au template (nécessaire pour String(o.matricule) dans le HTML)
  readonly String = String;

  // ════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Registre d'icônes SVG (remplace les emoji, qui
  // s'affichent mal/cassés selon le système — voir capture Windows).
  // Chaque icône est un trait simple (stroke=currentColor), 24x24.
  // ════════════════════════════════════════════════════════════
  private readonly icons: Record<string, string> = {
    // ── Statuts ──
    conge: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="5"/></svg>`,
    badge_oublie: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 9h3M15 13h3M7 16h6"/></svg>`,
    absence_non_justifiee: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>`,
    maladie: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
    attente_justification: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    present: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    mission: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    autre: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`,
    raison_familiale: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="5"/><path d="M3 3l18 18"/></svg>`,
  fin_contrat: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h6M8 17h4"/></svg>`,
  mise_a_pied: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    // ── Sous-types maladie ──
    accouchement: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21c0-4 2.5-6 6-6s6 2 6 6"/></svg>`,
    certificat: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>`,

    // ── Icônes d'interface ──
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
    export: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5"/></svg>`,
  };

  /** Renvoie le SVG (sécurisé) correspondant à une clé du registre d'icônes. */
  getIcon(key: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.icons[key || ''] || '');
  }

  // ── Filtre dates ─────────────────────────────────────────────
  dateDebut: string = new Date().toISOString().split('T')[0];
  dateFin: string   = new Date().toISOString().split('T')[0];

  // ── Filtre service ───────────────────────────────────────────
  selectedService: string | null = null;
  readonly services = ['Administratif', 'Maintenance', 'Magasin', 'Qualité'];

  // ── ✅ NOUVEAU — Filtre poste (Ouvrier : 1ere poste / 2eme poste) ──
  selectedPoste: '1ere poste' | '2eme poste' | null = null;
  readonly postes: ('1ere poste' | '2eme poste')[] = ['1ere poste', '2eme poste'];

  // ── Données présence ─────────────────────────────────────────
  data: PresenceData | null = null;
  loading = true;
  filterTab: 'tous' | 'presents' | 'absents' = 'absents';
  private _searchTerm = '';

  // dès qu'on tape une recherche, on bascule sur "Tous" pour retrouver n'importe qui
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(value: string) {
    this._searchTerm = value;
    if (value.trim()) {
      this.filterTab = 'tous';
    }
  }

  // ── Sélection multiple ──────────────────────────────────────
  selectedMatricules = new Set<string>();
  applyingQuick = false;
  quickError: string | null = null;

  readonly quickStatutOptions: QuickStatutOption[] = [
    { value: 'present',                 label: 'Présent',                    icon: 'present' },
    { value: 'badge_oublie',            label: 'Badge oublié',               icon: 'badge_oublie' },
    { value: 'conge',                   label: 'Congé',                      icon: 'conge' },
    { value: 'maladie',                 label: 'Maladie',                    icon: 'maladie' },
    { value: 'absence_non_justifiee',   label: 'Absence non justifiée',      icon: 'absence_non_justifiee' },
    { value: 'attente_justification',   label: 'En attente de justification',icon: 'attente_justification' }, // ✅ NOUVEAU
    { value: 'mission',                 label: 'Mission',                    icon: 'mission' },
     { value: 'raison_familiale',        label: 'Raison familiale',           icon: 'raison_familiale' },
  { value: 'fin_contrat',             label: 'Fin de contrat',             icon: 'fin_contrat' },
  { value: 'mise_a_pied',             label: 'Mise à pied',                icon: 'mise_a_pied' },
  ];

  readonly rowActionButtons: RowActionButton[] = [
    { statut: 'conge',                  label: 'Congé',                       icon: 'conge' },
    { statut: 'badge_oublie',           label: 'Présent (badge oublié)',      icon: 'badge_oublie' },
    { statut: 'absence_non_justifiee',  label: 'Absence non justifiée',       icon: 'absence_non_justifiee' },
    { statut: 'attente_justification',  label: 'En attente de justification', icon: 'attente_justification' }, // ✅ NOUVEAU
    { statut: 'maladie',                label: 'Congé maladie',               icon: 'maladie' },
    { statut: 'raison_familiale',       label: 'Raison familiale',            icon: 'raison_familiale' },
  { statut: 'fin_contrat',            label: 'Fin de contrat',              icon: 'fin_contrat' },
  { statut: 'mise_a_pied',            label: 'Mise à pied',                 icon: 'mise_a_pied' },
  ];

  // Matricule de la personne dont on enregistre actuellement un statut rapide (désactive ses boutons)
  rowSaving: string | null = null;
  // Erreur d'enregistrement rapide, par matricule
  rowErrors = new Map<string, string>();

  // ── Sous-formulaire "Congé maladie" ouvert sur une ligne ──────
  maladieFormMatricule: string | null = null;
  maladieSubModel: { typeMaladie: TypeMaladie | null; dateDebut: string; dateFin: string; nomDocteur: string } = this.emptyMaladieSubModel();

  // ── Données statuts manuels (table de gestion) ───────────────
  statuts: StatutManuel[] = [];
  loadingStatuts = false;

  // ── Export Excel ──────────────────────────────────────────────
  exportingExcel = false;
  exportError: string | null = null;

  // ── Formulaire ────────────────────────────────────────────────
  showForm = false;
  formModel: CreateStatutManuelPayload = this.emptyForm();
  editingId: number | null = null;
  savingForm = false;
  formError: string | null = null;
  formSelectionPersonnes: PersonneRow[] = [];

  readonly statutOptions: { value: TypeStatutManuel; label: string }[] = [
    { value: 'present',                  label: 'Présent' },
    { value: 'badge_oublie',             label: 'Présent (badge oublié)' },
    { value: 'conge',                    label: 'Congé' },
    { value: 'maladie',                  label: 'Congé maladie' },
    { value: 'absence_non_justifiee',    label: 'Absence non justifiée' },
    { value: 'attente_justification',    label: 'En attente de justification' }, // ✅ NOUVEAU
    { value: 'mission',                  label: 'Mission' },
    { value: 'autre',                    label: 'Autre' },
    { value: 'raison_familiale',         label: 'Raison familiale' },
  { value: 'fin_contrat',              label: 'Fin de contrat' },
  { value: 'mise_a_pied',              label: 'Mise à pied' },
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
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadStatuts();
  }

  // ════════════════════════════════════════════════════════════
  // Présence (ouvrier / service / poste) sur la période choisie
  // ✅ MODIFIÉ — "load()" est maintenant un dispatcher : il recharge
  // la bonne source selon le mode actif (poste > service > normal),
  // afin que tous les callbacks existants (après sauvegarde d'un
  // statut, changement de date, etc.) restent valables sans y toucher.
  // ════════════════════════════════════════════════════════════
 load(): void {
    if (this.selectedPoste) {
      this.loadPosteData();
      return;
    }

    this.loading = true;
    const obs: Observable<any> = this.selectedService
      ? this.pointageSvc.getPresencePeriodeEmployees(this.dateDebut, this.dateFin)
      : this.pointageSvc.getPresencePeriode(this.dateDebut, this.dateFin);

    obs.subscribe({
      next: (res: any) => {
        if (this.selectedService) {
          const presents = res.presents.filter((p: any) => p.service === this.selectedService);
          const absents = res.absents.filter((a: any) => a.service === this.selectedService);
          const enConge = (res.enConge || []).filter((c: any) => c.service === this.selectedService); // ✅ NOUVEAU
          this.data = { total: presents.length + absents.length + enConge.length, presents, absents, enConge };
        } else {
          this.data = res;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }

  // ✅ NOUVEAU — charge la liste nominative (présents + absents) du poste sélectionné
  private loadPosteData(): void {
    if (!this.selectedPoste) return;
    this.loading = true;

    const today = new Date().toISOString().split('T')[0];
    const isToday = this.dateDebut === today && this.dateFin === today;

    const obs = isToday
      ? this.pointageSvc.getRecapPosteToday()
      : this.pointageSvc.getRecapPostePeriode(this.dateDebut, this.dateFin);

    obs.subscribe({
      next: (rows: RecapPoste[]) => {
        const filtres = rows.filter(r => r.poste === this.selectedPoste);
        const presents: PersonneRow[] = filtres.flatMap(r => r.presentsListe.map(i => this.toPersonneRow(i)));
        const absents: PersonneRow[] = filtres.flatMap(r => r.absentsListe.map(i => this.toPersonneRow(i)));
        const enConge: PersonneRow[] = filtres.flatMap(r => (r.enCongeListe || []).map(i => this.toPersonneRow(i)));
        this.data = {
          total: presents.length + absents.length + enConge.length,
          presents,
          absents,
          enConge,
        } as PresenceData; // ✅ cast : PersonneRow est une forme allégée compatible à l'usage, mais pas structurellement identique
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }

  private toPersonneRow(item: RecapPosteItem): PersonneRow {
    return {
      matricule: item.matricule,
      nomPrenom: item.nomPrenom,
      heureEntree: item.heureEntree ?? null,
      timbratrice: item.timbratrice ?? null,
      statut: item.statut,
      commentaire: item.commentaire ?? null,
    };
  }

  // ✅ NOUVEAU — sélection d'un poste (Ouvrier), exclusif avec le filtre service
  selectPoste(poste: '1ere poste' | '2eme poste'): void {
    if (this.selectedPoste === poste) {
      // re-clic → désactive le mode poste, retour à la vue normale
      this.selectedPoste = null;
      this.load();
      return;
    }

    this.selectedPoste = poste;
    if (this.selectedService) {
      this.selectedService = null; // exclusivité avec le filtre service
    }
    this.load();
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

  // ✅ MODIFIÉ — exclusivité avec le filtre poste
  selectService(service: string): void {
    if (this.selectedPoste) {
      this.selectedPoste = null; // exclusivité avec le filtre poste
    }
    this.selectedService = this.selectedService === service ? null : service;
    this.load();
  }

  clearServiceFilter(): void {
    this.selectedService = null;
    this.load();
  }

  // ════════════════════════════════════════════════════════════
  // Sélection multiple sur la liste "Présence du jour"
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
   * Bouton rapide : applique un statut à toutes les personnes sélectionnées
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

  /** Ouvre le formulaire détaillé pré-rempli avec toutes les personnes sélectionnées */
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
    this.formSelectionPersonnes = personnes;
    this.showForm = true;
    this.scrollToForm();
  }

  // ════════════════════════════════════════════════════════════
  // Action rapide en 1 clic, DIRECTEMENT depuis une ligne d'absence.
  // Utilise la période affichée (dateDebut → dateFin). "maladie" ouvre
  // un sous-panneau au lieu d'enregistrer directement (il faut choisir
  // accouchement/certificat).
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

  // ── Sous-panneau "Congé maladie" (accouchement / certificat) ────
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

    // soumission groupée (plusieurs personnes sélectionnées)
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

  /** Applique le statut/dates/commentaire du formulaire à tout le groupe sélectionné */
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
   * Absences qui n'ont PAS encore de statut manuel enregistré sur la
   * période affichée. Dès qu'un statut est ajouté pour une personne,
   * elle disparaît de cette liste (et apparaît dans "Statuts manuels
   * enregistrés" en bas, où elle reste modifiable/supprimable).
   */
  get absencesATraiter(): PersonneRow[] {
    return (this.data?.absents || []).filter((a: any) => {
      if (a.statut !== 'absent') return false;

      // ✅ Exclut les personnes qui ont déjà un statut manuel
      // enregistré et actif sur la période affichée (même logique
      // de chevauchement que saveQuickStatutPourPersonne / applyQuickStatut).
      const matricule = String(a.matricule);
      const dejaTraite = this.statuts.some(s =>
        String(s.matricule) === matricule &&
        s.dateDebut <= this.dateFin && s.dateFin >= this.dateDebut
      );

      return !dejaTraite;
    });
  }

  get filteredList(): PersonneRow[] {
    let list: any[] = [];
    if (this.filterTab === 'tous') {
      list = [...(this.data?.presents || []), ...(this.data?.absents || [])];
    } else if (this.filterTab === 'presents') {
      list = this.data?.presents || [];
    } else {
      list = this.absencesATraiter;
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
  // ── Filtres pour la liste "Statuts manuels enregistrés" ──────
  statutsFilterMatricule: string = '';
  statutsFilterNom: string = '';
  statutsFilterStatut: TypeStatutManuel | '' = '';
  statutsFilterDateDebut: string | null = null;
  statutsFilterDateFin: string | null = null;

  get filteredStatuts(): StatutManuel[] {
    let list = this.statuts;

    if (this.statutsFilterMatricule.trim()) {
      const m = this.statutsFilterMatricule.trim().toLowerCase();
      list = list.filter(s => String(s.matricule).toLowerCase().includes(m));
    }

    if (this.statutsFilterNom.trim()) {
      const n = this.statutsFilterNom.trim().toLowerCase();
      list = list.filter(s => s.nomPrenom.toLowerCase().includes(n));
    }

    if (this.statutsFilterStatut) {
      list = list.filter(s => s.statut === this.statutsFilterStatut);
    }

    // Filtre par période : on garde les statuts dont la période chevauche l'intervalle demandé
    if (this.statutsFilterDateDebut) {
      list = list.filter(s => s.dateFin >= this.statutsFilterDateDebut!);
    }
    if (this.statutsFilterDateFin) {
      list = list.filter(s => s.dateDebut <= this.statutsFilterDateFin!);
    }

    return list;
  }

  resetStatutsFilters(): void {
    this.statutsFilterMatricule = '';
    this.statutsFilterNom = '';
    this.statutsFilterStatut = '';
    this.statutsFilterDateDebut = null;
    this.statutsFilterDateFin = null;
  }
}