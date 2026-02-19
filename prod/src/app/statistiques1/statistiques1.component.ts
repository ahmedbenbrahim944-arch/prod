import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  StatsService1, 
  Pourcentage5MResponse,
  Pourcentage5MParLigneResponse,
  Ligne5MStats,
  AffectationPersonnelResponse,
  Stats5MParDateResponse,
  Ligne5MDate,
  Stats5M,
  ProductiviteOuvriersResponse // ✅ NOUVELLE INTERFACE
} from '../statistiques1/stats.service';
import { Chart, registerables } from 'chart.js';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(ChartDataLabels);
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';


Chart.register(...registerables);

interface LigneStats {
  ligne: string;
  pcsProdTotal: number;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
  actif: boolean;
  totalQtePlanifiee: number;
}

@Component({
  selector: 'app-statistiques1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statistiques1.component.html',
  styleUrls: ['./statistiques1.component.css']
})
export class Statistiques1Component implements OnInit, OnDestroy {
  // Propriétés pour le filtre par semaine
  semaineSelectionnee: string = 'semaine1';
  statsLignes: LigneStats[] = [];
  
  stats5M: Stats5M | null = null;
  ligneSelectionnee: string | null = null;
  isLoading: boolean = false;
  showStats: boolean = false;

  stats5MDate: Stats5MParDateResponse | null = null;
  stats5MParLigneDate: Ligne5MDate[] = [];
  ligneSelectionneeDate: string | null = null;
  stats5MDateActuel: Stats5M | null = null;
  titre5MDate: string = '';
  showSaisieRapports: boolean = false;

  // Affectation Personnel
  affectationPersonnel: AffectationPersonnelResponse | null = null;
  isLoadingAffectation: boolean = false;
  showAffectation: boolean = false;

  // ✅ NOUVELLES PROPRIÉTÉS - Productivité des Ouvriers
  showProductiviteOuvriers: boolean = false;
  showProductiviteForm: boolean = false;
  isLoadingProductivite: boolean = false;
  dateDebutProductivite: string = '';
  dateFinProductivite: string = '';
  productiviteOuvriers: ProductiviteOuvriersResponse | null = null;

  // Propriétés pour le filtre par date
  dateSelectionnee: string = '';
  maxDate: string = '';
  showStatsDate: boolean = false;
  isLoadingDate: boolean = false;
  statsDate: any = null;
  statsLignesDate: LigneStats[] = [];
  showNonSaisieList: boolean = false;
  showSaisieDetails: boolean = false;
  showResultatsSemaine: boolean = false;
  showResultatsDate: boolean = false;

  // Propriétés pour les 5M par ligne (semaine uniquement)
  stats5MParLigneData: Ligne5MStats[] = [];
  titre5M: string = '';

  // Charts
  private barChart: Chart | null = null;
  private barChartDate: Chart | null = null;
  private pieCharts5M: Map<string, Chart> = new Map();

  // Couleurs pour les 5M (maintenant 6M)
  private readonly couleurs5M: Record<string, string> = {
    matierePremiere: '#ef4444',
    absence: '#f59e0b',
    rendement: '#10b981',
    maintenance: '#3b82f6',
    qualite: '#8b5cf6',
    methode: '#ec4899',
    environnement: '#6366f1' // Nouvelle couleur pour Environnement
  };

  // Propriétés pour les totaux
  pcsTotalSemaine: number = 0;
  pcsTotalDate: number = 0;
  pcsTotalJour: number = 0;

  // Propriétés pour la modale de détails
  showDetailsModal: boolean = false;
  detailsNonConf: any[] = [];
  causeSelectionnee: string = '';
  isLoadingDetails: boolean = false;
  
  // Totaux pour la modale
  totalQtyPlanifiee: number = 0;
  totalQtyProduite: number = 0;
  totalDelta: number = 0;
  total7M: number = 0;
  totalMatierePremiere: number = 0;
  totalAbsence: number = 0;
  totalRendement: number = 0;
  totalMethode: number = 0;
  totalMaintenance: number = 0;
  totalQualite: number = 0;
  totalEnvironnement: number = 0;

  readonly statutOptions = [
    { code: 'AB', libelle: 'Absent', couleur: '#ef4444', icon: '🚫' },
    { code: 'C', libelle: 'Congé', couleur: '#f59e0b', icon: '🏖️' },
    { code: 'S', libelle: 'Sélection', couleur: '#3b82f6', icon: '✓' },
    { code: 'P', libelle: 'Présent', couleur: '#10b981', icon: '✅' }
  ];

  constructor(private statsService: StatsService1, private router: Router) {}

  ngOnInit(): void {
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];
    // Initialiser avec la date d'aujourd'hui
    this.dateSelectionnee = this.maxDate;
    
    // ✅ Initialiser les dates de productivité
    // Date de début = il y a 7 jours
    const dateDebut = new Date(today);
    dateDebut.setDate(dateDebut.getDate() - 7);
    this.dateDebutProductivite = dateDebut.toISOString().split('T')[0];
    
    // Date de fin = aujourd'hui
    this.dateFinProductivite = this.maxDate;
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  getSemainesArray(): number[] {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Toggle l'affichage du formulaire de productivité
   */
  toggleProductiviteSection(): void {
    this.showProductiviteForm = !this.showProductiviteForm;
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Charger la productivité des ouvriers
   */
  chargerProductiviteOuvriers(): void {
    if (!this.dateDebutProductivite || !this.dateFinProductivite) {
      alert('Veuillez sélectionner une date de début et une date de fin');
      return;
    }

    // Vérifier que la date de début est avant la date de fin
    if (new Date(this.dateDebutProductivite) > new Date(this.dateFinProductivite)) {
      alert('La date de début doit être antérieure à la date de fin');
      return;
    }

    this.isLoadingProductivite = true;
    this.showProductiviteOuvriers = false;

    this.statsService.getProductiviteOuvriers(this.dateDebutProductivite, this.dateFinProductivite).subscribe({
      next: (response) => {
        this.productiviteOuvriers = response;
        this.isLoadingProductivite = false;
        this.showProductiviteOuvriers = true;
        this.showResultatsSemaine = false;
        this.showResultatsDate = false;
        this.showAffectation = false;
        
        console.log('✅ Productivité ouvriers chargée:', response);
        if (response.resume) {
          console.log('  - Nombre d\'ouvriers:', response.resume.nombreOuvriers);
          console.log('  - Total heures:', response.resume.totalHeures);
          console.log('  - Productivité moyenne:', response.resume.productiviteMoyenne);
        }
      },
      error: (error) => {
        console.error('❌ Erreur chargement productivité:', error);
        this.isLoadingProductivite = false;
        alert('Erreur lors du chargement de la productivité des ouvriers');
      }
    });
  }

  /**
   * Charger l'affectation du personnel
   */
  chargerAffectationPersonnel(): void {
    if (!this.semaineSelectionnee) {
      alert('Veuillez sélectionner une semaine');
      return;
    }

    this.isLoadingAffectation = true;
    this.showAffectation = false;

    this.statsService.getAffectationPersonnel(this.semaineSelectionnee).subscribe({
      next: (response) => {
        this.affectationPersonnel = response;
        this.isLoadingAffectation = false;
        this.showAffectation = true;
        this.showResultatsSemaine = false;
        this.showResultatsDate = false;
        this.showProductiviteOuvriers = false;
        console.log('✅ Affectation personnel chargée:', response);
      },
      error: (error) => {
        console.error('❌ Erreur chargement affectation:', error);
        this.isLoadingAffectation = false;
        alert('Erreur lors du chargement de l\'affectation du personnel');
      }
    });
  }

  /**
   * Obtenir la couleur du texte delta
   */
  getDeltaColor(difference: number): string {
    if (difference === 0) return '#10b981'; // Vert
    return '#ef4444'; // Rouge
  }

  private calculerPcsTotalSemaine(): void {
    if (!this.statsLignes || this.statsLignes.length === 0) {
      this.pcsTotalSemaine = 0;
      return;
    }
    
    const totalPcs = this.statsLignes.reduce((sum, ligne) => sum + ligne.pcsProdTotal, 0);
    this.pcsTotalSemaine = totalPcs / this.statsLignes.length;
  }

  /**
   * Charger les statistiques par semaine
   */
  chargerStatistiques(): void {
    if (!this.semaineSelectionnee) {
      alert('Veuillez sélectionner une semaine');
      return;
    }

    this.isLoading = true;
    
    forkJoin({
      lignes: this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee),
      pourcentage5M: this.statsService.getPourcentage5MParSemaine(this.semaineSelectionnee),
      pourcentage5MParLigne: this.statsService.getPourcentage5MParLigne(this.semaineSelectionnee)
    }).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes.lignes.map(ligne => ({
        ligne: ligne.ligne,
        pcsProdTotal: ligne.pcsProdTotal,
        nombrePlanifications: ligne.nombrePlanifications,
        nombreReferences: ligne.nombreReferences,
        totalQteSource: ligne.totalQteSource,
        totalDecProduction: ligne.totalDecProduction,
        actif: false,
        totalQtePlanifiee: 0
      }));
        this.stats5MParLigneData = response.pourcentage5MParLigne.lignes;
        
        if (response.lignes.resumeGlobalSemaine) {
          const pcsString = response.lignes.resumeGlobalSemaine.pcsTotalSemainePourcentage;
          this.pcsTotalSemaine = parseFloat(pcsString.replace('%', '')) || 0;
        } else {
          this.calculerPcsTotalSemaine();
        }
        
        const causes = response.pourcentage5M.pourcentagesParCause;
        
        this.stats5M = {
          matierePremiere: parseFloat(causes.matierePremiere.pourcentage) || 0,
          absence: parseFloat(causes.absence.pourcentage) || 0,
          rendement: parseFloat(causes.rendement.pourcentage) || 0,
          maintenance: parseFloat(causes.maintenance.pourcentage) || 0,
          qualite: parseFloat(causes.qualite.pourcentage) || 0,
          methode: parseFloat(causes.methode?.pourcentage) || 0,
          environnement: parseFloat(causes.environnement?.pourcentage) || 0
        };

        this.titre5M = `Analyse des 5M - ${this.semaineSelectionnee}`;

        this.isLoading = false;
        this.showResultatsSemaine = true;
        this.showResultatsDate = false;
        this.showAffectation = false;
        this.showProductiviteOuvriers = false;
        
        console.log('📊 STATISTIQUES CHARGÉES:');
        console.log('  - Nombre de lignes:', this.statsLignes.length);
        console.log('  - PCS Total semaine:', this.pcsTotalSemaine + '%');
        console.log('  - Stats 5M:', this.stats5M);
        
        setTimeout(() => {
          this.creerGraphiques();
        }, 100);
      },
      error: (error) => {
        console.error('❌ Erreur:', error);
        this.isLoading = false;
        alert('Erreur lors du chargement des statistiques');
      }
    });
  }

  private calculerPcsTotalDate(): void {
    if (!this.statsLignesDate || this.statsLignesDate.length === 0) {
      this.pcsTotalDate = 0;
      return;
    }
    
    const totalPcs = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.pcsProdTotal, 0);
    this.pcsTotalDate = totalPcs / this.statsLignesDate.length;
  }

  calculerPcsTotalJour(): void {
    if (!this.statsLignesDate || this.statsLignesDate.length === 0) {
      this.pcsTotalJour = 0;
      console.warn('⚠️ Aucune ligne trouvée pour calculer le PCS du jour');
      return;
    }
    
    if (this.statsDate?.resumeProduction?.pcsTotalToutesLignes !== undefined) {
      this.pcsTotalJour = this.statsDate.resumeProduction.pcsTotalToutesLignes;
      console.log('✅ PCS du jour (depuis résumé):', this.pcsTotalJour);
      return;
    }
    
    const totalQteSource = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.totalQteSource, 0);
    const totalDecProduction = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.totalDecProduction, 0);
    
    this.pcsTotalJour = totalQteSource > 0
      ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
      : 0;
    
    console.log('✅ PCS du jour (calculé):', this.pcsTotalJour);
  }

  /**
   * Obtenir le libellé de performance
   */
  getPerformanceLabel(percentage: number): string {
    if (percentage >= 75) return 'Performance Excellente';
    if (percentage >= 50) return 'Performance Bonne';
    if (percentage >= 25) return 'Performance Moyenne';
    return 'Performance à Améliorer';
  }

  /**
   * Sélectionner une ligne pour les stats par date
   */
  selectionnerLigneDate(ligne: string): void {
    this.ligneSelectionneeDate = ligne;
    
    const ligne5M = this.stats5MParLigneDate.find(l => l.ligne === ligne);
    
    if (ligne5M) {
      this.titre5MDate = `Analyse des 5M - ${ligne} (${this.dateSelectionnee})`;
      
      this.stats5MDateActuel = {
        matierePremiere: ligne5M.detailTotalParCause.matierePremiere.pourcentageSource || 0,
        absence: ligne5M.detailTotalParCause.absence.pourcentageSource || 0,
        rendement: ligne5M.detailTotalParCause.rendement.pourcentageSource || 0,
        maintenance: ligne5M.detailTotalParCause.maintenance.pourcentageSource || 0,
        qualite: ligne5M.detailTotalParCause.qualite.pourcentageSource || 0,
        methode: ligne5M.detailTotalParCause.methode?.pourcentageSource || 0,
        environnement: ligne5M.detailTotalParCause.environnement?.pourcentageSource || 0
      };
      
      setTimeout(() => {
        this.creerGraphiquesCirculaires5MDate();
      }, 50);
    }
  }

  /**
   * Retour aux filtres
   */
  retourAuxFiltres(): void {
    this.showResultatsSemaine = false;
    this.showResultatsDate = false;
    this.showAffectation = false;
    this.showProductiviteOuvriers = false;
    this.showProductiviteForm = false;
    this.ligneSelectionnee = null;
    this.ligneSelectionneeDate = null;
    this.showSaisieRapports = false;
    this.destroyAllCharts();
  }

  /**
   * Retour au choix
   */
  retourChoix(): void {
    this.router.navigate(['/prod']);
  }

  private destroyAllCharts(): void {
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
    if (this.barChartDate) {
      this.barChartDate.destroy();
      this.barChartDate = null;
    }
    this.pieCharts5M.forEach(chart => chart.destroy());
    this.pieCharts5M.clear();
  }

  creerGraphiques(): void {
    this.destroyAllCharts();
    this.creerHistogramme();
    this.creerGraphiquesCirculaires5M();
  }

  creerGraphiquesDate(): void {
    if (this.barChartDate) {
      this.barChartDate.destroy();
      this.barChartDate = null;
    }
    this.creerHistogrammeDate();
  }

  creerHistogramme(): void {
    const ctx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsLignes.map(l => l.ligne);
    const data = this.statsLignes.map(l => l.pcsProdTotal);
    
    const colors = data.map(value => {
      if (value >= 75) return '#10b981';
      if (value >= 50) return '#22c55e';
      if (value >= 25) return '#f59e0b';
      return '#ef4444';
    });

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rendement (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => this.darkenColor(c)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Rendement (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Lignes de production'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  creerHistogrammeDate(): void {
    const ctx = document.getElementById('barChartDate') as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsLignesDate.map(l => {
      const indicateur = l.actif ? '🟢' : '🔴';
      return `${l.ligne} ${indicateur}`;
    });
    
    const data = this.statsLignesDate.map(l => l.pcsProdTotal);
    
    const colors = this.statsLignesDate.map(ligne => {
      if (!ligne.actif) {
        return '#fca5a5';
      }
      
      if (ligne.pcsProdTotal >= 75) return '#10b981';
      if (ligne.pcsProdTotal >= 50) return '#22c55e';
      if (ligne.pcsProdTotal >= 25) return '#f59e0b';
      return '#ef4444';
    });

    this.barChartDate = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rendement (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => this.darkenColor(c)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Rendement (%)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          x: {
            title: {
              display: true,
              text: 'Lignes de production'
            },
            ticks: {
              font: {
                size: 13,
              },
              callback: function(value: string | number, index: number, values: any[]) {
                const label = labels[index];
                return label;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return value !== null ? 'Rendement: ' + value.toFixed(1) + '%' : 'Rendement: N/A';
              }
            }
          }
        }
      }
    });
  }

  private darkenColor(color: string): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 30);
    const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 30);
    const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 30);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  creerGraphiquesCirculaires5M(): void {
    if (!this.stats5M) return;

    const causesData = [
      { nom: 'matierePremiere', valeur: this.stats5M.matierePremiere, label: 'Matière Première' },
      { nom: 'absence', valeur: this.stats5M.absence, label: 'Absence' },
      { nom: 'rendement', valeur: this.stats5M.rendement, label: 'Rendement' },
      { nom: 'maintenance', valeur: this.stats5M.maintenance, label: 'Maintenance' },
      { nom: 'qualite', valeur: this.stats5M.qualite, label: 'Qualité' },
      { nom: 'methode', valeur: this.stats5M.methode, label: 'Méthode' },
      { nom: 'environnement', valeur: this.stats5M.environnement, label: 'Environnement' }
    ];

    causesData.forEach(cause => {
      const canvasId = `pieChart-${cause.nom}`;
      const existingChart = this.pieCharts5M.get(canvasId);
      if (existingChart) {
        existingChart.destroy();
        this.pieCharts5M.delete(canvasId);
      }
    });

    causesData.forEach((cause) => {
      const canvasId = `pieChart-${cause.nom}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) {
        console.warn(`Canvas non trouvé: ${canvasId}`);
        return;
      }

      const valeur = cause.valeur || 0;
      const reste = Math.max(0, 100 - valeur);
      const couleur = this.couleurs5M[cause.nom] || '#cccccc';

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pourcentage', 'Reste'],
          datasets: [{
            data: [valeur, reste],
            backgroundColor: [couleur, '#e5e7eb'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return context.parsed.toFixed(1) + '%';
                }
              }
            }
          }
        }
      });

      this.pieCharts5M.set(canvasId, chart);
    });
  }

  /**
 * Obtenir la couleur pour la productivité
 */
getColorForProductivite(productivite: number): string {
  if (productivite >= 90) return '#10b981'; // Vert - Excellent
  if (productivite >= 75) return '#3b82f6'; // Bleu - Bon
  if (productivite >= 60) return '#f59e0b'; // Orange - Moyen
  return '#ef4444'; // Rouge - Faible
}

  creerGraphiquesCirculaires5MDate(): void {
    if (!this.stats5MDateActuel) return;

    const causesData = [
      { nom: 'matierePremiere', valeur: this.stats5MDateActuel.matierePremiere, label: 'Matière Première' },
      { nom: 'absence', valeur: this.stats5MDateActuel.absence, label: 'Absence' },
      { nom: 'rendement', valeur: this.stats5MDateActuel.rendement, label: 'Rendement' },
      { nom: 'maintenance', valeur: this.stats5MDateActuel.maintenance, label: 'Maintenance' },
      { nom: 'qualite', valeur: this.stats5MDateActuel.qualite, label: 'Qualité' },
      { nom: 'methode', valeur: this.stats5MDateActuel.methode, label: 'Méthode' },
      { nom: 'environnement', valeur: this.stats5MDateActuel.environnement, label: 'Environnement' }
    ];

    causesData.forEach(cause => {
      const canvasId = `pieChart-${cause.nom}-date`;
      const existingChart = this.pieCharts5M.get(canvasId);
      if (existingChart) {
        existingChart.destroy();
        this.pieCharts5M.delete(canvasId);
      }
    });

    causesData.forEach((cause) => {
      const canvasId = `pieChart-${cause.nom}-date`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) {
        console.warn(`Canvas non trouvé: ${canvasId}`);
        return;
      }

      const valeur = cause.valeur || 0;
      const reste = Math.max(0, 100 - valeur);
      const couleur = this.couleurs5M[cause.nom] || '#cccccc';

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pourcentage', 'Reste'],
          datasets: [{
            data: [valeur, reste],
            backgroundColor: [couleur, '#e5e7eb'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return context.parsed.toFixed(1) + '%';
                }
              }
            }
          }
        }
      });

      this.pieCharts5M.set(canvasId, chart);
    });
  }

  /**
   * Sélectionner une ligne pour les stats par semaine
   */
  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
    
    const ligne5M = this.stats5MParLigneData.find(l => l.ligne === ligne);
    
    if (ligne5M) {
      this.titre5M = `Analyse des 5M - ${ligne}`;
      
      this.stats5M = {
        matierePremiere: ligne5M.detailParCause.matierePremiere.pourcentageDuTotal || 0,
        absence: ligne5M.detailParCause.absence.pourcentageDuTotal || 0,
        rendement: ligne5M.detailParCause.rendement.pourcentageDuTotal || 0,
        maintenance: ligne5M.detailParCause.maintenance.pourcentageDuTotal || 0,
        qualite: ligne5M.detailParCause.qualite.pourcentageDuTotal || 0,
        methode: ligne5M.detailParCause.methode?.pourcentageDuTotal || 0,
        environnement: ligne5M.detailParCause.environnement?.pourcentageDuTotal || 0
      };
      
      setTimeout(() => {
        this.creerGraphiquesCirculaires5M();
      }, 50);
    }
  }

  getColorForPercentage(percentage: number): string {
    if (percentage >= 75) return '#10b981';
    if (percentage >= 50) return '#3b82f6';
    if (percentage >= 25) return '#f59e0b';
    return '#ef4444';
  }

  getLignesAvecSaisie(): any[] {
    if (!this.statsDate?.rapportsSaisie?.repartitionParLigne) {
      return [];
    }
    
    return Object.entries(this.statsDate.rapportsSaisie.repartitionParLigne).map(([nom, data]: [string, any]) => ({
      nom,
      nombreOuvriers: data.nombreOuvriers,
      totalHeures: data.totalHeures
    }));
  }

  toggleNonSaisieList(): void {
    this.showNonSaisieList = !this.showNonSaisieList;
  }

  toggleSaisieDetails(): void {
    this.showSaisieDetails = !this.showSaisieDetails;
  }

  toggleSaisieRapports(): void {
    this.showSaisieRapports = !this.showSaisieRapports;
  }

  notifyOuvrier(ouvrier: any): void {
    if (confirm(`Voulez-vous notifier ${ouvrier.nomPrenom} (${ouvrier.matricule}) ?`)) {
      alert(`Notification envoyée à ${ouvrier.nomPrenom}`);
    }
  }

  ouvrirDetailsModal(cause: string): void {
    if (!this.ligneSelectionneeDate || !this.dateSelectionnee) {
      alert('Veuillez sélectionner une ligne et une date');
      return;
    }

    this.causeSelectionnee = cause;
    this.showDetailsModal = true;
    this.isLoadingDetails = true;

    this.statsService.getNonConfDetailsByDateLigne(
      this.dateSelectionnee, 
      this.ligneSelectionneeDate
    ).subscribe({
      next: (response) => {
        this.detailsNonConf = response.rapports;
        this.isLoadingDetails = false;
        
        this.calculerTotaux();
        console.log('✅ Détails chargés:', response);
      },
      error: (error) => {
        console.error('❌ Erreur chargement détails:', error);
        this.isLoadingDetails = false;
        alert('Erreur lors du chargement des détails');
      }
    });
  }

  private calculerTotaux(): void {
    this.totalQtyPlanifiee = 0;
    this.totalQtyProduite = 0;
    this.totalDelta = 0;
    this.total7M = 0;
    this.totalMatierePremiere = 0;
    this.totalAbsence = 0;
    this.totalRendement = 0;
    this.totalMethode = 0;
    this.totalMaintenance = 0;
    this.totalQualite = 0;
    this.totalEnvironnement = 0;

    this.detailsNonConf.forEach(rapport => {
      this.totalQtyPlanifiee += rapport.quantiteSource;
      this.totalQtyProduite += rapport.decProduction;
      this.totalDelta += rapport.deltaProd;
       this.total7M += rapport.total7M || rapport.total6M;
      this.totalMatierePremiere += rapport.details.matierePremiere;
      this.totalAbsence += rapport.details.absence;
      this.totalRendement += rapport.details.rendement;
      this.totalMethode += rapport.details.methode;
      this.totalMaintenance += rapport.details.maintenance;
      this.totalQualite += rapport.details.qualite;
      this.totalEnvironnement += rapport.details.environnement;
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsNonConf = [];
    this.causeSelectionnee = '';
  }

  getPourcentage(value: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100 * 10) / 10;
  }

  getJourFromDate(dateString: string): string {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const date = new Date(dateString);
    return jours[date.getDay()];
  }

  getReferencesAvecNonConf(): string {
    const avecNonConf = this.detailsNonConf.filter(r => r.total6M > 0).length;
    return `${avecNonConf}/${this.detailsNonConf.length}`;
  }

  getCausePrincipale(): string {
    const causes = [
      { nom: 'Matière Première', valeur: this.totalMatierePremiere },
      { nom: 'Absence', valeur: this.totalAbsence },
      { nom: 'Rendement', valeur: this.totalRendement },
      { nom: 'Méthode', valeur: this.totalMethode },
      { nom: 'Maintenance', valeur: this.totalMaintenance },
      { nom: 'Qualité', valeur: this.totalQualite },
      { nom: 'Environnement', valeur: this.totalEnvironnement }
    ];
    
    causes.sort((a, b) => b.valeur - a.valeur);
    return causes[0].valeur > 0 ? causes[0].nom : 'Aucune';
  }

  formatValue(value: number): string {
    if (value === 0 || value === null || value === undefined) {
      return '-';
    }
    return value.toString();
  }

  formatNumber(value: number): string {
    if (value === 0 || value === null || value === undefined) {
      return '-';
    }
    return value.toLocaleString('fr-FR');
  }

  formatPourcentage(value: number): string {
    if (value === 0 || value === null || value === undefined) {
      return '-';
    }
    return value.toFixed(1) + '%';
  }

  getLibelleStatut(code: string | null | undefined): string {
    if (!code) return 'Non défini';
    const statut = this.statutOptions.find(s => s.code === code);
    return statut ? statut.libelle : 'Non défini';
  }

  getCouleurStatut(code: string | null | undefined): string {
    if (!code) return '#6b7280';
    const statut = this.statutOptions.find(s => s.code === code);
    return statut ? statut.couleur : '#6b7280';
  }

  getIconeStatut(code: string | null | undefined): string {
    if (!code) return '❓';
    const statut = this.statutOptions.find(s => s.code === code);
    return statut ? statut.icon : '❓';
  }

  getStatutCount(statutCode: string): number {
    if (!this.statsDate?.rapportsSaisie?.repartitionStatuts) {
      return 0;
    }
    return this.statsDate.rapportsSaisie.repartitionStatuts[statutCode] || 0;
  }

  getStatutPercentage(statutCode: string): number {
    const count = this.getStatutCount(statutCode);
    const total = this.statsDate?.rapportsSaisie?.nombreOuvriersTotal || 0;
    
    if (total === 0) return 0;
    
    return Math.round((count / total) * 100 * 10) / 10;
  }

  /**
   * ✅ MÉTHODE MANQUANTE - Compter les lignes actives (semaine)
   */
  getLignesActivesCount(): number {
    return this.statsLignes.filter(l => l.actif).length;
  }

  /**
   * ✅ MÉTHODE MANQUANTE - Compter les lignes non actives (semaine)
   */
  getLignesNonActivesCount(): number {
    return this.statsLignes.filter(l => !l.actif).length;
  }

  /**
   * ✅ MÉTHODE MANQUANTE - Réinitialiser la sélection de ligne pour les stats par date
   */
  resetSelectionLigneDate(): void {
    this.ligneSelectionneeDate = null;
    
    // Revenir aux stats globales du jour
    const resumeJour = this.stats5MDate?.resumeTotalJour;
    
    if (resumeJour && resumeJour.detailParCause) {
      this.stats5MDateActuel = {
        matierePremiere: resumeJour.detailParCause.matierePremiere?.pourcentageSource || 0,
        absence: resumeJour.detailParCause.absence?.pourcentageSource || 0,
        rendement: resumeJour.detailParCause.rendement?.pourcentageSource || 0,
        maintenance: resumeJour.detailParCause.maintenance?.pourcentageSource || 0,
        qualite: resumeJour.detailParCause.qualite?.pourcentageSource || 0,
        methode: resumeJour.detailParCause.methode?.pourcentageSource || 0,
        environnement: resumeJour.detailParCause.environnement?.pourcentageSource || 0
      };
      
      this.titre5MDate = `Analyse des 5M - ${this.dateSelectionnee}`;
      
      setTimeout(() => {
        this.creerGraphiquesCirculaires5MDate();
      }, 50);
    }
  }

  chargerStatsParDate(): void {
    if (!this.dateSelectionnee) {
      alert('Veuillez sélectionner une date');
      return;
    }

    this.isLoadingDate = true;
    
    forkJoin({
      statsProduction: this.statsService.getStatsParDate(this.dateSelectionnee),
      stats5M: this.statsService.getStats5MParDate(this.dateSelectionnee),
      ouvriersStatuts: this.statsService.getOuvriersNonSaisisAvecStatuts(this.dateSelectionnee),
      repartitionStatuts: this.statsService.getStatutsByDate(this.dateSelectionnee)
    }).subscribe({
      next: (response) => {
        this.statsDate = response.statsProduction;
        
        this.statsLignesDate = [
          ...(response.statsProduction.lignesActives || []).map(ligne => ({
            ligne: ligne.ligne,
            pcsProdTotal: ligne.pcsProdTotal,
            nombrePlanifications: ligne.nombrePlanifications,
            nombreReferences: ligne.nombreReferences,
            totalQteSource: ligne.totalQteSource,
            totalDecProduction: ligne.totalDecProduction,
            actif: true,
            totalQtePlanifiee: ligne.totalQtePlanifiee
          })),
          ...(response.statsProduction.lignesNonActives || []).map(ligne => ({
            ligne: ligne.ligne,
            pcsProdTotal: ligne.pcsProdTotal,
            nombrePlanifications: ligne.nombrePlanifications,
            nombreReferences: ligne.nombreReferences,
            totalQteSource: ligne.totalQteSource,
            totalDecProduction: ligne.totalDecProduction,
            actif: false,
            totalQtePlanifiee: ligne.totalQtePlanifiee
          }))
        ];
        
        if (this.statsDate.rapportsSaisie && response.ouvriersStatuts.ouvriers) {
          this.statsDate.rapportsSaisie.ouvriersNonSaisis = response.ouvriersStatuts.ouvriers;
        }
        
        if (response.repartitionStatuts && response.repartitionStatuts.statistiques) {
          if (!this.statsDate.rapportsSaisie) {
            this.statsDate.rapportsSaisie = {};
          }
          
          this.statsDate.rapportsSaisie.repartitionStatuts = {
            P: response.repartitionStatuts.statistiques.repartitionStatuts?.P || 0,
            AB: response.repartitionStatuts.statistiques.repartitionStatuts?.AB || 0,
            C: response.repartitionStatuts.statistiques.repartitionStatuts?.C || 0,
            S: response.repartitionStatuts.statistiques.repartitionStatuts?.S || 0,
            nonDefini: response.repartitionStatuts.statistiques.repartitionStatuts?.nonDefini || 0
          };
        }
        
        if (response.statsProduction.resumeProduction) {
          this.pcsTotalDate = response.statsProduction.resumeProduction.pcsTotalToutesLignes || 0;
        } else {
          this.calculerPcsTotalDate();
        }
        
        this.calculerPcsTotalJour();
        
        this.stats5MDate = response.stats5M;
        this.stats5MParLigneDate = response.stats5M?.lignes || [];
        
        const resumeJour = response.stats5M?.resumeTotalJour;
        
        if (resumeJour && resumeJour.detailParCause) {
          this.stats5MDateActuel = {
            matierePremiere: resumeJour.detailParCause.matierePremiere?.pourcentageSource || 0,
            absence: resumeJour.detailParCause.absence?.pourcentageSource || 0,
            rendement: resumeJour.detailParCause.rendement?.pourcentageSource || 0,
            maintenance: resumeJour.detailParCause.maintenance?.pourcentageSource || 0,
            qualite: resumeJour.detailParCause.qualite?.pourcentageSource || 0,
            methode: resumeJour.detailParCause.methode?.pourcentageSource || 0,
            environnement: resumeJour.detailParCause.environnement?.pourcentageSource || 0
          };
        } else {
          this.stats5MDateActuel = {
            matierePremiere: 0,
            absence: 0,
            rendement: 0,
            maintenance: 0,
            qualite: 0,
            methode: 0,
            environnement: 0
          };
        }
        
        this.titre5MDate = `Analyse des 5M - ${this.dateSelectionnee}`;
        this.ligneSelectionneeDate = null;
        
        this.isLoadingDate = false;
        this.showResultatsDate = true;
        this.showResultatsSemaine = false;
        this.showAffectation = false;
        this.showProductiviteOuvriers = false;
        this.showNonSaisieList = false;
        this.showSaisieDetails = false;
        this.showSaisieRapports = false;
        
        setTimeout(() => {
          this.creerGraphiquesDate();
          this.creerGraphiquesCirculaires5MDate();
        }, 100);
      },
      error: (error) => {
        console.error('❌ Erreur:', error);
        this.isLoadingDate = false;
        alert('Erreur lors du chargement des statistiques pour cette date');
      }
    });
  }

 

// Appliquer le filtre




/**
 * ✅ NOUVELLE MÉTHODE - Exporter en Excel (.xlsx)
 */
exporterExcel(): void {
  console.log('🔄 Début export Excel...');
  
  // 1. Vérifier les données disponibles
  const donneesDisponibles = this.productiviteFiltree?.length > 0 
    ? this.productiviteFiltree 
    : this.productiviteOuvriers?.tableau;
  
  console.log('📊 Données disponibles:', donneesDisponibles);
  
  if (!donneesDisponibles || donneesDisponibles.length === 0) {
    console.error('❌ Aucune donnée à exporter');
    alert('Aucune donnée à exporter');
    return;
  }
  
  try {
    // 2. Préparer les données
    const donneesFormatees = this.preparerDonneesPourExport(donneesDisponibles);
    console.log('✅ Données formatées:', donneesFormatees.length, 'lignes');
    
    // 3. Vérifier que les données ne sont pas vides
    if (donneesFormatees.length === 0) {
      console.error('❌ Données formatées vides');
      alert('Les données formatées sont vides');
      return;
    }
    
    // 4. Créer une feuille de calcul avec gestion d'erreurs
    let ws: XLSX.WorkSheet;
    try {
      ws = XLSX.utils.json_to_sheet(donneesFormatees);
      console.log('✅ Feuille de calcul créée');
    } catch (sheetError) {
      console.error('❌ Erreur création feuille:', sheetError);
      
      // Essayer une autre méthode
      const headers = Object.keys(donneesFormatees[0]);
      const data = donneesFormatees.map(row => headers.map(header => row[header]));
      ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    }
    
    // 5. Ajuster la largeur des colonnes
    const wscols = Object.keys(donneesFormatees[0]).map(() => ({ width: 20 }));
    ws['!cols'] = wscols;
    
    // 6. Créer un classeur
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productivité');
    
    // 7. Générer le nom du fichier
    const nomFichier = this.genererNomFichier('xlsx');
    console.log('📁 Nom du fichier:', nomFichier);
    
    // 8. Exporter avec une méthode alternative si nécessaire
    try {
      XLSX.writeFile(wb, nomFichier);
      console.log('✅ Export Excel réussi!');
    } catch (writeError) {
      console.error('❌ Erreur writeFile:', writeError);
      
      // Méthode alternative : créer un blob
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = nomFichier;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'export Excel:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
      console.error('❌ Erreur lors de l\'export Excel:', error);
      alert(`Erreur lors de l\'export Excel. Détails: ${error.message}`);
    } else {
      console.error('❌ Erreur lors de l\'export Excel:', String(error));
      alert('Erreur lors de l\'export Excel.');
    }
  }
}

/**
 * ✅ NOUVELLE MÉTHODE - Exporter en CSV
 */
exporterCSV(): void {
  if (!this.productiviteOuvriers?.tableau || this.productiviteOuvriers.tableau.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Déterminer quelles données exporter
  const donneesAExporter = this.valeurFiltre && this.productiviteFiltree.length > 0 
    ? this.productiviteFiltree  // Données filtrées
    : this.productiviteOuvriers.tableau; // Toutes les données

  if (donneesAExporter.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  try {
    // Préparer les données pour CSV
    const donneesFormatees = this.preparerDonneesPourExport(donneesAExporter);
    
    // Convertir en CSV
    const csv = this.convertirEnCSV(donneesFormatees);
    
    // Générer le nom du fichier
    const nomFichier = this.genererNomFichier('csv');
    
    // Créer et télécharger le fichier
    this.telechargerFichier(csv, nomFichier, 'text/csv;charset=utf-8;');
    
    console.log('✅ Fichier CSV exporté:', nomFichier);
  } catch (error) {
    console.error('❌ Erreur lors de l\'export CSV:', error);
    alert('Erreur lors de l\'export CSV');
  }
}

/**
 * ✅ NOUVELLE MÉTHODE - Préparer les données pour l'export
 */
/**
 * ✅ CORRIGÉ - Préparer les données pour l'export
 */
private preparerDonneesPourExport(donnees: any[]): any[] {
  console.log('🔄 Formatage des données pour export...');
  
  if (!donnees || donnees.length === 0) {
    console.warn('⚠️ Aucune donnée à formater');
    return [];
  }
  
  try {
    return donnees.map((ligne, index) => {
      // Vérifier que la ligne existe
      if (!ligne) {
        console.warn(`⚠️ Ligne ${index} est undefined/null`);
        return {};
      }
      
      // Fonction helper pour convertir en nombre avec sécurité
      const toNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          // Enlever les caractères non numériques sauf point et virgule
          const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };
      
      // Fonction helper pour formater en pourcentage avec sécurité
      const formatPourcentage = (value: any): string => {
        const num = toNumber(value);
        if (num === 0) return '-';
        return `${num.toFixed(1)}%`;
      };
      
      // Fonction helper pour formater une date
      const formatDate = (dateString: any): string => {
        if (!dateString) return '';
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString('fr-FR');
        } catch (e) {
          return String(dateString);
        }
      };
      
      return {
        'Date': formatDate(ligne.JOURS),
        'Matricule': String(ligne.MAT || ligne.matricule || ''),
        'Nom et Prénom': String(ligne['NOM ET PRENOM'] || ligne.nomPrenom || ''),
        'Heures travaillées': toNumber(ligne['N°HEURS'] || ligne.nombreHeures || ligne.heures),
        'Ligne de production': String(ligne.LIGNES || ligne.ligne || ''),
        'Productivité (%)': formatPourcentage(ligne.PRODUCTIVITE),
        'M1 - Matière Première (%)': formatPourcentage(ligne.M1),
        'M2 - Méthode (%)': formatPourcentage(ligne.M2),
        'M3 - Maintenance (%)': formatPourcentage(ligne.M3),
        'M4 - Qualité (%)': formatPourcentage(ligne.M4),
        'M5 - Absence (%)': formatPourcentage(ligne.M5),
        'M6 - Rendement (%)': formatPourcentage(ligne.M6),
        'M7 - Environnement (%)': formatPourcentage(ligne.M7),
        'Productivité Moyenne': ligne['PRODUCTIVITE MOYENNE'] || '-',
        'Note': String(ligne.NOTE || '-')
      };
    });
  } catch (error) {
    console.error('❌ Erreur formatage données:', error);
    console.error('Données problématiques:', donnees);
    return [];
  }
}
/**
 * ✅ NOUVELLE MÉTHODE - Convertir les données en CSV
 */
private convertirEnCSV(donnees: any[]): string {
  if (donnees.length === 0) return '';
  
  // Extraire les en-têtes
  const entetes = Object.keys(donnees[0]);
  
  // Créer les lignes CSV
  const lignesCSV = donnees.map(ligne => {
    return entetes.map(entete => {
      const valeur = ligne[entete];
      
      // Gérer les chaînes avec virgules ou guillemets
      if (typeof valeur === 'string' && (valeur.includes(',') || valeur.includes('"'))) {
        return `"${valeur.replace(/"/g, '""')}"`;
      }
      
      return valeur;
    }).join(',');
  });
  
  // Ajouter les en-têtes au début
  lignesCSV.unshift(entetes.join(','));
  
  return lignesCSV.join('\n');
}

/**
 * ✅ NOUVELLE MÉTHODE - Télécharger un fichier
 */
private telechargerFichier(contenu: string, nomFichier: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = nomFichier;
  link.click();
  
  // Nettoyer
  window.URL.revokeObjectURL(url);
}

/**
 * ✅ NOUVELLE MÉTHODE - Générer le nom du fichier
 */
private genererNomFichier(extension: string): string {
  const dateDebut = this.dateDebutProductivite.replace(/-/g, '');
  const dateFin = this.dateFinProductivite.replace(/-/g, '');
  const aujourdhui = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  let nomBase = `Productivite_Ouvriers_${dateDebut}_${dateFin}`;
  
  // Ajouter un suffixe si des données filtrées
  if (this.valeurFiltre && this.productiviteFiltree.length > 0) {
    nomBase += `_Filtre_${this.champFiltre}`;
  }
  
  return `${nomBase}_${aujourdhui}.${extension}`;
}

typeFiltreProductivite: string = '';

productiviteMin: number | null = null;
productiviteMax: number | null = null;


appliquerFiltreProductivite(): void {
  if (!this.productiviteOuvriers?.tableau) {
    return;
  }

  let resultats = [...this.productiviteOuvriers.tableau];

  // Filtre par nom
  if (this.typeFiltreProductivite === 'nom' && this.valeurFiltre) {
    const recherche = this.valeurFiltre.toLowerCase();
    resultats = resultats.filter(ligne => 
      ligne['NOM ET PRENOM']?.toLowerCase().includes(recherche)
    );
  }

  // Filtre par productivité (plage min-max)
  if (this.typeFiltreProductivite === 'productivite' && 
      this.productiviteMin !== null && 
      this.productiviteMax !== null) {
    resultats = resultats.filter(ligne => 
      ligne.PRODUCTIVITE >= this.productiviteMin! && 
      ligne.PRODUCTIVITE <= this.productiviteMax!
    );
  }

  // Filtre par ligne
  if (this.typeFiltreProductivite === 'ligne' && this.ligneSelectionnee) {
    resultats = resultats.filter(ligne => 
      ligne.LIGNES === this.ligneSelectionnee
    );
  }

  this.productiviteFiltree = resultats;
}

/**
 * Réinitialise les champs de filtre quand on change le type de filtre
 */
onTypeFiltreChange(): void {
  this.valeurFiltre = '';
  this.ligneSelectionnee = '';
  this.productiviteMin = null;
  this.productiviteMax = null;
  this.productiviteFiltree = [];
}

getLignesUniques(): string[] {
  if (!this.productiviteOuvriers?.tableau) {
    return [];
  }
  
  const lignes = this.productiviteOuvriers.tableau.map(l => l.LIGNES);
  return [...new Set(lignes)].filter(l => l != null).sort();
}

resetFiltre(): void {
  this.valeurFiltre = '';
  this.typeFiltreProductivite = '';
  this.ligneSelectionnee = '';
  this.productiviteMin = null;
  this.productiviteMax = null;
  this.productiviteFiltree = [];
}

// Propriétés pour le filtre de productivité
champFiltre: string = '';
valeurFiltre: string = '';
minPourcentage: number = 0;
maxPourcentage: number = 100;
productiviteFiltree: any[] = [];

/**
 * ✅ NOUVELLE MÉTHODE - Filtrer les données de productivité
 */
appliquerFiltre(): void {
  if (!this.productiviteOuvriers?.tableau) {
    this.productiviteFiltree = [];
    this.productiviteDataSorted = [];
    return;
  }

  let donnees = this.productiviteOuvriers.tableau;

  // Si pas de filtre, retourner toutes les données
  if (!this.champFiltre && !this.valeurFiltre) {
    this.productiviteFiltree = [...donnees];
    this.productiviteDataSorted = [];
    // Réinitialiser le tri si pas de filtre
    this.productiviteSortDirection = null;
    return;
  }

  // Appliquer le filtre
  this.productiviteFiltree = donnees.filter(ligne => {
    // Si pas de champ spécifique, chercher dans tous les champs
    if (!this.champFiltre) {
      return this.rechercherDansTousChamps(ligne);
    }

    // Filtrer par champ spécifique
    return this.filtrerParChamp(ligne, this.champFiltre);
  });
  
  // Réinitialiser le tri après application du filtre
  this.productiviteSortDirection = null;
  this.productiviteDataSorted = [];
}

/**
 * Rechercher dans tous les champs
 */
private rechercherDansTousChamps(ligne: any): boolean {
  if (!this.valeurFiltre) return true;
  
  const valeurRecherche = this.valeurFiltre.toLowerCase();
  
  return Object.keys(ligne).some(cle => {
    const valeur = ligne[cle];
    if (valeur === null || valeur === undefined) return false;
    
    return valeur.toString().toLowerCase().includes(valeurRecherche);
  });
}

/**
 * Filtrer par champ spécifique
 */
private filtrerParChamp(ligne: any, champ: string): boolean {
  if (!this.valeurFiltre && !this.minPourcentage && !this.maxPourcentage) {
    return true;
  }

  switch (champ) {
    case 'JOURS':
      return this.filtrerDate(ligne.JOURS);
    
    case 'MAT':
      return ligne.MAT?.toString().toLowerCase().includes(this.valeurFiltre.toLowerCase());
    
    case 'NOM_ET_PRENOM':
      return ligne['NOM ET PRENOM']?.toLowerCase().includes(this.valeurFiltre.toLowerCase());
    
    case 'N_HEURES':
      return this.filtrerNombre(ligne['N°HEURS'], this.valeurFiltre);
    
    case 'LIGNES':
      return ligne.LIGNES?.toLowerCase().includes(this.valeurFiltre.toLowerCase());
    
    case 'PRODUCTIVITE':
      return this.filtrerPourcentage(ligne.PRODUCTIVITE);
    
    case 'M1':
    case 'M2':
    case 'M3':
    case 'M4':
    case 'M5':
    case 'M6':
    case 'M7':
      const cleM = champ; // M1, M2, etc.
      return this.filtrerPourcentage(ligne[cleM]);
    
    case 'PRODUCTIVITE_MOYENNE':
      return ligne['PRODUCTIVITE MOYENNE']?.toLowerCase().includes(this.valeurFiltre.toLowerCase());
    
    case 'NOTE':
      return ligne.NOTE?.toLowerCase().includes(this.valeurFiltre.toLowerCase());
    
    default:
      return true;
  }
}

/**
 * Filtrer par date
 */
private filtrerDate(date: any): boolean {
  if (!this.valeurFiltre) return true;
  
  const dateLigne = new Date(date).toISOString().split('T')[0];
  const dateFiltre = this.valeurFiltre;
  
  return dateLigne === dateFiltre;
}

/**
 * Filtrer par nombre
 */
private filtrerNombre(valeur: number, filtre: string): boolean {
  if (!filtre) return true;
  
  const numFiltre = parseFloat(filtre);
  if (isNaN(numFiltre)) {
    // Recherche textuelle
    return valeur?.toString().includes(filtre);
  }
  
  // Recherche numérique exacte
  return valeur === numFiltre;
}

/**
 * Filtrer par pourcentage (range)
 */
private filtrerPourcentage(valeur: number): boolean {
  if (valeur === null || valeur === undefined) return false;
  
  return valeur >= this.minPourcentage && valeur <= this.maxPourcentage;
}

/**
 * ✅ NOUVELLE MÉTHODE - Appliquer filtre pourcentage (pour les champs M1-M6 et Productivité)
 */
appliquerFiltrePourcentage(): void {
  if (this.isChampPourcentage()) {
    this.appliquerFiltre();
  }
}

/**
 * ✅ NOUVELLE MÉTHODE - Vérifier si le champ est de type date
 */
isChampDate(): boolean {
  return this.champFiltre === 'JOURS';
}

/**
 * ✅ NOUVELLE MÉTHODE - Vérifier si le champ est de type pourcentage
 */
isChampPourcentage(): boolean {
  const champsPourcentage = [
    'PRODUCTIVITE', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'
  ];
  return champsPourcentage.includes(this.champFiltre);
}

/**
 * ✅ NOUVELLE MÉTHODE - Obtenir le label pour le champ valeur
 */
getLabelValeurFiltre(): string {
  if (this.isChampDate()) return 'Date :';
  if (this.isChampPourcentage()) return 'Plage de valeurs :';
  return 'Valeur :';
}

/**
 * ✅ NOUVELLE MÉTHODE - Obtenir le placeholder
 */
getPlaceholderFiltre(): string {
  if (!this.champFiltre) return 'Rechercher dans tous les champs...';
  
  switch(this.champFiltre) {
    case 'MAT': return 'Ex: 12345';
    case 'NOM_ET_PRENOM': return 'Ex: Dupont Jean';
    case 'LIGNES': return 'Ex: Ligne 1';
    case 'N_HEURES': return 'Ex: 8';
    default: return 'Entrez une valeur...';
  }
}

/**
 * ✅ NOUVELLE MÉTHODE - Réinitialiser le filtre
 */
reinitialiserFiltre(): void {
  this.champFiltre = '';
  this.valeurFiltre = '';
  this.minPourcentage = 0;
  this.maxPourcentage = 100;
  this.appliquerFiltre();
}

/**
 * ✅ NOUVELLE MÉTHODE - Quand le champ de filtre change
 */
onChampFiltreChange(): void {
  // Réinitialiser les valeurs
  this.valeurFiltre = '';
  this.minPourcentage = 0;
  this.maxPourcentage = 100;
  this.productiviteSortDirection = null;
  this.productiviteDataSorted = [];
  
  // Si c'est un champ pourcentage, initialiser à 0-100
  if (this.isChampPourcentage()) {
    this.minPourcentage = 0;
    this.maxPourcentage = 100;
  }
  
  // Appliquer le filtre (sera vide donc tout afficher)
  this.appliquerFiltre();
}

productiviteSortDirection: 'asc' | 'desc' | null = null;
productiviteDataSorted: any[] = [];

/**
 * ✅ NOUVELLE MÉTHODE - Trier par productivité
 */
toggleSortProductivite(): void {
  if (this.productiviteSortDirection === null || this.productiviteSortDirection === 'desc') {
    this.productiviteSortDirection = 'asc';
    this.trierProductiviteCroissant();
  } else {
    this.productiviteSortDirection = 'desc';
    this.trierProductiviteDecroissant();
  }
}

/**
 * ✅ NOUVELLE MÉTHODE - Trier par productivité croissante
 */
trierProductiviteCroissant(): void {
  let donnees = [];
  
  // Utiliser les données filtrées si disponibles, sinon toutes les données
  if (this.valeurFiltre || this.ligneSelectionnee || (this.minPourcentage > 0 && this.maxPourcentage < 100)) {
    donnees = [...this.productiviteFiltree];
  } else {
    donnees = [...(this.productiviteOuvriers?.tableau || [])];
  }
  
  // Trier par productivité croissante
  this.productiviteDataSorted = donnees.sort((a, b) => {
    const aVal = a.PRODUCTIVITE || 0;
    const bVal = b.PRODUCTIVITE || 0;
    return aVal - bVal;
  });
}

/**
 * ✅ NOUVELLE MÉTHODE - Trier par productivité décroissante
 */
trierProductiviteDecroissant(): void {
  let donnees = [];
  
  // Utiliser les données filtrées si disponibles, sinon toutes les données
  if (this.valeurFiltre || this.ligneSelectionnee || (this.minPourcentage > 0 && this.maxPourcentage < 100)) {
    donnees = [...this.productiviteFiltree];
  } else {
    donnees = [...(this.productiviteOuvriers?.tableau || [])];
  }
  
  // Trier par productivité décroissante
  this.productiviteDataSorted = donnees.sort((a, b) => {
    const aVal = a.PRODUCTIVITE || 0;
    const bVal = b.PRODUCTIVITE || 0;
    return bVal - aVal;
  });
}


/**
 * ✅ NOUVELLE MÉTHODE - Formater une date pour le titre
 */
private formatDateForTitle(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  } catch (e) {
    return dateString;
  }
}

async exporterResumeExcel(): Promise<void> {
  if (!this.productiviteOuvriers?.tableau || this.productiviteOuvriers.tableau.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Utiliser les données filtrées si disponibles, sinon toutes les données
  let donneesSource = [];
  if (this.valeurFiltre || this.ligneSelectionnee || (this.productiviteMin && this.productiviteMax)) {
    donneesSource = this.productiviteFiltree;
  } else {
    donneesSource = this.productiviteSortDirection ? this.productiviteDataSorted : this.productiviteOuvriers.tableau;
  }

  // Grouper par ouvrier (MAT)
  const groupeParOuvrier = new Map<number, any[]>();
  
  donneesSource.forEach(ligne => {
    const mat = ligne.MAT;
    if (!groupeParOuvrier.has(mat)) {
      groupeParOuvrier.set(mat, []);
    }
    groupeParOuvrier.get(mat)!.push(ligne);
  });

  // Calculer les statistiques par ouvrier - AVEC LA NOUVELLE CORRESPONDANCE
  const resumeOuvriers = Array.from(groupeParOuvrier.entries()).map(([mat, lignes]) => {
    const totalHeures = lignes.reduce((sum, l) => {
      const heures = l['N°HEURS'];
      const heuresNum = typeof heures === 'string' ? parseFloat(heures) : heures;
      return sum + (heuresNum || 0);
    }, 0);
    
    // Filtrer les lignes avec productivité > 0
    const lignesProdPositive = lignes.filter(l => {
      const prod = l.PRODUCTIVITE;
      const prodNum = typeof prod === 'string' ? parseFloat(prod) : (prod || 0);
      return prodNum > 0;
    });
    
    const nbJoursProdPositive = lignesProdPositive.length;
    
    const calculerMoyenneProductivite = (): number => {
      if (nbJoursProdPositive === 0) return 0;
      const somme = lignesProdPositive.reduce((sum, l) => {
        const prod = l.PRODUCTIVITE;
        const prodNum = typeof prod === 'string' ? parseFloat(prod) : (prod || 0);
        return sum + prodNum;
      }, 0);
      return somme / nbJoursProdPositive;
    };
    
    const calculerMoyenneM = (champ: string): number => {
      if (nbJoursProdPositive === 0) return 0;
      const somme = lignesProdPositive.reduce((sum, l) => {
        const valeur = l[champ];
        const valeurNum = typeof valeur === 'string' ? parseFloat(valeur) : (valeur || 0);
        return sum + valeurNum;
      }, 0);
      return somme / nbJoursProdPositive;
    };

    return {
      'Matricule': mat,
      'Nom et Prénom': lignes[0]['NOM ET PRENOM'] || 'N/A',
      'Total Heures': totalHeures.toFixed(2),
      'Productivité Moyenne': calculerMoyenneProductivite().toFixed(2) + '%',
      // CORRESPONDANCE CORRIGÉE SELON VOS BESOINS :
      'M1 Matière première': calculerMoyenneM('M1').toFixed(2) + '%',          // M1 → M1 (correct)
      'M2 Absence': calculerMoyenneM('M5').toFixed(2) + '%',                   // M5 → M2 (Absence)
      'M2 Rendement': calculerMoyenneM('M6').toFixed(2) + '%',                 // M6 → M2 (Rendement)
      'M3 Méthode': calculerMoyenneM('M2').toFixed(2) + '%',                   // M2 → M3 (Méthode)
      'M4 Maintenance': calculerMoyenneM('M3').toFixed(2) + '%',               // M3 → M4 (Maintenance)
      'M5 Qualité': calculerMoyenneM('M4').toFixed(2) + '%',                   // M4 → M5 (Qualité)
      'M6 Environnement': calculerMoyenneM('M7').toFixed(2) + '%'              // M7 → M6 (Environnement)
    };
  });

  // Trier par nom
  resumeOuvriers.sort((a, b) => a['Nom et Prénom'].localeCompare(b['Nom et Prénom']));

  console.log('📊 Export ExcelJS - Nouvelle correspondance appliquée');

  try {
    // Créer un nouveau workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Application de Production';
    workbook.lastModifiedBy = 'Application';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Créer une feuille
    const worksheet = workbook.addWorksheet('Résumé Productivité');
    
    // 1. TITRE PRINCIPAL (ligne 1)
    const titleRow = worksheet.getRow(1);
    titleRow.height = 35;
    worksheet.mergeCells('A1:L1'); // Changé de K1 à L1 car nous avons maintenant 12 colonnes
    
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'STATISTIQUES DE PRODUCTIVITÉ PAR OUVRIER';
    titleCell.font = {
      name: 'Calibri',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }
    };
    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    
    // 2. PÉRIODE (ligne 2)
    const periodeRow = worksheet.getRow(2);
    periodeRow.height = 25;
    worksheet.mergeCells('A2:L2'); // Changé de K2 à L2
    
    const periodeCell = worksheet.getCell('A2');
    periodeCell.value = `Période : ${this.formatDateForTitle(this.dateDebutProductivite)} au ${this.formatDateForTitle(this.dateFinProductivite)}`;
    periodeCell.font = {
      name: 'Calibri',
      size: 11,
      color: { argb: 'FF000000' }
    };
    periodeCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAD3' }
    };
    periodeCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    
    // 3. Ligne vide (ligne 3)
    worksheet.getRow(3).height = 10;
    
    // 4. EN-TÊTES AVEC DEUX COLONNES M2 (ligne 4)
    const headers = [
      'Matricule',
      'Nom et Prénom', 
      'Total Heures',
      'Productivité Moyenne',
      'M1 Matière première',
      'M2 Absence',      // Première colonne M2
      'M2 Rendement',    // Deuxième colonne M2
      'M3 Méthode',
      'M4 Maintenance',
      'M5 Qualité',
      'M6 Environnement'
    ];
    
    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF548235' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: index < 2 ? 'left' : 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
    
    // 5. DONNÉES (lignes 5+)
    resumeOuvriers.forEach((ouvrier, index) => {
      const dataRow = worksheet.getRow(5 + index);
      dataRow.height = 25;
      
      // Alterner les couleurs de fond
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2';
      
      const dataCellStyle = {
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: bgColor }
        },
        border: {
          top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } }
        }
      };
      
      // Matricule (colonne A)
      const cell1 = dataRow.getCell(1);
      cell1.value = ouvrier['Matricule'];
      cell1.font = { name: 'Calibri', size: 10 };
      cell1.fill = dataCellStyle.fill;
      cell1.alignment = { vertical: 'middle', horizontal: 'left' };
      cell1.border = dataCellStyle.border;
      
      // Nom et Prénom (colonne B)
      const cell2 = dataRow.getCell(2);
      cell2.value = ouvrier['Nom et Prénom'];
      cell2.font = { name: 'Calibri', size: 10 };
      cell2.fill = dataCellStyle.fill;
      cell2.alignment = { vertical: 'middle', horizontal: 'left' };
      cell2.border = dataCellStyle.border;
      
      // Total Heures (colonne C)
      const cell3 = dataRow.getCell(3);
      cell3.value = ouvrier['Total Heures'];
      cell3.font = { name: 'Calibri', size: 10 };
      cell3.fill = dataCellStyle.fill;
      cell3.alignment = { vertical: 'middle', horizontal: 'center' };
      cell3.border = dataCellStyle.border;
      
      // Productivité Moyenne (colonne D)
      const cell4 = dataRow.getCell(4);
      cell4.value = ouvrier['Productivité Moyenne'];
      cell4.font = { name: 'Calibri', size: 10 };
      cell4.fill = dataCellStyle.fill;
      cell4.alignment = { vertical: 'middle', horizontal: 'center' };
      cell4.border = dataCellStyle.border;
      
      // M1 à M6 (colonnes E à K)
      const mKeys = [
        'M1 Matière première', 
        'M2 Absence', 
        'M2 Rendement', 
        'M3 Méthode', 
        'M4 Maintenance', 
        'M5 Qualité', 
        'M6 Environnement'
      ];
      
      for (let i = 0; i < mKeys.length; i++) {
        const cell = dataRow.getCell(5 + i);
        cell.value = (ouvrier as any)[mKeys[i]];
        cell.font = { name: 'Calibri', size: 10 };
        cell.fill = dataCellStyle.fill;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = dataCellStyle.border;
      }
    });
    
    // Définir les largeurs de colonnes
    worksheet.columns = [
      { width: 12 },  // A - Matricule
      { width: 25 },  // B - Nom et Prénom
      { width: 12 },  // C - Total Heures
      { width: 18 },  // D - Productivité Moyenne
      { width: 15 },  // E - M1 Matière première
      { width: 12 },  // F - M2 Absence
      { width: 12 },  // G - M2 Rendement
      { width: 12 },  // H - M3 Méthode
      { width: 15 },  // I - M4 Maintenance
      { width: 12 },  // J - M5 Qualité
      { width: 15 }   // K - M6 Environnement
    ];
    
    // Générer le nom du fichier
    const dateDebut = this.dateDebutProductivite 
      ? new Date(this.dateDebutProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-') 
      : 'debut';
    const dateFin = this.dateFinProductivite 
      ? new Date(this.dateFinProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-') 
      : 'fin';
    const fileName = `Statistiques_Productivite_Ouvriers_${dateDebut}_au_${dateFin}.xlsx`;
    
    // Sauvegarder le fichier
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fileName);
    
    console.log('✅ Rapport Excel généré avec la nouvelle correspondance des M');
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération Excel:', error);
    alert('Erreur lors de la génération du fichier Excel');
  }
}


}