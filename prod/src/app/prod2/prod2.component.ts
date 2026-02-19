// prod2.component.ts - VERSION COMPLÈTE
import { Component, signal, computed, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService,WeekInfo } from '../prod/semaine.service';
import { ProductService , ProductLine } from '../prod/product.service';
import { NonConfService } from './non-conf.service';
import { SaisieRapportService } from './saisie-rapport.service';
import { OuvrierService } from '../prod/ouvrier.service';
import { PhaseService } from '../prod/phase.service';
import { MatierePremierService } from '../prod2/matiere-premier.service';
import { AuthService } from '../login/auth.service';
import { HostListener } from '@angular/core';
import { CommentaireService } from './commentaire.service';



// Interfaces
interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
}

interface MatierePremiere {
  reference: string;
  quantite: number;
}

interface Causes5M {
  m1MatierePremiere: number;
  m1References: MatierePremiere[];
  m2Absence: number;
  matriculesAbsence: string[];
  m2Rendement: number;
  matriculesRendement: string[];
  m3Methode: number;
  m4Maintenance: number;
  phasesMaintenance: string[];
  m5Qualite: number;
  qualiteReferences: { reference: string; quantite: number }[];
   m6Environnement: number; 
}

interface RecordForEdit {
  matricule: string;
  nomPrenom: string;
  semaine: string;
  jour: string;
  ligne: string;
  phases: WorkPhase[];
  totalHeures: number;
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

interface Operator {
  matricule: string; // Format: "1001" ou "EMP001"
  nom: string;
  prenom: string;
  selected?: boolean;
  nomPrenom?: string; // Optionnel: nom complet
}

interface WorkPhase {
  phase: string;
  heures: number;
  ligne?: string;
}

interface ProductionRecord {
  id: string;
  matricule: string;
  nomPrenom: string;
  date: string;
  ligne1: string;
  phasesLigne1: WorkPhase[];
  ligne2: string;
  phasesLigne2: WorkPhase[];
  totalHeures: number;
}

interface OperatorFormData {
  matricule: string;
  nomPrenom: string;
  ligne1: string;
  phases: string[]; // Tableau de 3 phases max
  heuresPhases: number[]; // Tableau des heures par phase
  totalHeures: number;
}

interface PhaseHeure {
  phase: string;
  heures: number;
}

@Component({
  selector: 'app-prod2',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './prod2.component.html',
  styleUrls: ['./prod2.component.css']
})
export class Prod2Component implements AfterViewInit, OnInit {
  @ViewChild('scrollWrapper') scrollWrapper!: ElementRef;
  @ViewChild('tableContainer') tableContainer!: ElementRef;

  // Signals
  sidebarVisible = signal(false);
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
  currentMPReference = signal<string>('');
  currentMPQuantite = signal<number>(0);
  availableWeeksSignal = signal<WeekInfo[]>([]);
  

  selectedRecordForEdit = signal<RecordForEdit | null>(null);
  showEditForm = signal<boolean>(false);
  editMode = signal<'view' | 'edit'>('view');

  // Modal des causes
  showCausesModal = signal(false);
  // 🔒 true = le modal a été ouvert automatiquement après sauvegarde → on ne peut pas le fermer tant que l'écart n'est pas justifié
  causesModalForcee = signal(false);
  // Liste des écarts restants à justifier après sauvegarde (on les traite un par un)
  ecartsEnAttente = signal<{ reference: ReferenceProduction; jour: string }[]>([]);

  selectedEntryForCauses = signal<{
    reference: ReferenceProduction;
    day: string;
    entry: DayEntry;
  } | null>(null);
  
 currentCauses = signal<Causes5M>({
  m1MatierePremiere: 0,
  m1References: [],
  m2Absence: 0,
matriculesAbsence: [],
  m2Rendement: 0,
matriculesRendement: [],
  m3Methode: 0,
  m4Maintenance: 0,
  phasesMaintenance: [], // 🆕 Ajouter les phases de maintenance
  m5Qualite: 0,
  qualiteReferences: [],
  m6Environnement: 0 // Ajoutez cette ligne
});

  // Modal des références MP
  matieresPremieres = signal<any[]>([]);
filteredMPRefs = signal<string[]>([]);
searchMPQuery = signal('');
showMPSuggestions = signal(false);

  // Modal de production
  showProductionForm = signal(false);
  selectedDayForProduction = signal<string>('');
  productionRecords = signal<ProductionRecord[]>([]);
  currentDate = signal<string>('');
  searchRecordQuery = signal('');

  // Opérateurs
  operators = signal<Operator[]>([]);
  operatorsFormData = signal<Map<string, OperatorFormData>>(new Map());
  availablePhases = signal<string[]>([]);
  selectedMatricules = signal<string[]>([]);
  filteredOperatorsForSelection = signal<Operator[]>([]);

  // Panneaux
  showRecordsPanel = signal<boolean>(false);
  showRecordsDetails = signal<boolean>(false);
  selectedRecordForDetails = signal<ProductionRecord | null>(null);

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
    private nonConfService: NonConfService,
    private saisieRapportService: SaisieRapportService,
    private ouvrierService: OuvrierService, // AJOUTER
    private phaseService: PhaseService ,
     private authService: AuthService,
    private matierePremierService: MatierePremierService  ,
    private commentaireService: CommentaireService 
  ) {
    this.generateParticles();
  }

 ngOnInit(): void {
  this.loadProductionLines();
  this.loadAvailableOperators();
  this.loadExistingProductionRecords();
  
  // Initialiser la sidebar selon le type d'appareil
  if (this.isTabletOrMobile()) {
    this.sidebarVisible.set(false);
  } else {
    this.sidebarVisible.set(true);
  }

  // ✅ NOUVEAU: Afficher les permissions de l'utilisateur
  if (this.authService.isUser()) {
    const matricule = this.getUserMatricule();
    console.log('👤 Chef secteur connecté - Matricule:', matricule);
    
    if (this.canEditDP() && !this.canEditDM()) {
      console.log('✏️ Permissions: Modification de DP uniquement');
    } else if (this.canEditDM() && !this.canEditDP()) {
      console.log('✏️ Permissions: Modification de DM uniquement (matricule spécial)');
    }
  }

  // Écouter les changements de taille d'écran
  window.addEventListener('resize', () => {
    if (!this.isTabletOrMobile() && !this.sidebarVisible()) {
      this.sidebarVisible.set(true);
    } else if (this.isTabletOrMobile()) {
      this.sidebarVisible.set(false);
    }
  });
}

// Méthode pour fermer la sidebar via overlay
closeSidebarOverlay(): void {
  if (this.isTabletOrMobile()) {
    this.sidebarVisible.set(false);
  }
}

  // ==================== INITIALISATION ====================

  private generateParticles(): void {
    const particles = Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 6 + 2}px`,
      animationDelay: `${Math.random() * 10}s`,
      opacity: `${Math.random() * 0.3 + 0.1}`
    }));
    this.particles.set(particles);
  }
  private getImageUrl(productLine: ProductLine): string {
  if (productLine.imageUrl) {
    return this.productService.getImageUrl(productLine.imageUrl);
  }
  return this.getDefaultImageUrl(productLine.ligne);
}
handleImageError(event: Event, line: ProductionLine): void {
  const img = event.target as HTMLImageElement;
  img.src = this.getDefaultImageUrl(line.ligne);
}

private loadProductionLines(): void {
  this.loading.set(true);
  
  this.productService.getAllLines().subscribe({
    next: (response) => {
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
        
        // ✅ TRI CORRECT : Tri alphanumérique basé sur le numéro après "L"
        const sortedLines = this.sortLinesByNumber(lines);
        
        this.availableLines.set(sortedLines);
      } else {
        this.loadMockProductionLines();
      }
      this.loading.set(false);
    },
    error: (error) => {
      console.error('Erreur chargement lignes:', error);
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
  // Méthode pour charger les matières premières par ligne
private loadMatieresPremieres(ligne: string): void {
  this.loading.set(true);
  
  this.matierePremierService.findByLigne(ligne).subscribe({
    next: (response: any) => {
      console.log('Matieres premières chargées pour', ligne, ':', response);
      
      let mpList: string[] = [];
      
      if (Array.isArray(response)) {
        mpList = response.map((mp: any) => {
          if (typeof mp === 'string') {
            return mp;
          } else if (mp.refMatierePremier) {
            return mp.refMatierePremier;
          } else if (mp.reference) {
            return mp.reference;
          }
          return '';
        }).filter((ref: string) => ref !== '');
      } else if (response && Array.isArray(response.data)) {
        mpList = response.data.map((mp: any) => mp.refMatierePremier || mp.reference).filter(Boolean);
      }
      
      console.log('Références MP extraites:', mpList);
      
      if (mpList.length === 0) {
        // Références par défaut
        const defaultMPRefs: { [key: string]: string[] } = {
          'L04:RXT1': ['8', '16', '60', '75', '110', '136', '212', '264', '344', '360', '377', '404'],
          'L07:COM A1': ['COM001', 'COM002', 'COM003', 'COM004'],
          'L09:COMXT2': ['COM101', 'COM102', 'COM103'],
          'L10:RS3': ['RS001', 'RS002', 'RS003'],
          'L14:CD XT1': ['CD001', 'CD002', 'CD003'],
          'L15:MTSA3': ['MT001', 'MT002', 'MT003'],
          'L42:RA1': ['RA001', 'RA002', 'RA003']
        };
        
        mpList = defaultMPRefs[ligne] || [
          '8', '16', '60', '75', '110', '136', '212', '264', '344', '360', '377', '404'
        ];
      }
      
      this.matieresPremieres.set(mpList);
      this.filteredMPRefs.set(mpList);
      this.loading.set(false);
    },
    
      
     
    
  });
}

// Méthode pour filtrer les références MP
filterMPRefs(query: string): void {
  this.searchMPQuery.set(query);
  
  const allRefs = this.matieresPremieres();
  if (!query.trim()) {
    this.filteredMPRefs.set(allRefs);
    this.showMPSuggestions.set(false);
    return;
  }
  
  const filtered = allRefs.filter(ref => 
    ref.toLowerCase().includes(query.toLowerCase())
  );
  
  this.filteredMPRefs.set(filtered);
  this.showMPSuggestions.set(filtered.length > 0);
}

onSearchMPChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  this.currentMPSearchQuery.set(value);
  this.filterMPRefs(value);
}

// Méthode pour sélectionner une référence MP depuis les suggestions
selectMPReference(ref: string): void {
  this.currentMPReference.set(ref);
  this.searchMPQuery.set('');
  this.showMPSuggestions.set(false);
  this.filteredMPRefs.set(this.matieresPremieres());
  
  // Focus sur le champ quantité après sélection
  setTimeout(() => {
    const quantiteInput = document.querySelector('.mp-quantite-input') as HTMLInputElement;
    if (quantiteInput) {
      quantiteInput.focus();
      quantiteInput.select();
    }
  }, 100);
}

// Méthode pour fermer les suggestions
closeMPSuggestions(): void {
  setTimeout(() => {
    this.showMPSuggestions.set(false);
  }, 200);
}

  private loadMockProductionLines(): void {
    const lines: ProductionLine[] = [
      {
        ligne: 'L04:RXT1',
        referenceCount: 13,
        imageUrl: 'assets/images/unnamed.jpg',
        references: ['RA5246801', 'RA5246802', 'RA5246803'],
        isActive: true
      },
      {
        ligne: 'L07:COM A1',
        referenceCount: 4,
        imageUrl: 'assets/images/unnamed (1).jpg',
        references: ['COM001', 'COM002', 'COM003', 'COM004'],
        isActive: true
      }
    ];
    this.availableLines.set(lines);
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

  private loadAvailableOperators(): void {
  this.loading.set(true);
  
  this.ouvrierService.findAll().subscribe({
    next: (ouvriers: any) => {
      console.log('Ouvriers chargés depuis API:', ouvriers);
      
      // Transformer les données d'ouvrier en format Operator
      const operators: Operator[] = ouvriers.map((ouvrier: any) => {
        // Extraire nom et prénom du champ nomPrenom
        let nom = '';
        let prenom = '';
        
        if (ouvrier.nomPrenom) {
          const parts = ouvrier.nomPrenom.split(' ');
          if (parts.length >= 2) {
            nom = parts[0]; // Premier mot = nom
            prenom = parts.slice(1).join(' '); // Reste = prénom
          } else {
            nom = ouvrier.nomPrenom;
          }
        }
        
        return {
          matricule: ouvrier.matricule.toString(),
          nom: nom,
          prenom: prenom,
          selected: false
        };
      });
      
      this.operators.set(operators);
      this.updateFilteredOperators();
      this.loading.set(false);
    },
    
  });
}

  private loadExistingProductionRecords(): void {
    // Charger les rapports existants depuis l'API
    // Pour l'instant, on charge des données mockées
    const sampleRecords: ProductionRecord[] = [
      {
        id: '1',
        matricule: 'EMP001',
        nomPrenom: 'DUPONT Jean',
        date: new Date().toLocaleDateString('fr-FR'),
        ligne1: 'L04:RXT1',
        phasesLigne1: [{ phase: '4101', heures: 4, ligne: 'L04:RXT1' }],
        ligne2: '',
        phasesLigne2: [],
        totalHeures: 4
      }
    ];
    this.productionRecords.set(sampleRecords);
  }

  // ==================== FILTRES ====================

  filteredLines = computed(() => {
    const query = this.searchLineQuery().toLowerCase();
    if (!query) return this.availableLines();
    return this.availableLines().filter(line => 
      line.ligne.toLowerCase().includes(query)
    );
  });

 filteredWeekPlanification = computed(() => {
  const planif = this.weekPlanification();
  const query = this.searchReferenceQuery().toLowerCase();
  
  if (!planif) return planif;
  
  // Étape 1 : Filtrer les références qui ont au moins un OF non vide
  let filteredReferences = planif.references.filter(ref => {
    // Vérifier si au moins un jour a un OF valide (non null et non vide)
    return this.weekDays.some(day => {
      const dayEntry = ref[day] as DayEntry;
      return dayEntry && dayEntry.of && dayEntry.of.trim() !== '';
    });
  });
  
  // Étape 2 : Appliquer le filtre de recherche par référence si une query existe
  if (query) {
    filteredReferences = filteredReferences.filter(ref => 
      ref.reference.toLowerCase().includes(query)
    );
  }
  
  return {
    ...planif,
    references: filteredReferences
  };
});

  filteredProductionRecords = computed(() => {
    const records = this.productionRecords();
    const query = this.searchRecordQuery().toLowerCase();
    const currentDate = this.currentDate();
    
    if (!query) {
      return records.filter(record => record.date === currentDate);
    }
    
    return records.filter(record => 
      record.date === currentDate && 
      (record.matricule.toLowerCase().includes(query) ||
       record.nomPrenom.toLowerCase().includes(query) ||
       record.ligne1.toLowerCase().includes(query))
    );
  });

  // ==================== SEMAINES ====================

  private loadAvailableWeeks(): void {
    this.loading.set(true);
    
    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        let semainesArray: any[] = [];
        
        if (response && response.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        }
        
        const weeks: WeekInfo[] = [];
        
        semainesArray.forEach((semaine: any) => {
          let weekNumber = 0;
          if (semaine.nom && typeof semaine.nom === 'string') {
            const match = semaine.nom.match(/semaine(\d+)/i);
            if (match && match[1]) {
              weekNumber = parseInt(match[1], 10);
            }
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
        
        weeks.sort((a, b) => b.number - a.number);
        this.availableWeeksSignal.set(weeks);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement semaines:', error);
        this.availableWeeksSignal.set([]);
        this.loading.set(false);
      }
    });
  }

  getAvailableWeeks(): WeekInfo[] {
    return this.availableWeeksSignal();
  }

  // ==================== SÉLECTION LIGNE/SEMAINE ====================

 toggleSidebar(): void {
  console.log('Bouton toggle cliqué. État actuel:', this.sidebarVisible());
  const newState = !this.sidebarVisible();
  this.sidebarVisible.set(newState);
  console.log('Nouvel état sidebar:', newState);
}
onLigneSelected(line: ProductionLine): void {
  console.log('Line selected:', line.ligne);
  
  // Réinitialiser les phases et données avant de charger la nouvelle ligne
  this.selectedLigne.set(line);
  this.selectedWeek.set(null);
  this.weekPlanification.set(null);
  this.isEditing.set(false);
  this.selectedReferenceDetails.set(null);
  
  // Ouvrir la sidebar automatiquement sur desktop
  if (!this.isTabletOrMobile()) {
    this.sidebarVisible.set(true);
  } else {
    // Sur mobile/tablette, la sidebar reste fermée
    this.sidebarVisible.set(false);
  }
  
  // Charger les phases
  this.loadAvailablePhases(line.ligne);
  
  // Charger les semaines disponibles
  this.loadAvailableWeeks();
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
  isTabletOrMobile(): boolean {
  // Vérifie si c'est un appareil tactile ou si la largeur est inférieure à 1024px
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) || window.innerWidth < 1024;
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

  // ==================== CHARGEMENT PLANIFICATION ====================

  private loadWeekPlanificationFromAPI(semaineNom: string, line: ProductionLine): void {
    this.loading.set(true);
    
    this.semaineService.getPlanificationsForWeek(semaineNom).subscribe({
      next: (response) => {
        const planificationsLigne = response.planifications?.filter(
          (p: any) => p.ligne === line.ligne
        ) || [];
        
        const references: ReferenceProduction[] = [];
        const refsMap = new Map<string, ReferenceProduction>();
        
        line.references.forEach(reference => {
          refsMap.set(reference, {
            reference: reference,
            ligne: line.ligne
          });
        });
        
        const ofByReference = new Map<string, string>();
        planificationsLigne.forEach((plan: any) => {
          if (plan.of && !ofByReference.has(plan.reference)) {
            ofByReference.set(plan.reference, plan.of);
          }
        });
        
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
          }
        });
        
        refsMap.forEach((refObj) => {
          const ofForThisRef = ofByReference.get(refObj.reference) || '';
          this.weekDays.forEach(day => {
            if (!refObj[day]) {
              refObj[day] = {
                of: ofForThisRef,
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
          references
        });
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement planifications:', error);
        this.createEmptyPlanifications(line);
        this.loading.set(false);
      }
    });
  }

  private getWeekDates(year: number, weekNumber: number): WeekInfo {
    return this.semaineService.getWeekDates(year, weekNumber);
  }

  private createEmptyPlanifications(line: ProductionLine): void {
    const references = line.references.map((reference) => {
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
    
    const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);
    
    this.weekPlanification.set({
      weekNumber: this.selectedWeek() || 0,
      ligne: line.ligne,
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
      references
    });
  }

  // ==================== MODIFICATION PLANIFICATION ====================

toggleEditMode(): void {
  const currentEditingState = this.isEditing();
  
  if (!currentEditingState) {
    console.log('📝 Mode édition activé');
    this.isEditing.set(true);
  } else {
    this.checkDPIncoherences();
    
    if (this.hasIncoherences()) {
      // Afficher l'erreur et NE PAS sauvegarder
      alert(this.errorMessage());
      return; // ⛔ Bloquer la sauvegarde
    }
    
    // 2. Si pas d'incohérences, sauvegarder
    console.log('💾 Enregistrement des modifications...');
    this.sauvegarderPlanifications();
    
    // 3. Chercher les écarts DP < C sans causes
    setTimeout(() => {
      this.ouvrirModalEcartsSequentiels();
    }, 1200); 
  }
}

/**
 * 🔒 Détecte tous les écarts DP < C sans causes enregistrées,
 *    met la liste dans ecartsEnAttente, puis ouvre le modal forcé sur le premier.
 */
private ouvrirModalEcartsSequentiels(): void {
  const planif = this.weekPlanification();
  if (!planif) return;

  const ecarts: { reference: ReferenceProduction; jour: string }[] = [];

  planif.references.forEach(ref => {
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry;
      if (entry && entry.c > 0 && entry.dp > 0 && entry.dp < entry.c && !entry.causes) {
        ecarts.push({ reference: ref, jour: day });
      }
    });
  });

  if (ecarts.length === 0) {
    // Pas d'écart → rien à faire
    return;
  }

  // On garde tous les écarts en file
  this.ecartsEnAttente.set(ecarts);

  // On ouvre le modal forcé sur le PREMIER écart
  const premier = ecarts[0];
  this.causesModalForcee.set(true);
  this.openCausesModal(premier.reference, premier.jour);
}

// Méthode pour sauvegarder les planifications
private sauvegarderPlanifications(): void {
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
  
  // Préparer les données à sauvegarder
  const planificationsToSave: any[] = [];
  let modificationsDP = 0;
  let modificationsDM = 0;
  
  // Collecter toutes les modifications
  planif.references.forEach((ref) => {
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry;
      if (entry) {
        const planificationData = this.semaineService.formatWeekForAPI({
          semaine: semaineNom,
          jour: day,
          ligne: ligne,
          reference: ref.reference,
          nbOperateurs: entry.nbOperateurs || 0,
          of: entry.of || '',
          qtePlanifiee: entry.c || 0,
          qteModifiee: entry.m || 0,
          decProduction: entry.dp || 0,
          decMagasin: entry.dm || 0,
          pcsProd: entry.delta || 0
        });
        
        // Compter les modifications
        if (entry.dp !== 0) modificationsDP++;
        if (entry.dm !== 0) modificationsDM++;
        
        planificationsToSave.push(planificationData);
      }
    });
  });
  
  if (planificationsToSave.length === 0) {
    this.showSuccessMessage('Aucune donnée à sauvegarder');
    return;
  }
  
  console.log(`💾 Sauvegarde de ${planificationsToSave.length} entrées...`);
  console.log(`   Modifications DP: ${modificationsDP}`);
  console.log(`   Modifications DM: ${modificationsDM}`);
  
  this.showSuccessMessage(`Sauvegarde en cours... (${planificationsToSave.length} entrées)`);
  
  // Sauvegarder chaque entrée via l'API
  const savePromises = planificationsToSave.map((planData) => {
    return new Promise<void>((resolve, reject) => {
      this.semaineService.updateProductionPlanification(planData).subscribe({
        next: (response) => {
          console.log(`✅ Sauvegardé: ${planData.reference} - ${planData.jour}`, response);
          resolve();
        },
        error: (error) => {
          console.error(`❌ Erreur: ${planData.reference} - ${planData.jour}`, error);
          
          // Gérer les erreurs spécifiques
          let errorMsg = `Erreur pour ${planData.reference}`;
          if (error.status === 404) {
            errorMsg += ' : Non trouvé';
          } else if (error.status === 401) {
            errorMsg += ' : Non autorisé';
          }
          
          reject(new Error(errorMsg));
        }
      });
    });
  });
  
  // Exécuter toutes les sauvegardes
  Promise.all(savePromises.map(p => p.catch(e => e)))
    .then(results => {
      const successful = results.filter(r => !(r instanceof Error)).length;
      const errors = results.filter(r => r instanceof Error).length;
      
      if (errors === 0) {
        this.showSuccessMessage(`${successful} modifications enregistrées avec succès`);
        // Désactiver le mode édition après sauvegarde réussie
        this.isEditing.set(false);
      } else {
        this.showSuccessMessage(`${successful} réussies, ${errors} erreurs`);
      }
    })
    .catch((error) => {
      console.error('Erreur générale de sauvegarde:', error);
      this.showSuccessMessage('Erreur lors de la sauvegarde');
    });
}


detecterEcartsDP(): {reference: string, jour: string, c: number, dp: number, delta: number}[] {
  const planif = this.weekPlanification();
  if (!planif) return [];
  
  const ecarts: any[] = [];
  
  planif.references.forEach(ref => {
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry;
      if (entry && entry.c > 0 && entry.dp > 0 && entry.c > entry.dp) {
        const delta = entry.c - entry.dp;
        if (delta > 0) {
          ecarts.push({
            reference: ref.reference,
            jour: day,
            c: entry.c,
            dp: entry.dp,
            delta: delta
          });
        }
      }
    });
  });
  
  return ecarts;
}

// Notification après sauvegarde
notifierEcartsApresSauvegarde(ecarts: any[]): void {
  const totalEcarts = ecarts.length;
  const premiereReference = ecarts[0];
  
  // Afficher un message avec option d'analyse
  const message = `
    ⚠️ ${totalEcarts} écart(s) DP < C détecté(s)
    
    Exemple: ${premiereReference.reference} - ${premiereReference.jour}
    C: ${premiereReference.c} | DP: ${premiereReference.dp}
    Écart: ${premiereReference.delta}
    
    Souhaitez-vous analyser ces écarts maintenant ?
  `;
  
  const analyser = confirm(message);
  
  if (analyser) {
    // Ouvrir le modal d'analyse
    const planif = this.weekPlanification();
    if (planif) {
      const ref = planif.references.find(r => r.reference === premiereReference.reference);
      if (ref) {
        this.openCausesModal(ref, premiereReference.jour);
      }
    }
  } else {
    // Afficher un rappel
    this.showSuccessMessage(`⚠️ ${totalEcarts} écart(s) non analysé(s). Pensez à les justifier plus tard.`);
  }
}

// Dans prod2.component.ts - modifier updateDayEntry
updateDayEntry(reference: ReferenceProduction, day: string, field: string, value: any): void {
  // 🎯 VÉRIFICATION DES PERMISSIONS
  if (field === 'dp' && !this.canEditDP()) {
    console.warn('⚠️ Vous n\'avez pas la permission de modifier DP');
    this.showSuccessMessage('⚠️ Seuls les chefs secteurs normaux peuvent modifier DP');
    return;
  }
  
  if (field === 'dm' && !this.canEditDM()) {
    console.warn('⚠️ Vous n\'avez pas la permission de modifier DM');
    this.showSuccessMessage('⚠️ Seul le matricule 2603 peut modifier DM');
    return;
  }
  if (field === 'dp' || field === 'c') {
    // Vérifier les incohérences après modification
    setTimeout(() => {
      this.checkDPIncoherences();
    }, 100);
  }
  
  if (this.weekPlanification()) {
    const updatedPlanif = { ...this.weekPlanification()! };
    const refIndex = updatedPlanif.references.findIndex(r => r.reference === reference.reference);
    
    if (refIndex !== -1) {
      const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
      if (dayEntry) {
        if (field === 'of') {
          dayEntry.of = value;
          this.weekDays.forEach(otherDay => {
            const otherDayEntry = updatedPlanif.references[refIndex][otherDay] as DayEntry;
            if (otherDayEntry) {
              otherDayEntry.of = value;
            }
          });
        } else {
          const numValue = +value || 0;
          
          // Mettre à jour le champ spécifique
          (dayEntry as any)[field] = numValue;
          
          // Recalculer Delta si nécessaire
          if (field === 'c' || field === 'm' || field === 'dp') {
            const quantiteSource = dayEntry.m > 0 ? dayEntry.m : dayEntry.c;
            dayEntry.delta = quantiteSource > 0 ? 
              Math.round((dayEntry.dp / quantiteSource) * 100) : 0;
          }
          
          // ✅ SAUVEGARDE AUTOMATIQUE POUR DM (si permission)
          if (field === 'dm' && this.canEditDM()) {
            console.log('✅ Sauvegarde automatique du champ DM:', {
              reference: reference.reference,
              jour: day,
              valeur: numValue,
              matricule: this.getUserMatricule()
            });
            
            // Mettre à jour l'état local d'abord
            this.weekPlanification.set(updatedPlanif);
            
            // Sauvegarder cette modification spécifique via l'API magasin
            this.saveSingleMagasinDeclaration(reference.reference, day, dayEntry);
            return; // Sortir pour éviter de mettre à jour deux fois
          }
        }
      }
      this.weekPlanification.set(updatedPlanif);
    }
  }
}

// Dans prod2.component.ts
private saveSingleMagasinDeclaration(reference: string, day: string, entry: DayEntry): void {
  if (!this.semaineService.isAuthenticated()) {
    this.showSuccessMessage('Vous devez être connecté pour sauvegarder');
    return;
  }

  const planif = this.weekPlanification();
  if (!planif) return;

  const dmData = {
    semaine: `semaine${planif.weekNumber}`,
    jour: day,
    ligne: planif.ligne,
    reference: reference,
    decMagasin: entry.dm
  };

  console.log('Envoi DM unique:', dmData);
  
  this.semaineService.updateMagasinPlanification(dmData).subscribe({
    next: (response) => {
      console.log('DM sauvegardé avec succès:', response);
      this.showSuccessMessage('Déclaration Magasin enregistrée');
    },
    error: (error) => {
      console.error('Erreur sauvegarde DM:', error);
      
      let errorMessage = 'Erreur lors de la sauvegarde DM: ';
      if (error.error?.message) {
        errorMessage += error.error.message;
      } else if (error.status === 404) {
        errorMessage += 'Planification non trouvée';
      } else {
        errorMessage += 'Erreur serveur';
      }
      
      this.showSuccessMessage(errorMessage);
    }
  });
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
        }
      });
    });
    
    if (planificationsToSave.length === 0) {
      this.showSuccessMessage('Aucune donnée à sauvegarder');
      return;
    }
    
    this.showSuccessMessage(`Sauvegarde de ${planificationsToSave.length} modifications...`);
    
    const savePromises = planificationsToSave.map((planData) => {
      return new Promise<void>((resolve, reject) => {
        this.semaineService.updateProductionPlanification(planData).subscribe({
          next: () => resolve(),
          error: (error) => reject(error)
        });
      });
    });
    
    Promise.all(savePromises.map(p => p.catch(e => e)))
      .then(results => {
        const successful = results.filter(r => !(r instanceof Error)).length;
        this.showSuccessMessage(`${successful} modifications enregistrées`);
      })
      .catch(() => {
        this.showSuccessMessage('Erreur lors de la sauvegarde');
      });
  }

  // ==================== RAPPORTS DE PRODUCTION ====================

  onPersonIconClick(day: string): void {
  console.log('Opening production form for day:', day);
  
  const currentLine = this.selectedLigne();
  if (!currentLine) {
    alert('Veuillez sélectionner une ligne d\'abord');
    return;
  }
  
  // Vérifier que les phases sont chargées
  if (this.availablePhases().length === 0) {
    console.log('Phases non chargées, chargement en cours...');
    this.loadAvailablePhases(currentLine.ligne);
    
    // Attendre un peu pour le chargement
    setTimeout(() => {
      this.openProductionForm(day);
    }, 500);
  } else {
    this.openProductionForm(day);
  }
}
// Remplacez la méthode openProductionForm par cette version
private openProductionForm(day: string): void {
  console.log(`Ouverture formulaire production pour: ${day}`);
  
  const currentLine = this.selectedLigne();
  if (!currentLine) {
    alert('Veuillez sélectionner une ligne d\'abord');
    return;
  }

  // Calculer et afficher la date CORRECTE
  const correctDate = this.getCorrectDateForDay(day);
  console.log(`Date calculée: ${correctDate}`);
  this.currentDate.set(correctDate);
  
  this.selectedDayForProduction.set(day);
  this.showProductionForm.set(true);
  this.showRecordsPanel.set(false);
  
  this.selectedMatricules.set([]);
  this.searchRecordQuery.set('');
  this.updateFilteredOperators();
  this.loadExistingRapportsForDay(day);
  
  // Charger les phases pour la ligne
  console.log('Chargement des phases pour la ligne:', currentLine.ligne);
  this.loadAvailablePhases(currentLine.ligne);
}

// Remplacez la méthode setCorrectDate par cette version corrigée
private setCorrectDate(day: string): void {
  const planif = this.weekPlanification();
  if (!planif) {
    this.setDefaultDate(day);
    return;
  }

  const dayIndex = this.weekDays.indexOf(day);
  if (dayIndex === -1) {
    this.setDefaultDate(day);
    return;
  }

  // Obtenir la date du lundi de cette semaine
  const weekStartDate = new Date(planif.startDate);
  
  // S'assurer que startDate est bien un lundi
  // getDay(): 0 = dimanche, 1 = lundi, 2 = mardi, etc.
  const dayOfWeek = weekStartDate.getDay();
  
  // Si startDate n'est pas un lundi, ajuster
  if (dayOfWeek !== 1) {
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    weekStartDate.setDate(weekStartDate.getDate() + daysToMonday);
  }

  // Calculer la date exacte du jour sélectionné
  const exactDate = new Date(weekStartDate);
  exactDate.setDate(weekStartDate.getDate() + dayIndex);

  const formattedDate = this.formatDate(exactDate);
  console.log(`Date calculée pour ${day}: ${formattedDate} (index: ${dayIndex})`);
  this.currentDate.set(formattedDate);
}

private formatDateToFrench(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

 private setDefaultDate(day: string): void {
  const planif = this.weekPlanification();
  if (!planif) return;

  const dayIndex = this.weekDays.indexOf(day);
  
  // S'assurer que startDate est un lundi
  const startDate = new Date(planif.startDate);
  const dayOfWeek = startDate.getDay(); // 0=dimanche, 1=lundi, 2=mardi...
  
  // Si ce n'est pas un lundi, ajuster
  if (dayOfWeek !== 1) {
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + daysToMonday);
  }
  
  // Ajouter les jours
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayIndex);
  
  const formattedDate = this.formatDate(date);
  this.currentDate.set(formattedDate);
}

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private loadExistingRapportsForDay(day: string): void {
    const planif = this.weekPlanification();
    if (!planif || !this.selectedLigne()) return;

    const semaineNom = `semaine${planif.weekNumber}`;
    
    this.saisieRapportService.getRapportsBySemaineJour(semaineNom, day).subscribe({
      next: (response) => {
        console.log('Rapports existants:', response);
        // Transformer les rapports en ProductionRecord
        const records: ProductionRecord[] = response.rapports?.map((rapport: any) => {
          const phasesLigne1: WorkPhase[] = rapport.phases?.map((phase: any) => ({
            phase: phase.phase,
            heures: phase.heures,
            ligne: rapport.ligne
          })) || [];
          
          return {
            id: rapport.id.toString(),
            matricule: rapport.matricule.toString(),
            nomPrenom: rapport.nomPrenom,
            date: this.currentDate(),
            ligne1: rapport.ligne,
            phasesLigne1: phasesLigne1,
            ligne2: '',
            phasesLigne2: [],
            totalHeures: rapport.totalHeuresJour
          };
        }) || [];
        
        this.productionRecords.set(records);
      },
      error: (error) => {
        console.error('Erreur chargement rapports:', error);
      }
    });
  }

  private loadAvailablePhases(ligne: string): void {
  console.log('Chargement des phases pour la ligne:', ligne);
  
  // Vider les phases actuelles pendant le chargement
  this.availablePhases.set([]);
  
  this.phaseService.findByLigne(ligne).subscribe({
    next: (response: any) => {
      console.log('Réponse API phases pour', ligne, ':', response);
      
      let phaseList: string[] = [];
      
      // Gérer différents formats de réponse
      if (Array.isArray(response)) {
        // Format 1: Tableau direct de phases
        phaseList = response.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          } else if (phase.nom) {
            return phase.nom;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      } else if (response && Array.isArray(response.phases)) {
        // Format 2: { phases: [...] }
        phaseList = response.phases.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      } else if (response && response.data && Array.isArray(response.data)) {
        // Format 3: { data: [...] }
        phaseList = response.data.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      }
      
      console.log('Phases extraites pour', ligne, ':', phaseList);
      
      // IMPORTANT: Mettre à jour les phases disponibles
      this.availablePhases.set(phaseList);
      
      // Réinitialiser les sélections de phases pour tous les opérateurs
      if (this.operatorsFormData().size > 0) {
        const updatedFormData = new Map(this.operatorsFormData());
        updatedFormData.forEach((formData, matricule) => {
          formData.phases = ['', '', '']; // Réinitialiser les phases
          formData.heuresPhases = [0, 0, 0]; // Réinitialiser les heures
          formData.totalHeures = 0;
        });
        this.operatorsFormData.set(updatedFormData);
      }
      
      console.log('Phases disponibles mises à jour:', phaseList);
    },
    error: (error) => {
      console.error('Erreur chargement phases pour', ligne, ':', error);
      
      // Phases par défaut pour les lignes communes
      const defaultPhases: { [key: string]: string[] } = {
        'L04:RXT1': ['4101', '4102', '4103'],
        'L07:COM A1': ['5101', '5102', '5103'],
        'L09:COMXT2': ['6101', '6102', '6103'],
        'L10:RS3': ['7101', '7102', '7103'],
        'L14:CD XT1': ['8101', '8102', '8103'],
        'L15:MTSA3': ['9101', '9102', '9103'],
        'L42:RA1': ['4201', '4202', '4203']
      };
      
      const fallbackPhases = defaultPhases[ligne] || ['Phase1', 'Phase2', 'Phase3'];
      console.log('Utilisation des phases par défaut:', fallbackPhases);
      this.availablePhases.set(fallbackPhases);
    }
  });
}

  // ==================== GESTION OPÉRATEURS ====================

  updateFilteredOperators(): void {
    const query = this.searchRecordQuery().toLowerCase();
    const allOperators = this.operators();
    
    if (!query) {
      this.filteredOperatorsForSelection.set(allOperators);
      return;
    }
    
    const filtered = allOperators.filter(op => 
      op.matricule.toLowerCase().includes(query) ||
      op.nom.toLowerCase().includes(query) ||
      op.prenom.toLowerCase().includes(query)
    );
    this.filteredOperatorsForSelection.set(filtered);
  }

  toggleMatriculeSelection(matricule: string): void {
    const currentSelection = this.selectedMatricules();
    if (currentSelection.includes(matricule)) {
      this.selectedMatricules.set(currentSelection.filter(m => m !== matricule));
      const formData = this.operatorsFormData();
      formData.delete(matricule);
      this.operatorsFormData.set(new Map(formData));
    } else {
      this.selectedMatricules.set([...currentSelection, matricule]);
      this.initializeOperatorFormData(matricule);
    }
  }

  selectAllOperators(): void {
    const allMatricules = this.filteredOperatorsForSelection().map(op => op.matricule);
    this.selectedMatricules.set(allMatricules);
    allMatricules.forEach(matricule => this.initializeOperatorFormData(matricule));
  }

  deselectAllOperators(): void {
    this.selectedMatricules.set([]);
    this.operatorsFormData.set(new Map());
  }

 // Modifier la méthode initializeOperatorFormData:
initializeOperatorFormData(matricule: string): void {
  const currentLine = this.selectedLigne();
  if (!currentLine) return;

  // Trouver l'ouvrier dans la liste chargée
  const operator = this.operators().find(op => op.matricule === matricule);
  if (!operator) {
    console.error(`Ouvrier ${matricule} non trouvé`);
    return;
  }

  const currentFormData = this.operatorsFormData();
  
  if (!currentFormData.has(matricule)) {
    const newFormData = new Map(currentFormData);
    newFormData.set(matricule, {
      matricule: operator.matricule,
      nomPrenom: `${operator.nom} ${operator.prenom}`.trim(),
      ligne1: currentLine.ligne,
      phases: ['', '', ''],
      heuresPhases: [0, 0, 0],
      totalHeures: 0
    });
    this.operatorsFormData.set(newFormData);
  }
  
  // Charger les phases spécifiques à cette ligne
  this.loadAvailablePhases(currentLine.ligne);
}

  getSafeOperatorFormData(matricule: string): OperatorFormData {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) {
      return {
        matricule: matricule,
        nomPrenom: '',
        ligne1: this.selectedLigne()?.ligne || '',
        phases: ['', '', ''],
        heuresPhases: [0, 0, 0],
        totalHeures: 0
      };
    }
    return formData;
  }

  getOperatorFormData(matricule: string): OperatorFormData | undefined {
    return this.operatorsFormData().get(matricule);
  }

  updateOperatorPhaseHeures(matricule: string, phaseIndex: number, value: string): void {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) return;

    const heures = parseFloat(value) || 0;
    if (heures > 8) {
      alert('Les heures par phase ne peuvent pas dépasser 8h');
      return;
    }

    const updatedHeuresPhases = [...formData.heuresPhases];
    updatedHeuresPhases[phaseIndex] = heures;

    const totalHeures = updatedHeuresPhases.reduce((sum, heures) => sum + heures, 0);
    if (totalHeures > 8) {
      alert(`Le total des heures (${totalHeures}h) dépasse 8 heures`);
      return;
    }

    const updatedFormData: OperatorFormData = {
      ...formData,
      heuresPhases: updatedHeuresPhases,
      totalHeures: totalHeures
    };

    this.operatorsFormData().set(matricule, updatedFormData);
    this.operatorsFormData.set(new Map(this.operatorsFormData()));
  }

  getOperatorPhaseHeures(matricule: string, phaseIndex: number): number {
    const formData = this.getOperatorFormData(matricule);
    if (!formData || !formData.heuresPhases || phaseIndex >= formData.heuresPhases.length) {
      return 0;
    }
    return formData.heuresPhases[phaseIndex];
  }

  getOperatorPhaseValue(matricule: string, phaseIndex: number): string {
    const formData = this.getOperatorFormData(matricule);
    if (!formData || phaseIndex >= formData.phases.length) return '';
    return formData.phases[phaseIndex];
  }

  updateOperatorPhase(matricule: string, phaseIndex: number, value: string): void {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) return;

    const updatedPhases = [...formData.phases];
    updatedPhases[phaseIndex] = value;

    const updatedFormData: OperatorFormData = {
      ...formData,
      phases: updatedPhases
    };

    this.operatorsFormData().set(matricule, updatedFormData);
    this.operatorsFormData.set(new Map(this.operatorsFormData()));
  }

  // ==================== SAUVEGARDE RAPPORTS ====================

 // Dans la méthode saveAllProductionRecords(), modifier la création du DTO:
// Modifiez la création du DTO dans saveAllProductionRecords()
saveAllProductionRecords(): void {
  const selectedMatricules = this.selectedMatricules();
  if (selectedMatricules.length === 0) {
    alert('Veuillez sélectionner au moins un opérateur');
    return;
  }

  const planif = this.weekPlanification();
  if (!planif || !this.selectedLigne() || !this.selectedDayForProduction()) {
    alert('Données manquantes');
    return;
  }

  const semaineNom = `semaine${planif.weekNumber}`;
  const jour = this.selectedDayForProduction();
  const ligne = this.selectedLigne()!.ligne;

  let savedCount = 0;
  let hasErrors = false;

  const savePromises = selectedMatricules.map(matricule => {
    return new Promise<void>((resolve, reject) => {
      const formData = this.getOperatorFormData(matricule);
      if (!formData || formData.totalHeures === 0) {
        console.log(`Aucune donnée pour ${matricule}`);
        resolve();
        return;
      }

      if (formData.totalHeures > 8) {
        alert(`Le total des heures pour ${formData.nomPrenom} ne peut pas dépasser 8 heures (${formData.totalHeures}h)`);
        hasErrors = true;
        reject(new Error(`Heures dépassées pour ${matricule}`));
        return;
      }

      const phases: PhaseHeure[] = formData.phases
        .filter((phase, index) => phase !== '' && formData.heuresPhases[index] > 0)
        .map((phase, index) => ({
          phase: phase,
          heures: formData.heuresPhases[index]
        }));

      if (phases.length === 0) {
        console.log(`Aucune phase valide pour ${matricule}`);
        resolve();
        return;
      }

      // IMPORTANT: Convertir le matricule en nombre
      let matriculeNumber: number;
      
      if (matricule.startsWith('EMP')) {
        matriculeNumber = parseInt(matricule.replace('EMP', ''), 10);
      } else {
        matriculeNumber = parseInt(matricule, 10);
      }

      if (isNaN(matriculeNumber)) {
        console.error(`Matricule invalide: ${matricule}`);
        reject(new Error(`Matricule invalide: ${matricule}`));
        return;
      }

      // CRITIQUE: Créer le DTO SANS nomPrenom
      const dto = {
        semaine: semaineNom,
        jour: jour,
        ligne: ligne,
        matricule: matriculeNumber,  // Seulement le nombre
        phases: phases               // Seulement le tableau de phases
        // NE PAS inclure nomPrenom
      };

      console.log('Envoi du rapport:', dto);

      this.saisieRapportService.createRapport(dto).subscribe({
        next: (response) => {
          console.log(`Rapport sauvegardé pour ${matricule}:`, response);
          
          // Récupérer le nomPrenom de l'ouvrier pour l'affichage local
          const ouvrier = this.operators().find(op => op.matricule === matricule);
          const nomPrenom = ouvrier ? `${ouvrier.nom} ${ouvrier.prenom}` : formData.nomPrenom;
          
          // Ajouter au tableau local
          const newRecord: ProductionRecord = {
            id: Date.now().toString() + savedCount,
            matricule: matricule,
            nomPrenom: nomPrenom,
            date: this.currentDate(),
            ligne1: ligne,
            phasesLigne1: phases.map(p => ({ 
              phase: p.phase, 
              heures: p.heures,
              ligne: ligne 
            })),
            phasesLigne2: [],
            ligne2: '',
            totalHeures: formData.totalHeures
          };
          
          this.productionRecords.update(records => [newRecord, ...records]);
          savedCount++;
          resolve();
        },
        error: (error) => {
          console.error(`Erreur sauvegarde ${matricule}:`, error);
          
          const ouvrier = this.operators().find(op => op.matricule === matricule);
          const nomPrenom = ouvrier ? `${ouvrier.nom} ${ouvrier.prenom}` : formData?.nomPrenom || matricule;
          
          let errorMessage = `Erreur sauvegarde pour ${nomPrenom}: `;
          if (error.error?.message) {
            errorMessage += error.error.message;
          } else if (error.status === 404) {
            errorMessage += 'Ouvrier non trouvé dans la base de données';
          } else if (error.status === 409) {
            errorMessage += 'Un rapport existe déjà pour cet ouvrier ce jour';
          } else if (error.status === 400) {
            // Erreur de validation DTO
            if (error.error?.message?.includes('nomPrenom')) {
              errorMessage += 'Problème de format des données';
            } else {
              errorMessage += error.error?.message || 'Données invalides';
            }
          } else {
            errorMessage += 'Erreur serveur';
          }
          
          alert(errorMessage);
          reject(error);
        }
      });
    });
  });

  Promise.all(savePromises.map(p => p.catch(e => e)))
    .then(() => {
      if (hasErrors) return;
      
      if (savedCount > 0) {
        this.showSuccessMessage(`${savedCount} rapport(s) sauvegardé(s) avec succès`);
        this.closeProductionForm();
      } else {
        alert('Aucun rapport à sauvegarder');
      }
    })
    .catch(() => {
      this.showSuccessMessage('Erreurs lors de la sauvegarde');
    });
}

  closeProductionForm(): void {
    this.showProductionForm.set(false);
    this.selectedMatricules.set([]);
    this.operatorsFormData.set(new Map());
  }

  toggleRecordsPanel(): void {
  if (!this.showRecordsPanel()) {
    // Charger les rapports filtrés par ligne et jour
    this.loadFilteredRecords();
  }
  
  this.showRecordsPanel.set(!this.showRecordsPanel());
}
private loadFilteredRecords(): void {
  const planif = this.weekPlanification();
  const ligne = this.selectedLigne();
  const jour = this.selectedDayForProduction();
  
  if (!planif || !ligne || !jour) {
    console.error('Données manquantes pour charger les rapports');
    return;
  }

  const semaineNom = `semaine${planif.weekNumber}`;
  
  // Utiliser la nouvelle méthode pour filtrer
  const dto = {
    semaine: semaineNom,
    jour: jour,
    ligne: ligne.ligne
  };

  this.loading.set(true);
  
  this.saisieRapportService.voirRapportsFiltres(dto).subscribe({
    next: (response) => {
      console.log('Rapports filtrés chargés:', response);
      
      // Transformer les rapports en ProductionRecord
      const records: ProductionRecord[] = response.rapports?.map((rapport: any) => {
        const phasesLigne1: WorkPhase[] = rapport.phases?.map((phase: any) => ({
          phase: phase.phase,
          heures: phase.heures,
          ligne: rapport.ligne
        })) || [];
        
        return {
          id: rapport.id.toString(),
          matricule: rapport.matricule.toString(),
          nomPrenom: rapport.nomPrenom,
          date: this.currentDate(),
          ligne1: rapport.ligne,
          phasesLigne1: phasesLigne1,
          ligne2: '',
          phasesLigne2: [],
          totalHeures: rapport.totalHeuresJour
        };
      }) || [];
      
      this.productionRecords.set(records);
      this.loading.set(false);
    },
    error: (error) => {
      console.error('Erreur chargement rapports filtrés:', error);
      
      // Fallback: charger tous les rapports de la semaine
      this.loadExistingRapportsForDay(jour);
      this.loading.set(false);
    }
  });
}


showRecordDetails(record: ProductionRecord): void {
  console.log('Détails du rapport:', record);
  
  // Convertir le matricule en nombre si nécessaire
  let matriculeNumber: number;
  
  if (record.matricule.startsWith('EMP')) {
    matriculeNumber = parseInt(record.matricule.replace('EMP', ''), 10);
  } else {
    matriculeNumber = parseInt(record.matricule, 10);
  }
  
  if (isNaN(matriculeNumber)) {
    console.error('Matricule invalide:', record.matricule);
    return;
  }
  
  // Récupérer la semaine
  const planif = this.weekPlanification();
  if (!planif) {
    console.error('Aucune planification trouvée');
    return;
  }
  
  const semaineNom = `semaine${planif.weekNumber}`;
  const jour = record.date.split('/')[0]; // Extraire le jour depuis la date
  const ligne = record.ligne1;
  
  console.log('Critères de recherche:', { semaineNom, jour, ligne, matriculeNumber });
  
  // Récupérer les données complètes du rapport
  this.loading.set(true);
  
  this.saisieRapportService.getRapportParCriteres(semaineNom, jour, ligne, matriculeNumber).subscribe({
    next: (response) => {
      console.log('Rapport chargé pour modification:', response);
      
      const rapport = response.rapport || response;
      
      // Préparer les données pour l'édition
      const recordForEdit: RecordForEdit = {
        matricule: rapport.matricule.toString(),
        nomPrenom: rapport.nomPrenom,
        semaine: rapport.semaine,
        jour: rapport.jour,
        ligne: rapport.ligne,
        phases: rapport.phases.map((phase: any) => ({
          phase: phase.phase,
          heures: phase.heures,
          ligne: rapport.ligne
        })),
        totalHeures: rapport.totalHeuresJour
      };
      
      this.selectedRecordForEdit.set(recordForEdit);
      this.selectedRecordForDetails.set(record);
      this.showRecordsDetails.set(true);
      this.editMode.set('view');
      this.loading.set(false);
    },
    error: (error) => {
      console.error('Erreur chargement rapport:', error);
      
      // Fallback: utiliser les données locales
      const recordForEdit: RecordForEdit = {
        matricule: record.matricule,
        nomPrenom: record.nomPrenom,
        semaine: semaineNom,
        jour: this.selectedDayForProduction(),
        ligne: record.ligne1,
        phases: [...record.phasesLigne1],
        totalHeures: record.totalHeures
      };
      
      this.selectedRecordForEdit.set(recordForEdit);
      this.selectedRecordForDetails.set(record);
      this.showRecordsDetails.set(true);
      this.editMode.set('view');
      this.loading.set(false);
    }
  });
}


  // ==================== NON-CONFORMITÉS (CAUSES 5M) ====================

// Dans la méthode openCausesModal
openCausesModal(ref: ReferenceProduction, day: string): void {
  const entry = this.getDayEntry(ref, day);
  if (!entry) return;

  this.selectedEntryForCauses.set({ reference: ref, day, entry });
  
  const planif = this.weekPlanification();
  if (!planif || !this.selectedLigne()) return;

  const ligne = this.selectedLigne()!.ligne;
  
  // ========== RÉINITIALISATION COMPLÈTE ==========
  // Matière première
  this.currentMPReference.set('');
  this.currentMPQuantite.set(0);
  this.selectedMPReferences.set([]);
  this.currentMPSearchQuery.set('');
  this.showMPSuggestions.set(false);
  
  // Qualité
  this.currentQualiteReference.set('');
  this.currentQualiteQuantite.set(0);
  this.selectedQualiteReferences.set([]);
  this.currentQualiteSearchQuery.set('');
  this.showQualiteSuggestions.set(false);
  this.selectedCommentaireId.set(null);
  
  // 🆕 MATRICULES ABSENCE
  this.selectedMatriculesAbsence.set([]);
  this.currentAbsenceSearchQuery.set('');
  this.showAbsenceSuggestions.set(false);
  
  // 🆕 MATRICULES RENDEMENT
  this.selectedMatriculesRendement.set([]);
  this.currentRendementSearchQuery.set('');
  this.showRendementSuggestions.set(false);
  
  // 🆕 PHASES MAINTENANCE
  this.selectedPhasesMaintenance.set([]);
  this.currentPhasesSearchQuery.set('');
  this.showPhasesSuggestions.set(false);
  
  // Charger les données
  this.loadMatieresPremieres(ligne);
  this.loadAvailableCommentaires();

  // Vérifier si une non-conformité existe déjà
  const dto = {
    semaine: `semaine${planif.weekNumber}`,
    jour: day,
    ligne: ligne,
    reference: ref.reference
  };

  this.nonConfService.checkNonConformiteExists(dto).subscribe({
    next: (response: { exists: boolean; data?: any }) => {
      if (response.exists && response.data) {
        const details = response.data.details;
        
        // ========== CHARGER LES DONNÉES EXISTANTES ==========
        
        // Mettre à jour currentCauses
        this.currentCauses.set({
          m1MatierePremiere: details.matierePremiere || 0,
          m1References: [],
          m2Absence: details.absence || 0,
          matriculesAbsence: [], // Sera rempli après parsing
          m2Rendement: details.rendement || 0,
          matriculesRendement: [], // Sera rempli après parsing
          m3Methode: details.methode || 0,
          m4Maintenance: details.maintenance || 0,
          phasesMaintenance: [], // Sera rempli après parsing
          m5Qualite: details.qualite || 0,
          m6Environnement: details.environnement || 0,
          qualiteReferences: []
        });
        
        // Quantités
        if (details.matierePremiere > 0) {
          this.currentMPQuantite.set(details.matierePremiere);
        }
        if (details.qualite > 0) {
          this.currentQualiteQuantite.set(details.qualite);
        }
        
        // 🟠 MATRICULES ABSENCE
        if (details.matriculesAbsence) {
          console.log('Matricules absence trouvés:', details.matriculesAbsence);
          this.parseMatriculesAbsenceString(details.matriculesAbsence);
        }
        
        // 🟡 MATRICULES RENDEMENT
        if (details.matriculesRendement) {
          console.log('Matricules rendement trouvés:', details.matriculesRendement);
          this.parseMatriculesRendementString(details.matriculesRendement);
        }
        
        // 🔵 PHASES MAINTENANCE
        if (details.phasesMaintenance) {
          console.log('Phases maintenance trouvées:', details.phasesMaintenance);
          this.parsePhasesMaintenanceString(details.phasesMaintenance);
        } else if (response.data.phasesMaintenance) {
          console.log('Phases maintenance trouvées (autre niveau):', response.data.phasesMaintenance);
          this.parsePhasesMaintenanceString(response.data.phasesMaintenance);
        }
        
        // Références MP
        if (details.referenceMatierePremiere) {
          this.parseMPReferencesString(details.referenceMatierePremiere);
        }
        
        // Références Qualité
        if (details.referenceQualite) {
          this.parseQualiteReferencesString(details.referenceQualite);
        }
        
        // Commentaire
        let commentaireId = null;
        if (details.commentaire?.id) {
          commentaireId = details.commentaire.id;
        } else if (response.data.commentaireObjet?.id) {
          commentaireId = response.data.commentaireObjet.id;
        } else if (response.data.commentaireId) {
          commentaireId = response.data.commentaireId;
        }
        this.selectedCommentaireId.set(commentaireId);
        
        console.log('✅ Données chargées:', {
          mp: this.currentMPQuantite(),
          mpRefs: this.selectedMPReferences(),
          absence: details.absence,
          matriculesAbsence: this.selectedMatriculesAbsence(),
          rendement: details.rendement,
          matriculesRendement: this.selectedMatriculesRendement(),
          maintenance: details.maintenance,
          phasesMaintenance: this.selectedPhasesMaintenance(),
          qualite: details.qualite,
          qualiteRefs: this.selectedQualiteReferences(),
          environnement: details.environnement
        });
        
      } else {
        // ========== RÉINITIALISATION COMPLÈTE ==========
        this.currentCauses.set({
          m1MatierePremiere: 0,
          m1References: [],
          m2Absence: 0,
          matriculesAbsence: [],
          m2Rendement: 0,
          matriculesRendement: [],
          m3Methode: 0,
          m4Maintenance: 0,
          phasesMaintenance: [],
          m5Qualite: 0,
          m6Environnement: 0,
          qualiteReferences: []
        });
        
        this.selectedMatriculesAbsence.set([]);
        this.selectedMatriculesRendement.set([]);
        this.selectedPhasesMaintenance.set([]);
        this.selectedMPReferences.set([]);
        this.selectedQualiteReferences.set([]);
        this.selectedCommentaireId.set(null);
      }
      
      this.showCausesModal.set(true);
    },
    error: (error) => {
      console.error('❌ Erreur vérification non-conformité:', error);
      
      // Réinitialisation en cas d'erreur
      this.currentCauses.set({
        m1MatierePremiere: 0,
        m1References: [],
        m2Absence: 0,
        matriculesAbsence: [],
        m2Rendement: 0,
        matriculesRendement: [],
        m3Methode: 0,
        m4Maintenance: 0,
        phasesMaintenance: [],
        m5Qualite: 0,
        m6Environnement: 0,
        qualiteReferences: []
      });
      
      this.selectedMatriculesAbsence.set([]);
      this.selectedMatriculesRendement.set([]);
      this.selectedPhasesMaintenance.set([]);
      this.selectedMPReferences.set([]);
      this.selectedQualiteReferences.set([]);
      this.selectedCommentaireId.set(null);
      
      this.showCausesModal.set(true);
    }
  });
}
  closeCausesModal(): void {
    // 🔒 Si le modal est forcé ET l'écart n'est pas encore justifié → on bloque
    if (this.causesModalForcee() && this.getTotalCauses() !== this.getEcartCDP()) {
      this.showSuccessMessage('⚠️ Vous devez d\'abord justifier l\'écart avant de fermer');
      return;
    }

    this.showCausesModal.set(false);
    this.selectedEntryForCauses.set(null);

    // Si le modal était forcé, on passe au prochain écart en attente
    if (this.causesModalForcee()) {
      this.causesModalForcee.set(false);
      this.passerAuProchainEcart();
    }
  }

  /**
   * Retourne true si l'utilisateur peut fermer le modal (X ou Annuler).
   * Utilisé dans le template pour bloquer visuellement les boutons.
   */
  canFermerModal(): boolean {
    // Si le modal n'est pas forcé → toujours fermable
    if (!this.causesModalForcee()) return true;
    // Si forcé → seulement si l'écart est justifié
    return this.getTotalCauses() === this.getEcartCDP();
  }

  /**
   * Après avoir sauvegardé un écart, on retire cet écart de la liste
   * et on ouvre automatiquement le suivant s'il en reste un.
   */
  private passerAuProchainEcart(): void {
    const restants = this.ecartsEnAttente();
    if (restants.length <= 1) {
      // Plus d'écarts en attente
      this.ecartsEnAttente.set([]);
      return;
    }

    // Retirer le premier (celui qu'on vient de justifier)
    const suivants = restants.slice(1);
    this.ecartsEnAttente.set(suivants);

    // Ouvrir le modal forcé sur le suivant
    const prochain = suivants[0];
    this.causesModalForcee.set(true);
    this.openCausesModal(prochain.reference, prochain.jour);
  }
  incrementCauseMethode(amount: number = 100): void {
  this.currentCauses.update(causes => ({
    ...causes,
    m3Methode: (causes.m3Methode || 0) + amount
  }));
}
decrementCauseMethode(amount: number = 100): void {
  this.currentCauses.update(causes => ({
    ...causes,
    m3Methode: Math.max(0, (causes.m3Methode || 0) - amount)
  }));
}

  addMatierePremiereReference(): void {
    const reference = this.currentMPReference().trim();
    const quantite = this.currentMPQuantite();
    
    if (!reference || quantite <= 0) {
      alert('Veuillez saisir une référence valide et une quantité supérieure à 0');
      return;
    }

    this.currentCauses.update(causes => ({
      ...causes,
      m1References: [...causes.m1References, { reference, quantite }]
    }));

    this.currentMPReference.set('');
    this.currentMPQuantite.set(0);
  }

  removeMatierePremiereReference(index: number): void {
    this.currentCauses.update(causes => ({
      ...causes,
      m1References: causes.m1References.filter((_, i) => i !== index)
    }));
  }

  updateMPReference(value: string): void {
    this.currentMPReference.set(value);
  }

updateMPQuantite(value: string): void {
  const numValue = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
  this.currentMPQuantite.set(numValue);
  
  // 🎯 CORRECTION : Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    m1MatierePremiere: numValue
  }));
  
  // Si quantité = 0, vider les références
  if (numValue === 0) {
    this.selectedMPReferences.set([]);
    this.currentMPSearchQuery.set('');
  }
  
  // Charger les MP si nécessaire
  if (numValue > 0 && this.matieresPremieres().length === 0) {
    const planif = this.weekPlanification();
    if (planif && this.selectedLigne()) {
      const ligne = this.selectedLigne()!.ligne;
      this.loadMatieresPremieres(ligne);
    }
  }
}
  hasMatierePremierReferences(): boolean {
    return this.currentCauses().m1References.length > 0;
  }

  getTotalM1References(): number {
    return this.currentCauses().m1References.reduce((sum, ref) => sum + ref.quantite, 0);
  }

updateCause(field: keyof Causes5M, value: string): void {
  const numValue = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
  const current = { ...this.currentCauses() };
  
  switch(field) {
    case 'm2Absence':
      current.m2Absence = numValue;
      // Si quantité = 0, vider les matricules
      if (numValue === 0) {
        this.selectedMatriculesAbsence.set([]);
        current.matriculesAbsence = [];
      }
      break;
      
    case 'm2Rendement':
      current.m2Rendement = numValue;
      // Si quantité = 0, vider les matricules
      if (numValue === 0) {
        this.selectedMatriculesRendement.set([]);
        current.matriculesRendement = [];
      }
      break;
      
    case 'm3Methode':
      current.m3Methode = numValue;
      break;
      
    case 'm4Maintenance':
      current.m4Maintenance = numValue;
      // Si quantité = 0, vider les phases
      if (numValue === 0) {
        this.selectedPhasesMaintenance.set([]);
        current.phasesMaintenance = [];
        this.currentPhasesSearchQuery.set('');
        this.showPhasesSuggestions.set(false);
      }
      break;
      
    case 'm6Environnement':
      current.m6Environnement = numValue;
      break;
      
    case 'm1MatierePremiere':
      current.m1MatierePremiere = numValue;
      // Si quantité = 0, vider les références MP
      if (numValue === 0) {
        this.selectedMPReferences.set([]);
        this.currentMPSearchQuery.set('');
        this.showMPSuggestions.set(false);
      }
      break;
      
    case 'm5Qualite':
      current.m5Qualite = numValue;
      // Si quantité = 0, vider les références qualité
      if (numValue === 0) {
        this.selectedQualiteReferences.set([]);
        this.currentQualiteSearchQuery.set('');
        this.showQualiteSuggestions.set(false);
        this.selectedCommentaireId.set(null);
      }
      break;
  }
  
  this.currentCauses.set(current);
  console.log(`🔄 Cause mise à jour - ${field}:`, numValue);
}

  incrementCause(causeKey: keyof Causes5M, amount: number = 100): void {
    if (causeKey === 'm1References') return;
    
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: (causes[causeKey] as number) + amount
    }));
  }

  decrementCause(causeKey: keyof Causes5M, amount: number = 100): void {
    if (causeKey === 'm1References') return;
    
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: Math.max(0, (causes[causeKey] as number) - amount)
    }));
  }

getTotalCauses(): number {
  const causes = this.currentCauses();
  return causes.m1MatierePremiere +
         causes.m2Absence +
         causes.m2Rendement +
         causes.m3Methode +
         causes.m4Maintenance +
         causes.m5Qualite +
         causes.m6Environnement;  // ✅ AJOUT ICI
}

currentQualiteQuantite = signal<number>(0);
currentQualiteReference = signal<string>('');

// Méthode pour mettre à jour la référence qualité
updateQualiteReference(value: string): void {
  this.currentQualiteReference.set(value);
}

// Méthodes pour incrémenter/décrémenter la qualité
incrementCauseQualite(amount: number = 100): void {
  const newValue = this.currentQualiteQuantite() + amount;
  this.currentQualiteQuantite.set(newValue);
}

decrementCauseQualite(amount: number = 100): void {
  const newValue = Math.max(0, this.currentQualiteQuantite() - amount);
  this.currentQualiteQuantite.set(newValue);
}

// Méthode pour mettre à jour la quantité qualité
updateQualiteQuantite(value: string): void {
  const numValue = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
  this.currentQualiteQuantite.set(numValue);
  
  // 🎯 CORRECTION : Synchroniser avec currentCauses (DÉJÀ FAIT dans votre code ✅)
  this.currentCauses.update(causes => ({
    ...causes,
    m5Qualite: numValue
  }));
  
  // Si quantité = 0, vider les références
  if (numValue === 0) {
    this.selectedQualiteReferences.set([]);
    this.currentQualiteSearchQuery.set('');
    this.showQualiteSuggestions.set(false);
  }
  
  if (numValue > 0 && this.matieresPremieres().length === 0) {
    const planif = this.weekPlanification();
    if (planif && this.selectedLigne()) {
      const ligne = this.selectedLigne()!.ligne;
      this.loadMatieresPremieres(ligne);
    }
  }
}
addQualiteReference(ref: string): void {
  const trimmedRef = ref.trim();
  
  if (!trimmedRef) {
    return;
  }
  
  const current = this.selectedQualiteReferences();
  
  // Vérifier si déjà présente
  if (current.includes(trimmedRef)) {
    alert('Cette référence qualité est déjà ajoutée');
    return;
  }
  
  // Limite de 3 références
  if (current.length >= 3) {
    alert('Maximum 3 références qualité autorisées');
    return;
  }
  
  // Ajouter la référence
  this.selectedQualiteReferences.set([...current, trimmedRef]);
  this.currentQualiteSearchQuery.set('');
  this.showQualiteSuggestions.set(false); // 🆕 Fermer les suggestions
  
  console.log('Référence Qualité ajoutée:', trimmedRef, 'Total:', current.length + 1);
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
  if (!selected || !this.selectedLigne() || !this.selectedWeek()) return;

  const planif = this.weekPlanification();
  if (!planif) return;

  const token = this.authService.getToken();
  if (!token) {
    alert('Vous devez être connecté pour sauvegarder');
    return;
  }

  // ========== CRÉER LE DTO ==========
  const dto: any = {
    semaine: `semaine${planif.weekNumber}`,
    jour: selected.day,
    ligne: this.selectedLigne()!.ligne,
    reference: selected.reference.reference,
  };

  // Récupérer les valeurs
  const mpQuantite = this.currentMPQuantite();
  const qualiteQuantite = this.currentQualiteQuantite();
  const causes = this.currentCauses();

  // ========== MATIÈRE PREMIÈRE ==========
  if (mpQuantite > 0) {
    dto.matierePremiere = mpQuantite;
    const mpRefsString = this.getMPReferencesString();
    if (mpRefsString) {
      dto.referenceMatierePremiere = mpRefsString;
    }
  }

  // ========== ABSENCE AVEC MATRICULES ==========
  if (causes.m2Absence > 0) {
    dto.absence = causes.m2Absence;
    const matriculesAbsenceString = this.getMatriculesAbsenceString();
    if (matriculesAbsenceString) {
      dto.matriculesAbsence = matriculesAbsenceString;
    }
  }

  // ========== RENDEMENT AVEC MATRICULES ==========
  if (causes.m2Rendement > 0) {
    dto.rendement = causes.m2Rendement;
    const matriculesRendementString = this.getMatriculesRendementString();
    if (matriculesRendementString) {
      dto.matriculesRendement = matriculesRendementString;
    }
  }

  // ========== MÉTHODE ==========
  if (causes.m3Methode > 0) {
    dto.methode = causes.m3Methode;
  }

  // ========== MAINTENANCE AVEC PHASES ==========
  if (causes.m4Maintenance > 0) {
    dto.maintenance = causes.m4Maintenance;
    const phasesString = this.getPhasesMaintenanceString();
    if (phasesString) {
      dto.phasesMaintenance = phasesString;
    }
  }

  // ========== QUALITÉ AVEC RÉFÉRENCES ET COMMENTAIRE ==========
  if (qualiteQuantite > 0) {
    dto.qualite = qualiteQuantite;
    
    const qualiteRefsString = this.getQualiteReferencesString();
    if (qualiteRefsString) {
      dto.referenceQualite = qualiteRefsString;
    }
    
    // ✅ COMMENTAIRE OBLIGATOIRE
    if (!this.selectedCommentaireId()) {
      alert('Un commentaire est obligatoire lorsque la quantité Qualité > 0');
      return;
    }
    dto.commentaireId = this.selectedCommentaireId();
  }

  // ========== ENVIRONNEMENT ==========
  if (causes.m6Environnement > 0) {
    dto.environnement = causes.m6Environnement;
  }

  const totalCauses = this.getTotalCauses();
  console.log('📦 DTO complet à envoyer:', dto);
  console.log('📊 Total causes:', totalCauses);
  console.log('📉 Écart CDP:', this.getEcartCDP());

  // ========== GESTION TOTAL = 0 ==========
  if (totalCauses === 0) {
    const hasExistingData = selected.entry.causes;
    
    if (!hasExistingData) {
      this.showSuccessMessage('Aucune donnée à sauvegarder');
      this.closeCausesModal();
      return;
    } else {
      if (!confirm('Voulez-vous supprimer ce rapport ?')) {
        return;
      }
    }
  }

  // ========== ENVOI AU BACKEND ==========
  this.nonConfService.createOrUpdateNonConformite(dto).subscribe({
    next: (response) => {
      console.log('✅ Causes sauvegardées avec succès:', response);
      
      // Mettre à jour localement
      const updatedPlanif = { ...planif };
      const refIndex = updatedPlanif.references.findIndex(
        r => r.reference === selected.reference.reference
      );

      if (refIndex !== -1) {
        const dayEntry = updatedPlanif.references[refIndex][selected.day] as DayEntry;
        if (dayEntry) {
          if (response.action === 'deleted') {
            dayEntry.causes = undefined;
          } else {
            // Création/Mise à jour avec TOUTES les données
            dayEntry.causes = { 
              m1MatierePremiere: mpQuantite,
              m1References: this.selectedMPReferences().map(ref => ({ 
                reference: ref, 
                quantite: mpQuantite 
              })),
              m2Absence: causes.m2Absence,
              matriculesAbsence: this.selectedMatriculesAbsence(),
              m2Rendement: causes.m2Rendement,
              matriculesRendement: this.selectedMatriculesRendement(),
              m3Methode: causes.m3Methode,
              m4Maintenance: causes.m4Maintenance,
              phasesMaintenance: this.selectedPhasesMaintenance(),
              m5Qualite: qualiteQuantite,
              m6Environnement: causes.m6Environnement,
              qualiteReferences: this.selectedQualiteReferences().map(ref => ({ 
                reference: ref, 
                quantite: qualiteQuantite 
              }))
            };
          }
        }
        this.weekPlanification.set(updatedPlanif);
      }

      if (response.action === 'deleted') {
        this.showSuccessMessage('Rapport supprimé avec succès');
      } else {
        this.showSuccessMessage('Causes sauvegardées avec succès');
      }
      
      this.closeCausesModal();
    },
    error: (error) => {
      console.error('❌ Erreur sauvegarde causes:', error);
      
      if (error.status === 400) {
        const errorMessage = error.error?.message || '';
        if (errorMessage.includes('toutes les valeurs à 0')) {
          this.showSuccessMessage('Aucune donnée à sauvegarder');
          this.closeCausesModal();
        } else {
          this.showSuccessMessage('Erreur de validation: ' + errorMessage);
        }
      } else {
        this.showSuccessMessage('Erreur lors de la sauvegarde');
      }
    }
  });
}
// Fonction pour vérifier si on peut sauvegarder
canSaveCauses(): boolean {
  const totalCauses = this.getTotalCauses();
  const ecartCDP = this.getEcartCDP();
  
  // Si tout est à 0, on peut sauvegarder (pour supprimer)
  if (totalCauses === 0) return true;
  
  // Sinon, vérifier que les causes correspondent à l'écart
  const difference = Math.abs(totalCauses - ecartCDP);
  return difference <= 1; // tolérance de 1
}

  getSelectedC(): number {
    const selected = this.selectedEntryForCauses();
    return selected?.entry.c || 0;
  }

  getSelectedDP(): number {
    const selected = this.selectedEntryForCauses();
    return selected?.entry.dp || 0;
  }

  // ==================== UTILITAIRES ====================

  getDayEntry(ref: ReferenceProduction, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

  

  formatPhases(phases: WorkPhase[]): string {
    return phases.map(p => `${p.phase}(${p.heures}h)`).join(', ');
  }

  onSearchLineChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchLineQuery.set(target.value);
  }

  onSearchReferenceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchReferenceQuery.set(target.value);
  }

  onSearchRecordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchRecordQuery.set(target.value);
    this.updateFilteredOperators();
  }

  clearLineSearch(): void {
    this.searchLineQuery.set('');
  }

  clearReferenceSearch(): void {
    this.searchReferenceQuery.set('');
  }

  clearRecordSearch(): void {
    this.searchRecordQuery.set('');
  }

  private showSuccessMessage(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3000);
  }

  // ==================== GESTION DU SCROLL ====================

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

  // Dans Prod2Component

getDayDate(dayIndex: number): Date {
  const planif = this.weekPlanification();
  if (!planif) return new Date();
  
  const date = new Date(planif.startDate);
  
  // Correction: Vérifier si startDate est bien un lundi
  // Si ce n'est pas un lundi, ajuster au lundi précédent
  if (date.getDay() !== 1) { // 0=dimanche, 1=lundi
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    date.setDate(date.getDate() + daysToMonday);
  }
  
  // Ajouter le nombre de jours
  date.setDate(date.getDate() + dayIndex);
  return date;
}

// Alternative: Méthode plus robuste qui utilise les dates de la semaine API
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
  
  // Fallback: utiliser l'ancienne méthode
  return this.getDayDate(dayIndex);
}
// Ajoutez cette méthode dans Prod2Component
// Version corrigée de getCorrectDateForDay
private getCorrectDateForDay(day: string): string {
  const planif = this.weekPlanification();
  if (!planif) {
    console.error('Aucune planification disponible');
    return this.formatDate(new Date()); // Fallback à la date actuelle
  }

  const dayIndex = this.weekDays.indexOf(day);
  if (dayIndex === -1) {
    console.error(`Jour invalide: ${day}`);
    return this.formatDate(new Date());
  }

  // Utiliser la méthode de calcul de date existante
  const targetDate = this.getDayDateCorrected(day, dayIndex);
  console.log(`Date calculée pour ${day}: ${targetDate}`);
  
  return this.formatDate(targetDate);
}
// Ajouter ces méthodes dans prod2.component.ts

/**
 * Obtient le nombre d'opérateurs depuis la première référence valide
 * (Le nbOperateurs est le même pour toutes les références d'un jour donné)
 */
getAverageOperators(day: string): string {
  const planif = this.filteredWeekPlanification();
  if (!planif || !planif.references || planif.references.length === 0) {
    return '0';
  }

  // Chercher la première référence avec un nbOperateurs défini pour ce jour
  for (const ref of planif.references) {
    const dayEntry = this.getDayEntry(ref, day);
    if (dayEntry && dayEntry.nbOperateurs !== undefined && dayEntry.nbOperateurs !== null) {
      return dayEntry.nbOperateurs.toString();
    }
  }

  return '0';
}

/**
 * Obtient le nombre d'opérateurs pour une référence et un jour spécifiques
 */
getOperatorsForDay(ref: ReferenceProduction, day: string): number {
  const dayEntry = this.getDayEntry(ref, day);
  return dayEntry?.nbOperateurs || 0;
}

/**
 * Met à jour le nombre d'opérateurs pour une entrée spécifique
 */
updateNbOperateurs(reference: ReferenceProduction, day: string, value: string): void {
  if (this.weekPlanification()) {
    const updatedPlanif = { ...this.weekPlanification()! };
    const refIndex = updatedPlanif.references.findIndex(r => r.reference === reference.reference);
    
    if (refIndex !== -1) {
      const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
      if (dayEntry) {
        dayEntry.nbOperateurs = parseInt(value) || 0;
      }
      this.weekPlanification.set(updatedPlanif);
    }
  }
}

/**
 * Obtient le total des opérateurs pour un jour donné
 */
getTotalOperatorsForDay(day: string): number {
  const planif = this.filteredWeekPlanification();
  if (!planif || !planif.references) {
    return 0;
  }

  let total = 0;
  planif.references.forEach(ref => {
    const dayEntry = this.getDayEntry(ref, day);
    if (dayEntry && dayEntry.nbOperateurs) {
      total += dayEntry.nbOperateurs;
    }
  });

  return total;
}

/**
 * Met à jour le nbOperateurs pour TOUTES les références d'un jour donné
 * (Le nbOperateurs est partagé par toutes les références du même jour)
 */
updateAllReferencesOperators(day: string, value: string): void {
  const nbOp = parseInt(value, 10) || 0;
  
  if (nbOp < 0 || nbOp > 50) {
    console.warn('Nombre d\'opérateurs invalide:', nbOp);
    return;
  }

  const planif = this.weekPlanification();
  if (!planif) return;

  const updatedPlanif = { ...planif };
  
  // Mettre à jour toutes les références pour ce jour
  updatedPlanif.references = updatedPlanif.references.map(ref => {
    const updatedRef = { ...ref };
    const dayEntry = updatedRef[day] as DayEntry;
    
    if (dayEntry) {
      dayEntry.nbOperateurs = nbOp;
    }
    
    return updatedRef;
  });

  this.weekPlanification.set(updatedPlanif);
  console.log(`NB Opérateurs mis à jour pour ${day}: ${nbOp}`);
}

/**
 * Obtient le nombre moyen d'opérateurs en tant que nombre
 * Utilisé pour les conditions ngClass
 */
getAverageOperatorsNumber(day: string): number {
  const value = this.getAverageOperators(day);
  return parseInt(value, 10) || 0;
}

// Dans la classe Prod2Component
@HostListener('document:keydown.escape', ['$event'])
handleEscapeKey(event: KeyboardEvent): void {
  if (this.showCausesModal()) {
    this.closeCausesModal();
  }
}

incrementCauseMP(amount: number = 100): void {
  const newValue = this.currentMPQuantite() + amount;
  this.currentMPQuantite.set(newValue);
  
  // Si on a maintenant une quantité > 0, afficher le champ référence
  if (newValue > 0) {
    // Charger automatiquement les matières premières si ce n'est pas déjà fait
    const planif = this.weekPlanification();
    if (planif && this.selectedLigne()) {
      const ligne = this.selectedLigne()!.ligne;
      if (this.matieresPremieres().length === 0) {
        this.loadMatieresPremieres(ligne);
      }
    }
  }
}

decrementCauseMP(amount: number = 100): void {
  const newValue = Math.max(0, this.currentMPQuantite() - amount);
  this.currentMPQuantite.set(newValue);
}
selectedMPReferences = signal<string[]>([]);
selectedQualiteReferences = signal<string[]>([]);
currentMPSearchQuery = signal<string>('');
currentQualiteSearchQuery = signal<string>('');
addMPReference(ref: string): void {
  const current = this.selectedMPReferences();
  
  // Vérifier si déjà présente
  if (current.includes(ref)) {
    alert('Cette référence est déjà ajoutée');
    return;
  }
  
  // Limite de 3 références
  if (current.length >= 3) {
    alert('Maximum 3 références MP autorisées');
    return;
  }
  
  // Ajouter la référence
  this.selectedMPReferences.set([...current, ref]);
  this.currentMPSearchQuery.set('');
  this.showMPSuggestions.set(false);
  
  console.log('Référence MP ajoutée:', ref, 'Total:', current.length + 1);
}
removeMPReference(index: number): void {
  const current = this.selectedMPReferences();
  const updated = current.filter((_, i) => i !== index);
  this.selectedMPReferences.set(updated);
  
  console.log('Référence MP supprimée, restantes:', updated.length);
}
getMPReferencesString(): string {
  const refs = this.selectedMPReferences();
  return refs.length > 0 ? refs.join(', ') : '';
}

parseMPReferencesString(refsString: string | null): void {
  if (!refsString || refsString.trim() === '') {
    this.selectedMPReferences.set([]);
    return;
  }
  
  // Split par virgule et nettoyer les espaces
  const refs = refsString.split(',').map(ref => ref.trim()).filter(ref => ref !== '');
  this.selectedMPReferences.set(refs);
  
  console.log('Références MP parsées:', refs);
}
ddQualiteReference(ref: string): void {
  const trimmedRef = ref.trim();
  
  if (!trimmedRef) {
    return;
  }
  
  const current = this.selectedQualiteReferences();
  
  // Vérifier si déjà présente
  if (current.includes(trimmedRef)) {
    alert('Cette référence qualité est déjà ajoutée');
    return;
  }
  
  // Limite de 3 références
  if (current.length >= 3) {
    alert('Maximum 3 références qualité autorisées');
    return;
  }
  
  // Ajouter la référence
  this.selectedQualiteReferences.set([...current, trimmedRef]);
  this.currentQualiteSearchQuery.set('');
  
  console.log('Référence Qualité ajoutée:', trimmedRef, 'Total:', current.length + 1);
}

/**
 * Supprimer une référence Qualité de la liste
 */
removeQualiteReference(index: number): void {
  const current = this.selectedQualiteReferences();
  const updated = current.filter((_, i) => i !== index);
  this.selectedQualiteReferences.set(updated);
  
  console.log('Référence Qualité supprimée, restantes:', updated.length);
}
onSearchQualiteChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  this.currentQualiteSearchQuery.set(value);
  
  // Afficher les suggestions si la query n'est pas vide
  if (value.trim()) {
    this.showQualiteSuggestions.set(true);
  } else {
    this.showQualiteSuggestions.set(false);
  }
}
onQualiteKeyPress(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    const ref = this.currentQualiteSearchQuery().trim();
    if (ref) {
      this.addQualiteReference(ref);
    }
  }
}

/**
 * Obtenir la string des références Qualité séparées par virgule
 */
getQualiteReferencesString(): string {
  const refs = this.selectedQualiteReferences();
  return refs.length > 0 ? refs.join(', ') : '';
}

/**
 * Parser une string de références Qualité en tableau
 */
parseQualiteReferencesString(refsString: string | null): void {
  if (!refsString || refsString.trim() === '') {
    this.selectedQualiteReferences.set([]);
    return;
  }
  
  // Split par virgule et nettoyer les espaces
  const refs = refsString.split(',').map(ref => ref.trim()).filter(ref => ref !== '');
  this.selectedQualiteReferences.set(refs);
  
  console.log('Références Qualité parsées:', refs);
}
showQualiteSuggestions = signal(false);
filteredQualiteRefs = computed(() => {
  const query = this.currentQualiteSearchQuery().toLowerCase();
  const allRefs = this.matieresPremieres(); // 🎯 MÊME SOURCE QUE MP
  
  if (!query.trim()) {
    return allRefs;
  }
  
  return allRefs.filter(ref => 
    ref.toLowerCase().includes(query)
  );
});

// Dans prod2.component.ts

// Activer le mode édition
enableEditMode(): void {
  this.editMode.set('edit');
}

// Annuler l'édition
cancelEdit(): void {
  this.editMode.set('view');
  // Recharger les données originales si nécessaire
  if (this.selectedRecordForEdit()) {
    this.showRecordDetails(this.selectedRecordForDetails()!);
  }
}

// Mettre à jour les phases lors de l'édition
updateEditPhase(index: number, field: 'phase' | 'heures', value: string | number): void {
  const record = this.selectedRecordForEdit();
  if (!record || !record.phases[index]) return;
  
  const updatedPhases = [...record.phases];
  
  if (field === 'phase') {
    updatedPhases[index].phase = value as string;
  } else if (field === 'heures') {
    updatedPhases[index].heures = Number(value);
  }
  
  // Recalculer le total des heures
  const totalHeures = updatedPhases.reduce((sum, phase) => sum + (phase.heures || 0), 0);
  
  this.selectedRecordForEdit.set({
    ...record,
    phases: updatedPhases,
    totalHeures: totalHeures
  });
}

// Ajouter une phase (max 3)
addEditPhase(): void {
  const record = this.selectedRecordForEdit();
  if (!record) return;
  
  if (record.phases.length >= 3) {
    alert('Maximum 3 phases par jour');
    return;
  }
  
  const updatedPhases = [
    ...record.phases,
    { phase: '', heures: 0, ligne: record.ligne }
  ];
  
  this.selectedRecordForEdit.set({
    ...record,
    phases: updatedPhases
  });
}

// Supprimer une phase
removeEditPhase(index: number): void {
  const record = this.selectedRecordForEdit();
  if (!record) return;
  
  if (record.phases.length <= 1) {
    alert('Au moins une phase est requise');
    return;
  }
  
  const updatedPhases = record.phases.filter((_, i) => i !== index);
  
  // Recalculer le total des heures
  const totalHeures = updatedPhases.reduce((sum, phase) => sum + (phase.heures || 0), 0);
  
  this.selectedRecordForEdit.set({
    ...record,
    phases: updatedPhases,
    totalHeures: totalHeures
  });
}

// Sauvegarder les modifications
saveRecordEdit(): void {
  const record = this.selectedRecordForEdit();
  if (!record) return;

  // Validation
  if (record.totalHeures > 8) {
    alert(`Total des heures (${record.totalHeures}h) dépasse la limite de 8h`);
    return;
  }

  // Vérifier que toutes les phases ont une référence et des heures
  const invalidPhases = record.phases.filter(p => !p.phase || p.heures <= 0);
  if (invalidPhases.length > 0) {
    alert('Toutes les phases doivent avoir une référence et des heures > 0');
    return;
  }

  // Convertir le matricule en nombre
  let matriculeNumber: number;
  
  if (record.matricule.startsWith('EMP')) {
    matriculeNumber = parseInt(record.matricule.replace('EMP', ''), 10);
  } else {
    matriculeNumber = parseInt(record.matricule, 10);
  }

  if (isNaN(matriculeNumber)) {
    alert('Matricule invalide');
    return;
  }

  // Préparer le DTO pour l'API
  const dto = {
    semaine: record.semaine,
    jour: record.jour,
    ligne: record.ligne,
    matricule: matriculeNumber,
    phases: record.phases.map(p => ({
      phase: p.phase,
      heures: p.heures
    }))
  };

  console.log('DTO pour mise à jour:', dto);

  // Appeler le service de mise à jour
  this.loading.set(true);
  
  this.saisieRapportService.updateRapport(dto).subscribe({
    next: (response) => {
      console.log('Rapport mis à jour:', response);
      this.loading.set(false);
      
      // Mettre à jour localement
      this.updateLocalRecord(record);
      
      // Revenir en mode vue
      this.editMode.set('view');
      
      // Afficher un message de succès
      this.showSuccessMessage('Rapport mis à jour avec succès');
    },
    error: (error) => {
      console.error('Erreur mise à jour rapport:', error);
      this.loading.set(false);
      
      let errorMessage = 'Erreur lors de la mise à jour: ';
      if (error.error?.message) {
        errorMessage += error.error.message;
      } else if (error.status === 404) {
        errorMessage += 'Rapport non trouvé';
      } else if (error.status === 409) {
        errorMessage += 'Conflit de données';
      } else {
        errorMessage += 'Erreur serveur';
      }
      
      alert(errorMessage);
    }
  });
}

// Mettre à jour le record localement
private updateLocalRecord(updatedRecord: RecordForEdit): void {
  const records = this.productionRecords();
  const updatedRecords = records.map(record => {
    if (record.matricule === updatedRecord.matricule && 
        record.ligne1 === updatedRecord.ligne) {
      
      return {
        ...record,
        phasesLigne1: updatedRecord.phases,
        totalHeures: updatedRecord.totalHeures
      };
    }
    return record;
  });
  
  this.productionRecords.set(updatedRecords);
}

// Supprimer un rapport
deleteRecord(): void {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
    return;
  }

  const record = this.selectedRecordForEdit();
  if (!record) return;

  // Ici, vous devriez avoir l'ID du rapport
  // Pour l'instant, on utilisera les critères pour identifier le rapport
  
  const planif = this.weekPlanification();
  if (!planif) return;

  const semaineNom = `semaine${planif.weekNumber}`;
  
  // Note: Vous devriez récupérer l'ID du rapport d'abord
  // Pour l'exemple, on utilise une approche alternative
  
  alert('La suppression nécessite l\'ID du rapport. Cette fonctionnalité sera implémentée prochainement.');
}

// Fermer les détails
closeRecordDetails(): void {
  this.showRecordsDetails.set(false);
  this.selectedRecordForDetails.set(null);
  this.selectedRecordForEdit.set(null);
  this.editMode.set('view');
}

// Dans prod2.component.ts
private saveMagasinDeclarations(): void {
  const planif = this.weekPlanification();
  if (!planif || !this.selectedLigne()) {
    console.error('Données manquantes pour sauvegarder DM');
    return;
  }

  const semaineNom = `semaine${planif.weekNumber}`;
  const ligne = planif.ligne;
  
  // Collecter toutes les modifications DM
  const dmUpdates: any[] = [];
  
  planif.references.forEach((ref) => {
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry;
      if (entry && entry.dm !== undefined) {
        dmUpdates.push({
          semaine: semaineNom,
          jour: day,
          ligne: ligne,
          reference: ref.reference,
          decMagasin: entry.dm
        });
      }
    });
  });
  
  if (dmUpdates.length === 0) {
    console.log('Aucune déclaration magasin à sauvegarder');
    return;
  }
  
  console.log(`Envoi de ${dmUpdates.length} déclarations magasin`);
  
  // Sauvegarder chaque déclaration individuellement
  const savePromises = dmUpdates.map((dmData) => {
    return new Promise<void>((resolve, reject) => {
      this.semaineService.updateMagasinPlanification(dmData).subscribe({
        next: (response) => {
          console.log(`DM sauvegardé pour ${dmData.reference} - ${dmData.jour}:`, response);
          resolve();
        },
        error: (error) => {
          console.error(`Erreur sauvegarde DM ${dmData.reference}:`, error);
          reject(error);
        }
      });
    });
  });
  
  // Gérer toutes les sauvegardes
  Promise.all(savePromises.map(p => p.catch(e => e)))
    .then(results => {
      const successful = results.filter(r => !(r instanceof Error)).length;
      if (successful > 0) {
        this.showSuccessMessage(`${successful} déclaration(s) magasin enregistrée(s)`);
      }
    })
    .catch(() => {
      this.showSuccessMessage('Erreur lors de la sauvegarde DM');
    });
}
canEditDP(): boolean {
  return this.authService.canEditDP();
}

/**
 * 🎯 Vérifier si l'utilisateur peut modifier DM (Magasin)
 * Seul le matricule 2603 peut modifier DM
 */
canEditDM(): boolean {
  return this.authService.canEditDM();
}

/**
 * 🎯 Vérifier si c'est le matricule spécial pour DM
 */
isSpecialMatriculeDM(): boolean {
  return this.authService.isSpecialMatriculeDM();
}

/**
 * 🎯 Obtenir le matricule de l'utilisateur connecté
 */
getUserMatricule(): string | null {
  return this.authService.getUserMatricule();
}

availableCommentaires = signal<any[]>([]);
selectedCommentaireId = signal<number | null>(null);
isLoadingCommentaires = signal(false);

private loadAvailableCommentaires(): void {
  this.isLoadingCommentaires.set(true);
  
  this.commentaireService.getAllCommentaires().subscribe({
    next: (commentaires) => {
      console.log('Commentaires chargés depuis API:', commentaires);
      this.availableCommentaires.set(commentaires);
      this.isLoadingCommentaires.set(false);
    },
    error: (error) => {
      console.error('Erreur chargement commentaires depuis API:', error);
      this.isLoadingCommentaires.set(false);
      
      // En cas d'erreur, essayer d'utiliser les données mockées
      this.loadMockCommentaires();
    }
  });
}
private loadMockCommentaires(): void {
  const mockCommentaires = [
    { id: 1, commentaire: 'Bavure' },
    { id: 2, commentaire: 'Manque de matière' },
    { id: 3, commentaire: 'Déformation' },
    { id: 4, commentaire: 'Cote non conforme' },
    { id: 5, commentaire: 'Soudure non conforme' },
    { id: 6, commentaire: 'Aspect non conforme' },
    { id: 7, commentaire: 'Casse' },
    { id: 8, commentaire: 'Fissure' },
    { id: 9, commentaire: 'Arrachement non conforme' },
    { id: 10, commentaire: 'Sertissage non conforme' },
    { id: 11, commentaire: 'Traitement non conforme' },
    { id: 12, commentaire: 'Ancienne version' },
    { id: 13, commentaire: 'Taraudage non conforme' }
  ];
  
  this.availableCommentaires.set(mockCommentaires);
}

// Dans la classe Prod2Component
getSelectedCommentaireText(): string {
  const commentaireId = this.selectedCommentaireId();
  if (!commentaireId) return '';
  
  const commentaire = this.availableCommentaires().find(c => c.id === commentaireId);
  return commentaire ? commentaire.commentaire : 'Commentaire non trouvé';
}
incoherencesDP = signal<Array<{
  reference: string;
  day: string;
  c: number;
  dp: number;
  difference: number;
}>>([]);

hasIncoherences = computed(() => this.incoherencesDP().length > 0);
errorMessage = signal<string>('');
private checkDPIncoherences(): void {
  const planif = this.weekPlanification();
  if (!planif) {
    this.incoherencesDP.set([]);
    return;
  }

  const incoherences: Array<{
    reference: string;
    day: string;
    c: number;
    dp: number;
    difference: number;
  }> = [];

  planif.references.forEach(ref => {
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry;
      if (entry && entry.dp > 0 && entry.c > 0 && entry.dp > entry.c) {
        incoherences.push({
          reference: ref.reference,
          day: day,
          c: entry.c,
          dp: entry.dp,
          difference: entry.dp - entry.c
        });
      }
    });
  });

  this.incoherencesDP.set(incoherences);
  
  // Mettre à jour le message d'erreur
  if (incoherences.length > 0) {
    this.updateErrorMessage(incoherences);
  }
}

private updateErrorMessage(incoherences: any[]): void {
  const messages = incoherences.map(inc => 
    `${inc.reference} - ${inc.day.charAt(0).toUpperCase() + inc.day.slice(1)} : DP(${inc.dp}) > C(${inc.c})`
  ).join('\n');
  
  this.errorMessage.set(`⚠️ Incohérence(s) détectée(s) :\n${messages}\nCorrigez avant de sauvegarder.`);
}
selectedPhasesMaintenance = signal<string[]>([]);
currentPhasesSearchQuery = signal<string>('');
showPhasesSuggestions = signal(false);

filteredPhasesRefs = computed(() => {
  const query = this.currentPhasesSearchQuery().toLowerCase();
  const allPhases = this.availablePhases();
  
  // 🔴 NE GARDER QUE LES PHASES QUI SONT DES NOMBRES
  const numericPhases = allPhases.filter(phase => {
    // Vérifier si la phase ne contient que des chiffres
    return /^\d+$/.test(phase.trim());
  });
  
  if (!query.trim()) {
    return numericPhases;
  }
  
  return numericPhases.filter(phase => 
    phase.toLowerCase().includes(query)
  );
});

/**
 * Ajouter une phase maintenance à la liste
 */
addPhasesMaintenance(phase: string): void {
  const trimmedPhase = phase.trim();
  
  if (!trimmedPhase) {
    return;
  }
  
  // 🔴 CONVERTIR EN NOMBRE - Ne garder que les caractères numériques
  const phaseNumber = trimmedPhase.replace(/\D/g, ''); // Enlève tout ce qui n'est pas un chiffre
  
  if (!phaseNumber) {
    alert('La phase doit contenir des chiffres');
    return;
  }
  
  const current = this.selectedPhasesMaintenance();
  
  // Vérifier si déjà présente (comparer les nombres)
  if (current.includes(phaseNumber)) {
    alert('Cette phase est déjà ajoutée');
    return;
  }
  
  // Limite de 3 phases
  if (current.length >= 3) {
    alert('Maximum 3 phases autorisées');
    return;
  }
  
  // Ajouter la phase (en tant que nombre en string)
  this.selectedPhasesMaintenance.set([...current, phaseNumber]);
  this.currentPhasesSearchQuery.set('');
  this.showPhasesSuggestions.set(false);
  
  console.log('Phase maintenance ajoutée:', phaseNumber);
}

/**
 * Supprimer une phase maintenance de la liste
 */
removePhasesMaintenance(index: number): void {
  const current = this.selectedPhasesMaintenance();
  const updated = current.filter((_, i) => i !== index);
  this.selectedPhasesMaintenance.set(updated);
  console.log('Phase maintenance supprimée, restantes:', updated.length);
}

/**
 * Obtenir la string des phases maintenance séparées par virgule
 */
getPhasesMaintenanceString(): string {
  const phases = this.selectedPhasesMaintenance();
  return phases.length > 0 ? phases.join(', ') : '';
}

/**
 * Parser une string de phases maintenance en tableau
 */
parsePhasesMaintenanceString(phasesInput: string | string[] | number[] | null): void {
  console.log('Parsing phases maintenance - Input:', phasesInput);
  
  // ✅ CAS 1: null ou undefined
  if (!phasesInput) {
    console.log('Phases maintenance: null ou undefined');
    this.selectedPhasesMaintenance.set([]);
    return;
  }
  
  let phases: string[] = [];
  
  // ✅ CAS 2: Déjà un tableau
  if (Array.isArray(phasesInput)) {
    console.log('Phases maintenance est un tableau:', phasesInput);
    
    phases = phasesInput
      .map(p => {
        // Convertir chaque élément en string et garder seulement les chiffres
        const str = String(p).trim();
        return str.replace(/\D/g, ''); // Enlève tout sauf les chiffres
      })
      .filter(p => p !== ''); // Enlever les vides
    
  // ✅ CAS 3: C'est une string (format "1,2,3")
  } else if (typeof phasesInput === 'string') {
    console.log('Phases maintenance est une string:', phasesInput);
    
    phases = phasesInput
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '')
      .map(p => p.replace(/\D/g, '')) // Garder seulement les chiffres
      .filter(p => p !== '');
  }
  
  // 🔴 IMPORTANT: Si c'est un nombre, le convertir en string
  else if (typeof phasesInput === 'number') {
    console.log('Phases maintenance est un nombre:', phasesInput);
    phases = [String(phasesInput).replace(/\D/g, '')].filter(p => p !== '');
  }
  
  console.log('Phases maintenance parsées et nettoyées:', phases);
  
  // Mettre à jour le signal
  this.selectedPhasesMaintenance.set(phases);
  
  // Mettre à jour aussi dans currentCauses pour cohérence
  this.currentCauses.update(causes => ({
    ...causes,
    phasesMaintenance: phases
  }));
}

/**
 * Recherche de phases
 */
onSearchPhasesChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  this.currentPhasesSearchQuery.set(value);
  
  // Afficher les suggestions si la query n'est pas vide
  if (value.trim()) {
    this.showPhasesSuggestions.set(true);
  } else {
    this.showPhasesSuggestions.set(false);
  }
}

/**
 * Fermer les suggestions
 */
closePhasesSuggestions(): void {
  setTimeout(() => {
    this.showPhasesSuggestions.set(false);
  }, 200);
}

/**
 * Validation des phases maintenance avant sauvegarde
 */
validatePhasesMaintenance(): { valid: boolean; message?: string } {
  const phases = this.selectedPhasesMaintenance();
  const maintenanceQuantite = this.currentCauses().m4Maintenance;
  
  // Si maintenance > 0 et phases fournies
  if (maintenanceQuantite > 0 && phases.length > 0) {
    // 🔴 Vérifier que toutes les phases sont des nombres valides
    for (const phase of phases) {
      if (!/^\d+$/.test(phase)) {
        return {
          valid: false,
          message: `Format invalide: "${phase}" doit être un nombre`
        };
      }
    }
    
    // Optionnel: Vérifier que les phases existent dans availablePhases()
    const available = this.availablePhases()
      .filter(p => /^\d+$/.test(p.trim())); // Nombres uniquement
    
    const invalidPhases = phases.filter(p => !available.includes(p));
    
    if (invalidPhases.length > 0) {
      return {
        valid: false,
        message: `Phases non trouvées pour cette ligne: ${invalidPhases.join(', ')}`
      };
    }
  }
  
  return { valid: true };
}
selectedMatriculesAbsence = signal<string[]>([]);
selectedMatriculesRendement = signal<string[]>([]);
currentAbsenceSearchQuery = signal<string>('');
currentRendementSearchQuery = signal<string>('');
showAbsenceSuggestions = signal(false);
showRendementSuggestions = signal(false);

// Liste des ouvriers disponibles pour suggestions
filteredAbsenceMatricules = computed(() => {
  const query = this.currentAbsenceSearchQuery().toLowerCase();
  const allOperators = this.operators().map(op => op.matricule);
  
  if (!query.trim()) {
    return allOperators;
  }
  
  return allOperators.filter(mat => 
    mat.toLowerCase().includes(query)
  );
});

filteredRendementMatricules = computed(() => {
  const query = this.currentRendementSearchQuery().toLowerCase();
  const allOperators = this.operators().map(op => op.matricule);
  
  if (!query.trim()) {
    return allOperators;
  }
  
  return allOperators.filter(mat => 
    mat.toLowerCase().includes(query)
  );
});
addMatriculeAbsence(matricule: string): void {
  const trimmedMat = matricule.trim();
  
  if (!trimmedMat) {
    return;
  }
  
  // Extraire seulement les chiffres
  const matNumber = trimmedMat.replace(/\D/g, '');
  
  if (!matNumber) {
    alert('Le matricule doit contenir des chiffres');
    return;
  }
  
  const current = this.selectedMatriculesAbsence();
  
  // Vérifier si déjà présent
  if (current.includes(matNumber)) {
    alert('Ce matricule est déjà ajouté');
    return;
  }
  
  // Pas de limite stricte, mais on peut mettre une limite raisonnable
  if (current.length >= 10) {
    alert('Maximum 10 matricules par cause');
    return;
  }
  
  // Ajouter le matricule
  this.selectedMatriculesAbsence.set([...current, matNumber]);
  this.currentAbsenceSearchQuery.set('');
  this.showAbsenceSuggestions.set(false);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesAbsence: this.selectedMatriculesAbsence()
  }));
  
  console.log('Matricule absence ajouté:', matNumber);
}

/**
 * Supprimer un matricule absence
 */
removeMatriculeAbsence(index: number): void {
  const current = this.selectedMatriculesAbsence();
  const updated = current.filter((_, i) => i !== index);
  this.selectedMatriculesAbsence.set(updated);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesAbsence: updated
  }));
  
  console.log('Matricule absence supprimé, restants:', updated.length);
}

/**
 * Obtenir la string des matricules absence séparés par virgule
 */
getMatriculesAbsenceString(): string {
  const mats = this.selectedMatriculesAbsence();
  return mats.length > 0 ? mats.join(', ') : '';
}

/**
 * Parser une string de matricules absence
 */
parseMatriculesAbsenceString(matriculesInput: string | string[] | number[] | null): void {
  console.log('Parsing matricules absence - Input:', matriculesInput);
  
  if (!matriculesInput) {
    this.selectedMatriculesAbsence.set([]);
    return;
  }
  
  let matricules: string[] = [];
  
  if (Array.isArray(matriculesInput)) {
    matricules = matriculesInput
      .map(m => {
        const str = String(m).trim();
        return str.replace(/\D/g, '');
      })
      .filter(m => m !== '');
  } else if (typeof matriculesInput === 'string') {
    matricules = matriculesInput
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => m.replace(/\D/g, ''))
      .filter(m => m !== '');
  } else if (typeof matriculesInput === 'number') {
    matricules = [String(matriculesInput).replace(/\D/g, '')].filter(m => m !== '');
  }
  
  console.log('Matricules absence parsés:', matricules);
  this.selectedMatriculesAbsence.set(matricules);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesAbsence: matricules
  }));
}

/**
 * Recherche de matricules absence
 */
onSearchAbsenceChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  this.currentAbsenceSearchQuery.set(value);
  this.showAbsenceSuggestions.set(value.trim().length > 0);
}

/**
 * Fermer les suggestions absence
 */
closeAbsenceSuggestions(): void {
  setTimeout(() => {
    this.showAbsenceSuggestions.set(false);
  }, 200);
}
addMatriculeRendement(matricule: string): void {
  const trimmedMat = matricule.trim();
  
  if (!trimmedMat) {
    return;
  }
  
  // Extraire seulement les chiffres
  const matNumber = trimmedMat.replace(/\D/g, '');
  
  if (!matNumber) {
    alert('Le matricule doit contenir des chiffres');
    return;
  }
  
  const current = this.selectedMatriculesRendement();
  
  // Vérifier si déjà présent
  if (current.includes(matNumber)) {
    alert('Ce matricule est déjà ajouté');
    return;
  }
  
  // Limite raisonnable
  if (current.length >= 10) {
    alert('Maximum 10 matricules par cause');
    return;
  }
  
  // Ajouter le matricule
  this.selectedMatriculesRendement.set([...current, matNumber]);
  this.currentRendementSearchQuery.set('');
  this.showRendementSuggestions.set(false);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesRendement: this.selectedMatriculesRendement()
  }));
  
  console.log('Matricule rendement ajouté:', matNumber);
}

/**
 * Supprimer un matricule rendement
 */
removeMatriculeRendement(index: number): void {
  const current = this.selectedMatriculesRendement();
  const updated = current.filter((_, i) => i !== index);
  this.selectedMatriculesRendement.set(updated);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesRendement: updated
  }));
  
  console.log('Matricule rendement supprimé, restants:', updated.length);
}

/**
 * Obtenir la string des matricules rendement séparés par virgule
 */
getMatriculesRendementString(): string {
  const mats = this.selectedMatriculesRendement();
  return mats.length > 0 ? mats.join(', ') : '';
}

/**
 * Parser une string de matricules rendement
 */
parseMatriculesRendementString(matriculesInput: string | string[] | number[] | null): void {
  console.log('Parsing matricules rendement - Input:', matriculesInput);
  
  if (!matriculesInput) {
    this.selectedMatriculesRendement.set([]);
    return;
  }
  
  let matricules: string[] = [];
  
  if (Array.isArray(matriculesInput)) {
    matricules = matriculesInput
      .map(m => {
        const str = String(m).trim();
        return str.replace(/\D/g, '');
      })
      .filter(m => m !== '');
  } else if (typeof matriculesInput === 'string') {
    matricules = matriculesInput
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => m.replace(/\D/g, ''))
      .filter(m => m !== '');
  } else if (typeof matriculesInput === 'number') {
    matricules = [String(matriculesInput).replace(/\D/g, '')].filter(m => m !== '');
  }
  
  console.log('Matricules rendement parsés:', matricules);
  this.selectedMatriculesRendement.set(matricules);
  
  // Synchroniser avec currentCauses
  this.currentCauses.update(causes => ({
    ...causes,
    matriculesRendement: matricules
  }));
}

/**
 * Recherche de matricules rendement
 */
onSearchRendementChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  this.currentRendementSearchQuery.set(value);
  this.showRendementSuggestions.set(value.trim().length > 0);
}

/**
 * Fermer les suggestions rendement
 */
closeRendementSuggestions(): void {
  setTimeout(() => {
    this.showRendementSuggestions.set(false);
  }, 200);
}




}