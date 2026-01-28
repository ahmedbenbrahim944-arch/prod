import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  StatsService, 
  Pourcentage5MResponse,
  Pourcentage5MParLigneResponse,
  Ligne5MStats,
  AffectationPersonnelResponse,
  Stats5MParDateResponse,
  Ligne5MDate,
  Stats5M,  // ✅ AJOUTER CETTE IMPORTATION
  UpdateStatutRequest
} from './stats.service';
import { Chart, registerables } from 'chart.js';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(ChartDataLabels);


Chart.register(...registerables);
import { AuthService } from '../login/auth.service';

interface LigneStats {
  ligne: string;
  pcsProdTotal: number;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
  actif: boolean;  // ✅ AJOUTER
  totalQtePlanifiee: number;  // ✅ AJOUTER
}

@Component({
  selector: 'app-statistiques',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statistiques.component.html',
  styleUrls: ['./statistiques.component.css']
})
export class StatistiquesComponent implements OnInit, OnDestroy {
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

  // ✅ NOUVELLES PROPRIÉTÉS - Affectation Personnel
  affectationPersonnel: AffectationPersonnelResponse | null = null;
  isLoadingAffectation: boolean = false;
  showAffectation: boolean = false;

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
    methode: '#ec4899', // ✅ NOUVELLE COULEUR POUR MÉTHODE
    environnement: '#0ee9cf',
  };

  // Propriétés pour les totaux
  pcsTotalSemaine: number = 0;
  pcsTotalDate: number = 0;
  pcsTotalJour: number = 0;

  constructor(private statsService: StatsService, private router: Router,private authService: AuthService) {}

  ngOnInit(): void {
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];
    // Initialiser avec la date d'aujourd'hui
    this.dateSelectionnee = this.maxDate;
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  getSemainesArray(): number[] {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Charger l'affectation du personnel
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
   * ✅ MÉTHODE UTILITAIRE - Obtenir la couleur du texte delta
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
    
    // Calculer la moyenne des PCS de toutes les lignes
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
        this.statsLignes = response.lignes.lignes as any as LigneStats[];
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
        
        console.log('📊 STATISTIQUES CHARGÉES:');
        console.log('  - Nombre de lignes:', this.statsLignes.length);
        console.log('  - PCS Total Semaine:', this.pcsTotalSemaine + '%');
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

  getLignesActivesCount(): number {
  if (!this.statsLignesDate) return 0;
  return this.statsLignesDate.filter(l => l.actif).length;
}

getLignesNonActivesCount(): number {
  if (!this.statsLignesDate) return 0;
  return this.statsLignesDate.filter(l => !l.actif).length;
}

 private calculerPcsTotalDate(): void {
  if (!this.statsLignesDate || this.statsLignesDate.length === 0) {
    this.pcsTotalDate = 0;
    return;
  }
  
  // Calculer la moyenne des PCS de toutes les lignes (actives et non actives)
  const totalPcs = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.pcsProdTotal, 0);
  this.pcsTotalDate = totalPcs / this.statsLignesDate.length;
}

  /**
   * Charger les statistiques par date
   */
 chargerStatsParDate(): void {
  if (!this.dateSelectionnee) {
    alert('Veuillez sélectionner une date');
    return;
  }

  this.isLoadingDate = true;
  
  forkJoin({
    statsProduction: this.statsService.getStatsParDate(this.dateSelectionnee),
    stats5M: this.statsService.getStats5MParDate(this.dateSelectionnee),
    ouvriersNonSaisis: this.statsService.getOuvriersNonSaisisParDate(this.dateSelectionnee)
  }).subscribe({
    next: (response) => {
      // Stats de production
      this.statsDate = response.statsProduction;
      
      // ✅ MODIFICATION : Combiner lignesActives et lignesNonActives
      this.statsLignesDate = [
        ...(response.statsProduction.lignesActives || []).map(ligne => ({
          ligne: ligne.ligne,
          pcsProdTotal: ligne.pcsProdTotal,
          nombrePlanifications: ligne.nombrePlanifications,
          nombreReferences: ligne.nombreReferences,
          totalQteSource: ligne.totalQteSource,
          totalDecProduction: ligne.totalDecProduction,
          actif: true,  // ✅
          totalQtePlanifiee: ligne.totalQtePlanifiee || 0  // ✅
        })),
        ...(response.statsProduction.lignesNonActives || []).map(ligne => ({
          ligne: ligne.ligne,
          pcsProdTotal: ligne.pcsProdTotal,
          nombrePlanifications: ligne.nombrePlanifications,
          nombreReferences: ligne.nombreReferences,
          totalQteSource: ligne.totalQteSource,
          totalDecProduction: ligne.totalDecProduction,
          actif: false,  // ✅
          totalQtePlanifiee: ligne.totalQtePlanifiee  || 0 // ✅
        }))
      ];
      
      // ✅ CORRECTION : Accès correct au PCS total pour la date
      if (response.statsProduction.resumeProduction) {
        this.pcsTotalDate = response.statsProduction.resumeProduction.pcsTotalToutesLignes || 0;
      } else {
        // Fallback au calcul manuel
        this.calculerPcsTotalDate();
      }
      
      // ✅ Calculer le PCS total du jour
      this.calculerPcsTotalJour();
      
      // Stats 5M par date
      this.stats5MDate = response.stats5M;
      this.stats5MParLigneDate = response.stats5M?.lignes || [];
      
      // Initialiser avec les 5M globaux du jour
      const resumeJour = response.stats5M?.resumeTotalJour;
      
      // ✅ UTILISER 'pourcentageSource' (basé sur qtePlanifiee)
      this.stats5MDateActuel = resumeJour ? {
        matierePremiere: resumeJour.detailParCause.matierePremiere?.pourcentageSource || 0,
        absence: resumeJour.detailParCause.absence?.pourcentageSource || 0,
        rendement: resumeJour.detailParCause.rendement?.pourcentageSource || 0,
        maintenance: resumeJour.detailParCause.maintenance?.pourcentageSource || 0,
        qualite: resumeJour.detailParCause.qualite?.pourcentageSource || 0,
        methode: resumeJour.detailParCause.methode?.pourcentageSource || 0,
         environnement: resumeJour.detailParCause.environnement?.pourcentageSource || 0
      } : {
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        maintenance: 0,
        qualite: 0,
        methode: 0,
        environnement: 0
      };
      
      this.titre5MDate = `Analyse des 5M - ${this.dateSelectionnee}`;
      this.ligneSelectionneeDate = null;
      
      // ✅ Mettre à jour les ouvriers non-saisis avec statuts
      this.ouvriersNonSaisisAvecStatuts = response.ouvriersNonSaisis?.ouvriers || [];
      
      // ✅ Vérification finale
      console.log('📊 STATISTIQUES PAR DATE CHARGÉES:');
      console.log('  - Date:', this.dateSelectionnee);
      console.log('  - PCS Total toutes lignes:', this.pcsTotalDate + '%');
      console.log('  - PCS Total du jour:', this.pcsTotalJour + '%');
      console.log('  - Nombre de lignes:', this.statsLignesDate.length);
      console.log('  - Lignes actives:', this.statsLignesDate.filter(l => l.actif).length);
      console.log('  - Lignes non actives:', this.statsLignesDate.filter(l => !l.actif).length);
      console.log('  - Stats 5M Date:', this.stats5MDateActuel);
      
      this.isLoadingDate = false;
      this.showResultatsDate = true;
      this.showResultatsSemaine = false;
      this.showAffectation = false;
      this.showNonSaisieList = false;
      this.showSaisieDetails = false;
      this.showSaisieRapports = false;
      this.showStatutsPanel = false; // Masquer le panneau des statuts au départ
      
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

  calculerPcsTotalJour(): void {
    if (!this.statsLignesDate || this.statsLignesDate.length === 0) {
      this.pcsTotalJour = 0;
      console.warn('⚠️ Aucune ligne trouvée pour calculer le PCS du jour');
      return;
    }
    
    // ✅ OPTION 1 : Utiliser directement le PCS total du résumé (préféré)
    if (this.statsDate?.resumeProduction?.pcsTotalToutesLignes !== undefined) {
      this.pcsTotalJour = this.statsDate.resumeProduction.pcsTotalToutesLignes;
      console.log('✅ PCS du jour (depuis résumé):', this.pcsTotalJour);
      return;
    }
    
    // ✅ OPTION 2 : Calculer la moyenne pondérée (fallback)
    const totalQteSource = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.totalQteSource, 0);
    const totalDecProduction = this.statsLignesDate.reduce((sum, ligne) => sum + ligne.totalDecProduction, 0);
    
    this.pcsTotalJour = totalQteSource > 0
      ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
      : 0;
    
    console.log('✅ PCS du jour (calculé):', this.pcsTotalJour);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Obtenir le libellé de performance
   */
  getPerformanceLabel(percentage: number): string {
    if (percentage >= 75) return 'Performance Excellente';
    if (percentage >= 50) return 'Performance Bonne';
    if (percentage >= 25) return 'Performance Moyenne';
    return 'Performance à Améliorer';
  }

  /**
   * ✅ MÉTHODE - Sélectionner une ligne pour les stats par date
   */
  selectionnerLigneDate(ligne: string): void {
    this.ligneSelectionneeDate = ligne;
    
    const ligne5M = this.stats5MParLigneDate.find(l => l.ligne === ligne);
    
    if (ligne5M) {
      this.titre5MDate = `Analyse des 5M - ${ligne} (${this.dateSelectionnee})`;
      
      // ✅ UTILISER 'pourcentageSource' (basé sur qtePlanifiee)
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
   * ✅ MÉTHODE - Revenir aux 5M globaux du jour
   */
  resetSelectionLigneDate(): void {
    this.ligneSelectionneeDate = null;
    
    if (this.stats5MDate) {
      const resumeJour = this.stats5MDate.resumeTotalJour;
      
      // ✅ UTILISER 'pourcentageSource' (basé sur qtePlanifiee)
      this.stats5MDateActuel = {
        matierePremiere: resumeJour.detailParCause.matierePremiere.pourcentageSource || 0,
        absence: resumeJour.detailParCause.absence.pourcentageSource || 0,
        rendement: resumeJour.detailParCause.rendement.pourcentageSource || 0,
        maintenance: resumeJour.detailParCause.maintenance.pourcentageSource || 0,
        qualite: resumeJour.detailParCause.qualite.pourcentageSource || 0,
        methode: resumeJour.detailParCause.methode?.pourcentageSource || 0,
        environnement: resumeJour.detailParCause.environnement?.pourcentageSource || 0
      };
      
      this.titre5MDate = `Analyse des 5M - ${this.dateSelectionnee}`;
      
      setTimeout(() => {
        this.creerGraphiquesCirculaires5MDate();
      }, 50);
    }
  }

  retourAuxFiltres(): void {
    this.showResultatsSemaine = false;
    this.showResultatsDate = false;
    this.ligneSelectionnee = null;
    this.ligneSelectionneeDate = null;
    this.showAffectation = false;
    this.showSaisieRapports = false;
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

    const labels = this.statsLignesDate.map(l => l.ligne);
    const data = this.statsLignesDate.map(l => l.pcsProdTotal);
    
    const colors = data.map(value => {
      if (value >= 75) return '#10b981';
      if (value >= 50) return '#22c55e';
      if (value >= 25) return '#f59e0b';
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
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: (value: number) => `${value.toFixed(1)}%`,
            font: {
              weight: 'bold',
              size: 12
            },
            color: '#374151'
          }
        }
      }
    });
  }

  /**
   * ✅ MÉTHODE - Toggle pour afficher/masquer la saisie des rapports
   */
  toggleSaisieRapports(): void {
    this.showSaisieRapports = !this.showSaisieRapports;
  }

  private darkenColor(color: string): string {
    const colors: {[key: string]: string} = {
      '#10b981': '#0da271',
      '#22c55e': '#1aa152',
      '#f59e0b': '#d6880a',
      '#ef4444': '#d33838',
      '#ec4899': '#d43d89' // ✅ NOUVELLE COULEUR ASSOMBRIE
    };
    return colors[color] || '#374151';
  }

  /**
   * ✅ MÉTHODE CORRIGÉE - Créer les graphiques circulaires 5M (avec gestion des undefined)
   */
  creerGraphiquesCirculaires5M(): void {
    if (!this.stats5M) return;

    const causes5M = [
      { nom: 'matierePremiere', valeur: this.stats5M.matierePremiere || 0 },
      { nom: 'absence', valeur: this.stats5M.absence || 0 },
      { nom: 'rendement', valeur: this.stats5M.rendement || 0 },
      { nom: 'maintenance', valeur: this.stats5M.maintenance || 0 },
      { nom: 'qualite', valeur: this.stats5M.qualite || 0 },
      { nom: 'methode', valeur: this.stats5M.methode || 0 }, // ✅ NOUVELLE CAUSE
      { nom: 'environnement', valeur: this.stats5M.environnement || 0 }, // ✅ NOUVELLE CAUSE
    ];

    causes5M.forEach((cause) => {
      const canvasId = `pieChart-${cause.nom}`;
      const existingChart = this.pieCharts5M.get(canvasId);
      if (existingChart) {
        existingChart.destroy();
        this.pieCharts5M.delete(canvasId);
      }
    });

    causes5M.forEach((cause) => {
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
            legend: {
              display: false
            },
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
   * ✅ MÉTHODE CORRIGÉE - Créer les graphiques circulaires 5M pour la date (avec gestion des undefined)
   */
  creerGraphiquesCirculaires5MDate(): void {
    if (!this.stats5MDateActuel) return;

    const causesData = [
      { nom: 'matierePremiere', valeur: this.stats5MDateActuel.matierePremiere || 0 },
      { nom: 'absence', valeur: this.stats5MDateActuel.absence || 0 },
      { nom: 'rendement', valeur: this.stats5MDateActuel.rendement || 0 },
      { nom: 'maintenance', valeur: this.stats5MDateActuel.maintenance || 0 },
      { nom: 'qualite', valeur: this.stats5MDateActuel.qualite || 0 },
      { nom: 'methode', valeur: this.stats5MDateActuel.methode || 0 }, // ✅ NOUVELLE CAUSE
      { nom: 'environnement', valeur: this.stats5MDateActuel.environnement || 0 }, // ✅ NOUVELLE CAUSE
    ];

    // Détruire les anciens graphiques 5M de la date
    causesData.forEach(cause => {
      const canvasId = `pieChart-${cause.nom}-date`;
      const existingChart = this.pieCharts5M.get(canvasId);
      if (existingChart) {
        existingChart.destroy();
        this.pieCharts5M.delete(canvasId);
      }
    });

    // Créer les nouveaux graphiques
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
   * ✅ MÉTHODE - Sélectionner une ligne pour les stats par semaine
   */
  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
    
    const ligne5M = this.stats5MParLigneData.find(l => l.ligne === ligne);
    
    if (ligne5M) {
      this.titre5M = `Analyse des 5M - ${ligne}`;
      
      // ✅ UTILISER 'pourcentageDuTotal' (basé sur qtePlanifiee)
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

 retourChoix(): void {
  // Vérifier si l'utilisateur est un admin avec matricule 1194 ou 9001
  const matricule = this.authService.getUserMatricule();
  const isSpecialAdmin = ['1194', '9001'].includes(matricule || '');
  
  if (isSpecialAdmin) {
    this.router.navigate(['/choix1']); // Retour vers choix1 pour ces admin
  } else {
    this.router.navigate(['/choix']); // Retour normal vers choix
  }
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

  notifyOuvrier(ouvrier: any): void {
    if (confirm(`Voulez-vous notifier ${ouvrier.nomPrenom} (${ouvrier.matricule}) ?`)) {
      alert(`Notification envoyée à ${ouvrier.nomPrenom}`);
    }
  }
  statutOptions = [
  { code: 'AB', libelle: 'Absent', couleur: '#ef4444', icon: '' },
  { code: 'C', libelle: 'Congé', couleur: '#3b82f6', icon: '' },
  { code: 'S', libelle: 'Sélection', couleur: '#10b981', icon: '' }
];
ouvriersNonSaisisAvecStatuts: any[] = [];
statutsModifies: Map<string, string> = new Map(); // Stocke les statuts modifiés en mémoire
commentaires: Map<string, string> = new Map(); // Stocke les commentaires
showStatutsPanel: boolean = false;
isSaving: boolean = false;
showStatutsForDate: string = '';

// NOUVELLE MÉTHODE : Charger les ouvriers non-saisis avec leurs statuts
chargerOuvriersNonSaisisAvecStatuts(): void {
  if (!this.dateSelectionnee) {
    alert('Veuillez sélectionner une date');
    return;
  }

  // Si c'est déjà la date actuelle, on réutilise les données existantes
  if (this.showStatutsPanel && this.showStatutsForDate === this.dateSelectionnee) {
    return;
  }

  this.showStatutsForDate = this.dateSelectionnee;
  
  this.statsService.getOuvriersNonSaisisParDate(this.dateSelectionnee).subscribe({
    next: (response) => {
      this.ouvriersNonSaisisAvecStatuts = response.ouvriers;
      this.showStatutsPanel = true;
      
      // Initialiser les maps avec les statuts existants
      this.statutsModifies.clear();
      this.commentaires.clear();
      
      this.ouvriersNonSaisisAvecStatuts.forEach(ouvrier => {
        if (ouvrier.statut) {
          this.statutsModifies.set(ouvrier.matricule, ouvrier.statut);
        }
        if (ouvrier.commentaire) {
          this.commentaires.set(ouvrier.matricule, ouvrier.commentaire);
        }
      });
      
      console.log('✅ Ouvriers non-saisis avec statuts chargés:', response);
    },
    error: (error) => {
      console.error('❌ Erreur chargement ouvriers non-saisis:', error);
      alert('Erreur lors du chargement des ouvriers non-saisis');
    }
  });
}

// NOUVELLE MÉTHODE : Changer le statut d'un ouvrier
changerStatut(matricule: string, statut: string): void {
  this.statutsModifies.set(matricule, statut);
  console.log(`📝 Statut modifié pour ${matricule}: ${statut}`);
}

// NOUVELLE MÉTHODE : Changer le commentaire
changerCommentaire(matricule: string, commentaire: string): void {
  this.commentaires.set(matricule, commentaire);
}

// NOUVELLE MÉTHODE : Obtenir le statut actuel d'un ouvrier
getStatutActuel(matricule: string): string | null {
  return this.statutsModifies.get(matricule) || null;
}

// NOUVELLE MÉTHODE : Obtenir le commentaire actuel d'un ouvrier
getCommentaireActuel(matricule: string): string {
  return this.commentaires.get(matricule) || '';
}

// NOUVELLE MÉTHODE : Obtenir le libellé du statut
getLibelleStatut(code: string): string {
  const statut = this.statutOptions.find(s => s.code === code);
  return statut ? statut.libelle : 'Non défini';
}

// NOUVELLE MÉTHODE : Obtenir la couleur du statut
getCouleurStatut(code: string): string {
  const statut = this.statutOptions.find(s => s.code === code);
  return statut ? statut.couleur : '#6b7280';
}

// NOUVELLE MÉTHODE : Obtenir l'icône du statut
getIconeStatut(code: string): string {
  const statut = this.statutOptions.find(s => s.code === code);
  return statut ? statut.icon : '';
}

// NOUVELLE MÉTHODE : Vérifier si un statut est valide
isValidStatut(statut: string): boolean {
  return ['AB', 'C', 'S'].includes(statut);
}

// NOUVELLE MÉTHODE : Sauvegarder un statut individuel
sauvegarderStatut(ouvrier: any): void {
const statut = this.statutsModifies.get(ouvrier.matricule);

if (!statut || !this.isValidStatut(statut)) {
  alert('Veuillez sélectionner un statut valide (AB, C ou S) pour cet ouvrier');
  return;
}

  const matriculeString = ouvrier.matricule.toString();
  const nomPrenomString = ouvrier.nomPrenom || '';

const statutData: UpdateStatutRequest = {
  matricule: matriculeString,
  nomPrenom: nomPrenomString,
  date: this.dateSelectionnee,
  statut: statut as 'AB' | 'C' | 'S',
  commentaire: this.commentaires.get(ouvrier.matricule) || ''
};

  console.log('📤 Envoi des données de statut:', statutData); // ✅ Ajouté

  this.isSaving = true;

  this.statsService.updateStatutOuvrier(statutData).subscribe({
    next: (response) => {
  // Mettre à jour la liste
  const index = this.ouvriersNonSaisisAvecStatuts.findIndex(o => o.matricule === ouvrier.matricule);
  if (index !== -1) {
    this.ouvriersNonSaisisAvecStatuts[index].statut = statut;
    this.ouvriersNonSaisisAvecStatuts[index].libelleStatut = this.getLibelleStatut(statut);
  }
  
  alert(`✅ Statut enregistré pour ${ouvrier.nomPrenom}`);
},
    error: (error) => {
      this.isSaving = false;
      console.error('❌ Erreur détaillée:', error); // ✅ Amélioré
      console.error('❌ URL appelée:', error.url);
      console.error('❌ Status:', error.status);
      console.error('❌ Message:', error.message);
      console.error('❌ Body de la requête:', statutData);
      
      // Afficher plus d'informations à l'utilisateur
      let messageErreur = 'Erreur lors de la sauvegarde du statut';
      if (error.status === 404) {
        messageErreur = 'Route API non trouvée. Vérifiez que le backend est correctement configuré.';
      } else if (error.status === 401) {
        messageErreur = 'Non autorisé. Votre session a peut-être expiré.';
      } else if (error.status === 400) {
        messageErreur = 'Données invalides envoyées au serveur.';
        if (error.error?.message) {
          messageErreur += ` Détails: ${error.error.message}`;
        }
      }
      
      alert(`${messageErreur}\n\nVérifiez la console pour plus de détails.`);
    }
  });

  
}

getOuvriersAvecStatuts(): any[] {
  // Si on a les données avec statuts, utiliser celles-ci
  if (this.ouvriersNonSaisisAvecStatuts.length > 0) {
    return this.ouvriersNonSaisisAvecStatuts;
  }
  
  // Sinon utiliser les données originales
  return this.statsDate?.rapportsSaisie?.ouvriersNonSaisis || [];
}

// NOUVELLE MÉTHODE : Sauvegarder tous les statuts en une fois
// NOUVELLE MÉTHODE : Sauvegarder tous les statuts en une fois
sauvegarderTousStatuts(): void {
  // Utiliser la méthode getOuvriersAvecStatuts() pour obtenir les données correctes
  const ouvriers = this.getOuvriersAvecStatuts();
  
  const statutsToSave = [];
  
  // Préparer les données pour tous les ouvriers modifiés
  for (const ouvrier of ouvriers) {
    const statut = this.statutsModifies.get(ouvrier.matricule);
    
    if (statut && this.isValidStatut(statut)) {
      const statutTyped = statut as 'AB' | 'C' | 'S';
      statutsToSave.push({
        matricule: ouvrier.matricule.toString(),
        nomPrenom: ouvrier.nomPrenom || '',
        date: this.dateSelectionnee,
        statut: statutTyped,
        commentaire: this.commentaires.get(ouvrier.matricule) || ''
      });
    }
  }

  if (statutsToSave.length === 0) {
    alert('Aucun statut à sauvegarder. Veuillez d\'abord modifier des statuts.');
    return;
  }

  if (!confirm(`Voulez-vous enregistrer les statuts pour ${statutsToSave.length} ouvrier(s) ?`)) {
    return;
  }

  this.isSaving = true;
  let compteurReussis = 0;
  let compteurEchecs = 0;
  
  console.log(`📤 Tentative d'enregistrement de ${statutsToSave.length} statuts`, statutsToSave);

  // Créer un tableau de promesses pour toutes les requêtes
  const requetes = statutsToSave.map(statutData => {
    return new Promise<void>((resolve) => {
      this.statsService.updateStatutOuvrier(statutData).subscribe({
        next: (response) => {
          compteurReussis++;
          console.log(`✅ Statut sauvegardé pour ${statutData.matricule}`, response);
          
          // Mettre à jour l'ouvrier dans la liste
          const index = ouvriers.findIndex(o => o.matricule === statutData.matricule);
          if (index !== -1) {
            ouvriers[index].statut = statutData.statut;
            ouvriers[index].libelleStatut = this.getLibelleStatut(statutData.statut);
            ouvriers[index].commentaire = statutData.commentaire;
          }
          
          resolve();
        },
        error: (error) => {
          compteurEchecs++;
          console.error(`❌ Erreur pour ${statutData.matricule}:`, error);
          console.error('Données envoyées:', statutData);
          resolve();
        }
      });
    });
  });

  // Attendre que toutes les requêtes soient terminées
  Promise.all(requetes).then(() => {
    this.isSaving = false;
    
    // Réinitialiser les modifications après sauvegarde
    this.statutsModifies.clear();
    this.commentaires.clear();
    
    if (compteurEchecs === 0) {
      alert(`✅ ${compteurReussis} statut(s) enregistré(s) avec succès !`);
    } else {
      alert(`${compteurReussis} statut(s) enregistré(s) avec succès, ${compteurEchecs} échec(s)`);
    }
    
    console.log('✅ Résultat sauvegarde:', { reussis: compteurReussis, echecs: compteurEchecs });
  }).catch(error => {
    this.isSaving = false;
    console.error('❌ Erreur générale:', error);
    alert('Une erreur est survenue lors de la sauvegarde');
  });
}

// NOUVELLE MÉTHODE : Toggle l'affichage du panneau des statuts
toggleStatutsPanel(): void {
  if (!this.showStatutsPanel) {
    this.chargerOuvriersNonSaisisAvecStatuts();
  } else {
    this.showStatutsPanel = false;
  }
}

// NOUVELLE MÉTHODE : Réinitialiser un statut
reinitialiserStatut(matricule: string): void {
  this.statutsModifies.delete(matricule);
  this.commentaires.delete(matricule);
  
  const ouvrier = this.ouvriersNonSaisisAvecStatuts.find(o => o.matricule === matricule);
  if (ouvrier) {
    ouvrier.statut = null;
    ouvrier.libelleStatut = 'Non défini';
    ouvrier.commentaire = '';
  }
}

private rafraichirOuvriersNonSaisis(): void {
  if (!this.dateSelectionnee) return;
  
  this.statsService.getOuvriersNonSaisisParDate(this.dateSelectionnee).subscribe({
    next: (response) => {
      // Mettre à jour les deux sources
      this.ouvriersNonSaisisAvecStatuts = response.ouvriers;
      
      if (this.statsDate?.rapportsSaisie) {
        this.statsDate.rapportsSaisie.ouvriersNonSaisis = response.ouvriers;
      }
    },
    error: (error) => {
      console.error('❌ Erreur rafraîchissement:', error);
    }
  });
}





}