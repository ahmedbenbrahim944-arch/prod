// src/app/planificationmod/planificationmod.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
import { AuthService } from '../login/auth.service';

// ─── Interfaces mise à jour avec POSTE ──────────────────────────────────────

interface DayEntry {
  of: string;
  nbOperateurs: number;
  c: number;   // qtePlanifiee
  m: number;   // qteModifiee
  dp: number;
  dm: number;
  delta: number;
  poste: string; // 'poste1' ou 'poste2'
}

// Interface pour les données d'un poste spécifique
interface PosteData {
  lundi?: DayEntry;
  mardi?: DayEntry;
  mercredi?: DayEntry;
  jeudi?: DayEntry;
  vendredi?: DayEntry;
  samedi?: DayEntry;
}

interface ReferenceRow {
  reference: string;
  ligne: string;
  note?: string;
  poste1: PosteData;  // POSTE 1 (6h-14h)
  poste2: PosteData;  // POSTE 2 (14h-22h)
}

interface LigneData {
  ligne: string;
  references: ReferenceRow[];
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-planificationmod',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planificationmod.component.html',
  styleUrls: ['./planificationmod.component.css']
})
export class PlanificationmodComponent implements OnInit {

  // ── État général ──
  selectedSemaine: string = '';
  selectedPoste: string = 'poste1';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // ── Semaines disponibles ──
  availableWeeks: WeekInfo[] = [];

  // ── Cartes lignes ──
  availableLines: ProductionLine[] = [];
  selectedLigneForView: ProductionLine | null = null;
  searchLineQuery: string = '';

  // ── Tableau ──
  lignesData: LigneData[] = [];
  weekDays: (keyof PosteData)[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ── Inline editing M ──
  editingKey: string | null = null;
  editMValue: number | null = null;
  savingKey: string | null = null;

  // ── Gestion OF manquant ──
  showOfPrompt: boolean = false;
  pendingEdit: { ref: ReferenceRow, day: string, poste: string } | null = null;
  tempOfValue: string = '';

  // ── Ligne active ──
  activeRowRef: string | null = null;

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadAvailableWeeks();
    this.loadProductionLines();
  }

  // ─── Chargement semaines ──────────────────────────────────────────────────

  private loadAvailableWeeks(): void {
    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        let semainesArray: any[] = [];
        if (response?.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        }

        const weeks: WeekInfo[] = semainesArray
          .map((s: any) => {
            const match = s.nom?.match(/semaine(\d+)/i);
            const num = match ? parseInt(match[1], 10) : 0;
            if (!num) return null;
            return {
              number: num,
              startDate: s.dateDebut ? new Date(s.dateDebut) : new Date(),
              endDate: s.dateFin ? new Date(s.dateFin) : new Date(),
              display: s.nom || `semaine${num}`,
              data: s
            } as WeekInfo;
          })
          .filter(Boolean) as WeekInfo[];

        weeks.sort((a, b) => b.number - a.number);
        this.availableWeeks = weeks;
        if (weeks.length > 0) {
          this.selectedSemaine = weeks[0].display;
        }
      },
      error: () => {
        this.availableWeeks = Array.from({ length: 52 }, (_, i) => ({
          number: i + 1,
          startDate: new Date(),
          endDate: new Date(),
          display: `semaine${i + 1}`,
          data: null
        }));
      }
    });
  }

  // ─── Chargement cartes lignes ─────────────────────────────────────────────

  private loadProductionLines(): void {
    this.productService.getAllLines().subscribe({
      next: (response) => {
        const lines: ProductionLine[] = (response?.lines || []).map((l: ProductLine) => ({
          ligne: l.ligne,
          referenceCount: l.referenceCount || l.references?.length || 0,
          imageUrl: l.imageUrl
            ? this.productService.getImageUrl(l.imageUrl)
            : this.getDefaultImageUrl(l.ligne),
          references: l.references || [],
          isActive: true
        }));
        this.availableLines = lines.sort(
          (a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne)
        );
      },
      error: () => {}
    });
  }

  private getDefaultImageUrl(ligne: string): string {
    const imageMap: { [key: string]: string } = {
      'L04:RXT1':   'assets/images/unnamed.jpg',
      'L07:COM A1': 'assets/images/unnamed (1).jpg',
      'L09:COMXT2': 'assets/images/unnamed (2).jpg',
      'L10:RS3':    'assets/images/unnamed (3).jpg',
      'L14:CD XT1': 'assets/images/unnamed (4).jpg',
      'L15:MTSA3':  'assets/images/unnamed (5).jpg'
    };
    return imageMap[ligne] || 'assets/images/default-line.jpg';
  }

  get filteredLines(): ProductionLine[] {
    if (!this.searchLineQuery.trim()) return this.availableLines;
    const q = this.searchLineQuery.toLowerCase();
    return this.availableLines.filter(l => l.ligne.toLowerCase().includes(q));
  }

  clearSearch(): void { this.searchLineQuery = ''; }

  // ─── Navigation ───────────────────────────────────────────────────────────

  goBack(): void { this.router.navigate(['/']); }

  backToLines(): void {
    this.selectedLigneForView = null;
    this.lignesData = [];
    this.editingKey = null;
    this.activeRowRef = null;
    this.selectedPoste = 'poste1';
    this.showOfPrompt = false;
    this.pendingEdit = null;
  }

  onLineSelected(line: ProductionLine): void {
    this.selectedLigneForView = line;
    this.lignesData = [];
    this.errorMessage = '';
    this.editingKey = null;
    this.selectedPoste = 'poste1';
    if (this.selectedSemaine) this.loadDataForLigne(line.ligne);
  }

  onSemaineChange(): void {
    if (this.selectedLigneForView && this.selectedSemaine) {
      this.loadDataForLigne(this.selectedLigneForView.ligne);
    }
  }

  // ─── Chargement planification ─────────────────────────────────────────────

  private loadDataForLigne(ligneName: string): void {
    this.isLoading = true;
    this.lignesData = [];
    this.editingKey = null;

    this.productService.getAllLines().subscribe({
      next: (productResponse) => {
        const lines: ProductLine[] = (productResponse?.lines || [])
          .filter((l: ProductLine) => l.ligne === ligneName);

        this.semaineService.getPlanificationsForWeek(this.selectedSemaine).subscribe({
          next: (planifResponse) => {
            const planifications: any[] = planifResponse?.planifications || [];
            this.buildLignesData(lines, planifications);
            this.isLoading = false;
          },
          error: () => {
            this.buildLignesData(lines, []);
            this.isLoading = false;
          }
        });
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement';
        this.isLoading = false;
      }
    });
  }

  private buildLignesData(lines: ProductLine[], planifications: any[]): void {
    const planifIndex = new Map<string, any>();
    planifications.forEach(p => {
      const posteValue = p.poste || 'poste1';
      const key = `${p.ligne}|${p.reference}|${p.jour?.toLowerCase()}|${posteValue}`;
      planifIndex.set(key, p);
    });

    const result: LigneData[] = lines
      .sort((a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne))
      .map(line => {
        const sortedRefs = this.sortReferencesByLast3(line.references || []);
        const refs: ReferenceRow[] = sortedRefs.map(reference => {
          const row: ReferenceRow = { 
            reference, 
            ligne: line.ligne,
            poste1: {},
            poste2: {}
          };
          
          this.weekDays.forEach(day => {
            // POSTE 1
            const key1 = `${line.ligne}|${reference}|${day}|poste1`;
            const plan1 = planifIndex.get(key1);
            row.poste1[day] = {
              of: plan1?.of || '',
              nbOperateurs: plan1?.nbOperateurs || 0,
              c: plan1?.qtePlanifiee || 0,
              m: plan1?.qteModifiee || 0,
              dp: plan1?.decProduction || 0,
              dm: plan1?.decMagasin || 0,
              delta: plan1?.pcsProd || 0,
              poste: 'poste1'
            };

            // POSTE 2
            const key2 = `${line.ligne}|${reference}|${day}|poste2`;
            const plan2 = planifIndex.get(key2);
            row.poste2[day] = {
              of: plan2?.of || '',
              nbOperateurs: plan2?.nbOperateurs || 0,
              c: plan2?.qtePlanifiee || 0,
              m: plan2?.qteModifiee || 0,
              dp: plan2?.decProduction || 0,
              dm: plan2?.decMagasin || 0,
              delta: plan2?.pcsProd || 0,
              poste: 'poste2'
            };
          });
          
          return row;
        });
        return { ligne: line.ligne, references: refs };
      });

    this.lignesData = result;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private sortReferencesByLast3(refs: string[]): string[] {
    return [...refs].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '').slice(-3)) || 0;
      const numB = parseInt(b.replace(/\D/g, '').slice(-3)) || 0;
      return numA - numB;
    });
  }

  private extractLineNumber(ligne: string): number {
    const match = ligne.match(/^L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  getDayEntry(ref: ReferenceRow, day: string, poste: string = 'poste1'): DayEntry | undefined {
    if (poste === 'poste1') {
      return ref.poste1[day as keyof PosteData];
    } else {
      return ref.poste2[day as keyof PosteData];
    }
  }

  getOfForRef(ref: ReferenceRow, poste: string = 'poste1'): string {
    for (const day of this.weekDays) {
      const e = this.getDayEntry(ref, day, poste);
      if (e?.of) return e.of;
    }
    return '';
  }

  getCValue(ref: ReferenceRow, day: string, poste: string): number {
    const entry = this.getDayEntry(ref, day, poste);
    return entry?.c || 0;
  }

  getMValue(ref: ReferenceRow, day: string, poste: string): number {
    const entry = this.getDayEntry(ref, day, poste);
    return entry?.m || 0;
  }

  // ── Totaux C (planifié) ────────────────────────────────────────────────────

  getTotalCForRef(ref: ReferenceRow, poste: string = 'poste1'): number {
    return this.weekDays.reduce((sum, day) => {
      const entry = this.getDayEntry(ref, day, poste);
      return sum + (entry?.c || 0);
    }, 0);
  }

  getTotalCForDay(ligneData: LigneData, day: string, poste: string = 'poste1'): number {
    return ligneData.references.reduce((sum, ref) => {
      const entry = this.getDayEntry(ref, day, poste);
      return sum + (entry?.c || 0);
    }, 0);
  }

  getTotalCForLigne(ligneData: LigneData, poste: string = 'poste1'): number {
    return this.weekDays.reduce((sum, day) => sum + this.getTotalCForDay(ligneData, day, poste), 0);
  }

  // ── Totaux M (modifié) ─────────────────────────────────────────────────────

  getTotalMForRef(ref: ReferenceRow, poste: string = 'poste1'): number {
    return this.weekDays.reduce((sum, day) => {
      const entry = this.getDayEntry(ref, day, poste);
      return sum + (entry?.m || 0);
    }, 0);
  }

  getTotalMForDay(ligneData: LigneData, day: string, poste: string = 'poste1'): number {
    return ligneData.references.reduce((sum, ref) => {
      const entry = this.getDayEntry(ref, day, poste);
      return sum + (entry?.m || 0);
    }, 0);
  }

  getTotalMForLigne(ligneData: LigneData, poste: string = 'poste1'): number {
    return this.weekDays.reduce((sum, day) => sum + this.getTotalMForDay(ligneData, day, poste), 0);
  }

  // ─── Utilitaires affichage ────────────────────────────────────────────────

  getFrenchDay(day: string): string {
    const map: { [k: string]: string } = {
      lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
      jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam'
    };
    return map[day] || day;
  }

  getWeeksList(): string[] {
    if (this.availableWeeks.length > 0) return this.availableWeeks.map(w => w.display);
    return Array.from({ length: 52 }, (_, i) => `semaine${i + 1}`);
  }

  // ─── Inline editing M AVEC VÉRIFICATION OF ─────────────────────────────────

  cellKey(ref: ReferenceRow, day: string, poste: string): string {
    return `${ref.reference}|${ref.ligne}|${day}|${poste}`;
  }

  isEditing(ref: ReferenceRow, day: string, poste: string): boolean {
    return this.editingKey === this.cellKey(ref, day, poste);
  }

  // ✅ Méthode startEdit modifiée : vérifie si OF existe
  startEdit(ref: ReferenceRow, day: string, poste: string): void {
    const ofValue = this.getOfForRef(ref, poste);
    
    // Vérifier si OF existe et n'est pas vide
    if (!ofValue || ofValue.trim() === '') {
      // OF manquant → demander de le saisir d'abord
      this.pendingEdit = { ref, day, poste };
      this.tempOfValue = '';
      this.showOfPrompt = true;
    } else {
      // OF existe → éditer M directement
      this.doStartEdit(ref, day, poste);
    }
  }

  // Édition directe de M
  private doStartEdit(ref: ReferenceRow, day: string, poste: string): void {
    const entry = this.getDayEntry(ref, day, poste);
    this.editingKey = this.cellKey(ref, day, poste);
    this.editMValue = (entry?.m && entry.m > 0) ? entry.m : null;
    this.activeRowRef = ref.reference;
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editMValue = null;
  }

  // Sauvegarder OF puis ouvrir l'édition de M
  saveOfAndContinue(): void {
    if (!this.pendingEdit) return;
    
    const { ref, day, poste } = this.pendingEdit;
    const newOf = this.tempOfValue;
    
    if (!newOf || newOf.trim() === '') {
      this.errorMessage = 'Veuillez saisir un OF valide';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }
    
    // Mise à jour locale immédiate
    for (const d of this.weekDays) {
      const entry = this.getDayEntry(ref, d, poste);
      if (entry) {
        entry.of = newOf;
      }
    }
    
    const payload = {
      semaine: this.selectedSemaine,
      ligne: ref.ligne,
      reference: ref.reference,
      poste: poste,
      of: newOf
    };
    
    this.savingKey = `${ref.reference}|${ref.ligne}|${poste}`;
    
    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingKey = null;
        this.showOfPrompt = false;
        this.pendingEdit = null;
        this.tempOfValue = '';
        // Après sauvegarde OF, ouvrir l'édition de M
        this.doStartEdit(ref, day, poste);
        this.showSuccess('OF sauvegardé ✓');
      },
      error: (err) => {
        console.error('Erreur sauvegarde OF:', err);
        this.errorMessage = 'Erreur lors de la saisie du OF';
        this.savingKey = null;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  cancelOfPrompt(): void {
    this.showOfPrompt = false;
    this.pendingEdit = null;
    this.tempOfValue = '';
  }

  // Sauvegarde de M
  saveCell(ref: ReferenceRow, day: string, poste: string): void {
    const key = this.cellKey(ref, day, poste);
    if (this.editingKey !== key) return;
    
    const entry = this.getDayEntry(ref, day, poste);
    if (!entry) { 
      this.editingKey = null; 
      return; 
    }

    const newM = this.editMValue ?? 0;
    this.savingKey = key;
    this.editingKey = null;
    
    // Mise à jour locale immédiate
    entry.m = newM;

    const payload = {
      semaine: this.selectedSemaine,
      jour: day,
      ligne: ref.ligne,
      reference: ref.reference,
      poste: poste,
      qteModifiee: newM,
      of: entry.of,
      nbOperateurs: entry.nbOperateurs,
      qtePlanifiee: entry.c,
      decProduction: entry.dp,
      decMagasin: entry.dm,
      note: ref.note ?? null
    };

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingKey = null;
        this.showSuccess('M sauvegardé ✓');
      },
      error: (err) => {
        console.error('Erreur sauvegarde M:', err);
        this.errorMessage = 'Erreur lors de la sauvegarde';
        this.savingKey = null;
        // Rollback local
        entry.m = 0;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  // ─── Feedback ────────────────────────────────────────────────────────────

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 2500);
  }
}

interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
}