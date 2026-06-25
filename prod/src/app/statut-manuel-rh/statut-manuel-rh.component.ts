import {
  Component, OnInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PointageService, PresenceData } from '../pointage-dashboard/pointage.service';
import {
  StatutManuelService, StatutManuel, TypeStatutManuel, CreateStatutManuelPayload
} from './statut-manuel.service';
import { ExportExcelService, ExportPeriodeData } from './export-excel.service';
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
  searchTerm = '';

  // ── Données statuts manuels (table de gestion) ───────────────
  statuts: StatutManuel[] = [];
  loadingStatuts = false;

  // ── Export Excel ──────────────────────────────────────────────
  exportingExcel = false;
  exportError: string | null = null;

  // ── Formulaire ────────────────────────────────────────────────
  formModel: CreateStatutManuelPayload = this.emptyForm();
  editingId: number | null = null;
  savingForm = false;
  formError: string | null = null;

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
  // Export Excel — pointage de la période, un onglet par service
  // ════════════════════════════════════════════════════════════
  exportExcel(): void {
    if (!this.dateDebut || !this.dateFin) return;
    this.exportError = null;
    this.exportingExcel = true;

    // On récupère toujours TOUS les services pour l'export (indépendant du filtre à l'écran)
    this.pointageSvc.getPresencePeriodeEmployees(this.dateDebut, this.dateFin).subscribe({
      next: async (res: any) => {
        try {
          const dataParService: Record<string, ExportPeriodeData> = {};
          this.services.forEach(service => {
            dataParService[service] = {
              presents: (res.presents || []).filter((p: any) => p.service === service),
              absents: (res.absents || []).filter((a: any) => a.service === service),
            };
          });

          await this.exportSvc.exportPointagePeriode(
            dataParService,
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
    this.scrollToForm();
  }

  resetForm(): void {
    this.editingId = null;
    this.formModel = this.emptyForm();
    this.formError = null;
  }

  submitForm(): void {
    this.formError = null;

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
        this.resetForm();
        this.loadStatuts();
        this.load();
      },
      error: (err) => {
        this.savingForm = false;
        this.formError = err?.error?.message || "Erreur lors de l'enregistrement.";
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