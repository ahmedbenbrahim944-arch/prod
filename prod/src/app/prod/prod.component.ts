// src/app/prod/prod.component.ts
import { Component, OnInit, signal, computed, inject, DestroyRef,effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { ProductService, ProductLine } from './product.service';
import { AuthService } from '../login/auth.service';
import { TempsSecService } from './temps-sec.service';
import { OuvrierService } from './ouvrier.service';
import { PhaseService } from './phase.service';
import { SemaineService } from './semaine.service';
import { UserService } from './user.service';
import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { RapportPhaseService } from '../prod/rapport-phase.service';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { StatsService } from './stats.service';
import { ChartService } from './chart.service';
import { Chart } from 'chart.js';
import { StatsAnnuelService, StatsAnnuellesResponse } from './stats-annuel.service';
import { Stats5MAnnuelService , Stats5MAnnuellesResponse} from '../prod/stats-5m-annuel.service';
import { MatierePremiereService } from './matiere-premiere.service';



interface CreateLineForm {
  ligne: string;
  references: string;
  image: File | null;
  imagePreview: string | null;
  errors: {
    ligne?: string;
    references?: string;
    image?: string;
  };
}

interface AddReferencesForm {
  selectedLine: string; // Changez de 'ligne' à 'selectedLine' pour plus de clarté
  references: string;
  errors: {
    selectedLine?: string;
    references?: string;
  };
}

interface StatsAnnuellesForm {
  date: string;
  errors: {
    date?: string;
  };
}

interface WeekForm {
  nom: string; // Changez weekNumber en nom
  dateDebut: string;
  dateFin: string;
  errors: {
    nom?: string;
    dateDebut?: string;
    dateFin?: string;
  };
}

interface MatierePremiereForm {
  ligne: string;
  refMatierePremier: string;
  errors: {
    ligne?: string;
    refMatierePremier?: string;
  };
}

interface MatierePremiere {
  id?: number;
  ligne: string;
  refMatierePremier: string;
}

interface StatsForm {
  semaine: string;
  ligne: string;
  errors: {
    semaine?: string;
    ligne?: string;
  };
}

interface DownloadPhaseForm {
  semaine: string;
  errors: {
    semaine?: string;
  };
}

interface UserForm {
  nom: string;
  prenom: string;
  password: string;
  errors: {
    nom?: string;
    prenom?: string;
    password?: string;
  };
}

interface TimeForm {
  selectedLine: string; // Changez de 'ligne' à 'selectedLine'
  selectedReference: string; // Changez de 'reference' à 'selectedReference'
  seconde: number;
  errors: {
    selectedLine?: string;
    selectedReference?: string;
    seconde?: string;
  };
}

interface WorkerForm {
  matricule: number | null;
  nomPrenom: string;
  errors: {
    matricule?: string;
    nomPrenom?: string;
  };
}

interface PhaseForm {
  mode: 'add' | 'edit'; // Nouveau : mode add ou edit
  selectedLine: string;
  phase: string;
  errors: {
    selectedLine?: string;
    phase?: string;
  };
}
interface DownloadLineSummaryForm {
  semaine: string;
  ligne: string;
  errors: {
    semaine?: string;
    ligne?: string;
  };
}

interface User {
  id?: number; // Rendre id optionnel pour correspondre au service
  nom: string;
  prenom: string;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  createdBy?: any;
}

@Component({
  selector: 'app-prod',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './prod.component.html',
  styleUrls: ['./prod.component.css']
})
export class ProdComponent implements OnInit {
  // Services injectés
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private tempsSecService = inject(TempsSecService);
  private ouvrierService = inject(OuvrierService);
  private phaseService = inject(PhaseService);
  private semaineService = inject(SemaineService);
  private userService = inject(UserService);
  private http = inject(HttpClient);
  private rapportPhaseService = inject(RapportPhaseService);
  private statsService = inject(StatsService); 
  private chartService = inject(ChartService);
  private statsAnnuelService = inject(StatsAnnuelService);
  private stats5MAnnuelService = inject(Stats5MAnnuelService);
  private matierePremiereService = inject(MatierePremiereService);

  matierePremieres = signal<MatierePremiere[]>([]);

  showImageUploadModal = false;
  selectedLineImage: File | null = null;
  lineImagePreview: string | null = null;
  imageUploadError: string | null = null;

  // Signals pour la réactivité
  loading = signal(false);
  lines = signal<ProductLine[]>([]);
  searchQuery = signal('');
  activeTab = signal('view');
  selectedLine = signal<ProductLine | null>(null);
  showSuccess = signal(false);
  successMessage = signal('');
  particles = signal<any[]>([]);
  users = signal<User[]>([]);
  errorMessage = signal<string | null>(null);

  weekStats = signal<any>(null);
loadingStats = signal(false);
statsLoadedOnce = signal(false);
downloadPhaseForm: DownloadPhaseForm = {
  semaine: '',
  errors: {}
};

downloadLineSummaryForm: DownloadLineSummaryForm = {
  semaine: '',
  ligne: '',
  errors: {}
};

lineSummaryStats = signal<any>(null);

charts: Chart[] = [];
  
  


  // Formulaires
  createForm: CreateLineForm = {
    ligne: '',
    references: '',
    image: null,
    imagePreview: null,
    errors: {}
  };

  matierePremiereForm: MatierePremiereForm = {
  ligne: '',
  refMatierePremier: '',
  errors: {}
};


  statsAnnuellesForm: StatsAnnuellesForm = {
  date: '',
  errors: {}
};

statsAnnuellesPreview = signal<StatsAnnuellesResponse | null>(null);

  addRefForm: AddReferencesForm = {
  selectedLine: '', // Vide initialement
  references: '',
  errors: {}
};

statsForm: StatsForm = {
  semaine: '',
  ligne: '',
  errors: {}
};

loadingStatsData = signal(false);
statsData = signal<any>(null);

  weekForm: WeekForm = {
  nom: '', // Au lieu de weekNumber
  dateDebut: '',
  dateFin: '',
  errors: {}
};

stats5MAnnuellesForm: StatsAnnuellesForm = {
  date: '',
  errors: {}
};
stats5MAnnuellesPreview = signal<Stats5MAnnuellesResponse | null>(null);

  userForm: UserForm = {
    nom: '',
    prenom: '',
    password: '',
    errors: {}
  };

  timeForm: TimeForm = {
  selectedLine: '',
  selectedReference: '',
  seconde: 0,
  errors: {}
};

  workerForm: WorkerForm = {
    matricule: null,
    nomPrenom: '',
    errors: {}
  };

  phaseForm: PhaseForm = {
  mode: 'add', // Par défaut en mode ajout
  selectedLine: '',
  phase: '',
  errors: {}
};

  availableWeeks: number[] = [];

  // Computed properties
  totalLines = computed(() => this.lines().length);
  totalReferences = computed(() => 
    this.lines().reduce((total, line) => {
      return total + (line.references?.length || 0);

    }, 0)
  );
  totalUsers = computed(() => this.users().length);



  // Statistiques par défaut
  private totalLinesCount = signal(0);

  ngOnInit() {
  this.generateParticles();
  this.generateAvailableWeeks();
  this.loadLines();
  this.loadUsers();
  this.loadStats();
  this.loadMatierePremieres();
  
  // Watcher pour le changement de semaine
  effect(() => {
    const semaine = this.downloadPhaseForm.semaine;
    if (semaine.trim()) {
      this.loadWeekStats(semaine);
    }
  });
    effect(() => {
    const { semaine, ligne } = this.downloadLineSummaryForm;
    if (semaine.trim() && ligne.trim()) {
      this.loadLineSummaryData();
    }
  });
  effect(() => {
  const date = this.statsAnnuellesForm.date;
  if (date && date.trim()) {
    this.loadStatsAnnuellesPreview(date);
  }
});
effect(() => {
  const date = this.stats5MAnnuellesForm.date;
  if (date && date.trim()) {
    this.loadStats5MAnnuellesPreview(date);
  }
});
}
private loadStats5MAnnuellesPreview(date: string) {
  if (!date || !date.trim()) {
    this.stats5MAnnuellesPreview.set(null);
    return;
  }

  this.loading.set(true);
  
  this.stats5MAnnuelService.getStats5MParMois(date.trim())
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur chargement aperçu stats 5M:', error);
        this.stats5MAnnuellesPreview.set(null);
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (data) => {
        if (data) {
          this.stats5MAnnuellesPreview.set(data);
        }
      }
    });
}

private loadMatierePremieres() {
  this.loading.set(true);
  
  this.matierePremiereService.findAll()
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors du chargement des matières premières:', error);
        this.errorMessage.set('Impossible de charger les matières premières');
        return of([]);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (matieres) => {
        this.matierePremieres.set(matieres);
      }
    });
}

async onAddMatierePremiere() {
  // Validation
  this.matierePremiereForm.errors = {};
  let hasErrors = false;

  if (!this.matierePremiereForm.ligne.trim()) {
    this.matierePremiereForm.errors.ligne = 'La ligne est requise';
    hasErrors = true;
  }

  if (!this.matierePremiereForm.refMatierePremier.trim()) {
    this.matierePremiereForm.errors.refMatierePremier = 'La référence matière première est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  // Vérifier si la matière première existe déjà
  this.loading.set(true);
  this.errorMessage.set(null);

  try {
    const exists = await this.matierePremiereService.checkIfExists(
      this.matierePremiereForm.ligne.trim(),
      this.matierePremiereForm.refMatierePremier.trim()
    ).toPromise();

    if (exists) {
      this.errorMessage.set(`Une matière première avec cette ligne et cette référence existe déjà !`);
      this.loading.set(false);
      return;
    }

    const createDto = {
      ligne: this.matierePremiereForm.ligne.trim(),
      refMatierePremier: this.matierePremiereForm.refMatierePremier.trim()
    };

    this.matierePremiereService.create(createDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'ajout de la matière première:', error);
          
          if (error.status === 409) {
            this.errorMessage.set(`Une matière première avec cette ligne et cette référence existe déjà`);
          } else {
            this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de la matière première');
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Matière première ajoutée avec succès !`);
            this.resetMatierePremiereForm();
            this.loadMatierePremieres(); // Recharger la liste
          }
        }
      });
      
  } catch (error) {
    this.loading.set(false);
    console.error('Erreur lors de la vérification:', error);
  }
}

// Méthode pour réinitialiser le formulaire
private resetMatierePremiereForm() {
  this.matierePremiereForm = {
    ligne: '',
    refMatierePremier: '',
    errors: {}
  };
  this.errorMessage.set(null);
}

// Méthode pour annuler
onCancelMatierePremiere() {
  this.resetMatierePremiereForm();
  this.activeTab.set('view');
}
private loadStatsAnnuellesPreview(date: string) {
  if (!date || !date.trim()) {
    this.statsAnnuellesPreview.set(null);
    return;
  }

  this.loading.set(true);
  
  this.statsAnnuelService.getStatsPcsParMois(date.trim())
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur chargement aperçu stats annuelles:', error);
        this.statsAnnuellesPreview.set(null);
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (data) => {
        if (data) {
          this.statsAnnuellesPreview.set(data);
        }
      }
    });
}

/**
 * Extraire l'année d'une date
 */
getYearFromDate(dateStr: string): number | string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.getFullYear();
  } catch (e) {
    return '';
  }
}

// Méthode pour vérifier si une matière première existe déjà
checkMatierePremiereExists(): boolean {
  if (!this.matierePremiereForm.ligne.trim() || !this.matierePremiereForm.refMatierePremier.trim()) {
    return false;
  }
  
  return this.matierePremieres().some(matiere => 
    matiere.ligne === this.matierePremiereForm.ligne.trim() &&
    matiere.refMatierePremier === this.matierePremiereForm.refMatierePremier.trim()
  );
}

// Méthode pour supprimer une matière première
onDeleteMatierePremiere(id: number) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette matière première ?')) {
    this.loading.set(true);
    
    this.matierePremiereService.remove(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la suppression:', error);
          this.errorMessage.set('Erreur lors de la suppression de la matière première');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage('Matière première supprimée avec succès !');
            this.loadMatierePremieres(); // Recharger la liste
          }
        }
      });
  }
}

// Méthodes pour les statistiques
getUniqueLignes(): string[] {
  const lignes = this.matierePremieres().map(m => m.ligne);
  return [...new Set(lignes)];
}

getUniqueRefs(): string[] {
  const refs = this.matierePremieres().map(m => m.refMatierePremier);
  return [...new Set(refs)];
}

/**
 * Télécharger le fichier Excel des stats annuelles
 */
async onDownloadStatsAnnuelles() {
  // Validation
  this.statsAnnuellesForm.errors = {};
  let hasErrors = false;

  if (!this.statsAnnuellesForm.date.trim()) {
    this.statsAnnuellesForm.errors.date = 'La date est requise';
    hasErrors = true;
  } else {
    // Valider le format de date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(this.statsAnnuellesForm.date)) {
      this.statsAnnuellesForm.errors.date = 'Format de date invalide (YYYY-MM-DD requis)';
      hasErrors = true;
    }
  }

  if (hasErrors) return;

  this.loading.set(true);
  this.errorMessage.set(null);

  try {
    // Récupérer les données
    const data = await this.getStatsAnnuelles(this.statsAnnuellesForm.date.trim());
    
    if (!data) {
      this.errorMessage.set('Aucune donnée disponible pour cette année');
      this.loading.set(false);
      return;
    }

    // Générer le fichier Excel
    await this.generateStatsAnnuellesExcel(data);
    
    this.showSuccessMessage(`Statistiques annuelles ${data.annee} téléchargées avec succès !`);
    
  } catch (error: any) {
    console.error('Erreur lors du téléchargement:', error);
    
    if (error.status === 404) {
      this.errorMessage.set(`Aucune donnée trouvée pour l'année sélectionnée`);
    } else {
      this.errorMessage.set(error.message || 'Erreur lors de la génération du rapport');
    }
  } finally {
    this.loading.set(false);
  }
}

/**
 * Récupérer les données depuis l'API
 */
private getStatsAnnuelles(date: string): Promise<StatsAnnuellesResponse> {
  return new Promise((resolve, reject) => {
    this.statsAnnuelService.getStatsPcsParMois(date)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          reject(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response) {
            resolve(response);
          } else {
            reject(new Error('Aucune donnée reçue'));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
  });
}

/**
 * Générer le fichier Excel
 */
private async generateStatsAnnuellesExcel(data: StatsAnnuellesResponse): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Productivité ${data.annee}`);
  
  // Définir les noms des mois (avec abréviations)
  const moisNoms = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  
  const moisAbrev = [
    'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
    'juil', 'août', 'sept', 'oct', 'nov', 'déc'
  ];

  // Titre principal (ligne 1)
  const titleRow = worksheet.addRow([`Productivité`]);
  titleRow.height = 40;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { 
    bold: true, 
    size: 18,
    color: { argb: 'FFFFFF' }
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1565C0' }
  };
  titleCell.alignment = { 
    vertical: 'middle', 
    horizontal: 'center' 
  };
  worksheet.mergeCells(1, 1, 1, 15);

  // Sous-titre "Productivité" (ligne 2)
  const subtitleRow = worksheet.addRow(['Productivité']);
  subtitleRow.height = 25;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(2, 1, 2, 15);

  // TdB (ligne 3 - colonne M)
  worksheet.getCell('M3').value = 'TdB';
  worksheet.getCell('M3').alignment = { horizontal: 'right' };

  // URL (ligne 4)
  const urlRow = worksheet.addRow(['']);
  const urlCell = urlRow.getCell(1);
  urlCell.font = { size: 10, color: { argb: '0000FF' }, underline: true };
  urlCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(4, 1, 4, 15);

  // Pilote (ligne 4 - colonne M)
  worksheet.getCell('M4').value = '';
  worksheet.getCell('M4').alignment = { horizontal: 'right' };

  // En-têtes des colonnes (ligne 5)
  const headers = [
    'LP',
    'Lignes',
    ...moisAbrev.map(m => `${m}-${String(data.annee).slice(-2)}`),
    'Productivité\nLignes'
  ];
  
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 30;
  
  // Style des en-têtes
  headerRow.eachCell((cell) => {
    cell.font = { 
      bold: true, 
      size: 10,
      color: { argb: '000000' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Données des lignes
  data.lignes.forEach((ligne, index) => {
    const rowData = [
      index + 1, // LP (numéro de ligne)
      ligne.ligne,
      ...moisNoms.map(mois => {
        const pcsProd = ligne.mois[mois]?.pcsProd || 0;
        return pcsProd > 0 ? `${pcsProd.toFixed(2)}%` : '';
      }),
      `${ligne.moyenneAnnuelle.toFixed(2)}%`
    ];
    
    const dataRow = worksheet.addRow(rowData);
    
    // Style des cellules de données
    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: colNumber <= 2 ? 'left' : 'center'
      };
      
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // Couleur de fond alternée
      if (index % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    });
  });

  // Ligne OBJECTIF
  const objectifRow = worksheet.addRow([
    '',
    'OBJECTIF',
    ...Array(12).fill('95,00%'),
    '95,00%'
  ]);
  
  objectifRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: colNumber <= 2 ? 'left' : 'center'
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD700' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Ligne Productivité Mensuel
  const prodMensuelRow = worksheet.addRow([
    '',
    'Productivité Mensuel',
    ...moisNoms.map(mois => {
      const prod = data.productiviteMensuelle[mois] || 0;
      return prod > 0 ? `${prod.toFixed(2)}%` : '';
    }),
    `${data.moyenneAnnuelleGlobale.toFixed(2)}%`
  ]);
  
  prodMensuelRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: colNumber <= 2 ? 'left' : 'center'
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '90EE90' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Ajuster les largeurs des colonnes
  worksheet.columns = [
    { width: 6 },  // LP
    { width: 20 }, // Lignes
    ...Array(12).fill({ width: 10 }), // Mois
    { width: 14 }  // Productivité Lignes
  ];

  // Générer le fichier
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `productivite-annuelle-${data.annee}-${dateStr}.xlsx`);
}

/**
 * Annuler et réinitialiser le formulaire
 */
onCancelStatsAnnuelles() {
  this.resetStatsAnnuellesForm();
  this.activeTab.set('view');
}

/**
 * Réinitialiser le formulaire
 */
private resetStatsAnnuellesForm() {
  this.statsAnnuellesForm = {
    date: '',
    errors: {}
  };
  this.statsAnnuellesPreview.set(null);
  this.errorMessage.set(null);
}


  phases = signal<any[]>([]);
selectedPhaseForEdit: any = null;

  private generateParticles() {
    const particles = [];
    for (let i = 0; i < 25; i++) {
      particles.push({
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 8 + 2}px`,
        animationDelay: `${Math.random() * 15}s`,
        opacity: `${Math.random() * 0.4 + 0.1}`
      });
    }
    this.particles.set(particles);
  }

  private generateAvailableWeeks() {
    this.availableWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
  }

  private loadLines() {
    this.loading.set(true);
    this.errorMessage.set(null);
    
    this.productService.getAllLines()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des lignes:', error);
          this.errorMessage.set('Impossible de charger les lignes. Vérifiez la connexion au serveur.');
          return of({ lines: [], total: 0 });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          const linesWithFullImageUrls = response.lines.map(line => ({
            ...line,
            imageUrl: this.productService.getImageUrl(line.imageUrl),
            references: line.references || []
          }));
          this.lines.set(linesWithFullImageUrls);
        }
      });
  }

  private loadPhases() {
  this.loading.set(true);
  
  this.phaseService.findAll()
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors du chargement des phases:', error);
        return of([]);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (phases) => {
        this.phases.set(phases);
      }
    });
}

// Méthode pour basculer entre mode ajout et édition
setPhaseMode(mode: 'add' | 'edit') {
  this.phaseForm.mode = mode;
  this.resetPhaseForm();
  
  if (mode === 'edit') {
    // Charger les phases pour la sélection
    this.loadPhases();
  }
}

// Obtenir les phases pour la ligne sélectionnée
getPhasesForSelectedLine(): any[] {
  if (!this.phaseForm.selectedLine) {
    return [];
  }
  
  return this.phases().filter(phase => 
    phase.ligne === this.phaseForm.selectedLine
  );
}

// Sélectionner une phase pour modification
selectPhaseForEdit(phase: any) {
  this.selectedPhaseForEdit = phase;
  this.phaseForm.selectedLine = phase.ligne;
  this.phaseForm.phase = phase.phase;
  this.phaseForm.mode = 'edit';
}

// Vérifier si une phase existe déjà pour la ligne sélectionnée
checkIfPhaseExists(): boolean {
  if (!this.phaseForm.selectedLine || !this.phaseForm.phase.trim()) {
    return false;
  }
  
  return this.phases().some(phase => 
    phase.ligne === this.phaseForm.selectedLine && 
    phase.phase === this.phaseForm.phase.trim()
  );
}

  private loadUsers() {
    this.loading.set(true);
    
    this.userService.findAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des utilisateurs:', error);
          // Utilisateurs de test en cas d'erreur
          return of([
            { 
              id: 1, 
              nom: '1234', 
              prenom: 'Admin',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            { 
              id: 2, 
              nom: '5678', 
              prenom: 'Utilisateur',
              isActive: true,
              createdAt: new Date().toISOString()
            }
          ]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (users) => {
          this.users.set(users);
        }
      });
  }

  private loadStats() {
    this.productService.getStats()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des stats:', error);
          return of({ totalLines: 0 });
        })
      )
      .subscribe({
        next: (stats) => {
          this.totalLinesCount.set(stats.totalLines || 0);
        }
      });
  }

  onSearch() {
    const query = this.searchQuery().toLowerCase().trim();
    
    if (!query) {
      this.loadLines();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.productService.searchLines(query)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la recherche:', error);
          this.errorMessage.set('Erreur lors de la recherche.');
          return of({ lines: [], query });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          const linesWithFullImageUrls = response.lines.map(line => ({
            ...line,
            imageUrl: this.productService.getImageUrl(line.imageUrl),
            references: line.references || []
          }));
          this.lines.set(linesWithFullImageUrls);
        }
      });
  }

  onCreateLine() {
    this.createForm.errors = {};
    let hasErrors = false;

    if (!this.createForm.ligne.trim()) {
      this.createForm.errors.ligne = 'Le nom de la ligne est requis';
      hasErrors = true;
    }

    if (!this.createForm.references.trim()) {
      this.createForm.errors.references = 'Au moins une référence est requise';
      hasErrors = true;
    }

    if (hasErrors) return;

    const references = this.productService.parseReferences(this.createForm.references);
    if (references.length === 0) {
      this.createForm.errors.references = 'Veuillez saisir au moins une référence valide';
      return;
    }

    const createData = {
      ligne: this.createForm.ligne.trim(),
      references
    };

    this.loading.set(true);
    this.errorMessage.set(null);

    this.productService.createLineWithImage(createData, this.createForm.image)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la création:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la création de la ligne');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage('Ligne créée avec succès !');
            this.resetCreateForm();
            this.activeTab.set('view');
            this.loadLines();
          }
        }
      });
  }

  onAddReferences() {
  // Validation
  this.addRefForm.errors = {};
  let hasErrors = false;

  if (!this.addRefForm.selectedLine.trim()) {
    this.addRefForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.addRefForm.references.trim()) {
    this.addRefForm.errors.references = 'Au moins une référence est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  const references = this.productService.parseReferences(this.addRefForm.references);
  if (references.length === 0) {
    this.addRefForm.errors.references = 'Veuillez saisir au moins une référence valide';
    return;
  }

  this.loading.set(true);
  this.errorMessage.set(null);

  this.productService.addReferences(this.addRefForm.selectedLine.trim(), references)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de l\'ajout des références:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout des références');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          let message = 'Références ajoutées avec succès !';
          if (response.existingReferences && response.existingReferences.length > 0) {
            message = `${response.addedReferences.length} référence(s) ajoutée(s), ${response.existingReferences.length} référence(s) existaient déjà`;
          }
          
          this.showSuccessMessage(message);
          this.resetAddRefForm();
          this.activeTab.set('view');
          this.loadLines(); // Recharger la liste
        }
      }
    });
}

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.createForm.errors.image = 'Veuillez sélectionner une image valide (JPEG, PNG, etc.)';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.createForm.errors.image = 'L\'image ne doit pas dépasser 5MB';
        return;
      }

      this.createForm.image = file;
      this.createForm.errors.image = '';

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.createForm.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.createForm.image = null;
    this.createForm.imagePreview = null;
    this.createForm.errors.image = '';
  }

  selectLine(line: ProductLine) {
    this.loading.set(true);
    
    this.productService.getLine(line.ligne)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des détails:', error);
          this.errorMessage.set('Impossible de charger les détails de la ligne');
          return of(line);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (detailedLine) => {
          this.selectedLine.set({
            ...detailedLine,
            imageUrl: this.productService.getImageUrl(detailedLine.imageUrl),
            references: detailedLine.references || []
          });
        }
      });
  }

  closeModal() {
    this.selectedLine.set(null);
  }

  

  private showSuccessMessage(message: string) {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => {
      this.showSuccess.set(false);
    }, 3000);
  }

  private resetCreateForm() {
    this.createForm = {
      ligne: '',
      references: '',
      image: null,
      imagePreview: null,
      errors: {}
    };
  }

  private resetAddRefForm() {
  this.addRefForm = {
    selectedLine: '',
    references: '',
    errors: {}
  };
}

  goBackToLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onAddUser() {
    this.userForm.errors = {};
    let hasErrors = false;

    if (!this.userForm.nom.trim()) {
      this.userForm.errors.nom = 'Le nom est requis';
      hasErrors = true;
    } else if (!/^\d+$/.test(this.userForm.nom)) {
      this.userForm.errors.nom = 'Le nom doit contenir uniquement des chiffres';
      hasErrors = true;
    } else if (this.userForm.nom.length < 4 || this.userForm.nom.length > 10) {
      this.userForm.errors.nom = 'Le nom doit contenir entre 4 et 10 chiffres';
      hasErrors = true;
    }

    if (!this.userForm.prenom.trim()) {
      this.userForm.errors.prenom = 'Le prénom est requis';
      hasErrors = true;
    } else if (this.userForm.prenom.length > 50) {
      this.userForm.errors.prenom = 'Le prénom ne doit pas dépasser 50 caractères';
      hasErrors = true;
    }

    if (!this.userForm.password.trim()) {
      this.userForm.errors.password = 'Le mot de passe est requis';
      hasErrors = true;
    } else if (!/^\d+$/.test(this.userForm.password)) {
      this.userForm.errors.password = 'Le mot de passe doit contenir uniquement des chiffres';
      hasErrors = true;
    } else if (this.userForm.password.length < 4 || this.userForm.password.length > 10) {
      this.userForm.errors.password = 'Le mot de passe doit contenir entre 4 et 10 chiffres';
      hasErrors = true;
    }

    if (hasErrors) return;

    const createUserDto = {
      nom: this.userForm.nom,
      prenom: this.userForm.prenom,
      password: this.userForm.password
    };

    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService.create(createUserDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la création de l\'utilisateur:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la création de l\'utilisateur');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Utilisateur "${this.userForm.nom} ${this.userForm.prenom}" créé avec succès !`);
            this.resetUserForm();
            this.loadUsers();
          }
        }
      });
  }

  private resetUserForm() {
    this.userForm = {
      nom: '',
      prenom: '',
      password: '',
      errors: {}
    };
  }

  onCancelUser() {
    this.resetUserForm();
  }

 // src/app/prod/prod.component.ts (dans onCreateWeek)
onCreateWeek() {
  // Validation
  this.weekForm.errors = {};
  let hasErrors = false;

  if (!this.weekForm.nom.trim()) {
    this.weekForm.errors.nom = 'Le nom de la semaine est requis';
    hasErrors = true;
  } else if (!/^semaine[0-9]{1,2}$/.test(this.weekForm.nom.trim())) {
    this.weekForm.errors.nom = 'Le nom doit être au format "semaineXX"';
    hasErrors = true;
  }

  if (!this.weekForm.dateDebut.trim()) {
    this.weekForm.errors.dateDebut = 'La date de début est requise';
    hasErrors = true;
  }

  if (!this.weekForm.dateFin.trim()) {
    this.weekForm.errors.dateFin = 'La date de fin est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  // Formater les dates en YYYY-MM-DD
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const createSemaineDto = {
    nom: this.weekForm.nom.trim(),
    dateDebut: formatDate(this.weekForm.dateDebut),
    dateFin: formatDate(this.weekForm.dateFin)
  };

  console.log('Dates envoyées au backend:', createSemaineDto);

  this.loading.set(true);
  this.errorMessage.set(null);

  this.semaineService.createSemaine(createSemaineDto)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de la création de la semaine:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de la création de la semaine');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          console.log('Réponse du backend:', response);
          this.showSuccessMessage(`Semaine "${this.weekForm.nom}" créée avec succès !`);
          this.resetWeekForm();
          this.activeTab.set('view');
        }
      }
    });
}

  private resetWeekForm() {
  this.weekForm = {
    nom: '',
    dateDebut: '',
    dateFin: '',
    errors: {}
  };
}

  onCancelWeek() {
    this.resetWeekForm();
    this.activeTab.set('view');
  }

 onAddTime() {
  // Validation
  this.timeForm.errors = {};
  let hasErrors = false;

  if (!this.timeForm.selectedLine.trim()) {
    this.timeForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.timeForm.selectedReference.trim()) {
    this.timeForm.errors.selectedReference = 'Veuillez sélectionner une référence';
    hasErrors = true;
  }

  if (!this.timeForm.seconde || this.timeForm.seconde <= 0) {
    this.timeForm.errors.seconde = 'Veuillez saisir un temps valide (supérieur à 0)';
    hasErrors = true;
  }

  if (hasErrors) return;

  const createTempsSecDto = {
    ligne: this.timeForm.selectedLine,
    reference: this.timeForm.selectedReference,
    seconde: this.timeForm.seconde
  };

  this.loading.set(true);
  this.errorMessage.set(null);

  this.tempsSecService.createOrUpdate(createTempsSecDto)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de l\'ajout du temps:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout du temps');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          this.showSuccessMessage(`Temps de ${this.timeForm.seconde} secondes ajouté pour ${this.timeForm.selectedLine} - ${this.timeForm.selectedReference} !`);
          this.resetTimeForm();
          this.activeTab.set('view');
        }
      }
    });
}

  private resetTimeForm() {
  this.timeForm = {
    selectedLine: '',
    selectedReference: '',
    seconde: 0,
    errors: {}
  };
}

  onCancelTime() {
    this.resetTimeForm();
    this.activeTab.set('view');
  }

  async onAddWorker() {
  // Validation
  this.workerForm.errors = {};
  let hasErrors = false;

  if (!this.workerForm.matricule) {
    this.workerForm.errors.matricule = 'Le matricule est requis';
    hasErrors = true;
  } else if (this.workerForm.matricule < 1 || this.workerForm.matricule > 999999) {
    this.workerForm.errors.matricule = 'Le matricule doit être entre 1 et 999999';
    hasErrors = true;
  }

  if (!this.workerForm.nomPrenom.trim()) {
    this.workerForm.errors.nomPrenom = 'Le nom et prénom sont requis';
    hasErrors = true;
  }

  if (hasErrors) return;

  // VÉRIFICATION SI L'OUVRIER EXISTE DÉJÀ
  this.loading.set(true);
  this.errorMessage.set(null);
  
  try {
    // Vérifier si l'ouvrier existe déjà
    const ouvrierExists = await this.checkIfWorkerExists(this.workerForm.matricule!);
    
    if (ouvrierExists) {
      this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
      this.loading.set(false);
      return;
    }

    // Si l'ouvrier n'existe pas, procéder à la création
    const createOuvrierDto = {
      matricule: this.workerForm.matricule!,
      nomPrenom: this.workerForm.nomPrenom
    };

    this.ouvrierService.create(createOuvrierDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'ajout de l\'ouvrier:', error);
          
          // Gestion spécifique des erreurs de conflit (matricule déjà existant)
          if (error.status === 409) {
            this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
          } else {
            this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de l\'ouvrier');
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Ouvrier "${this.workerForm.nomPrenom}" (${this.workerForm.matricule}) ajouté avec succès !`);
            this.resetWorkerForm();
            this.activeTab.set('view');
          }
        }
      });
      
  } catch (error) {
    this.loading.set(false);
    console.error('Erreur lors de la vérification:', error);
  }
}

  

  onCancelWorker() {
    this.resetWorkerForm();
    this.activeTab.set('view');
  }

  onAddPhase() {
  // Validation
  this.phaseForm.errors = {};
  let hasErrors = false;

  if (!this.phaseForm.selectedLine.trim()) {
    this.phaseForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.phaseForm.phase.trim()) {
    this.phaseForm.errors.phase = 'Le numéro de phase est requis';
    hasErrors = true;
  } else if (this.phaseForm.phase.trim().length > 10) {
    this.phaseForm.errors.phase = 'La phase ne doit pas dépasser 10 caractères';
    hasErrors = true;
  }

  if (hasErrors) return;

  const createPhaseDto = {
    ligne: this.phaseForm.selectedLine,
    phase: this.phaseForm.phase.trim()
  };

  // Vérifier si la phase existe déjà (sauf en mode édition de cette même phase)
  const phaseExists = this.checkIfPhaseExists();
  
  if (phaseExists && this.phaseForm.mode === 'add') {
    this.errorMessage.set(`La phase "${this.phaseForm.phase}" existe déjà pour la ligne "${this.phaseForm.selectedLine}"`);
    return;
  }

  this.loading.set(true);
  this.errorMessage.set(null);

  if (this.phaseForm.mode === 'add') {
    // Mode AJOUT
    this.phaseService.create(createPhaseDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'ajout de la phase:', error);
          
          if (error.status === 409) {
            this.errorMessage.set(`La phase "${this.phaseForm.phase}" existe déjà pour cette ligne`);
          } else {
            this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de la phase');
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Phase "${this.phaseForm.phase}" ajoutée pour la ligne "${this.phaseForm.selectedLine}" !`);
            this.resetPhaseForm();
            this.loadPhases(); // Recharger la liste
            this.activeTab.set('view');
          }
        }
      });
  } else {
    // Mode ÉDITION
    if (!this.selectedPhaseForEdit || !this.selectedPhaseForEdit.id) {
      this.errorMessage.set('Aucune phase sélectionnée pour modification');
      this.loading.set(false);
      return;
    }

    const updatePhaseDto = {
      phase: this.phaseForm.phase.trim()
    };

    this.phaseService.update(this.selectedPhaseForEdit.id, updatePhaseDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la modification de la phase:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la modification de la phase');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Phase modifiée avec succès ! Nouveau numéro: "${this.phaseForm.phase}"`);
            this.resetPhaseForm();
            this.loadPhases(); // Recharger la liste
            this.activeTab.set('view');
          }
        }
      });
  }
}

  private resetPhaseForm() {
  this.phaseForm = {
    mode: this.phaseForm.mode, // Garder le mode actuel
    selectedLine: '',
    phase: '',
    errors: {}
  };
  this.selectedPhaseForEdit = null;
  this.errorMessage.set(null);
}

  

  openImageUpload() {
    this.showImageUploadModal = true;
    this.selectedLineImage = null;
    this.lineImagePreview = null;
    this.imageUploadError = null;
  }

  closeImageUploadModal() {
    this.showImageUploadModal = false;
    this.selectedLineImage = null;
    this.lineImagePreview = null;
    this.imageUploadError = null;
  }

  onLineImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.imageUploadError = 'Veuillez sélectionner une image valide (JPEG, PNG, etc.)';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.imageUploadError = 'L\'image ne doit pas dépasser 5MB';
        return;
      }

      this.selectedLineImage = file;
      this.imageUploadError = null;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.lineImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  onDeletePhase(phaseId: number) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette phase ?')) {
    this.loading.set(true);
    
    this.phaseService.remove(phaseId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la suppression:', error);
          this.errorMessage.set('Erreur lors de la suppression de la phase');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage('Phase supprimée avec succès !');
            this.loadPhases(); // Recharger la liste
          }
        }
      });
  }
}

// Mettez à jour onCancelPhase
onCancelPhase() {
  this.resetPhaseForm();
  this.activeTab.set('view');
}
/**
 * Obtenir les phases pour une ligne spécifique
 */
getPhasesForLine(ligne: string): any[] {
  return this.phases().filter(phase => phase.ligne === ligne);
}

/**
 * Sélectionner une ligne pour la gestion des phases
 */
selectLineForPhaseManagement(ligne: string) {
  this.phaseForm.selectedLine = ligne;
  this.phaseForm.mode = 'add';
  this.activeTab.set('add-phase');
  this.closeModal();
  
  // Charger les phases pour cette ligne
  this.loadPhases();
}

/**
 * Sélectionner une phase pour modification depuis la vue ligne
 */
selectPhaseForEditFromLine(phase: any) {
  this.selectedPhaseForEdit = phase;
  this.phaseForm.selectedLine = phase.ligne;
  this.phaseForm.phase = phase.phase;
  this.phaseForm.mode = 'edit';
  this.activeTab.set('add-phase');
  this.closeModal();
  
  // Charger toutes les phases
  this.loadPhases();
}
  uploadLineImage() {
    if (!this.selectedLine() || !this.selectedLineImage) {
      this.imageUploadError = 'Veuillez sélectionner une image';
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.imageUploadError = null;

    this.productService.addImageToLine(this.selectedLine()!.ligne, this.selectedLineImage)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'upload de l\'image:', error);
          this.imageUploadError = error.error?.message || 'Erreur lors de l\'upload de l\'image';
          
          if (error.status) {
            this.imageUploadError += ` (Statut: ${error.status})`;
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            const fullImageUrl = response.imageUrl ? 
              this.productService.getImageUrl(response.imageUrl) : 
              null;
            
            this.showSuccessMessage('Photo de la ligne mise à jour avec succès !');
            
            const updatedLines = this.lines().map(line => {
              if (line.ligne === this.selectedLine()!.ligne) {
                return {
                  ...line,
                  imageUrl: fullImageUrl || line.imageUrl
                };
              }
              return line;
            });
            this.lines.set(updatedLines);
            
            if (this.selectedLine()) {
              const updatedSelectedLine = {
                ...this.selectedLine()!,
                imageUrl: fullImageUrl || this.selectedLine()!.imageUrl
              };
              this.selectedLine.set(updatedSelectedLine);
            }
            
            this.closeImageUploadModal();
            
            setTimeout(() => {
              this.loadLines();
            }, 500);
          } else {
            this.imageUploadError = 'Aucune réponse du serveur';
          }
        }
      });
  }
  /**
 * Grouper les lignes par première lettre pour une meilleure organisation
 */
getGroupedLines(): { group: string, lines: ProductLine[] }[] {
  const lines = this.lines();
  
  // Trier les lignes par nom
  const sortedLines = [...lines].sort((a, b) => 
    a.ligne.localeCompare(b.ligne, undefined, { sensitivity: 'base' })
  );
  
  // Grouper par première lettre
  const groups: { [key: string]: ProductLine[] } = {};
  
  sortedLines.forEach(line => {
    const firstLetter = line.ligne.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(line);
  });
  
  // Convertir en tableau
  return Object.keys(groups)
    .sort()
    .map(letter => ({
      group: `Lignes commençant par "${letter}"`,
      lines: groups[letter]
    }));
}

/**
 * Obtenir les détails de la ligne sélectionnée
 */
getSelectedLineDetails(): ProductLine | null {
  if (!this.addRefForm.selectedLine) {
    return null;
  }
  
  return this.lines().find(line => 
    line.ligne === this.addRefForm.selectedLine
  ) || null;
}

/**
 * Sélectionner automatiquement une ligne depuis la vue détaillée
 */
selectLineForAddingRefs(line: ProductLine) {
  this.addRefForm.selectedLine = line.ligne;
  this.activeTab.set('add-ref');
  
  // Faire défiler vers le formulaire
  setTimeout(() => {
    const formElement = document.querySelector('.creation-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

  // Getters pour compatibilité avec le template
  getTotalLines(): number {
    return this.totalLines();
  }

  getTotalReferences(): number {
    return this.totalReferences();
  }

  getTotalUsers(): number {
    return this.totalUsers();
  }

  getUserType(): string | null {
    return this.authService.getUserType();
  }

  logout() {
    this.authService.logout();
  }
  getAvailableReferences(): string[] {
  if (!this.timeForm.selectedLine) {
    return [];
  }
  
  const selectedLine = this.lines().find(line => 
    line.ligne === this.timeForm.selectedLine
  );
  
  return selectedLine?.references || [];
}
onLineSelectedForTime() {
  // Réinitialiser la référence quand on change de ligne
  this.timeForm.selectedReference = '';
  this.timeForm.errors.selectedReference = '';
}
loadExistingTimeForReference() {
  if (!this.timeForm.selectedLine || !this.timeForm.selectedReference) {
    return;
  }
  
  this.tempsSecService.findByLigneAndReference(
    this.timeForm.selectedLine, 
    this.timeForm.selectedReference
  )
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        // Si pas trouvé, c'est normal (premier ajout)
        console.log('Temps non trouvé pour cette combinaison');
        return of(null);
      })
    )
    .subscribe({
      next: (existingTime) => {
        if (existingTime && Array.isArray(existingTime) && existingTime.length > 0) {
          // Si temps existe déjà, pré-remplir le champ
          this.timeForm.seconde = existingTime[0].seconde;
          this.showSuccessMessage(`Temps existant trouvé : ${existingTime[0].seconde} secondes`);
        }
      }
    });
}
/**
 * Vérifier si un ouvrier avec ce matricule existe déjà
 */
async checkIfWorkerExists(matricule: number): Promise<boolean> {
  try {
    // CORRECTION : passer directement le nombre
    await this.ouvrierService.searchByMatricule(matricule).toPromise();
    return true; // Si pas d'erreur, l'ouvrier existe
  } catch (error: any) {
    // Si erreur 404, l'ouvrier n'existe pas
    if (error.status === 404) {
      return false;
    }
    // Pour d'autres erreurs, on considère qu'il n'existe pas
    console.log('Erreur lors de la vérification:', error);
    return false;
  }
}
// Ajoutez ces propriétés
matriculeCheckResult: {
  available: boolean;
  message: string;
  existingWorker?: { matricule: number; nomPrenom: string };
} | null = null;

checkingMatricule = signal(false);

// Méthode pour vérifier le matricule
async onCheckMatricule() {
  if (!this.workerForm.matricule || this.workerForm.matricule < 1) {
    return;
  }

  this.checkingMatricule.set(true);
  this.matriculeCheckResult = null;

  try {
    // Vérifier si l'ouvrier existe
    const exists = await this.checkIfWorkerExists(this.workerForm.matricule);
    
    if (exists) {
      // Si existe, essayer de récupérer ses informations
      try {
        // CORRECTION : passer directement le nombre
        const existingWorker = await this.ouvrierService.searchByMatricule(this.workerForm.matricule!).toPromise();
        
        this.matriculeCheckResult = {
          available: false,
          message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`,
          existingWorker: existingWorker
        };
      } catch (error) {
        this.matriculeCheckResult = {
          available: false,
          message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`
        };
      }
    } else {
      this.matriculeCheckResult = {
        available: true,
        message: `✅ Le matricule ${this.workerForm.matricule} est disponible`
      };
    }
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    this.matriculeCheckResult = {
      available: false,
      message: '⚠️ Erreur lors de la vérification du matricule'
    };
  } finally {
    this.checkingMatricule.set(false);
  }
}
// Méthode pour générer la liste des semaines
getWeeksList(): string[] {
  const weeks = [];
  for (let i = 1; i <= 52; i++) {
    weeks.push(`semaine${i}`);
  }
  return weeks;
}

// Méthode pour suggérer un autre matricule
suggestDifferentMatricule() {
  // Générer un matricule aléatoire dans la plage 1000-9999
  const suggestedMatricule = Math.floor(Math.random() * 9000) + 1000;
  this.workerForm.matricule = suggestedMatricule;
  this.matriculeCheckResult = null;
  
  // Vérifier automatiquement le nouveau matricule après un délai
  setTimeout(() => {
    this.onCheckMatricule();
  }, 500);
}

// Mettez à jour resetWorkerForm pour réinitialiser aussi le résultat de vérification
private resetWorkerForm() {
  this.workerForm = {
    matricule: null,
    nomPrenom: '',
    errors: {}
  };
  this.matriculeCheckResult = null;
}
/**
 * Sélectionner une référence pour définir son temps depuis la vue détaillée
 */
selectRefForTimeSetting(ligne: string, reference: string) {
  this.timeForm.selectedLine = ligne;
  this.timeForm.selectedReference = reference;
  
  // Charger le temps existant si disponible
  this.loadExistingTimeForReference();
  
  // Basculer vers l'onglet temps
  this.activeTab.set('add-time');
  this.closeModal();
  
  // Faire défiler vers le formulaire
  setTimeout(() => {
    const formElement = document.querySelector('.creation-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}
async onDownloadPhaseReports() {
  // Validation
  this.downloadPhaseForm.errors = {};
  let hasErrors = false;

  if (!this.downloadPhaseForm.semaine.trim()) {
    this.downloadPhaseForm.errors.semaine = 'Le nom de la semaine est requis';
    hasErrors = true;
  }

  if (hasErrors) return;

  this.loading.set(true);
  this.errorMessage.set(null);

  try {
    // 1. Récupérer les données depuis le backend
    const rapports = await this.getPhaseReportsForWeek(this.downloadPhaseForm.semaine.trim());
    
    // VÉRIFICATION SI LA SEMAINE EXISTE
    if (!rapports) {
      this.errorMessage.set(`Erreur lors de la récupération des données pour la semaine "${this.downloadPhaseForm.semaine}"`);
      this.loading.set(false);
      return;
    }
    
    if (rapports.length === 0) {
      this.errorMessage.set(`⚠️ Aucun rapport trouvé pour la semaine "${this.downloadPhaseForm.semaine}"`);
      this.loading.set(false);
      return;
    }

    // 2. Générer le fichier Excel
    await this.generateExcelFile(rapports, this.downloadPhaseForm.semaine.trim());
    
    this.showSuccessMessage(`✅ Rapports de la semaine "${this.downloadPhaseForm.semaine}" téléchargés avec succès !`);
    
  } catch (error: any) {
    console.error('Erreur lors du téléchargement:', error);
    
    // Messages d'erreur spécifiques
    if (error.status === 404) {
      this.errorMessage.set(`❌ La semaine "${this.downloadPhaseForm.semaine}" n'existe pas dans la base de données`);
    } else if (error.status === 500) {
      this.errorMessage.set('❌ Erreur serveur. Veuillez réessayer plus tard');
    } else if (error.message && error.message.includes('semaine')) {
      this.errorMessage.set(`❌ Semaine "${this.downloadPhaseForm.semaine}" introuvable`);
    } else {
      this.errorMessage.set(error.message || '❌ Erreur lors du téléchargement des rapports');
    }
  } finally {
    this.loading.set(false);
  }
}

// Méthode pour récupérer les rapports depuis le backend
// Méthode pour récupérer les rapports depuis le backend
private getPhaseReportsForWeek(semaine: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    this.rapportPhaseService.getRapportsBySemaine(semaine)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          // Rejeter avec l'erreur pour pouvoir la traiter dans onDownloadPhaseReports
          reject(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response && response.rapports) {
            resolve(response.rapports);
          } else if (response && response.message) {
            // Si le backend retourne un message d'erreur
            reject(new Error(response.message));
          } else {
            resolve([]);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
  });
}
// Ajoutez cette méthode dans la classe ProdComponent
onSemaineChange(value: string) {
  // Réinitialiser les messages d'erreur
  this.errorMessage.set(null);
  this.downloadPhaseForm.errors = {};
  
  // Charger les statistiques si la semaine n'est pas vide
  if (value && value.trim()) {
    this.loadWeekStats(value.trim());
  } else {
    this.weekStats.set(null);
    this.statsLoadedOnce.set(false);
  }
}


// Méthode pour charger les statistiques de la semaine
loadWeekStats(semaine: string) {
  if (!semaine.trim()) {
    this.weekStats.set(null);
    return;
  }

  this.loadingStats.set(true);
  
  this.rapportPhaseService.getStatsSemaine(semaine)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.log('Aucune statistique disponible pour cette semaine:', error);
        
        // Afficher un message dans l'interface
        if (error.status === 404) {
          this.weekStats.set({
            message: `La semaine "${semaine}" n'existe pas`,
            totalRapports: 0,
            totalOuvriers: 0,
            totalLignes: 0
          });
        } else {
          this.weekStats.set(null);
        }
        
        return of(null);
      }),
      finalize(() => {
        this.loadingStats.set(false);
        this.statsLoadedOnce.set(true);
      })
    )
    .subscribe({
      next: (stats) => {
        this.weekStats.set(stats);
      }
    });
}
// Méthode pour générer le fichier Excel

private async generateExcelFile(rapports: any[], semaine: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Rapports ${semaine}`);
  
  // En-têtes BASÉS SUR VOTRE TABLEAU SQL
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Semaine', key: 'semaine', width: 15 },
    { header: 'Jour', key: 'jour', width: 15 },
    { header: 'Ligne', key: 'ligne', width: 20 },
    { header: 'Matricule', key: 'matricule', width: 15 },
    { header: 'Nom Prénom', key: 'nomPrenom', width: 25 },
    { header: 'Date Création', key: 'createdAt', width: 25 },
    { header: 'Date Modification', key: 'updatedAt', width: 25 },
    { header: 'Phases', key: 'phases', width: 40 },
    { header: 'Total Heures/Jour', key: 'totalHeuresJour', width: 20 },
    { header: 'Heures Restantes', key: 'heuresRestantes', width: 20 },
    { header: 'Nb Phases/Jour', key: 'nbPhasesJour', width: 20 },
    { header: 'PCS Prod Ligne', key: 'pcsProdLigne', width: 20 },
    { header: 'Pourcentage Total Écart', key: 'pourcentageTotalEcart', width: 25 }
  ];
  
  // Données - UTILISER LES VRAIS CHAMPS DE VOTRE BASE
   rapports.forEach((rapport, index) => {
    // Traiter les phases - CORRECTION ICI
    let phasesDisplay = this.formatPhasesForDisplay(rapport.phases);
    
    const row = worksheet.addRow({
      id: rapport.id || index + 1,
      semaine: rapport.semaine || 'N/A',
      jour: rapport.jour || 'N/A',
      ligne: rapport.ligne || 'N/A',
      matricule: rapport.matricule || 'N/A',
      nomPrenom: rapport.nomPrenom || 'N/A',
      createdAt: rapport.createdAt 
        ? this.formatDateTime(rapport.createdAt) 
        : 'N/A',
      updatedAt: rapport.updatedAt 
        ? this.formatDateTime(rapport.updatedAt) 
        : 'N/A',
      phases: phasesDisplay,
      totalHeuresJour: rapport.totalHeuresJour || 0,
      heuresRestantes: rapport.heuresRestantes || 0,
      nbPhasesJour: rapport.nbPhasesJour || 0,
      pcsProdLigne: rapport.pcsProdLigne || 0,
      pourcentageTotalEcart: rapport.pourcentageTotalEcart || 0 
    });
    
    // Style alterné
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F8F9FA' }
      };
    }
    
    // Format pour les nombres
    const totalHeuresCell = row.getCell('totalHeuresJour');
    totalHeuresCell.numFmt = '0.00';
    
    const heuresRestantesCell = row.getCell('heuresRestantes');
    heuresRestantesCell.numFmt = '0.00';

    const pourcentageCell = row.getCell('pourcentageTotalEcart');
    pourcentageCell.numFmt = '0.00%';
  });
  
  // Style des en-têtes
  const headerRow = worksheet.getRow(1);
  headerRow.font = { 
    bold: true, 
    color: { argb: 'FFFFFF' },
    size: 12
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2E7D32' } // Vert foncé
  };
  headerRow.alignment = { 
    vertical: 'middle', 
    horizontal: 'center',
    wrapText: true
  };
  headerRow.height = 30;
  
  // Style des bordures
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  // Ajuster automatiquement la largeur des colonnes
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell!({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 0), 50);
  });
  
  // Ajouter un titre
  const titleRow = worksheet.insertRow(1, [`RAPPORTS DE PRODUCTION - ${semaine.toUpperCase()}`]);
  titleRow.height = 40;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { 
    bold: true, 
    size: 16,
    color: { argb: 'FFFFFF' }
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1565C0' } // Bleu
  };
  titleCell.alignment = { 
    vertical: 'middle', 
    horizontal: 'center' 
  };
  worksheet.mergeCells(1, 1, 1, worksheet.columnCount);
  
  // Ajouter un pied de page avec des statistiques
  const statsRow = worksheet.addRow([]);
  const statsCell = statsRow.getCell(1);
  statsCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | Total: ${rapports.length} rapports`;
  statsCell.font = { italic: true, size: 10, color: { argb: '666666' } };
  statsCell.alignment = { horizontal: 'right' };
  worksheet.mergeCells(statsRow.number, 1, statsRow.number, worksheet.columnCount);
  
  // Générer le fichier Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  // Nom du fichier avec date
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `rapports-production-${semaine}-${dateStr}.xlsx`);
}
// CORRECTION COMPLÈTE DE formatPhasesForDisplay
private formatPhasesForDisplay(phasesData: any): string {
  if (!phasesData) {
    return 'Aucune phase';
  }
  
  try {
    let phasesArray: any[] = [];
    
    // Cas 1: C'est déjà un tableau
    if (Array.isArray(phasesData)) {
      phasesArray = phasesData;
    }
    // Cas 2: C'est une string JSON
    else if (typeof phasesData === 'string') {
      // Nettoyer la string
      let cleanString = phasesData.trim();
      
      // Remplacer les éventuelles guillemets simples par doubles
      cleanString = cleanString.replace(/'/g, '"');
      // Supprimer les backslashes inutiles
      cleanString = cleanString.replace(/\\/g, '');
      
      if (cleanString.startsWith('[') && cleanString.endsWith(']')) {
        try {
          phasesArray = JSON.parse(cleanString);
        } catch (parseError) {
          console.log('Erreur parsing, tentative alternative...');
          
          // Essayer de réparer le JSON corrompu
          // Si le JSON a des clés sans guillemets
          cleanString = cleanString.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          
          try {
            phasesArray = JSON.parse(cleanString);
          } catch (e) {
            console.log('Échec après réparation:', e);
            return `Format invalide: ${phasesData.substring(0, 100)}...`;
          }
        }
      }
    }
    
    // Maintenant, traiter le tableau obtenu
    const formattedPhases: string[] = [];
    
    phasesArray.forEach((phaseObj, index) => {
      if (phaseObj && typeof phaseObj === 'object') {
        // VOTRE CAS : Les clés sont des nombres (4104, 4201, etc.)
        // Exemple: { "4104": "quelque chose" }
        const keys = Object.keys(phaseObj);
        
        if (keys.length > 0) {
          keys.forEach(key => {
            const value = phaseObj[key];
            
            // Déterminer ce qu'est la valeur
            // C'est probablement l'heure ou la durée
            if (typeof value === 'object') {
              // Si la valeur est un objet
              const subKeys = Object.keys(value);
              const hourValue = value.heure || value.Heure || value.hours || 
                               value.temps || value.duree || '?';
              formattedPhases.push(`Phase ${key}: ${hourValue}`);
            } else {
              // Si la valeur est une string ou un nombre
              const displayValue = value || '?';
              formattedPhases.push(`Phase ${key}: ${displayValue}`);
            }
          });
        } else {
          // Format standard : { "phase": "4104", "heure": "4" }
          const phaseNumber = phaseObj.phase || phaseObj.Phase || 
                            phaseObj.numero || phaseObj.Numero || 
                            phaseObj.id || `Phase ${index + 1}`;
          
          const heureValue = phaseObj.heure || phaseObj.Heure || 
                           phaseObj.hours || phaseObj.Hours || 
                           phaseObj.temps || phaseObj.duree || 
                           phaseObj.value || '?';
          
          formattedPhases.push(`Phase ${phaseNumber}: ${heureValue}`);
        }
      }
    });
    
    return formattedPhases.length > 0 
      ? formattedPhases.join(', ') 
      : 'Aucune phase valide';
    
  } catch (error) {
    console.error('Erreur critique lors du formatage:', error);
    return typeof phasesData === 'string' 
      ? `Erreur: ${phasesData.substring(0, 50)}...` 
      : 'Format inconnu';
  }
}

// Ajoutez cette méthode utilitaire pour formater les dates
private formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

// Méthode pour annuler
onCancelDownloadPhase() {
  this.resetDownloadPhaseForm();
  this.activeTab.set('view');
}

// Méthode pour réinitialiser le formulaire
private resetDownloadPhaseForm() {
  this.downloadPhaseForm = {
    semaine: '',
    errors: {}
  };
}

// Ajoutez ces méthodes utilitaires si nécessaire
private getAuthHeaders(): HttpHeaders {
  const token = this.authService.getToken();
  let headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });
  
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  
  return headers;
}
onSemaineChangeForLineSummary(value: string) {
  this.errorMessage.set(null);
  this.downloadLineSummaryForm.errors = {};
  
  // Charger les données si semaine et ligne sont sélectionnées
  if (value && this.downloadLineSummaryForm.ligne) {
    this.loadLineSummaryData();
  }
}
onLigneSelectedForSummary() {
  this.errorMessage.set(null);
  this.downloadLineSummaryForm.errors = {};
  
  // Charger les données si semaine est sélectionnée
  if (this.downloadLineSummaryForm.semaine && this.downloadLineSummaryForm.ligne) {
    this.loadLineSummaryData();
  }
}
private loadLineSummaryData() {
  if (!this.downloadLineSummaryForm.semaine.trim() || !this.downloadLineSummaryForm.ligne.trim()) {
    return;
  }

  this.loading.set(true);
  
  this.semaineService.getPlanificationsVuProd(
    this.downloadLineSummaryForm.semaine.trim(),
    this.downloadLineSummaryForm.ligne.trim()
  )
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur chargement données ligne:', error);
        if (error.status === 404) {
          this.errorMessage.set(`Aucune donnée trouvée pour ${this.downloadLineSummaryForm.ligne} en ${this.downloadLineSummaryForm.semaine}`);
        } else {
          this.errorMessage.set('Erreur lors du chargement des données');
        }
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (data) => {
        if (data) {
          this.lineSummaryStats.set(data);
          
          // Afficher un message de succès
          if (data.stats) {
            this.showSuccessMessage(`Données chargées : ${data.planifications?.length || 0} planifications trouvées`);
          }
        } else {
          this.lineSummaryStats.set(null);
        }
      }
    });
}
async onDownloadLineSummary() {
  // Validation
  this.downloadLineSummaryForm.errors = {};
  let hasErrors = false;

  if (!this.downloadLineSummaryForm.semaine.trim()) {
    this.downloadLineSummaryForm.errors.semaine = 'La semaine est requise';
    hasErrors = true;
  }

  if (!this.downloadLineSummaryForm.ligne.trim()) {
    this.downloadLineSummaryForm.errors.ligne = 'La ligne est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  this.loading.set(true);
  this.errorMessage.set(null);

  try {
    // 1. Récupérer les données depuis l'API
    const data = await this.getLineSummaryData(
      this.downloadLineSummaryForm.semaine.trim(),
      this.downloadLineSummaryForm.ligne.trim()
    );
    
    if (!data) {
      this.errorMessage.set('Aucune donnée disponible pour cette ligne et semaine');
      this.loading.set(false);
      return;
    }

    // 2. Générer le fichier Excel
    await this.generateLineSummaryExcel(
      data,
      this.downloadLineSummaryForm.semaine.trim(),
      this.downloadLineSummaryForm.ligne.trim()
    );
    
    this.showSuccessMessage(`Résumé de la ligne ${this.downloadLineSummaryForm.ligne} téléchargé avec succès !`);
    
  } catch (error: any) {
    console.error('Erreur lors du téléchargement:', error);
    
    if (error.status === 404) {
      this.errorMessage.set(`Aucune donnée trouvée pour ${this.downloadLineSummaryForm.ligne} en ${this.downloadLineSummaryForm.semaine}`);
    } else {
      this.errorMessage.set(error.message || 'Erreur lors de la génération du rapport');
    }
  } finally {
    this.loading.set(false);
  }
}
private getLineSummaryData(semaine: string, ligne: string): Promise<any> {
  return new Promise((resolve, reject) => {
    this.semaineService.getPlanificationsVuProd(semaine, ligne)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          reject(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          reject(error);
        }
      });
  });
}

// Méthode pour générer le fichier Excel
private async generateLineSummaryExcel(data: any, semaine: string, ligne: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Résumé ${ligne} - ${semaine}`);
  
  // Titre principal
  const titleRow = worksheet.addRow([`RAPPORT DE PRODUCTION - ${ligne.toUpperCase()} - ${semaine.toUpperCase()}`]);
  titleRow.height = 40;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { 
    bold: true, 
    size: 18,
    color: { argb: 'FFFFFF' }
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF9800' } // Orange
  };
  titleCell.alignment = { 
    vertical: 'middle', 
    horizontal: 'center' 
  };
  worksheet.mergeCells(1, 1, 1, 8);
  
  // Section Statistiques
  if (data.stats) {
    const statsTitle = worksheet.addRow(['STATISTIQUES GLOBALES']);
    statsTitle.height = 30;
    const statsTitleCell = statsTitle.getCell(1);
    statsTitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    statsTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2196F3' } // Bleu
    };
    statsTitleCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells(2, 1, 2, 8);
    
    // En-têtes statistiques
    worksheet.addRow([
      'Total Planifications',
      'Qté Planifiée Totale',
      'Qté Modifiée Totale',
      'Qté Source Totale',
      'Déc. Production',
      'Déc. Magasin',
      'Delta Prod Total',
      'PCS Prod Total (%)'
    ]);
    
    // Données statistiques
    const statsRow = worksheet.addRow([
      data.stats.totalPlanifications || 0,
      data.stats.totalQtePlanifiee || 0,
      data.stats.totalQteModifiee || 0,
      data.stats.totalQteSource || 0,
      data.stats.totalDecProduction || 0,
      data.stats.totalDecMagasin || 0,
      data.stats.deltaProdTotal || 0,
      data.stats.pcsProdTotal || 0
    ]);
    
    // Style des en-têtes statistiques
    const statHeaderRow = worksheet.getRow(3);
    statHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    statHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '607D8B' }
    };
    statHeaderRow.alignment = { horizontal: 'center' };
    
    // Style des données statistiques
    statsRow.font = { bold: true };
    statsRow.eachCell((cell) => {
      if (typeof cell.value === 'number') {
        cell.numFmt = cell.address.includes('H') ? '0.00' : '#,##0';
      }
    });
    
    worksheet.addRow([]); // Ligne vide
  }
  
  // Section Détails des Planifications
  if (data.planifications && data.planifications.length > 0) {
    const detailsTitle = worksheet.addRow(['DÉTAILS DES PLANIFICATIONS']);
    detailsTitle.height = 30;
    const detailsTitleCell = detailsTitle.getCell(1);
    detailsTitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    detailsTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4CAF50' } // Vert
    };
    detailsTitleCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells(detailsTitle.number, 1, detailsTitle.number, 13);
    
    // En-têtes détails
    const detailHeaders = [
      'Jour', 'Référence', 'OF', 'Qté Planifiée', 'Qté Modifiée',
      'Emballage', 'Nb Opérateurs', 'Nb Heures Planifiées',
      'Déc. Production', 'Déc. Magasin', 'Delta Prod',
      'PCS Prod', 'Total Produit'
    ];
    
    worksheet.addRow(detailHeaders);
    
    // Données des planifications
    data.planifications.forEach((plan: any, index: number) => {
      const row = worksheet.addRow([
        plan.jour || '',
        plan.reference || '',
        plan.of || '',
        plan.qtePlanifiee || 0,
        plan.qteModifiee || 0,
        plan.emballage || '',
        plan.nbOperateurs || 0,
        plan.nbHeuresPlanifiées || 0,
        plan.decProduction || 0,
        plan.decMagasin || 0,
        plan.deltaProd || 0,
        plan.pcsProd || 0,
        // Calcul du total produit si nécessaire
        (plan.qtePlanifiee || 0) - (plan.decProduction || 0)
      ]);
      
      // Style alterné
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    });
    
    // Style des en-têtes détails
    const detailHeaderRow = worksheet.getRow(detailsTitle.number + 1);
    detailHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    detailHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '757575' }
    };
    detailHeaderRow.alignment = { horizontal: 'center' };
    detailHeaderRow.height = 25;
    
    // Ajuster les largeurs
    worksheet.columns = [
      { width: 15 }, { width: 20 }, { width: 15 },
      { width: 15 }, { width: 15 }, { width: 12 },
      { width: 15 }, { width: 20 }, { width: 15 },
      { width: 15 }, { width: 12 }, { width: 12 },
      { width: 15 }
    ];
  }
  
  // Pied de page
   const footerRow = worksheet.addRow([]);
  const footerCell = worksheet.getCell(`A${footerRow.number}`); // CORRECTION
  footerCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} | Total: ${data.planifications?.length || 0} planifications`;
  footerCell.font = { italic: true, size: 10, color: { argb: '666666' } };
  footerCell.alignment = { horizontal: 'right' };
  worksheet.mergeCells(footerRow.number, 1, footerRow.number, 13);
  
  // Générer le fichier
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `resume-production-${ligne}-${semaine}-${dateStr}.xlsx`);
}

// Méthode pour annuler
onCancelLineSummary() {
  this.resetDownloadLineSummaryForm();
  this.activeTab.set('view');
}

// Réinitialiser le formulaire
private resetDownloadLineSummaryForm() {
  this.downloadLineSummaryForm = {
    semaine: '',
    ligne: '',
    errors: {}
  };
  this.lineSummaryStats.set(null);
  this.errorMessage.set(null);
}
mobileMenuOpen = false;
toggleMobileSidebar() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  // AJOUTER CETTE MÉTHODE POUR OBTENIR LE TITRE DE L'ONGLET ACTIF :
  

  // Modifier la méthode setActiveTab existante pour fermer le menu mobile :
 
 

// Ajouter cette méthode pour réinitialiser le formulaire de stats
private resetStatsForm() {
  this.statsForm = {
    semaine: '',
    ligne: '',
    errors: {}
  };
  this.statsData.set(null);
}

// Ajouter cette méthode pour annuler la vue des stats


// Ajouter cette méthode dans la liste des méthodes de navigation
setActiveTab(tab: string) {
  this.activeTab.set(tab);
  this.mobileMenuOpen = false;
  this.errorMessage.set('');
  this.successMessage.set('');
  this.showSuccess.set(false);
  
  // Réinitialiser les données de stats si on quitte l'onglet
  if (tab !== 'view-stats') {
    this.statsData.set(null);
  }
}

// Ajouter dans le getTabTitle()
getTabTitle(): string {
  const titles: { [key: string]: string } = {
    'view': 'Vue d\'ensemble des Lignes',
    'create': 'Créer une Nouvelle Ligne',
    'add-ref': 'Ajouter des Références',
    'new-week': 'Créer une Nouvelle Semaine',
    'planning': 'Planification',
    'add-user': 'Ajouter un Utilisateur',
    'add-time': 'Définir le Temps par Seconde',
    'add-worker': 'Ajouter un Ouvrier',
    'add-phase': 'Gestion des Phases',
    'download-phase': 'Télécharger les Rapports de Phase',
    'download-line-summary': 'Résumé par Ligne',
    'stats-annuelles': 'Productivité Annuelle',
    'view-stats': 'Voir les Statistiques' // Ajouter cette ligne
  };
  return titles[this.activeTab()] || 'PDP - Système de Gestion';
}
isAdmin(): boolean {
  return this.getUserType() === 'admin';
}

onViewStats() {
  // Validation
  this.statsForm.errors = {};
  let hasErrors = false;

  if (!this.statsForm.semaine.trim()) {
    this.statsForm.errors.semaine = 'La semaine est requise';
    hasErrors = true;
  }

  if (!this.statsForm.ligne.trim()) {
    this.statsForm.errors.ligne = 'La ligne est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  this.loadingStatsData.set(true);
  this.errorMessage.set(null);
  
  // Détruire les graphiques existants
  this.chartService.destroyCharts(this.charts);
  this.charts = [];

  const getStatsDto = {
    semaine: this.statsForm.semaine.trim(),
    ligne: this.statsForm.ligne.trim()
  };

  this.statsService.getStatsBySemaineAndLigne(getStatsDto)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors du chargement des statistiques:', error);
        if (error.status === 404) {
          this.errorMessage.set(`Aucune donnée trouvée pour la ligne ${this.statsForm.ligne} en semaine ${this.statsForm.semaine}`);
        } else {
          this.errorMessage.set('Erreur lors du chargement des statistiques');
        }
        return of(null);
      }),
      finalize(() => this.loadingStatsData.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          this.statsData.set(response);
          this.activeTab.set('view-stats');
          this.showSuccessMessage(`Statistiques chargées pour ${this.statsForm.ligne} - ${this.statsForm.semaine}`);
          
          // Créer les graphiques après un délai pour permettre au DOM de se mettre à jour
          setTimeout(() => {
            this.createCharts();
          }, 100);
        }
      }
    });
}

// Méthode pour créer les graphiques
private createCharts(): void {
  if (!this.statsData()) return;

  const stats = this.statsData();
  
  // Graphique 1: Quantités
  const qtyCanvas = document.getElementById('quantityChart') as HTMLCanvasElement;
  if (qtyCanvas) {
    const ctx = qtyCanvas.getContext('2d');
    if (ctx) {
      const chart = this.chartService.createQuantityChart(ctx, stats);
      this.charts.push(chart);
    }
  }

  // Graphique 2: PCS Prod
  const pcsCanvas = document.getElementById('pcsChart') as HTMLCanvasElement;
  if (pcsCanvas) {
    const ctx = pcsCanvas.getContext('2d');
    if (ctx) {
      const chart = this.chartService.createPcsChart(ctx, stats);
      this.charts.push(chart);
    }
  }

  // Graphique 3: Répartition des écarts (camembert)
  const pieCanvas = document.getElementById('ecartPieChart') as HTMLCanvasElement;
  if (pieCanvas) {
    const ctx = pieCanvas.getContext('2d');
    if (ctx) {
      const chart = this.chartService.createEcartPieChart(ctx, stats);
      this.charts.push(chart);
    }
  }

  // Graphique 4: Écarts par jour
  const barCanvas = document.getElementById('ecartBarChart') as HTMLCanvasElement;
  if (barCanvas) {
    const ctx = barCanvas.getContext('2d');
    if (ctx) {
      const chart = this.chartService.createEcartBarChart(ctx, stats);
      this.charts.push(chart);
    }
  }

  // Graphique 5: Comparaison
  const comparisonCanvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
  if (comparisonCanvas) {
    const ctx = comparisonCanvas.getContext('2d');
    if (ctx) {
      const chart = this.chartService.createComparisonChart(ctx, stats);
      this.charts.push(chart);
    }
  }
}

// Modifier onCancelStats pour nettoyer les graphiques
onCancelStats() {
  this.chartService.destroyCharts(this.charts);
  this.charts = [];
  this.resetStatsForm();
  this.activeTab.set('view');
}

// Nettoyer les graphiques lors de la destruction du composant
ngOnDestroy() {
  this.chartService.destroyCharts(this.charts);
}

async exportCharts() {
    if (!this.charts || this.charts.length === 0) {
      this.errorMessage.set('Aucun graphique à exporter');
      return;
    }

    try {
      // Télécharger chaque graphique individuellement
      this.charts.forEach((chart, index) => {
        if (chart && chart.canvas) {
          const canvas = chart.canvas;
          const imageUrl = canvas.toDataURL('image/png');
          
          // Créer un lien de téléchargement temporaire
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = `graphique-${index + 1}-${this.statsForm.semaine}-${this.statsForm.ligne}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      });
      
      this.showSuccessMessage('Graphiques exportés avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      this.errorMessage.set('Erreur lors de l\'export des graphiques');
    }
  }
  async onDownloadStats5MAnnuelles() {
  // Validation
  this.stats5MAnnuellesForm.errors = {};
  let hasErrors = false;

  if (!this.stats5MAnnuellesForm.date.trim()) {
    this.stats5MAnnuellesForm.errors.date = 'La date est requise';
    hasErrors = true;
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(this.stats5MAnnuellesForm.date)) {
      this.stats5MAnnuellesForm.errors.date = 'Format de date invalide (YYYY-MM-DD requis)';
      hasErrors = true;
    }
  }

  if (hasErrors) return;

  this.loading.set(true);
  this.errorMessage.set(null);

  try {
    // Récupérer les données
    const data = await this.getStats5MAnnuelles(this.stats5MAnnuellesForm.date.trim());
    
    if (!data) {
      this.errorMessage.set('Aucune donnée disponible pour cette année');
      this.loading.set(false);
      return;
    }

    // Générer le fichier Excel
    await this.generateStats5MAnnuellesExcel(data);
    
    this.showSuccessMessage(`Statistiques 5M annuelles ${data.annee} téléchargées avec succès !`);
    
  } catch (error: any) {
    console.error('Erreur lors du téléchargement:', error);
    
    if (error.status === 404) {
      this.errorMessage.set(`Aucune donnée trouvée pour l'année sélectionnée`);
    } else {
      this.errorMessage.set(error.message || 'Erreur lors de la génération du rapport');
    }
  } finally {
    this.loading.set(false);
  }
}

/**
 * Récupérer les données depuis l'API
 */
private getStats5MAnnuelles(date: string): Promise<Stats5MAnnuellesResponse> {
  return new Promise((resolve, reject) => {
    this.stats5MAnnuelService.getStats5MParMois(date)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          reject(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response) {
            resolve(response);
          } else {
            reject(new Error('Aucune donnée reçue'));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
  });
}

/**
 * Générer le fichier Excel pour les stats 5M
 */
private async generateStats5MAnnuellesExcel(data: Stats5MAnnuellesResponse): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Non Productivité ${data.annee}`);
  
  const moisNoms = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  
  const moisAbrev = [
    'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
    'juil', 'août', 'sept', 'oct', 'nov', 'déc'
  ];

  // Ligne 1: Titre principal
  const titleRow = worksheet.addRow(['Non Productivité']);
  titleRow.height = 40;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { 
    bold: true, 
    size: 18,
    color: { argb: '000000' }
  };
  titleCell.alignment = { 
    vertical: 'middle', 
    horizontal: 'center' 
  };
  worksheet.mergeCells(1, 1, 1, 15);

  // Ligne 2: Sous-titre
  const subtitleRow = worksheet.addRow(["Efficience Main d'œuvre"]);
  subtitleRow.height = 25;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(2, 1, 2, 15);

  // Ligne 3: URL et TdB
  const urlRow = worksheet.addRow(['']);
  const urlCell = urlRow.getCell(1);
  urlCell.font = { size: 10, color: { argb: '0000FF' }, underline: true };
  urlCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(3, 1, 3, 12);
  
  worksheet.getCell('M3').value = 'TdB';
  worksheet.getCell('M3').alignment = { horizontal: 'right' };

  // Ligne 4: Pilote
  const piloteRow = worksheet.addRow(['']);
  worksheet.getCell('M4').value = '';
  worksheet.getCell('M4').alignment = { horizontal: 'right' };

  // Ligne 5: En-têtes des colonnes
  const headers = [
    'Causes',
    ...moisAbrev.map(m => `${m}-${String(data.annee).slice(-2)}`),
    'Tot'
  ];
  
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 30;
  
  headerRow.eachCell((cell) => {
    cell.font = { 
      bold: true, 
      size: 10,
      color: { argb: '000000' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Données des 5M
  const causesData = [
    {
      label: '% M1:Matière première',
      key: 'matierePremiere',
      total: data.moyennesAnnuelles.matierePremiere.pourcentage
    },
    {
      label: '% M5:Qualité',
      key: 'qualite',
      total: data.moyennesAnnuelles.qualite.pourcentage
    },
    {
      label: '% M2:absence',
      key: 'absence',
      total: data.moyennesAnnuelles.absence.pourcentage
    },
     {
      label: '% M3:Méthode', // NOUVEAU - LIGNE SÉPARÉE
      key: 'methode',
      total: data.moyennesAnnuelles.methode.pourcentage
    },
    {
      label: '% M4:maintenance',
      key: 'maintenance',
      total: data.moyennesAnnuelles.maintenance.pourcentage
    },
    {
      label: '% M2:Rendement',
      key: 'rendement',
      total: data.moyennesAnnuelles.rendement.pourcentage
    }
  ];

  causesData.forEach((cause, index) => {
    const rowData = [
      cause.label,
      ...moisNoms.map(mois => {
        const moisData = data.mois[mois];
        const value = moisData?.[cause.key as keyof typeof moisData];
        const pourcentage = typeof value === 'object' && value !== null 
          ? (value as any).pourcentage 
          : 0;
        return pourcentage > 0 ? `${pourcentage.toFixed(2)}%` : '';
      }),
      `${cause.total.toFixed(2)}%`
    ];
    
    const dataRow = worksheet.addRow(rowData);
    
    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: colNumber === 1 ? 'left' : 'center'
      };
      
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      if (index % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    });
  });

  // Ligne GÉNÉRAL (somme de tous les 5M)
  const generalRow = worksheet.addRow([
    '% Général',
    ...moisNoms.map(mois => {
      const pourcentage = data.mois[mois]?.pourcentageTotal5M || 0;
      return pourcentage > 0 ? `${pourcentage.toFixed(2)}%` : '';
    }),
    `${data.moyennesAnnuelles.pourcentageTotal5M.toFixed(2)}%`
  ]);
  
  generalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: cell.address.includes('A') ? 'left' : 'center'
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD700' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Ajuster les largeurs des colonnes
  worksheet.columns = [
    { width: 22 },  // Causes
    ...Array(12).fill({ width: 10 }), // Mois
    { width: 10 }   // Tot
  ];

  // Générer le fichier
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `non-productivite-annuelle-${data.annee}-${dateStr}.xlsx`);
}

/**
 * Annuler et réinitialiser le formulaire 5M
 */
onCancelStats5MAnnuelles() {
  this.resetStats5MAnnuellesForm();
  this.activeTab.set('view');
}

/**
 * Réinitialiser le formulaire 5M
 */
private resetStats5MAnnuellesForm() {
  this.stats5MAnnuellesForm = {
    date: '',
    errors: {}
  };
  this.stats5MAnnuellesPreview.set(null);
  this.errorMessage.set(null);
}

}