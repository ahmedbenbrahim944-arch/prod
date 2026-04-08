// src/app/affectation/affectation.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffectationService, Ouvrier, Affectation, PhaseHeures } from './affectation.service';
import { ExportExcelService } from './export-excel.service';
import { forkJoin } from 'rxjs';

interface PhaseRow {
  phase: string;
  heures: number;
}

interface OuvrierRow extends Ouvrier {
  affectation: Affectation | null;
  editing: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  success: boolean;
  formLigne: string;
  formPhases: PhaseRow[];
  formEstCapitaine: boolean;
  formPoste: '1ere poste' | '2eme poste'; // ← modifié
  availablePhases: string[];
  loadingPhases: boolean;
  liveTotal: number;
}

interface LigneGroup {
  ligne: string;
  posteGroups: {
    '1ere poste': PosteGroup;
    '2eme poste': PosteGroup;
  };
  capitaine?: OuvrierRow;
  totalOuvriers: number;
  totalHeures: number;
}

interface PosteGroup {
  poste: '1ere poste' | '2eme poste';
  ouvriers: OuvrierRow[];
  totalHeures: number;
  totalOuvriers: number;
}

@Component({
  selector: 'app-affectation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affectation.component.html',
  styleUrls: ['./affectation.component.css'],
})
export class AffectationComponent implements OnInit {
  rows: OuvrierRow[] = [];
  lignes: string[] = [];
  loading = true;
  globalError: string | null = null;
  searchTerm = '';
  filterStatus: 'all' | 'assigned' | 'unassigned' = 'all';
  viewMode: 'table' | 'grouped' = 'table';
  selectedLigne: string = '';

  constructor(
    private svc: AffectationService,
    private exportSvc: ExportExcelService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadData(); }

  // ── Chargement ─────────────────────────────────────────────────────────────

  loadData(): void {
    this.loading = true;
    this.globalError = null;

    forkJoin({
      ouvriers:     this.svc.getAllOuvriers(),
      affectations: this.svc.getAllAffectations(),
      lignesResp:   this.svc.getAllLignes(),
    }).subscribe({
      next: ({ ouvriers, affectations, lignesResp }) => {
        this.lignes = lignesResp.lignes;
        const affMap = new Map(affectations.data.map((a) => [a.matricule, a]));

        this.rows = ouvriers.map((o) => {
          const aff = affMap.get(o.matricule) ?? null;
          return {
            ...o,
            affectation: aff,
            editing: false,
            saving: false,
            deleting: false,
            error: null,
            success: false,
            formLigne: '',
            formPhases: [{ phase: '', heures: 0 }],
            formEstCapitaine: false,
            formPoste: '1ere poste', // ← modifié: valeur par défaut "1ere poste"
            availablePhases: [],
            loadingPhases: false,
            liveTotal: 0,
          };
        });

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.globalError = 'Erreur lors du chargement.';
        this.loading = false;
      },
    });
  }

  // ── Édition inline ─────────────────────────────────────────────────────────

  startEdit(row: OuvrierRow): void {
    this.rows.forEach((r) => { if (r !== row) r.editing = false; });

    row.editing          = true;
    row.error            = null;
    row.formLigne        = row.affectation?.ligne ?? '';
    row.formEstCapitaine = row.affectation?.estCapitaine ?? false;
    row.formPoste        = row.affectation?.poste ?? '1ere poste'; // ← modifié: "1ere poste" par défaut
    row.formPhases       = row.affectation
      ? row.affectation.phases.map((p) => ({ phase: p.phase, heures: p.heures }))
      : [{ phase: '', heures: 0 }];
    row.liveTotal        = row.affectation?.totalHeures ?? 0;

    if (row.formLigne) {
      this.loadPhases(row, row.formLigne);
    }
  }

  cancelEdit(row: OuvrierRow): void {
    row.editing = false;
    row.error   = null;
  }

  onLigneChange(row: OuvrierRow): void {
    row.formPhases      = [{ phase: '', heures: 0 }];
    row.availablePhases = [];
    row.liveTotal       = 0;
    if (row.formLigne) this.loadPhases(row, row.formLigne);
  }

  loadPhases(row: OuvrierRow, ligne: string): void {
    row.loadingPhases = true;
    this.svc.getPhasesByLigne(ligne).subscribe({
      next: (phases) => {
        row.availablePhases = phases;
        row.loadingPhases   = false;
        this.cdr.markForCheck();
      },
      error: () => {
        row.availablePhases = [];
        row.loadingPhases   = false;
      },
    });
  }

  // ── Gestion des phases ──────────────────────────────────────────────────────

  addPhaseRow(row: OuvrierRow): void {
    row.formPhases.push({ phase: '', heures: 0 });
  }

  removePhaseRow(row: OuvrierRow, i: number): void {
    if (row.formPhases.length > 1) {
      row.formPhases.splice(i, 1);
      this.calcTotal(row);
    }
  }

  calcTotal(row: OuvrierRow): void {
    row.liveTotal = row.formPhases.reduce((s, p) => s + (Number(p.heures) || 0), 0);
  }

  getAvailable(row: OuvrierRow, currentIndex: number): string[] {
    const others = row.formPhases
      .filter((_, i) => i !== currentIndex)
      .map((p) => p.phase)
      .filter(Boolean);
    return row.availablePhases.filter((p) => !others.includes(p));
  }

  // ── Sauvegarder ─────────────────────────────────────────────────────────────

  saveAffectation(row: OuvrierRow): void {
    row.error = null;

    if (!row.formLigne) {
      row.error = 'Veuillez sélectionner une ligne.';
      return;
    }
    if (row.formPhases.some((p) => !p.phase)) {
      row.error = 'Sélectionnez toutes les phases.';
      return;
    }
    if (row.formPhases.some((p) => p.heures <= 0)) {
      row.error = 'Les heures doivent être > 0.';
      return;
    }

    row.saving = true;
    const dto = {
      ligne:          row.formLigne,
      phases:         row.formPhases,
      estCapitaine:   row.formEstCapitaine,
      poste:          row.formPoste, // ← modifié: "1ere poste" ou "2eme poste"
    };

    const obs$ = row.affectation
      ? this.svc.updateAffectation(row.matricule, dto)
      : this.svc.createAffectation({ matricule: row.matricule, ...dto });

    obs$.subscribe({
      next: (resp) => {
        row.affectation = resp.data;
        row.editing     = false;
        row.saving      = false;
        row.success     = true;
        setTimeout(() => (row.success = false), 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        row.saving = false;
        row.error  = err?.error?.message ?? 'Erreur lors de la sauvegarde.';
      },
    });
  }

  async toggleCapitaine(row: OuvrierRow): Promise<void> {
    if (!row.affectation) return;

    const nouvelleValeur = !row.affectation.estCapitaine;
    const action$ = nouvelleValeur
      ? this.svc.nommerCapitaine(row.matricule)
      : this.svc.retirerCapitaine(row.matricule);

    row.saving = true;
    action$.subscribe({
      next: (resp) => {
        row.affectation = resp.data;
        row.saving      = false;
        row.success     = true;
        setTimeout(() => (row.success = false), 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        row.saving = false;
        row.error  = err?.error?.message ?? 'Erreur lors du changement de statut capitaine.';
      },
    });
  }

  // ── Supprimer ───────────────────────────────────────────────────────────────

  deleteAffectation(row: OuvrierRow): void {
    if (!confirm(`Supprimer l'affectation de ${row.nomPrenom} ?`)) return;
    row.deleting = true;
    this.svc.deleteAffectation(row.matricule).subscribe({
      next: () => {
        row.affectation = null;
        row.deleting    = false;
        row.editing     = false;
      },
      error: (err) => {
        row.deleting = false;
        row.error    = err?.error?.message ?? 'Erreur suppression.';
      },
    });
  }

  // ── Export Excel ────────────────────────────────────────────────────────────

  exporting = false;

  async exportExcel(): Promise<void> {
    const affectations = this.rows
      .filter((r) => r.affectation !== null)
      .map((r) => r.affectation!);

    if (affectations.length === 0) return;

    this.exporting = true;
    try {
      await this.exportSvc.exportAffectations(affectations);
    } finally {
      this.exporting = false;
    }
  }

  // ── Vue groupée ─────────────────────────────────────────────────────────────

get groupedRows(): LigneGroup[] {
  const groupes = new Map<string, LigneGroup>();
  
  const dataSource = this.rows;
  
  dataSource.forEach((row) => {
    if (!row.affectation) return;
    
    // 🔧 Ignorer les affectations avec poste invalide
    const poste = row.affectation.poste;
    if (poste !== '1ere poste' && poste !== '2eme poste') {
      console.warn(`Affectation ignorée pour ${row.matricule}: poste invalide = ${poste}`);
      return;
    }
    
    const ligne = row.affectation.ligne;
    
    if (!groupes.has(ligne)) {
      groupes.set(ligne, {
        ligne,
        posteGroups: {
          '1ere poste': {
            poste: '1ere poste',
            ouvriers: [],
            totalHeures: 0,
            totalOuvriers: 0
          },
          '2eme poste': {
            poste: '2eme poste',
            ouvriers: [],
            totalHeures: 0,
            totalOuvriers: 0
          }
        },
        totalOuvriers: 0,
        totalHeures: 0
      });
    }
    
    const group = groupes.get(ligne)!;
    const posteGroup = group.posteGroups[poste];
    
    posteGroup.ouvriers.push(row);
    posteGroup.totalOuvriers++;
    posteGroup.totalHeures += (row.affectation.totalHeures || 0);
    group.totalOuvriers++;
    group.totalHeures += (row.affectation.totalHeures || 0);
    
    if (row.affectation.estCapitaine) {
      group.capitaine = row;
    }
  });

  return Array.from(groupes.values()).sort((a, b) => a.ligne.localeCompare(b.ligne));
}
  // ── Filtres ─────────────────────────────────────────────────────────────────

  get filteredRows(): OuvrierRow[] {
    let filtered = this.rows.filter((r) => {
      const s = this.searchTerm.toLowerCase();
      const matchSearch =
        !s ||
        r.nomPrenom.toLowerCase().includes(s) ||
        r.matricule.toString().includes(s);
      const matchStatus =
        this.filterStatus === 'all' ||
        (this.filterStatus === 'assigned'   && r.affectation !== null) ||
        (this.filterStatus === 'unassigned' && r.affectation === null);
      return matchSearch && matchStatus;
    });

    if (this.selectedLigne) {
      filtered = filtered.filter((r) => r.affectation?.ligne === this.selectedLigne);
    }

    return filtered;
  }

  get assignedCount():   number { return this.rows.filter((r) => r.affectation !== null).length; }
  get unassignedCount(): number { return this.rows.filter((r) => r.affectation === null).length; }

  getLigneCount(ligne: string): number {
    return this.rows.filter((r) => r.affectation?.ligne === ligne).length;
  }

  getLigneCapitaine(ligne: string): OuvrierRow | undefined {
    return this.rows.find((r) => r.affectation?.ligne === ligne && r.affectation?.estCapitaine);
  }

  isCapitaine(row: OuvrierRow): boolean {
    return row.affectation?.estCapitaine === true;
  }

  getCapitaineStyle(row: OuvrierRow): any {
    if (this.isCapitaine(row)) {
      return { 'background-color': '#fff3e0', 'border-left': '4px solid #ff9800' };
    }
    return {};
  }
}