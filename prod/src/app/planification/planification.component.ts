import { Component, signal, computed, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
import { NonConfService } from '../prod2/non-conf.service';
import { AffectationService } from '../affectation/affectation.service';
import { forkJoin } from 'rxjs';



// Interfaces
interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
}

interface Causes5M {
  m1MatierePremiere: number;
  m1References: { reference: string; quantite: number }[];
  m2Absence: number;
  m2MatriculesAbsence: string[];
  m2Rendement: number;
  m2MatriculesRendement: string[];
  m3Methode: number;
  m4Maintenance: number;
  m4PhasesMaintenance: string[];
  m5Qualite: number;
  qualiteReferences: { reference: string; quantite: number }[];
  m5CommentaireQualite: string;
  m6Environnement: number;
}

interface DayEntry {
  of: string;
  nbOperateurs: number;
  c: number;        // qtePlanifiee
  m: number;        // qteModifiee
  dp: number;       // decProduction
  dm: number;       // decMagasin
  delta: number;    // pcsProd
  causes?: Causes5M;
}

interface ReferenceProduction {
  reference: string;
  ligne?: string;
  note?: string;  // NOUVEAU : note par référence
  [key: string]: string | DayEntry | undefined;
  lundi?: DayEntry;
  mardi?: DayEntry;
  mercredi?: DayEntry;
  jeudi?: DayEntry;
  vendredi?: DayEntry;
  samedi?: DayEntry;
}

interface WeekPlanification {
  weekNumber: number;
  ligne: string;
  startDate: Date;
  endDate: Date;
  references: ReferenceProduction[];
}

interface ReferenceDetail {
  reference: string;
  [key: string]: string | DayDetail | undefined;
  lundi?: DayDetail;
  mardi?: DayDetail;
  mercredi?: DayDetail;
  jeudi?: DayDetail;
  vendredi?: DayDetail;
  samedi?: DayDetail;
}

interface DayDetail {
  qPro: number;
  nbBac: number;
  tPiece: number;
  tProdH: number;
  tProdMin: number;
}

@Component({
  selector: 'app-planification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planification.component.html',
  styleUrls: ['./planification.component.css']
})
export class PlanificationComponent implements AfterViewInit, OnInit {
  @ViewChild('scrollWrapper') scrollWrapper!: ElementRef;
  @ViewChild('tableContainer') tableContainer!: ElementRef;

  // Signals
  sidebarVisible = signal(true);
  loading = signal(false);
  selectedLigne = signal<ProductionLine | null>(null);
  selectedWeek = signal<number | null>(null);
  selectedPoste = signal<string>('poste1'); // ✅ NOUVEAU : poste1 (6h-14h) | poste2 (14h-22h)
  availableLines = signal<ProductionLine[]>([]);
  weekPlanification = signal<WeekPlanification | null>(null);
  showSuccess = signal(false);
  successMessage = signal('');
  particles = signal<any[]>([]);
  isEditing = signal(false);
  searchLineQuery = signal('');
  searchReferenceQuery = signal('');
  selectedReferenceDetails = signal<ReferenceDetail | null>(null);
  availableWeeksSignal = signal<WeekInfo[]>([]);

  showCausesModal = signal(false);
  selectedEntryForCauses = signal<{
    reference: ReferenceProduction;
    day: string;
    entry: DayEntry;
  } | null>(null);

  currentCauses = signal<Causes5M>({
    m1MatierePremiere: 0,
    m1References: [],
    m2Absence: 0,
    m2MatriculesAbsence: [],
    m2Rendement: 0,
    m2MatriculesRendement: [],
    m3Methode: 0,
    m4Maintenance: 0,
    m4PhasesMaintenance: [],
    m5Qualite: 0,
    qualiteReferences: [],
    m5CommentaireQualite: '',
    m6Environnement: 0,
  });

  isScrollable = signal(false);
  isScrolled = signal(false);
  isScrolledEnd = signal(false);
  showScrollIndicator = signal(true);

  private isTouchScrolling = false;
  private touchStartX = 0;
  private scrollLeftStart = 0;

  lignePresents = signal<number>(0);
ligneAbsents = signal<number>(0);
ligneTotal = signal<number>(0);
loadingPresence = signal<boolean>(false);

  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    private nonConfService: NonConfService,
    private affectationService: AffectationService
  ) {
    this.generateParticles();
  }

  ngOnInit() {
    this.loadProductionLines();
    this.semaineService.getSemainesForPlanning().subscribe({
      next: (data) => {},
      error: (err) => {}
    });
  }

  toggleSidebar(): void {
    this.sidebarVisible.set(!this.sidebarVisible());
  }

  private generateParticles() {
    const particles = Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 6 + 2}px`,
      animationDelay: `${Math.random() * 10}s`,
      opacity: `${Math.random() * 0.3 + 0.1}`
    }));
    this.particles.set(particles);
  }

  private loadProductionLines(): void {
    this.loading.set(true);
    this.productService.getAllLines().subscribe({
      next: (response) => {
        if (response && response.lines && Array.isArray(response.lines)) {
          const lines: ProductionLine[] = response.lines.map((productLine: ProductLine) => ({
            ligne: productLine.ligne,
            referenceCount: productLine.referenceCount || productLine.references?.length || 0,
            imageUrl: this.getImageUrl(productLine),
            references: productLine.references || [],
            isActive: true
          }));
          this.availableLines.set(this.sortLinesByNumber(lines));
        } else {
          this.loadMockProductionLines();
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadMockProductionLines();
        this.loading.set(false);
      }
    });
  }

  private sortLinesByNumber(lines: ProductionLine[]): ProductionLine[] {
    return lines.sort((a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne));
  }

  private extractLineNumber(ligne: string): number {
    const match = ligne.match(/^L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private getImageUrl(productLine: ProductLine): string {
    if (productLine.imageUrl) return this.productService.getImageUrl(productLine.imageUrl);
    return this.getDefaultImageUrl(productLine.ligne);
  }

  private getDefaultImageUrl(ligne: string): string {
    const imageMap: { [key: string]: string } = {
      'L04:RXT1': 'assets/images/unnamed.jpg',
      'L07:COM A1': 'assets/images/unnamed (1).jpg',
      'L09:COMXT2': 'assets/images/unnamed (2).jpg',
      'L10:RS3': 'assets/images/unnamed (3).jpg',
      'L14:CD XT1': 'assets/images/unnamed (4).jpg',
      'L15:MTSA3': 'assets/images/unnamed (5).jpg'
    };
    return imageMap[ligne] || 'assets/images/default-line.jpg';
  }

  private loadMockProductionLines(): void {
    const lines: ProductionLine[] = [
      { ligne: 'L04:RXT1', referenceCount: 13, imageUrl: 'assets/images/unnamed.jpg', references: ['RA5246801', 'RA5246802', 'RA5246803'], isActive: true },
      { ligne: 'L07:COM A1', referenceCount: 4, imageUrl: 'assets/images/unnamed (1).jpg', references: ['COM001', 'COM002'], isActive: true },
    ];
    this.availableLines.set(lines);
  }

  filteredLines = computed(() => {
    const query = this.searchLineQuery().toLowerCase();
    if (!query) return this.availableLines();
    return this.availableLines().filter(line => line.ligne.toLowerCase().includes(query));
  });

  filteredWeekPlanification = computed(() => {
    const planif = this.weekPlanification();
    const query = this.searchReferenceQuery().toLowerCase();
    if (!planif || !query) return planif;
    return { ...planif, references: planif.references.filter(ref => ref.reference.toLowerCase().includes(query)) };
  });

  getAvailableWeeks(): WeekInfo[] {
    return this.availableWeeksSignal().length > 0 ? this.availableWeeksSignal() : [];
  }

  private getWeekDates(year: number, weekNumber: number): WeekInfo {
    return this.semaineService.getWeekDates(year, weekNumber);
  }

  // ✅ NOUVEAU : sélection du poste — recharge les données si une semaine est déjà sélectionnée
  selectPoste(poste: string): void {
    this.selectedPoste.set(poste);
    const line = this.selectedLigne();
    const week = this.selectedWeek();
    if (line && week) {
      const selectedWeekData = this.getAvailableWeeks().find(w => w.number === week);
      const semaineNom = selectedWeekData?.display || `semaine${week}`;
      this.loadWeekPlanificationFromAPI(semaineNom, line);
    }
  }

  onLigneSelected(line: ProductionLine): void {
    this.selectedLigne.set(line);
    this.selectedWeek.set(null);
    this.weekPlanification.set(null);
    this.isEditing.set(false);
    this.selectedReferenceDetails.set(null);
    this.loadAvailableWeeks();
    this.loadPresenceForLigne(line.ligne);
  }

  onWeekSelected(weekNumber: number): void {
    const line = this.selectedLigne();
    if (line && weekNumber) {
      this.selectedWeek.set(weekNumber);
      const selectedWeekData = this.getAvailableWeeks().find(w => w.number === weekNumber);
      const semaineNom = selectedWeekData?.display || `semaine${weekNumber}`;
      this.loadWeekPlanificationFromAPI(semaineNom, line);
      this.isEditing.set(false);
      this.selectedReferenceDetails.set(null);
    }
  }

  private loadAvailableWeeks(): void {
    this.loading.set(true);
    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        let semainesArray: any[] = [];
        if (response && response.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        } else {
          this.availableWeeksSignal.set([]);
          this.loading.set(false);
          return;
        }

        const weeks: WeekInfo[] = [];
        semainesArray.forEach((semaine: any) => {
          let weekNumber = 0;
          if (semaine.nom && typeof semaine.nom === 'string') {
            const match = semaine.nom.match(/semaine(\d+)/i);
            if (match && match[1]) weekNumber = parseInt(match[1], 10);
          }
          if (weekNumber > 0) {
            weeks.push({
              number: weekNumber,
              startDate: semaine.dateDebut ? new Date(semaine.dateDebut) : new Date(),
              endDate: semaine.dateFin ? new Date(semaine.dateFin) : new Date(),
              display: semaine.nom || `semaine${weekNumber}`,
              data: semaine
            });
          }
        });

        weeks.sort((a: WeekInfo, b: WeekInfo) => b.number - a.number);
        this.availableWeeksSignal.set(weeks);
        this.loading.set(false);
      },
      error: () => {
        this.availableWeeksSignal.set([]);
        this.loading.set(false);
        this.showSuccessMessage('Erreur de chargement des semaines');
      }
    });
  }

 private loadWeekPlanificationFromAPI(semaineNom: string, line: ProductionLine): void {
    this.loading.set(true);
    this.semaineService.getPlanificationsForWeek(semaineNom).subscribe({
      next: (response) => {
        // ✅ DÉBOGAGE : Afficher TOUTE la réponse
        console.log('🔍 RÉPONSE BRUTE API:', JSON.stringify(response, null, 2));
        
        // ✅ DÉBOGAGE : Afficher le poste sélectionné
        console.log('📌 Poste sélectionné:', this.selectedPoste());
        console.log('📌 Ligne sélectionnée:', line.ligne);
        
        // ✅ DÉBOGAGE : Afficher TOUTES les planifications avant filtrage
        console.log('📋 Toutes les planifications reçues:', response.planifications?.length || 0);
        
        if (response.planifications && response.planifications.length > 0) {
          console.log('📋 Première planification exemple:', JSON.stringify(response.planifications[0], null, 2));
        }
        
        // ✅ FILTRAGE SIMPLIFIÉ - Afficher toutes les planifications de la ligne
        const toutesPlanificationsLigne = response.planifications?.filter(
          (p: any) => p.ligne === line.ligne
        ) || [];
        
        console.log('📊 Planifications de la ligne', line.ligne, ':', toutesPlanificationsLigne.length);
        
        // ✅ DÉBOGAGE : Voir les postes disponibles
        const postesDisponibles = [...new Set(toutesPlanificationsLigne.map((p: any) => p.poste || 'non défini'))];
        console.log('🏷️ Postes disponibles dans les données:', postesDisponibles);
        
        // ✅ FILTRAGE par poste (simplifié)
        const planificationsLigne = toutesPlanificationsLigne.filter((p: any) => {
          const postePlanif = p.poste || 'poste1';
          const match = postePlanif === this.selectedPoste();
          console.log(`  - ${p.reference} | ${p.jour} | poste: "${postePlanif}" | match: ${match}`);
          return match;
        });
        
        console.log('✅ Planifications filtrées final:', planificationsLigne.length);
        
        // Si aucune planification trouvée, continuer avec un tableau vide
        if (planificationsLigne.length === 0) {
          console.warn('⚠️ Aucune planification trouvée pour ce poste');
        }
        
        const references: ReferenceProduction[] = [];
        const refsMap = new Map<string, ReferenceProduction>();
        const ofByReference = new Map<string, string>();
        const noteByReference = new Map<string, string>();

        const reversedReferences = [...line.references].reverse();
        reversedReferences.forEach(reference => {
          refsMap.set(reference, { reference, ligne: line.ligne });
        });

        // Première passe : récupérer OF et notes
       toutesPlanificationsLigne.forEach((plan: any) => {
  if (plan.of && !ofByReference.has(plan.reference)) {
    ofByReference.set(plan.reference, plan.of);
  }
  if (plan.note !== undefined && plan.note !== null && !noteByReference.has(plan.reference)) {
    noteByReference.set(plan.reference, plan.note);
  }
});

        // Mettre à jour avec les données existantes
        planificationsLigne.forEach((plan: any) => {
          const refKey = plan.reference;
          if (refsMap.has(refKey)) {
            const refObj = refsMap.get(refKey)!;
            const jour = plan.jour.toLowerCase();
            const ofForThisRef = ofByReference.get(refKey) || '';

            refObj[jour] = {
              of: ofForThisRef,
              nbOperateurs: plan.nbOperateurs || 0,
              c: plan.qtePlanifiee || 0,
              m: plan.qteModifiee || 0,
              dp: plan.decProduction || 0,
              dm: plan.decMagasin || 0,
              delta: plan.pcsProd || 0
            };

            refObj.note = noteByReference.get(refKey) || '';
          }
        });

        // Créer des entrées vides pour les jours manquants
        refsMap.forEach((refObj) => {
          const ofForThisRef = ofByReference.get(refObj.reference) || '';
          if (!refObj.note) refObj.note = noteByReference.get(refObj.reference) || '';

          this.weekDays.forEach(day => {
            if (!refObj[day]) {
              refObj[day] = { of: ofForThisRef, nbOperateurs: 0, c: 0, m: 0, dp: 0, dm: 0, delta: 0 };
            }
          });
          references.push(refObj);
        });

        console.log('📋 Références créées:', references.length);
        console.log('📋 Première référence exemple:', references[0]);

        const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);
        this.weekPlanification.set({
          weekNumber: this.selectedWeek() || 0,
          ligne: line.ligne,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          references
        });
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement planification:', error);
        const references = this.createEmptyPlanifications(line);
        const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);
        this.weekPlanification.set({
          weekNumber: this.selectedWeek() || 0,
          ligne: line.ligne,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          references
        });
        this.loading.set(false);
      }
    });
  }

  private createEmptyPlanifications(line: ProductionLine): ReferenceProduction[] {
    return line.references.map((reference) => {
      const refData: ReferenceProduction = { reference, ligne: line.ligne, note: '' };
      this.weekDays.forEach(day => {
        refData[day] = { of: '', nbOperateurs: 0, c: 0, m: 0, dp: 0, dm: 0, delta: 0 };
      });
      return refData;
    });
  }

  backToLines(): void {
    this.selectedLigne.set(null);
    this.selectedWeek.set(null);
    this.weekPlanification.set(null);
    this.isEditing.set(false);
    this.selectedReferenceDetails.set(null);
    this.selectedPoste.set('poste1'); // ✅ reset poste
  }

  goBackToLogin(): void {
    this.router.navigate(['/login']);
  }

  toggleEditMode(): void {
    const currentEditingState = this.isEditing();
    if (currentEditingState) {
      this.savePlanificationsToAPI();
    }
    this.isEditing.set(!currentEditingState);
  }

  onSearchLineChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchLineQuery.set(target.value);
  }

  onSearchReferenceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchReferenceQuery.set(target.value);
  }

  clearLineSearch(): void { this.searchLineQuery.set(''); }
  clearReferenceSearch(): void { this.searchReferenceQuery.set(''); }

  private showSuccessMessage(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3000);
  }

  updateDayEntry(reference: ReferenceProduction, day: string, field: string, value: any): void {
    if (this.weekPlanification()) {
      const updatedPlanif = { ...this.weekPlanification()! };
      const refIndex = updatedPlanif.references.findIndex(r => r.reference === reference.reference);
      if (refIndex !== -1) {
        const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
        if (dayEntry) {
          if (field === 'of') {
            (dayEntry as any)[field] = value;
            this.weekDays.forEach(otherDay => {
              const otherDayEntry = updatedPlanif.references[refIndex][otherDay] as DayEntry;
              if (otherDayEntry) otherDayEntry.of = value;
            });
          } else {
            (dayEntry as any)[field] = +value;
          }
          if (field === 'c' || field === 'm' || field === 'dp') {
            const quantiteSource = dayEntry.m > 0 ? dayEntry.m : dayEntry.c;
            dayEntry.delta = quantiteSource > 0 ? Math.round((dayEntry.dp / quantiteSource) * 100) : 0;
          }
        }
        this.weekPlanification.set(updatedPlanif);
      }
    }
  }

  // NOUVEAU : Mettre à jour la note d'une référence
  updateNoteForReference(ref: ReferenceProduction, newNote: string): void {
    if (this.weekPlanification()) {
      const updatedPlanif = { ...this.weekPlanification()! };
      const refIndex = updatedPlanif.references.findIndex(r => r.reference === ref.reference);
      if (refIndex !== -1) {
        updatedPlanif.references[refIndex].note = newNote;
        this.weekPlanification.set(updatedPlanif);
      }
    }
  }

  getDayDate(dayIndex: number): Date {
    const planif = this.weekPlanification();
    if (!planif) return new Date();
    const startDate = new Date(planif.startDate);
    const dayOfWeek = startDate.getDay();
    if (dayOfWeek !== 1) {
      const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
      startDate.setDate(startDate.getDate() + daysToMonday);
    }
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayIndex);
    return date;
  }

  getDayDateCorrected(day: string, dayIndex: number): Date {
    const planif = this.weekPlanification();
    if (!planif) return new Date();
    const semaineData = this.getAvailableWeeks().find(w => w.number === planif.weekNumber);
    if (semaineData && semaineData.startDate) {
      const startDate = new Date(semaineData.startDate);
      const dayOfWeek = startDate.getDay();
      if (dayOfWeek !== 1) {
        const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + daysToMonday);
      }
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayIndex);
      return date;
    }
    return this.getDayDate(dayIndex);
  }

  getDayEntry(ref: ReferenceProduction, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

 private savePlanificationsToAPI(): void {
    if (!this.semaineService.isAuthenticated()) {
      this.showSuccessMessage('Vous devez être connecté pour sauvegarder');
      return;
    }
    const planif = this.weekPlanification();
    if (!planif) { 
      this.showSuccessMessage('Aucune planification à sauvegarder'); 
      return; 
    }

    const semaineNom = `semaine${planif.weekNumber}`;
    const ligne = planif.ligne;
    const planificationsToSave: any[] = [];

    planif.references.forEach((ref) => {
      this.weekDays.forEach(day => {
        const entry = ref[day] as DayEntry;
        if (entry) {
          planificationsToSave.push(this.semaineService.formatWeekForAPI({
            semaine: semaineNom,
            jour: day,
            ligne: ligne,
            reference: ref.reference,
            poste: this.selectedPoste(), // ✅ AJOUT IMPORTANT
            nbOperateurs: entry.nbOperateurs,
            of: entry.of,
            qtePlanifiee: entry.c,
            qteModifiee: entry.m,
            decProduction: entry.dp,
            decMagasin: entry.dm,
            note: ref.note ?? null
          }));
        }
      });
    });

    // ... reste du code inchangé
}

  getFirstNbOperateurs(day: string): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || planif.references.length === 0) return 0;
    const firstRef = planif.references[0];
    const entry = firstRef[day] as DayEntry;
    return entry?.nbOperateurs || 0;
  }

  showReferenceDetails(ref: ReferenceProduction): void {
    const referenceDetail: ReferenceDetail = { reference: ref.reference };
    this.weekDays.forEach(day => {
      const dayEntry = ref[day] as DayEntry | undefined;
      if (dayEntry) {
        const qPro = dayEntry.c;
        const nbBac = Math.ceil(qPro / 50);
        const tPiece = Math.floor(Math.random() * 30) + 10;
        const totalSeconds = qPro * tPiece;
        referenceDetail[day] = { qPro, nbBac, tPiece, tProdH: Math.floor(totalSeconds / 3600), tProdMin: Math.floor((totalSeconds % 3600) / 60) };
      }
    });
    this.selectedReferenceDetails.set(referenceDetail);
  }

  backToWeekPlanning(): void { this.selectedReferenceDetails.set(null); }

  getReferenceDetailValue(day: string, field: string): string {
    const detail = this.selectedReferenceDetails();
    if (!detail) return '-';
    const dayDetail = detail[day] as DayDetail | undefined;
    if (!dayDetail) return '-';
    return dayDetail[field as keyof DayDetail].toString();
  }

  getTotalReferenceDetail(field: string): string {
    const detail = this.selectedReferenceDetails();
    if (!detail) return '-';
    let total = 0;
    this.weekDays.forEach(day => {
      const dayDetail = detail[day] as DayDetail | undefined;
      if (dayDetail) total += dayDetail[field as keyof DayDetail] as number;
    });
    return total.toString();
  }

  openCausesModal(ref: ReferenceProduction, day: string): void {
    const entry = this.getDayEntry(ref, day);
    if (!entry) return;
    this.selectedEntryForCauses.set({ reference: ref, day, entry });

    const planif = this.weekPlanification();
    if (!planif || !this.selectedLigne()) return;

    const dto = { semaine: `semaine${planif.weekNumber}`, jour: day, ligne: this.selectedLigne()!.ligne, reference: ref.reference ,poste: this.selectedPoste() // ✅ AJOUT IMPORTANT
    };
    this.loading.set(true);

    this.nonConfService.checkNonConformiteExists(dto).subscribe({
      next: (response) => {
        const parseStringOrArray = (input: any): string[] => {
          if (!input) return [];
          if (Array.isArray(input)) return input.filter(item => item && typeof item === 'string' && item.trim() !== '');
          if (typeof input === 'string') return input.split(',').map(item => item.trim()).filter(item => item !== '');
          return [];
        };

        if (response.exists && response.data) {
          const details = response.data.details || {};
          const mpRefs = parseStringOrArray(details.referenceMatierePremiere);
          const qualiteRefs = parseStringOrArray(details.referenceQualite);

          this.currentCauses.set({
            m1MatierePremiere: details.matierePremiere || 0,
            m1References: mpRefs.map((r: string) => ({ reference: r, quantite: mpRefs.length > 0 ? (details.matierePremiere || 0) / mpRefs.length : 0 })),
            m2Absence: details.absence || 0,
            m2MatriculesAbsence: parseStringOrArray(details.matriculesAbsence),
            m2Rendement: details.rendement || 0,
            m2MatriculesRendement: parseStringOrArray(details.matriculesRendement),
            m3Methode: details.methode || 0,
            m4Maintenance: details.maintenance || 0,
            m4PhasesMaintenance: parseStringOrArray(details.phasesMaintenance),
            m5Qualite: details.qualite || 0,
            qualiteReferences: qualiteRefs.map((r: string) => ({ reference: r, quantite: qualiteRefs.length > 0 ? (details.qualite || 0) / qualiteRefs.length : 0 })),
            m5CommentaireQualite: details.commentaireTexte || details.commentaire || '',
            m6Environnement: details.environnement || 0
          });
        } else {
          this.currentCauses.set({ m1MatierePremiere: 0, m1References: [], m2Absence: 0, m2MatriculesAbsence: [], m2Rendement: 0, m2MatriculesRendement: [], m3Methode: 0, m4Maintenance: 0, m4PhasesMaintenance: [], m5Qualite: 0, qualiteReferences: [], m5CommentaireQualite: '', m6Environnement: 0 });
        }
        this.loading.set(false);
        this.showCausesModal.set(true);
      },
      error: () => {
        this.currentCauses.set({ m1MatierePremiere: 0, m1References: [], m2Absence: 0, m2MatriculesAbsence: [], m2Rendement: 0, m2MatriculesRendement: [], m3Methode: 0, m4Maintenance: 0, m4PhasesMaintenance: [], m5Qualite: 0, qualiteReferences: [], m5CommentaireQualite: '', m6Environnement: 0 });
        this.loading.set(false);
        this.showCausesModal.set(true);
      }
    });
  }

  getTotalCForDay(day: string): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || !planif.references) return 0;
    return planif.references.reduce((total, ref) => {
      const entry = this.getDayEntry(ref, day);
      return total + (entry?.c || 0);
    }, 0);
  }

  hasCausesRegistered(ref: ReferenceProduction, day: string): boolean {
    const entry = this.getDayEntry(ref, day);
    if (!entry || !entry.causes) return false;
    const c = entry.causes;
    return c.m1MatierePremiere > 0 || c.m2Absence > 0 || c.m2Rendement > 0 || c.m4Maintenance > 0 || c.m5Qualite > 0;
  }

  closeCausesModal(): void {
    this.showCausesModal.set(false);
    this.selectedEntryForCauses.set(null);
  }

  updateCause(causeKey: keyof Causes5M, value: string): void {
    const numValue = Math.max(0, parseInt(value) || 0);
    this.currentCauses.update(causes => ({ ...causes, [causeKey]: numValue }));
  }

  getTotalCauses(): number {
    const c = this.currentCauses();
    return c.m1MatierePremiere + c.m2Absence + c.m2Rendement + c.m3Methode + c.m4Maintenance + c.m5Qualite + c.m6Environnement;
  }

  getEcartCDP(): number {
    const selected = this.selectedEntryForCauses();
    if (!selected) return 0;
    return Math.abs(this.getQuantiteSource(selected.entry) - selected.entry.dp);
  }

  getDifferenceRestante(): number { return this.getEcartCDP() - this.getTotalCauses(); }

  saveCauses(): void {
    const selected = this.selectedEntryForCauses();
    if (!selected) return;
    const planif = this.weekPlanification();
    if (!planif) return;
    const updatedPlanif = { ...planif };
    const refIndex = updatedPlanif.references.findIndex(r => r.reference === selected.reference.reference);
    if (refIndex !== -1) {
      const dayEntry = updatedPlanif.references[refIndex][selected.day] as DayEntry;
      if (dayEntry) dayEntry.causes = { ...this.currentCauses() };
      this.weekPlanification.set(updatedPlanif);
    }
    this.showSuccessMessage('Causes sauvegardées avec succès');
    this.closeCausesModal();
  }

  getQuantiteSource(entry: DayEntry): number { return entry.m > 0 ? entry.m : entry.c; }
  getSelectedC(): number { const s = this.selectedEntryForCauses(); return s ? this.getQuantiteSource(s.entry) : 0; }
  getSelectedDP(): number { const s = this.selectedEntryForCauses(); return s ? s.entry.dp : 0; }

  onTableScroll(event: Event): void {
    const wrapper = event.target as HTMLElement;
    this.updateScrollState(wrapper);
    this.onFirstScroll();
  }

  onTouchStart(event: TouchEvent): void {
    const wrapper = this.scrollWrapper.nativeElement;
    this.isTouchScrolling = true;
    this.touchStartX = event.touches[0].pageX;
    this.scrollLeftStart = wrapper.scrollLeft;
    wrapper.style.cursor = 'grabbing';
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isTouchScrolling) return;
    event.preventDefault();
    const wrapper = this.scrollWrapper.nativeElement;
    const walk = (event.touches[0].pageX - this.touchStartX) * 2;
    wrapper.scrollLeft = this.scrollLeftStart - walk;
    this.updateScrollState(wrapper);
  }

  onTouchEnd(): void {
    this.isTouchScrolling = false;
    this.scrollWrapper.nativeElement.style.cursor = 'grab';
  }

  private updateScrollState(wrapper: HTMLElement): void {
    const scrollLeft = wrapper.scrollLeft;
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    this.isScrolled.set(scrollLeft > 10);
    this.isScrolledEnd.set(scrollLeft >= maxScroll - 10);
    this.isScrollable.set(wrapper.scrollWidth > wrapper.clientWidth);
  }

  scrollToStart(): void {
    if (this.scrollWrapper?.nativeElement) this.scrollWrapper.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
  }

  hideScrollIndicator(): void { this.showScrollIndicator.set(false); }
  onFirstScroll(): void { this.hideScrollIndicator(); }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.scrollWrapper?.nativeElement) this.updateScrollState(this.scrollWrapper.nativeElement);
    }, 100);
  }

  handleImageError(event: Event, line: ProductionLine): void {
    (event.target as HTMLImageElement).src = this.getDefaultImageUrl(line.ligne);
  }

  getOfForReference(ref: ReferenceProduction): string {
    for (const day of this.weekDays) {
      const entry = ref[day] as DayEntry;
      if (entry && entry.of) return entry.of;
    }
    return '';
  }

  updateOfForAllDays(ref: ReferenceProduction, newOf: string): void {
    if (this.weekPlanification()) {
      const updatedPlanif = { ...this.weekPlanification()! };
      const refIndex = updatedPlanif.references.findIndex(r => r.reference === ref.reference);
      if (refIndex !== -1) {
        this.weekDays.forEach(day => {
          const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
          if (dayEntry) dayEntry.of = newOf;
        });
        this.weekPlanification.set(updatedPlanif);
      }
    }
  }

  getTotalCForReference(ref: ReferenceProduction): number {
    return this.weekDays.reduce((total, day) => total + (this.getDayEntry(ref, day)?.c || 0), 0);
  }

  getTotalDPForReference(ref: ReferenceProduction): number {
    return this.weekDays.reduce((total, day) => total + (this.getDayEntry(ref, day)?.dp || 0), 0);
  }

  getTotalDMForReference(ref: ReferenceProduction): number {
    return this.weekDays.reduce((total, day) => total + (this.getDayEntry(ref, day)?.dm || 0), 0);
  }

  getGlobalDeltaForReference(ref: ReferenceProduction): number {
    let totalQteSource = 0, totalDP = 0;
    this.weekDays.forEach(day => {
      const entry = this.getDayEntry(ref, day);
      if (entry) { totalQteSource += this.getQuantiteSource(entry); totalDP += entry.dp; }
    });
    return totalQteSource === 0 ? 0 : Math.round((totalDP / totalQteSource) * 100);
  }

  getTotalOfAllC(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif?.references) return 0;
    return planif.references.reduce((total, ref) => total + this.getTotalCForReference(ref), 0);
  }

  getTotalOfAllDP(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif?.references) return 0;
    return planif.references.reduce((total, ref) => total + this.getTotalDPForReference(ref), 0);
  }

  getTotalOfAllDM(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif?.references) return 0;
    return planif.references.reduce((total, ref) => total + this.getTotalDMForReference(ref), 0);
  }

  private loadPresenceForLigne(ligne: string): void {
  this.loadingPresence.set(true);
  this.lignePresents.set(0);
  this.ligneAbsents.set(0);
  this.ligneTotal.set(0);

  // Appels parallèles : affectations + pointage du jour
  forkJoin({
    affectations: this.affectationService.getAllAffectations(),
    pointage: this.affectationService.getPointagesToday()
  }).subscribe({
    next: ({ affectations, pointage }) => {
      // Filtrer les ouvriers affectés à cette ligne
      const ouvriersDeLaLigne = affectations.data.filter(a => a.ligne === ligne);
      const matriculesDeLaLigne = new Set(ouvriersDeLaLigne.map(a => a.matricule));

      // Matricules présents aujourd'hui
      const matriculesPresents = new Set(
        pointage.presents.map((p: any) => Number(p.matricule))
      );

      let presents = 0;
      let absents = 0;
      matriculesDeLaLigne.forEach(matricule => {
        if (matriculesPresents.has(Number(matricule))) {
          presents++;
        } else {
          absents++;
        }
      });

      this.ligneTotal.set(matriculesDeLaLigne.size);
      this.lignePresents.set(presents);
      this.ligneAbsents.set(absents);
      this.loadingPresence.set(false);
    },
    error: () => {
      this.loadingPresence.set(false);
    }
  });
}
}