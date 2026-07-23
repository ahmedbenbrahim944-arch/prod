// src/app/plaquettes/plaquettes.component.ts
import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  PlaquettesService, Semaine, MatriculeMachine,
  TypePlaquette, Plaquette, LigneAvecReferences, TypeResume,
} from './plaquettes.service';

@Component({
  selector: 'app-plaquettes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './plaquettes.component.html',
  styleUrls: ['./plaquettes.component.css'],
})
export class PlaquettesComponent implements OnInit {

  // ── Lignes autorisées et mapping types ────────────────────────
  readonly LIGNES_AUTORISEES = ['L04', 'L29', 'L32', 'L39', 'L42'];

  readonly LIGNE_TYPES: Record<string, string[]> = {
    'L04': ['RA9898001'],
    'L29': ['RA6044002'],
    'L32': ['RA5535001'],
    'L39': ['1SDR001085A1001', '1SDR001078A1001', '1SDR003218A1001', '1SDR002113A1001'],
    'L42': ['RA5266001'],
  };

  sidebarOpen = false;
  isMobile = window.innerWidth < 768;

  semaines: Semaine[] = [];
  matricules: MatriculeMachine[] = [];
  typesPlaquettes: TypePlaquette[] = [];        // tous les types (depuis l'API)
  typesPlaquettesFiltres: TypePlaquette[] = []; // types filtrés selon la ligne choisie
  lignes: LigneAvecReferences[] = [];           // chargées depuis l'API puis filtrées
  references: string[] = [];
  plaquettes: Plaquette[] = [];
  resumeParType: TypeResume[] = [];

  selectedSemaine: Semaine | null = null;

  form: FormGroup;
  formLoading = false;
  formError = '';
  formSuccess = '';
  tableLoading = false;

  // Édition inline quantiteDonnee dans le tableau détail
  editingQteCell: { id: number } | null = null;
  editingQteValue: number = 0;
  editQteLoading = false;

  // Édition dans le résumé par type
  editingResumeCell: { typeId: number; field: 'reste' | 'produitFini' | 'rebut' } | null = null;
  editingResumeValue: number = 0;
  editResumeLoading = false;

  deletingId: number | null = null;

  constructor(private fb: FormBuilder, private plaquettesService: PlaquettesService) {
    this.form = this.fb.group({
      ligne:              ['', Validators.required],
      reference:          ['', Validators.required],
      matriculeMachineId: ['', Validators.required],
      typePlaquetteId:    ['', Validators.required],
      quantiteDonnee:     ['', [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    this.loadSemaines();
    this.loadMatricules();
    this.loadTypesPlaquettes();
    this.loadLignes();
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (!this.isMobile) this.sidebarOpen = false;
  }

  // ── Chargements ───────────────────────────────────────────────
  loadSemaines(): void {
    this.plaquettesService.getSemaines().subscribe({
      next: (data) => {
        this.semaines = data;
        if (data.length > 0) this.selectSemaine(data[0]);
      }
    });
  }

  loadMatricules(): void {
    this.plaquettesService.getMatricules().subscribe({
      next: (res) => (this.matricules = res)
    });
  }

  loadTypesPlaquettes(): void {
    this.plaquettesService.getTypesPlaquettes().subscribe({
      next: (res) => (this.typesPlaquettes = res)
    });
  }

  // Charger les lignes depuis l'API et filtrer celles autorisées
  loadLignes(): void {
    this.plaquettesService.getLignes().subscribe({
      next: (res) => {
        this.lignes = res.filter(l =>
          this.LIGNES_AUTORISEES.some(prefix => l.ligne.startsWith(prefix))
        );
      }
    });
  }

  loadPlaquettes(): void {
    if (!this.selectedSemaine) return;
    this.tableLoading = true;
    this.plaquettesService.getPlaquettes(this.selectedSemaine.id).subscribe({
      next: (res) => {
        this.plaquettes = res;
        this.calculerResumeParType();
        this.tableLoading = false;
      },
      error: () => (this.tableLoading = false),
    });
  }

  // ── Résumé par type (calculé côté frontend) ──────────────────
  calculerResumeParType(): void {
    const map = new Map<number, TypeResume>();
    for (const p of this.plaquettes) {
      const id  = p.typePlaquette.id;
      const nom = p.typePlaquette.nom;
      if (!map.has(id)) {
        map.set(id, {
          typeId: id, typeNom: nom,
          quantiteTotale: 0, resteTotale: 0,
          produitFiniTotal: 0, rebutTotal: 0, consommationTotale: 0
        });
      }
      const g = map.get(id)!;
      g.quantiteTotale     += Number(p.quantiteDonnee);
      g.resteTotale        += Number(p.reste);
      g.produitFiniTotal   += Number(p.produitFini);
      g.rebutTotal         += Number(p.rebut ?? 0);
      g.consommationTotale += Number(p.consommation);
    }
    this.resumeParType = Array.from(map.values()).sort((a, b) => a.typeNom.localeCompare(b.typeNom));
  }

  // ── Ligne change → références depuis l'API + filtrer les types
  onLigneChange(): void {
    const ligne = this.form.value.ligne;
    this.form.patchValue({ reference: '', typePlaquetteId: '' });
    this.references = [];
    this.typesPlaquettesFiltres = [];

    if (!ligne) return;

    // Références depuis l'API
    const found = this.lignes.find(l => l.ligne === ligne);
    this.references = found ? found.references : [];

    // Trouver le préfixe correspondant (ex: "L39:A.C POLO XT5" → "L39")
    const prefix = this.LIGNES_AUTORISEES.find(p => ligne.startsWith(p));
    if (prefix && this.LIGNE_TYPES[prefix]) {
      this.typesPlaquettesFiltres = this.typesPlaquettes.filter(t =>
        this.LIGNE_TYPES[prefix].includes(t.nom)
      );
      // Auto-sélection si un seul type disponible
      if (this.typesPlaquettesFiltres.length === 1) {
        this.form.patchValue({ typePlaquetteId: this.typesPlaquettesFiltres[0].id });
      }
    }
  }

  // ── Édition inline quantiteDonnee (tableau détail) ────────────
  startEditQte(plaquette: Plaquette): void {
    this.editingQteCell  = { id: plaquette.id };
    this.editingQteValue = Number(plaquette.quantiteDonnee);
  }

  isEditingQte(id: number): boolean {
    return this.editingQteCell?.id === id;
  }

  cancelEditQte(): void {
    this.editingQteCell = null;
  }

  saveEditQte(plaquette: Plaquette): void {
    if (!this.editingQteCell) return;
    if (this.editingQteValue <= 0) return;

    this.editQteLoading = true;
    this.plaquettesService.updatePlaquette(plaquette.id, { quantiteDonnee: this.editingQteValue }).subscribe({
      next: (res) => {
        const idx = this.plaquettes.findIndex(p => p.id === plaquette.id);
        if (idx !== -1) {
          this.plaquettes[idx] = res.plaquette;
        }
        this.calculerResumeParType();
        this.editingQteCell = null;
        this.editQteLoading = false;
      },
      error: () => { this.editQteLoading = false; },
    });
  }

  // ── Édition résumé par type ───────────────────────────────────
  startEditResume(resume: TypeResume, field: 'reste' | 'produitFini' | 'rebut'): void {
    this.editingResumeCell  = { typeId: resume.typeId, field };
    this.editingResumeValue =
      field === 'reste'      ? resume.resteTotale      :
      field === 'produitFini'? resume.produitFiniTotal  :
                               resume.rebutTotal;
  }

  isEditingResume(typeId: number, field: 'reste' | 'produitFini' | 'rebut'): boolean {
    return this.editingResumeCell?.typeId === typeId && this.editingResumeCell?.field === field;
  }

  cancelEditResume(): void { this.editingResumeCell = null; }

  saveEditResume(resume: TypeResume, field: 'reste' | 'produitFini' | 'rebut'): void {
    if (!this.editingResumeCell) return;
    this.editResumeLoading = true;

    const plaquettesType = this.plaquettes.filter(p => p.typePlaquette.id === resume.typeId);
    if (plaquettesType.length === 0) { this.editResumeLoading = false; return; }

    const totalQte = plaquettesType.reduce((s, p) => s + Number(p.quantiteDonnee), 0);
    const newTotal = +this.editingResumeValue;
    let remaining  = newTotal;
    const updates: Promise<any>[] = [];

    plaquettesType.forEach((p, idx) => {
      const isLast = idx === plaquettesType.length - 1;
      const share  = isLast
        ? remaining
        : Math.round((Number(p.quantiteDonnee) / totalQte) * newTotal);
      remaining -= share;
      const dto: any = {};
      dto[field] = share;
      updates.push(this.plaquettesService.updatePlaquette(p.id, dto).toPromise());
    });

    Promise.all(updates).then(() => {
      this.loadPlaquettes();
      this.editingResumeCell = null;
      this.editResumeLoading = false;
    }).catch(() => { this.editResumeLoading = false; });
  }

  // ── Sidebar ───────────────────────────────────────────────────
  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }

  selectSemaine(semaine: Semaine): void {
    this.selectedSemaine = semaine;
    this.sidebarOpen = false;
    this.loadPlaquettes();
  }

  // ── Formulaire ────────────────────────────────────────────────
  submitForm(): void {
    if (this.form.invalid || !this.selectedSemaine) return;
    this.formLoading = true;
    this.formError   = '';
    this.formSuccess = '';

    const dto = {
      semaineId:          this.selectedSemaine.id,
      ligne:              this.form.value.ligne,
      reference:          this.form.value.reference,
      matriculeMachineId: +this.form.value.matriculeMachineId,
      typePlaquetteId:    +this.form.value.typePlaquetteId,
      quantiteDonnee:     +this.form.value.quantiteDonnee,
    };

    this.plaquettesService.createPlaquette(dto).subscribe({
      next: (res) => {
        this.formSuccess = res.message;
        this.formLoading = false;
        this.form.reset();
        this.references = [];
        this.typesPlaquettesFiltres = [];
        this.loadPlaquettes();
        setTimeout(() => (this.formSuccess = ''), 3000);
      },
      error: (err) => {
        this.formError   = err?.error?.message || 'Erreur lors de la création';
        this.formLoading = false;
      },
    });
  }

  // ── Suppression ───────────────────────────────────────────────
  confirmDelete(id: number): void { this.deletingId = id; }
  cancelDelete():  void { this.deletingId = null; }

  deletePlaquette(): void {
    if (!this.deletingId) return;
    this.plaquettesService.deletePlaquette(this.deletingId).subscribe({
      next: () => {
        this.plaquettes = this.plaquettes.filter((p) => p.id !== this.deletingId);
        this.calculerResumeParType();
        this.deletingId = null;
      },
    });
  }

  // ── Totaux ────────────────────────────────────────────────────
  getTotalQte():   number { return this.resumeParType.reduce((s, r) => s + r.quantiteTotale,    0); }
  getTotalReste(): number { return this.resumeParType.reduce((s, r) => s + r.resteTotale,        0); }
  getTotalPF():    number { return this.resumeParType.reduce((s, r) => s + r.produitFiniTotal,   0); }
  getTotalRebut(): number { return this.resumeParType.reduce((s, r) => s + (r.rebutTotal ?? 0),  0); }
  getTotalConso(): number { return this.resumeParType.reduce((s, r) => s + r.consommationTotale, 0); }

  trackById(_: number, item: any): number { return item.id; }

  // Kept for compatibility
  isEditing(_id: number, _field: 'reste' | 'produitFini'): boolean { return false; }
  cancelEdit(): void {}
  saveEdit(_plaquette: Plaquette): void {}
}