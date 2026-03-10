// src/app/planification1/planification1.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  c: number;
  m: number;
  dp: number;
  dm: number;
  delta: number;
}

interface ReferenceRow {
  reference: string;
  ligne: string;
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
  selector: 'app-planification1',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planification1.component.html',
  styleUrls: ['./planification1.component.css']
})
export class Planification1Component implements OnInit {

  // ── État général ──
  selectedSemaine: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // ── Données semaines ──
  availableWeeks: WeekInfo[] = [];

  // ── Cartes lignes ──
  availableLines: ProductionLine[] = [];
  selectedLigneForView: ProductionLine | null = null;
  searchLineQuery: string = '';

  // ── Tableau ──
  lignesData: LigneData[] = [];
  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ── Inline editing C ──
  editingKey: string | null = null;
  editCValue: number | null = null;
  savingKey: string | null = null;

  // ── Inline editing OF ──
  editingOfKey: string | null = null;
  editOfValue: string = '';
  savingOfKey: string | null = null;

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
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
        // ✅ Présélection automatique de la dernière semaine (la plus récente)
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

  clearSearch(): void {
    this.searchLineQuery = '';
  }

  // ─── Clic sur une carte ligne ─────────────────────────────────────────────

  onLineSelected(line: ProductionLine): void {
    this.selectedLigneForView = line;
    this.lignesData = [];
    this.errorMessage = '';
    this.editingKey = null;
    this.editingOfKey = null;
    // ✅ Charger directement avec la semaine déjà sélectionnée
    if (this.selectedSemaine) {
      this.loadDataForLigne(line.ligne);
    }
  }

  backToLines(): void {
    this.selectedLigneForView = null;
    this.lignesData = [];
    // ✅ On garde la semaine sélectionnée pour la prochaine carte
    this.errorMessage = '';
    this.editingKey = null;
    this.editingOfKey = null;
  }

  // ─── Changement de semaine (depuis la vue tableau) ────────────────────────

  onSemaineChange(): void {
    this.errorMessage = '';
    this.lignesData = [];
    this.editingKey = null;
    // Charger les données dès que la semaine est choisie
    if (this.selectedLigneForView && this.selectedSemaine) {
      this.loadDataForLigne(this.selectedLigneForView.ligne);
    }
  }

  // ─── Chargement planification pour la ligne sélectionnée ─────────────────

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

  // ─── Construction données tableau ─────────────────────────────────────────

  private buildLignesData(lines: ProductLine[], planifications: any[]): void {
    const planifIndex = new Map<string, any>();
    planifications.forEach(p => {
      const key = `${p.ligne}|${p.reference}|${p.jour?.toLowerCase()}`;
      planifIndex.set(key, p);
    });

    const ofByRef = new Map<string, string>();
    planifications.forEach(p => {
      if (p.of && !ofByRef.has(`${p.ligne}|${p.reference}`)) {
        ofByRef.set(`${p.ligne}|${p.reference}`, p.of);
      }
    });

    const result: LigneData[] = lines
      .sort((a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne))
      .map(line => {
        // ✅ Tri par les 3 derniers chiffres (croissant)
        const sortedRefs = this.sortReferencesByLast3(line.references || []);

        const refs: ReferenceRow[] = sortedRefs.map(reference => {
          const row: ReferenceRow = { reference, ligne: line.ligne };

          this.weekDays.forEach(day => {
            const key = `${line.ligne}|${reference}|${day}`;
            const plan = planifIndex.get(key);
            const of = ofByRef.get(`${line.ligne}|${reference}`) || '';

            row[day] = {
              of: plan?.of || of,
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

  // ─── Tri références par 3 derniers chiffres ───────────────────────────────

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  getFrenchDay(day: string): string {
    const map: { [k: string]: string } = {
      lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
      jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam'
    };
    return map[day] || day;
  }

  getWeeksList(): string[] {
    if (this.availableWeeks.length > 0) {
      return this.availableWeeks.map(w => w.display);
    }
    return Array.from({ length: 52 }, (_, i) => `semaine${i + 1}`);
  }

  // ─── Inline editing C ────────────────────────────────────────────────────

  cellKey(ref: ReferenceRow, day: string): string {
    return `${ref.reference}|${ref.ligne}|${day}`;
  }

  isEditing(ref: ReferenceRow, day: string): boolean {
    return this.editingKey === this.cellKey(ref, day);
  }

  startEdit(ref: ReferenceRow, day: string): void {
    this.editingOfKey = null;
    const entry = this.getDayEntry(ref, day);
    this.editingKey = this.cellKey(ref, day);
    this.editCValue = (entry?.c && entry.c > 0) ? entry.c : null;
  }

  saveCell(ref: ReferenceRow, day: string): void {
    const key = this.cellKey(ref, day);
    if (this.editingKey !== key) return;

    const entry = this.getDayEntry(ref, day);
    if (!entry) { this.editingKey = null; return; }

    const newC = this.editCValue ?? 0;
    this.savingKey = key;
    this.editingKey = null;
    entry.c = newC;

    const payload = this.semaineService.formatWeekForAPI({
      semaine: this.selectedSemaine,
      jour: day,
      ligne: ref.ligne,
      reference: ref.reference,
      nbOperateurs: entry.nbOperateurs,
      of: entry.of,
      qtePlanifiee: newC,
      qteModifiee: entry.m,
      decProduction: entry.dp,
      decMagasin: entry.dm
    });

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => { this.savingKey = null; this.showSuccess('Sauvegardé ✓'); },
      error: () => { this.errorMessage = 'Erreur lors de la sauvegarde'; this.savingKey = null; }
    });
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editingOfKey = null;
  }

  // ─── Inline editing OF ───────────────────────────────────────────────────

  ofRefKey(ref: ReferenceRow): string {
    return `${ref.reference}|${ref.ligne}`;
  }

  isEditingOf(ref: ReferenceRow): boolean {
    return this.editingOfKey === this.ofRefKey(ref);
  }

  startEditOf(ref: ReferenceRow): void {
    if (this.editingKey) this.editingKey = null;
    this.editingOfKey = this.ofRefKey(ref);
    this.editOfValue = this.getOfForRef(ref);
  }

  saveOf(ref: ReferenceRow): void {
    if (this.editingOfKey !== this.ofRefKey(ref)) return;

    const newOf = (this.editOfValue || '').trim();
    this.savingOfKey = this.ofRefKey(ref);
    this.editingOfKey = null;

    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry | undefined;
      if (entry) entry.of = newOf;
    });

    const dayToSave = this.weekDays.find(d => {
      const e = ref[d] as DayEntry | undefined;
      return e && e.c > 0;
    }) || 'lundi';

    const entry = ref[dayToSave] as DayEntry;

    const payload = this.semaineService.formatWeekForAPI({
      semaine: this.selectedSemaine,
      jour: dayToSave,
      ligne: ref.ligne,
      reference: ref.reference,
      nbOperateurs: entry?.nbOperateurs || 0,
      of: newOf,
      qtePlanifiee: entry?.c || 0,
      qteModifiee: entry?.m || 0,
      decProduction: entry?.dp || 0,
      decMagasin: entry?.dm || 0
    });

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => { this.savingOfKey = null; this.showSuccess('OF sauvegardé ✓'); },
      error: () => {
        this.errorMessage = 'Erreur lors de la sauvegarde de l\'OF';
        this.savingOfKey = null;
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 2500);
  }

  goBack(): void {
    this.router.navigate(['/prod']);
  }
}