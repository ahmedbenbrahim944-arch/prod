// src/app/planificationmod/planificationmod.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
import { AuthService } from '../login/auth.service';

// ─── Interfaces (identiques à planification1) ────────────────────────────────

interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
}

interface DayEntry {
  of: string;
  nbOperateurs: number;
  c: number;   // qtePlanifiee  — lecture seule ici
  m: number;   // qteModifiee   — saisie par l'utilisateur
  dp: number;
  dm: number;
  delta: number;
}

interface ReferenceRow {
  reference: string;
  ligne: string;
  note?: string;
  lundi?: DayEntry;
  mardi?: DayEntry;
  mercredi?: DayEntry;
  jeudi?: DayEntry;
  vendredi?: DayEntry;
  samedi?: DayEntry;
  [key: string]: string | DayEntry | undefined;
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
  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ── Inline editing M ──
  editingKey: string | null = null;
  editMValue: number | null = null;
  savingKey: string | null = null;

  // ── Ligne active ──
  activeRowRef: string | null = null;

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Guard : tout utilisateur authentifié
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
  }

  onLineSelected(line: ProductionLine): void {
    this.selectedLigneForView = line;
    this.lignesData = [];
    this.errorMessage = '';
    this.editingKey = null;
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
      const key = `${p.ligne}|${p.reference}|${p.jour?.toLowerCase()}`;
      planifIndex.set(key, p);
    });

    const result: LigneData[] = lines
      .sort((a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne))
      .map(line => {
        const sortedRefs = this.sortReferencesByLast3(line.references || []);
        const refs: ReferenceRow[] = sortedRefs.map(reference => {
          const row: ReferenceRow = { reference, ligne: line.ligne };
          this.weekDays.forEach(day => {
            const key = `${line.ligne}|${reference}|${day}`;
            const plan = planifIndex.get(key);
            row[day] = {
              of: plan?.of || '',
              nbOperateurs: plan?.nbOperateurs || 0,
              c: plan?.qtePlanifiee || 0,
              m: plan?.qteModifiee || 0,
              dp: plan?.decProduction || 0,
              dm: plan?.decMagasin || 0,
              delta: plan?.pcsProd || 0
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

  getDayEntry(ref: ReferenceRow, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

  getOfForRef(ref: ReferenceRow): string {
    for (const day of this.weekDays) {
      const e = ref[day] as DayEntry;
      if (e?.of) return e.of;
    }
    return '';
  }

  // ── Totaux C (planifié) ────────────────────────────────────────────────────

  getTotalCForRef(ref: ReferenceRow): number {
    return this.weekDays.reduce((sum, day) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.c || 0);
    }, 0);
  }

  getTotalCForDay(ligneData: LigneData, day: string): number {
    return ligneData.references.reduce((sum, ref) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.c || 0);
    }, 0);
  }

  getTotalCForLigne(ligneData: LigneData): number {
    return this.weekDays.reduce((sum, day) => sum + this.getTotalCForDay(ligneData, day), 0);
  }

  // ── Totaux M (modifié) ─────────────────────────────────────────────────────

  getTotalMForRef(ref: ReferenceRow): number {
    return this.weekDays.reduce((sum, day) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.m || 0);
    }, 0);
  }

  getTotalMForDay(ligneData: LigneData, day: string): number {
    return ligneData.references.reduce((sum, ref) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.m || 0);
    }, 0);
  }

  getTotalMForLigne(ligneData: LigneData): number {
    return this.weekDays.reduce((sum, day) => sum + this.getTotalMForDay(ligneData, day), 0);
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

  // ─── Inline editing M ────────────────────────────────────────────────────

  cellKey(ref: ReferenceRow, day: string): string {
    return `${ref.reference}|${ref.ligne}|${day}`;
  }

  isEditing(ref: ReferenceRow, day: string): boolean {
    return this.editingKey === this.cellKey(ref, day);
  }

  startEdit(ref: ReferenceRow, day: string): void {
    const entry = this.getDayEntry(ref, day);
    this.editingKey = this.cellKey(ref, day);
    this.editMValue = (entry?.m && entry.m > 0) ? entry.m : null;
    this.activeRowRef = ref.reference;
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editMValue = null;
  }

  saveCell(ref: ReferenceRow, day: string): void {
    const key = this.cellKey(ref, day);
    if (this.editingKey !== key) return;
    const entry = this.getDayEntry(ref, day);
    if (!entry) { this.editingKey = null; return; }

    const newM = this.editMValue ?? 0;
    this.savingKey = key;
    this.editingKey = null;
    // Mise à jour locale immédiate
    entry.m = newM;

    const payload = this.semaineService.formatWeekForAPI({
      semaine: this.selectedSemaine,
      jour: day,
      ligne: ref.ligne,
      reference: ref.reference,
      nbOperateurs: entry.nbOperateurs,
      of: entry.of,
      qtePlanifiee: entry.c,     // On préserve C
      qteModifiee: newM,          // On sauvegarde M
      decProduction: entry.dp,
      decMagasin: entry.dm,
      note: ref.note ?? null
    });

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingKey = null;
        this.showSuccess('M sauvegardé ✓');
      },
      error: (err) => {
        console.error('Erreur sauvegarde M:', err);
        this.errorMessage = 'Erreur lors de la sauvegarde de M';
        this.savingKey = null;
        // Rollback local
        entry.m = 0;
      }
    });
  }

  // ─── Feedback ────────────────────────────────────────────────────────────

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 2500);
  }
}