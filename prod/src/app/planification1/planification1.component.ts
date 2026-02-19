import { Component, signal, computed, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
import { NonConfService } from '../prod2/non-conf.service';



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
  m1References: { reference: string; quantite: number }[];  // ✅ AJOUTER
  m2Absence: number;
  m2Rendement: number;
  m3Methode: number;  // ✅ AJOUTER
  m4Maintenance: number;
  m5Qualite: number;
  qualiteReferences: { reference: string; quantite: number }[];
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
  selector: 'app-planification1',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planification1.component.html',
  styleUrls: ['./planification1.component.css']
})
export class Planification1Component implements AfterViewInit, OnInit {
  @ViewChild('scrollWrapper') scrollWrapper!: ElementRef;
  @ViewChild('tableContainer') tableContainer!: ElementRef;

  // Signals
  sidebarVisible = signal(true);
  loading = signal(false);
  selectedLigne = signal<ProductionLine | null>(null);
  selectedWeek = signal<number | null>(null);
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
    m1References: [],  // ✅ AJOUTER
    m2Absence: 0,
    m2Rendement: 0,
    m3Methode: 0,  // ✅ AJOUTER
    m4Maintenance: 0,
    m5Qualite: 0,
    qualiteReferences: [], // ✅ AJOUTER
    m6Environnement: 0,
  });

  // Gestion du scroll
  isScrollable = signal(false);
  isScrolled = signal(false);
  isScrolledEnd = signal(false);
  showScrollIndicator = signal(true);

  private isTouchScrolling = false;
  private touchStartX = 0;
  private scrollLeftStart = 0;

  // Données
  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    private nonConfService: NonConfService
  ) {
    this.generateParticles();
  }

  ngOnInit() {
    this.loadProductionLines();
    this.semaineService.getSemainesForPlanning().subscribe({
      next: (data) => {
        console.log('DEBUG - Données brutes API semaines:', data);
        console.log('Type de données:', typeof data);
        console.log('Est un array?', Array.isArray(data));
        console.log('Structure complète:', JSON.stringify(data, null, 2));
      },
      error: (err) => {
        console.error('DEBUG - Erreur API:', err);
      }
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
    console.log('Chargement des lignes depuis ProductService...');
    this.loading.set(true);

    this.productService.getAllLines().subscribe({
      next: (response) => {
        console.log('Réponse ProductService:', response);

        if (response && response.lines && Array.isArray(response.lines)) {
          const lines: ProductionLine[] = response.lines.map((productLine: ProductLine) => {
            return {
              ligne: productLine.ligne,
              referenceCount: productLine.referenceCount || productLine.references?.length || 0,
              imageUrl: this.getImageUrl(productLine),
              references: productLine.references || [],
              isActive: true
            };
          });

          // ✅ CORRECTION : Tri alphanumérique correct basé sur le numéro après "L"
          const sortedLines = this.sortLinesByNumber(lines);

          console.log('Lignes chargées et triées:', sortedLines.length);
          this.availableLines.set(sortedLines);
        } else {
          console.warn('Format de réponse inattendu, chargement mockées');
          this.loadMockProductionLines();
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement des lignes:', error);
        this.loadMockProductionLines();
        this.loading.set(false);
      }
    });
  }

  private sortLinesByNumber(lines: ProductionLine[]): ProductionLine[] {
    return lines.sort((a, b) => {
      // Extraire le numéro de la ligne (ex: "L04:RXT1" -> 4)
      const numA = this.extractLineNumber(a.ligne);
      const numB = this.extractLineNumber(b.ligne);

      // Comparer numériquement
      return numA - numB;
    });
  }

  /**
   * Extrait le numéro d'une ligne (ex: "L04:RXT1" -> 4, "L42:RA1" -> 42)
   */
  private extractLineNumber(ligne: string): number {
    const match = ligne.match(/^L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private getImageUrl(productLine: ProductLine): string {
    if (productLine.imageUrl) {
      return this.productService.getImageUrl(productLine.imageUrl);
    }
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
      {
        ligne: 'L04:RXT1',
        referenceCount: 13,
        imageUrl: 'assets/images/unnamed.jpg',
        references: ['RA5246801', 'RA5246802', 'RA5246803', 'RA5246804', 'RA5246805', 'RA5246806', 'RA5246811', 'RA5246814', 'RA5246815', 'RA5246822', 'RA5246823', 'RA5246827', 'RA5246828'],
        isActive: true
      },
      {
        ligne: 'L07:COM A1',
        referenceCount: 4,
        imageUrl: 'assets/images/unnamed (1).jpg',
        references: ['COM001', 'COM002', 'COM003', 'COM004'],
        isActive: true
      },
      {
        ligne: 'L09:COMXT2',
        referenceCount: 8,
        imageUrl: 'assets/images/unnamed (2).jpg',
        references: ['COMXT001', 'COMXT002', 'COMXT003', 'COMXT004', 'COMXT005', 'COMXT006', 'COMXT007', 'COMXT008'],
        isActive: false
      },
      {
        ligne: 'L10:RS3',
        referenceCount: 6,
        imageUrl: 'assets/images/unnamed (3).jpg',
        references: ['RS3001', 'RS3002', 'RS3003', 'RS3004', 'RS3005', 'RS3006'],
        isActive: true
      },
      {
        ligne: 'L14:CD XT1',
        referenceCount: 10,
        imageUrl: 'assets/images/unnamed (4).jpg',
        references: ['CDXT001', 'CDXT002', 'CDXT003', 'CDXT004', 'CDXT005', 'CDXT006', 'CDXT007', 'CDXT008', 'CDXT009', 'CDXT010'],
        isActive: true
      },
      {
        ligne: 'L15:MTSA3',
        referenceCount: 10,
        imageUrl: 'assets/images/unnamed (5).jpg',
        references: ['MTSA001', 'MTSA002', 'MTSA003', 'MTSA004', 'MTSA005', 'MTSA006', 'MTSA007', 'MTSA008', 'MTSA009', 'MTSA010'],
        isActive: false
      }
    ];
    this.availableLines.set(lines);
  }

  // Computed pour les lignes filtrées
  filteredLines = computed(() => {
    const query = this.searchLineQuery().toLowerCase();
    if (!query) return this.availableLines();

    return this.availableLines().filter(line =>
      line.ligne.toLowerCase().includes(query)
    );
  });

  // Computed pour les références filtrées
  filteredWeekPlanification = computed(() => {
    const planif = this.weekPlanification();
    const query = this.searchReferenceQuery().toLowerCase();

    if (!planif || !query) return planif;

    const filteredPlanif = {
      ...planif,
      references: planif.references.filter(ref =>
        ref.reference.toLowerCase().includes(query)
      )
    };

    return filteredPlanif;
  });

  getAvailableWeeks(): WeekInfo[] {
    const apiWeeks = this.availableWeeksSignal();

    if (apiWeeks.length > 0) {
      console.log('Semaines API disponibles:', apiWeeks.length);
      return apiWeeks;
    }

    // NE PAS retourner de données mockées, juste un tableau vide
    console.log('Aucune semaine disponible depuis l\'API');
    return [];
  }

  private getWeekDates(year: number, weekNumber: number): WeekInfo {
    return this.semaineService.getWeekDates(year, weekNumber);
  }

  onLigneSelected(line: ProductionLine): void {
    console.log('Line selected:', line.ligne);
    this.selectedLigne.set(line);
    this.selectedWeek.set(null);
    this.weekPlanification.set(null);
    this.isEditing.set(false);
    this.selectedReferenceDetails.set(null);

    // AJOUTER CETTE LIGNE : Charger les semaines disponibles
    this.loadAvailableWeeks();
  }

  onWeekSelected(weekNumber: number): void {
    console.log('Week selected:', weekNumber);
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

  // Dans planification.component.ts

  private loadAvailableWeeks(): void {
    this.loading.set(true);

    console.log('Chargement des semaines via route publique...');

    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        console.log('DEBUG - Réponse semaines publiques:', response);

        let semainesArray: any[] = [];

        // Vérifier le format de réponse
        if (response && response.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        } else {
          console.warn('Format de réponse inattendu:', response);
          this.availableWeeksSignal.set([]);
          this.loading.set(false);
          return;
        }

        console.log('Semaines trouvées:', semainesArray.length);

        if (semainesArray.length > 0) {
          const weeks: WeekInfo[] = [];

          semainesArray.forEach((semaine: any) => {
            let weekNumber = 0;

            // Extraire le numéro de semaine du nom (ex: "semaine1" -> 1)
            if (semaine.nom && typeof semaine.nom === 'string') {
              const match = semaine.nom.match(/semaine(\d+)/i);
              if (match && match[1]) {
                weekNumber = parseInt(match[1], 10);
              } else {
                console.warn(`Format de nom invalide: ${semaine.nom}`);
              }
            }

            // Si on a un numéro valide, créer l'objet WeekInfo
            if (weekNumber > 0) {
              weeks.push({
                number: weekNumber,
                startDate: semaine.dateDebut ? new Date(semaine.dateDebut) : new Date(),
                endDate: semaine.dateFin ? new Date(semaine.dateFin) : new Date(),
                display: semaine.nom || `semaine${weekNumber}`,
                data: semaine
              });
            } else {
              console.warn(`Semaine sans numéro valide:`, semaine);
            }
          });

          // Trier les semaines par numéro
          weeks.sort((a: WeekInfo, b: WeekInfo) => b.number - a.number); // Décroissant

          console.log(`Chargé ${weeks.length} semaines:`, weeks);
          this.availableWeeksSignal.set(weeks);
        } else {
          console.warn('Aucune semaine trouvée');
          this.availableWeeksSignal.set([]);
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement des semaines publiques:', error);
        this.availableWeeksSignal.set([]);
        this.loading.set(false);

        // Optionnel: Ajouter un message d'erreur à l'utilisateur
        this.showSuccessMessage('Erreur de chargement des semaines');
      }
    });
  }

  private getAvailableWeeksMock(): WeekInfo[] {
    const weeks: WeekInfo[] = [];
    const currentYear = new Date().getFullYear();

    for (let weekNumber = 1; weekNumber <= 52; weekNumber++) {
      weeks.push(this.getWeekDates(currentYear, weekNumber));
    }

    return weeks;
  }

  private loadWeekPlanificationFromAPI(semaineNom: string, line: ProductionLine): void {
    console.log('Chargement planifications depuis API...');
    this.loading.set(true);

    this.semaineService.getPlanificationsForWeek(semaineNom).subscribe({
      next: (response) => {
        console.log('Planifications API:', response);

        const planificationsLigne = response.planifications?.filter(
          (p: any) => p.ligne === line.ligne
        ) || [];

        const references: ReferenceProduction[] = [];
        const refsMap = new Map<string, ReferenceProduction>();

        // Map pour stocker l'OF par référence (prendre le premier OF trouvé)
        const ofByReference = new Map<string, string>();

        // MODIFICATION ICI : inverser l'ordre des références de la ligne
        const reversedReferences = [...line.references].reverse(); // ← Créer une copie inversée

        reversedReferences.forEach(reference => { // ← Utiliser reversedReferences au lieu de line.references
          refsMap.set(reference, {
            reference: reference,
            ligne: line.ligne
          });
        });
        // FIN DE LA MODIFICATION

        // Première passe: récupérer les OF
        planificationsLigne.forEach((plan: any) => {
          if (plan.of && !ofByReference.has(plan.reference)) {
            ofByReference.set(plan.reference, plan.of);
          }
        });

        // Mettre à jour avec les données existantes
        planificationsLigne.forEach((plan: any) => {
          const refKey = plan.reference;
          if (refsMap.has(refKey)) {
            const refObj = refsMap.get(refKey)!;
            const jour = plan.jour.toLowerCase();
            // Utiliser l'OF de la référence (même pour tous les jours)
            const ofForThisRef = ofByReference.get(refKey) || '';

            refObj[jour] = {
              of: ofForThisRef,  // IMPORTANT: Utiliser le même OF pour tous les jours
              nbOperateurs: plan.nbOperateurs || 0,
              c: plan.qtePlanifiee || 0,
              m: plan.qteModifiee || 0,
              dp: plan.decProduction || 0,
              dm: plan.decMagasin || 0,
              delta: plan.pcsProd || 0
            };
          }
        });

        // Créer des entrées vides pour les jours manquants
        refsMap.forEach((refObj) => {
          const ofForThisRef = ofByReference.get(refObj.reference) || '';

          this.weekDays.forEach(day => {
            if (!refObj[day]) {
              refObj[day] = {
                of: ofForThisRef,  // IMPORTANT: Utiliser le même OF pour tous les jours
                nbOperateurs: 0,
                c: 0,
                m: 0,
                dp: 0,
                dm: 0,
                delta: 0
              };
            }
          });
          references.push(refObj);
        });

        const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);

        this.weekPlanification.set({
          weekNumber: this.selectedWeek() || 0,
          ligne: line.ligne,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          references // ← Les références sont déjà dans l'ordre inversé
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement planifications:', error);

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
      const refData: ReferenceProduction = { reference, ligne: line.ligne };

      this.weekDays.forEach(day => {
        refData[day] = {
          of: '',
          nbOperateurs: 0,
          c: 0,
          m: 0,
          dp: 0,
          dm: 0,
          delta: 0
        };
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
  }

  goBackToLogin(): void {
    this.router.navigate(['/login']);
  }

  toggleEditMode(): void {
    const currentEditingState = this.isEditing();

    if (!currentEditingState) {
      // NE PAS ajouter d'entrées automatiquement
      // Juste activer le mode édition
      console.log('Mode édition activé');
    } else {
      this.savePlanificationsToAPI();
    }

    this.isEditing.set(!currentEditingState);
  }

  private addEntriesToAllDaysAndReferences(): void {
    const planif = this.weekPlanification();
    if (!planif) return;

    const updatedPlanif = { ...planif };

    updatedPlanif.references = updatedPlanif.references.map((ref) => {
      const updatedRef = { ...ref };

      this.weekDays.forEach(day => {
        const entry = updatedRef[day] as DayEntry;
        if (entry) {
          // Initialiser avec des valeurs par défaut si toutes à 0
          if (entry.c === 0 && entry.m === 0 && entry.dp === 0) {
            entry.c = 1000;
            entry.dp = 750;
            entry.delta = Math.round((entry.dp / entry.c) * 100);
          }
        }
      });

      return updatedRef;
    });

    this.weekPlanification.set(updatedPlanif);
    this.showSuccessMessage('Prêt pour l\'édition');
  }

  onSearchLineChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchLineQuery.set(target.value);
  }

  onSearchReferenceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchReferenceQuery.set(target.value);
  }

  clearLineSearch(): void {
    this.searchLineQuery.set('');
  }

  clearReferenceSearch(): void {
    this.searchReferenceQuery.set('');
  }

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
          // Gérer tous les champs, y compris nbOperateurs
          if (field === 'of') {
            // IMPORTANT: Quand on modifie l'OF, on le met à jour pour TOUS les jours
            (dayEntry as any)[field] = value;

            // Mettre à jour l'OF pour tous les autres jours de cette référence
            this.weekDays.forEach(otherDay => {
              const otherDayEntry = updatedPlanif.references[refIndex][otherDay] as DayEntry;
              if (otherDayEntry) {
                otherDayEntry.of = value;
              }
            });
          } else {
            (dayEntry as any)[field] = +value;
          }

          // Recalculer le delta si nécessaire
          if (field === 'c' || field === 'm' || field === 'dp') {
            const quantiteSource = dayEntry.m > 0 ? dayEntry.m : dayEntry.c;
            dayEntry.delta = quantiteSource > 0 ?
              Math.round((dayEntry.dp / quantiteSource) * 100) : 0;
          }
        }
        this.weekPlanification.set(updatedPlanif);
      }
    }
  }

  // planification.component.ts - La méthode actuelle qui a le problème
  // planification.component.ts - Méthode corrigée
  getDayDate(dayIndex: number): Date {
    const planif = this.weekPlanification();
    if (!planif) return new Date();

    // Créer une copie de la date de début
    const startDate = new Date(planif.startDate);

    // S'assurer que startDate est bien un lundi (jour 1)
    // getDay(): 0 = dimanche, 1 = lundi, 2 = mardi, etc.
    const dayOfWeek = startDate.getDay();

    // Si ce n'est pas un lundi, ajuster
    if (dayOfWeek !== 1) {
      // Calculer combien de jours pour revenir au lundi
      // Si dimanche (0) : ajouter 1 jour
      // Si mardi (2) : soustraire 1 jour (2-1=1, donc -1)
      // Si mercredi (3) : soustraire 2 jours (3-1=2, donc -2)
      const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
      startDate.setDate(startDate.getDate() + daysToMonday);
    }

    // Ajouter le nombre de jours correspondant à l'index
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayIndex);

    return date;
  }

  /**
   * Alternative : Méthode plus robuste qui utilise les dates de l'API
   * Vous pouvez utiliser celle-ci à la place de getDayDate()
   */
  getDayDateCorrected(day: string, dayIndex: number): Date {
    const planif = this.weekPlanification();
    if (!planif) return new Date();

    // Si nous avons les dates exactes de l'API, les utiliser
    const semaineData = this.getAvailableWeeks().find(w => w.number === planif.weekNumber);

    if (semaineData && semaineData.startDate) {
      // S'assurer que startDate est un lundi
      const startDate = new Date(semaineData.startDate);

      // Ajuster au lundi si nécessaire
      const dayOfWeek = startDate.getDay(); // 0=dimanche, 1=lundi
      if (dayOfWeek !== 1) {
        const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + daysToMonday);
      }

      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayIndex);
      return date;
    }

    // Fallback : utiliser la méthode standard
    return this.getDayDate(dayIndex);
  }
  getDayEntry(ref: ReferenceProduction, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

  private savePlanificationsToAPI(): void {
    // Vérifier l'authentification
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
    let modificationsCount = 0;

    console.log('Sauvegarde des données:', planif.references.length, 'références');

    // Parcourir toutes les références et jours
    planif.references.forEach((ref) => {
      this.weekDays.forEach(day => {
        const entry = ref[day] as DayEntry;
        if (entry) {
          // Préparer les données pour l'API
          const planificationData = this.semaineService.formatWeekForAPI({
            semaine: semaineNom,
            jour: day,
            ligne: ligne,
            reference: ref.reference,
            nbOperateurs: entry.nbOperateurs,
            of: entry.of,
            qtePlanifiee: entry.c,
            qteModifiee: entry.m,
            decProduction: entry.dp,
            decMagasin: entry.dm
          });

          planificationsToSave.push(planificationData);
          modificationsCount++;
        }
      });
    });

    console.log('Total à sauvegarder:', planificationsToSave.length);

    if (planificationsToSave.length === 0) {
      this.showSuccessMessage('Aucune donnée à sauvegarder');
      return;
    }

    // Afficher un message de début
    this.showSuccessMessage(`Sauvegarde de ${modificationsCount} modifications...`);

    // Utiliser un Promise.all pour gérer toutes les requêtes
    const savePromises = planificationsToSave.map((planData, index) => {
      return new Promise<void>((resolve, reject) => {
        this.semaineService.updatePlanificationByCriteria(planData).subscribe({
          next: () => {
            console.log(`✓ Planification ${index + 1}/${planificationsToSave.length} sauvegardée`);
            resolve();
          },
          error: (error) => {
            console.error(`✗ Erreur sauvegarde ${index + 1}:`, error);
            reject(error);
          }
        });
      });
    });

    // Gérer toutes les sauvegardes
    Promise.all(savePromises.map(p => p.catch(e => e)))
      .then(results => {
        const successful = results.filter(r => !(r instanceof Error)).length;
        const errors = results.filter(r => r instanceof Error).length;

        if (errors === 0) {
          this.showSuccessMessage(`Toutes les ${successful} modifications ont été enregistrées avec succès`);
        } else {
          this.showSuccessMessage(`Sauvegarde terminée: ${successful} OK, ${errors} erreurs`);
        }
      })
      .catch(finalError => {
        console.error('Erreur générale de sauvegarde:', finalError);
        this.showSuccessMessage('Erreur lors de la sauvegarde');
      });
  }
  getFirstNbOperateurs(day: string): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || planif.references.length === 0) return 0;

    // Prendre le nbOperateurs de la première référence pour ce jour
    const firstRef = planif.references[0];
    const entry = firstRef[day] as DayEntry;
    return entry?.nbOperateurs || 0;
  }

  // Méthodes pour les détails de référence
  showReferenceDetails(ref: ReferenceProduction): void {
    console.log('Showing details for reference:', ref.reference);

    const referenceDetail: ReferenceDetail = {
      reference: ref.reference
    };

    this.weekDays.forEach(day => {
      const dayEntry = ref[day] as DayEntry | undefined;
      if (dayEntry) {
        const qPro = dayEntry.c;
        const nbBac = Math.ceil(qPro / 50);
        const tPiece = Math.floor(Math.random() * 30) + 10;
        const totalSeconds = qPro * tPiece;
        const tProdH = Math.floor(totalSeconds / 3600);
        const tProdMin = Math.floor((totalSeconds % 3600) / 60);

        const dayDetail: DayDetail = {
          qPro: qPro,
          nbBac: nbBac,
          tPiece: tPiece,
          tProdH: tProdH,
          tProdMin: tProdMin
        };

        referenceDetail[day] = dayDetail;
      }
    });

    this.selectedReferenceDetails.set(referenceDetail);
  }

  backToWeekPlanning(): void {
    this.selectedReferenceDetails.set(null);
  }

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
      if (dayDetail) {
        total += dayDetail[field as keyof DayDetail] as number;
      }
    });

    return total.toString();
  }

  openCausesModal(ref: ReferenceProduction, day: string): void {
    const entry = this.getDayEntry(ref, day);
    if (!entry) return;

    this.selectedEntryForCauses.set({ reference: ref, day, entry });

    const planif = this.weekPlanification();
    if (!planif || !this.selectedLigne()) return;

    const ligne = this.selectedLigne()!.ligne;

    const dto = {
      semaine: `semaine${planif.weekNumber}`,
      jour: day,
      ligne: ligne,
      reference: ref.reference
    };

    console.log('Vérification non-conformité pour:', dto);

    this.loading.set(true);

    this.nonConfService.checkNonConformiteExists(dto).subscribe({
      next: (response) => {
        console.log('Réponse API non-conformité:', response);

        if (response.exists && response.data) {
          const details = response.data.details || {};

          // ✅ PARSER LES RÉFÉRENCES MP
          let mpReferences: { reference: string; quantite: number }[] = [];
          if (details.referenceMatierePremiere) {
            const refs = details.referenceMatierePremiere.split(',').map((r: string) => r.trim());
            const quantiteParRef = details.matierePremiere / refs.length;
            mpReferences = refs.map((ref: string) => ({
              reference: ref,
              quantite: quantiteParRef
            }));
          }

          // ✅ PARSER LES RÉFÉRENCES QUALITÉ
          let qualiteReferences: { reference: string; quantite: number }[] = [];
          if (details.referenceQualite) {
            const refs = details.referenceQualite.split(',').map((r: string) => r.trim());
            const quantiteParRef = details.qualite / refs.length;
            qualiteReferences = refs.map((ref: string) => ({
              reference: ref,
              quantite: quantiteParRef
            }));
          }

          this.currentCauses.set({
            m1MatierePremiere: details.matierePremiere || 0,
            m1References: mpReferences,  // ✅ AJOUTER
            m2Absence: details.absence || 0,
            m2Rendement: details.rendement || 0,
            m3Methode: details.methode || 0,  // ✅ AJOUTER
            m4Maintenance: details.maintenance || 0,
            m5Qualite: details.qualite || 0,
            qualiteReferences: qualiteReferences,  // ✅ AJOUTER
            m6Environnement: details.environnement || 0
          });

          console.log('✅ Causes chargées:', this.currentCauses());
        } else {
          // Réinitialiser
          this.currentCauses.set({
            m1MatierePremiere: 0,
            m1References: [],
            m2Absence: 0,
            m2Rendement: 0,
            m3Methode: 0,
            m4Maintenance: 0,
            m5Qualite: 0,
            qualiteReferences: [],
            m6Environnement: 0
          });
        }

        this.loading.set(false);
        this.showCausesModal.set(true);
      },
      error: (error) => {
        console.error('❌ Erreur chargement non-conformité:', error);

        this.currentCauses.set({
          m1MatierePremiere: 0,
          m1References: [],
          m2Absence: 0,
          m2Rendement: 0,
          m3Methode: 0,
          m4Maintenance: 0,
          m5Qualite: 0,
          qualiteReferences: [],
          m6Environnement: 0
        });

        this.loading.set(false);
        this.showCausesModal.set(true);
      }
    });
  }

  getTotalCForDay(day: string): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || !planif.references || planif.references.length === 0) {
      return 0;
    }

    let total = 0;

    // Parcourir toutes les références et additionner les valeurs C pour ce jour
    planif.references.forEach(ref => {
      const entry = this.getDayEntry(ref, day);
      if (entry && entry.c) {
        total += entry.c;
      }
    });

    return total;
  }

  hasCausesRegistered(ref: ReferenceProduction, day: string): boolean {
    const entry = this.getDayEntry(ref, day);
    if (!entry) return false;

    // Vérifier si des causes ont été enregistrées
    if (entry.causes) {
      const causes = entry.causes;
      return (
        causes.m1MatierePremiere > 0 ||
        causes.m2Absence > 0 ||
        causes.m2Rendement > 0 ||
        causes.m4Maintenance > 0 ||
        causes.m5Qualite > 0
      );
    }

    return false;
  }

  closeCausesModal(): void {
    this.showCausesModal.set(false);
    this.selectedEntryForCauses.set(null);
  }

  updateCause(causeKey: keyof Causes5M, value: string): void {
    const numValue = Math.max(0, parseInt(value) || 0);
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: numValue
    }));
  }





  getTotalCauses(): number {
    const causes = this.currentCauses();
    return causes.m1MatierePremiere +
      causes.m2Absence +
      causes.m2Rendement +
      causes.m3Methode +  // ✅ AJOUTER
      causes.m4Maintenance +
      causes.m5Qualite; +
        causes.m6Environnement;
  }

  getEcartCDP(): number {
    const selected = this.selectedEntryForCauses();
    if (!selected) return 0;
    return Math.abs(selected.entry.c - selected.entry.dp);
  }

  getDifferenceRestante(): number {
    return this.getEcartCDP() - this.getTotalCauses();
  }

  saveCauses(): void {
    const selected = this.selectedEntryForCauses();
    if (!selected) return;

    const planif = this.weekPlanification();
    if (!planif) return;

    const updatedPlanif = { ...planif };
    const refIndex = updatedPlanif.references.findIndex(
      r => r.reference === selected.reference.reference
    );

    if (refIndex !== -1) {
      const dayEntry = updatedPlanif.references[refIndex][selected.day] as DayEntry;
      if (dayEntry) {
        dayEntry.causes = { ...this.currentCauses() };
      }
      this.weekPlanification.set(updatedPlanif);
    }

    this.showSuccessMessage('Causes sauvegardées avec succès');
    this.closeCausesModal();
  }

  getSelectedC(): number {
    const selected = this.selectedEntryForCauses();
    if (!selected) return 0;
    return selected.entry.c;
  }

  getSelectedDP(): number {
    const selected = this.selectedEntryForCauses();
    if (!selected) return 0;
    return selected.entry.dp;
  }

  // Gestion du scroll
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
    const x = event.touches[0].pageX;
    const walk = (x - this.touchStartX) * 2;
    wrapper.scrollLeft = this.scrollLeftStart - walk;

    this.updateScrollState(wrapper);
  }

  onTouchEnd(): void {
    this.isTouchScrolling = false;
    const wrapper = this.scrollWrapper.nativeElement;
    wrapper.style.cursor = 'grab';
  }

  private updateScrollState(wrapper: HTMLElement): void {
    const scrollLeft = wrapper.scrollLeft;
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;

    this.isScrolled.set(scrollLeft > 10);
    this.isScrolledEnd.set(scrollLeft >= maxScroll - 10);
    this.isScrollable.set(wrapper.scrollWidth > wrapper.clientWidth);
  }

  scrollToStart(): void {
    if (this.scrollWrapper?.nativeElement) {
      this.scrollWrapper.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  hideScrollIndicator(): void {
    this.showScrollIndicator.set(false);
  }

  onFirstScroll(): void {
    this.hideScrollIndicator();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.scrollWrapper?.nativeElement) {
        const wrapper = this.scrollWrapper.nativeElement;
        this.updateScrollState(wrapper);
      }
    }, 100);
  }

  handleImageError(event: Event, line: ProductionLine): void {
    const img = event.target as HTMLImageElement;
    img.src = this.getDefaultImageUrl(line.ligne);
  }
  getOfForReference(ref: ReferenceProduction): string {
    // Chercher l'OF dans tous les jours, retourner le premier trouvé
    for (const day of this.weekDays) {
      const entry = ref[day] as DayEntry;
      if (entry && entry.of) {
        return entry.of;
      }
    }
    return '';
  }
  updateOfForAllDays(ref: ReferenceProduction, newOf: string): void {
    if (this.weekPlanification()) {
      const updatedPlanif = { ...this.weekPlanification()! };
      const refIndex = updatedPlanif.references.findIndex(r => r.reference === ref.reference);

      if (refIndex !== -1) {
        // Mettre à jour l'OF pour TOUS les jours
        this.weekDays.forEach(day => {
          const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
          if (dayEntry) {
            dayEntry.of = newOf;
          }
        });

        this.weekPlanification.set(updatedPlanif);
      }
    }
  }
  getTotalCForReference(ref: ReferenceProduction): number {
    let total = 0;

    this.weekDays.forEach(day => {
      const entry = this.getDayEntry(ref, day);
      if (entry && entry.c) {
        total += entry.c;
      }
    });

    return total;
  }
  getAverageDeltaForReference(ref: ReferenceProduction): number {
    let totalDelta = 0;
    let daysWithData = 0;

    this.weekDays.forEach(day => {
      const entry = this.getDayEntry(ref, day);
      if (entry && entry.c > 0) { // Uniquement les jours avec des données
        totalDelta += entry.delta || 0;
        daysWithData++;
      }
    });

    return daysWithData > 0 ? Math.round(totalDelta / daysWithData) : 0;
  }
  getTotalOfAllC(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || !planif.references) return 0;

    let total = 0;

    // Somme de tous les C de toutes les références
    planif.references.forEach(ref => {
      total += this.getTotalCForReference(ref);
    });

    return total;
  }
  getTotalDPForReference(ref: ReferenceProduction): number {
    let total = 0;
    this.weekDays.forEach(day => {
      const entry = this.getDayEntry(ref, day);
      if (entry && entry.dp) {
        total += entry.dp;
      }
    });
    return total;
  }

  // Total DM pour une référence
  getTotalDMForReference(ref: ReferenceProduction): number {
    let total = 0;
    this.weekDays.forEach(day => {
      const entry = this.getDayEntry(ref, day);
      if (entry && entry.dm) {
        total += entry.dm;
      }
    });
    return total;
  }

  // Delta global pour une référence : (DP total / C total) * 100
  getGlobalDeltaForReference(ref: ReferenceProduction): number {
    const totalC = this.getTotalCForReference(ref);
    const totalDP = this.getTotalDPForReference(ref);

    if (totalC === 0) return 0;
    return Math.round((totalDP / totalC) * 100);
  }

  // Total général de toutes les références (pour l'en-tête)


  getTotalOfAllDP(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || !planif.references) return 0;

    let total = 0;
    planif.references.forEach(ref => {
      total += this.getTotalDPForReference(ref);
    });
    return total;
  }

  getTotalOfAllDM(): number {
    const planif = this.filteredWeekPlanification();
    if (!planif || !planif.references) return 0;

    let total = 0;
    planif.references.forEach(ref => {
      total += this.getTotalDMForReference(ref);
    });
    return total;
  }


}