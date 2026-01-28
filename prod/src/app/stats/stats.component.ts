import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface DetailNonConformite {
  reference: string;
  of: string;
  qtyPlanifiee: number;
  qtyProduite: number;
  delta: number;
  m1_matierePremiere: number;
  m2_absence: number;
  m3_rendement: number;
  m4_methode: number;
  m5_maintenance: number;
  m6_qualite: number;
  m7_environnement: number;
  total7M: number;
  pourcentageEcart: number;
  refMP?: string;
  refQualite?: string;
  date: string;
  jour: string;
  ligne: string;
  nombreReferences?: number;
}

interface LigneDetail {
  ligne: string;
  nombreReferences: number;
 production: {  // <-- CE N'EST PAS production mais production ?
    totalQteSource: number;
    totalDecProduction: number;
    pcs: number;
  };
  causes7M: {
    matierePremiere: { quantite: number; pourcentage: number; references: string[] };
    absence: { quantite: number; pourcentage: number };
    rendement: { quantite: number; pourcentage: number };
    methode: { quantite: number; pourcentage: number };
    maintenance: { quantite: number; pourcentage: number };
    qualite: { quantite: number; pourcentage: number; references: string[] };
    environnement: { quantite: number; pourcentage: number };
  };
  detailsReferences?: Array<{
    reference: string;
    of: string;
    qtePlanifiee: number;
    qteModifiee: number;
    decProduction: number;
    pcsProd: number;
    causes7M?: any;
  }>;
}


interface StatsPeriode {
  message: string;
  periode: {
    dateDebut: string;
    dateFin: string;
    nombreSemaines: number;
    dateCalcul: string;
  };
  productionGlobale: {
    totalQteSource: number;
    totalDecProduction: number;
    pcsTotal: number;
    oee: null | number;
  };
  statsParLigne: Array<{
    ligne: string;
    nombreReferences: number;
    production: {
      totalQteSource: number;
      totalDecProduction: number;
      pcs: number;
    };
    causes7M: {
      matierePremiere: { quantite: number; pourcentage: number };
      absence: { quantite: number; pourcentage: number };
      rendement: { quantite: number; pourcentage: number };
      methode: { quantite: number; pourcentage: number };
      maintenance: { quantite: number; pourcentage: number };
      qualite: { quantite: number; pourcentage: number };
      environnement: { quantite: number; pourcentage: number };
    };
    oee: null | number;
  }>;
  personnel: {
    totalOuvriers: number;
    totalPresences: number;        // Nouveau
    totalConges: number;           // Nouveau
    totalAbsences: number;         // Nouveau
    moyennePresences: number;      // ✅ MOYENNE JOURNALIÈRE
    moyenneConges: number;         // ✅ MOYENNE JOURNALIÈRE
    moyenneAbsences: number;       // ✅ MOYENNE JOURNALIÈRE
    tauxPresence: number;          // Nouveau
    joursDansPeriode: number;    
    presents: number;
    conges: number;
    absents: number;
    details: {
      matriculesPresents: number[];
      matriculesConges: number[];
      matriculesAbsents: number[];
    };
  };
  resume7M: {
    totaux: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
    pourcentages: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
  };
  detailsNonConformites?: DetailNonConformite[];
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  dateDebut: string = '';
  dateFin: string = '';
  maxDate: string = '';
  statsData: StatsPeriode | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  private chart: Chart | null = null;
  selectedM: string | null = null;
  
  // Modale de détails
  showDetailsModal: boolean = false;
  detailsModalTitle: string = '';
  detailsModalData: DetailNonConformite[] = [];
  detailsModalCause: string = '';
  detailsModalStats: any = {
    totalReferences: 0,
    totalQtyPlanifiee: 0,
    totalQtyProduite: 0,
    totalDelta: 0,
    total7M: 0,
    tauxConformite: 0,
    causesPrincipales: ''
  };
  
  mDetails: { [key: string]: any } = {
    matierePremiere: { 
      label: 'Matière Première', 
      icon: 'M1', 
      color: '#ef4444',
      description: 'Écarts liés aux matières premières',
      key: 'm1_matierePremiere'
    },
    absence: { 
      label: 'Absence', 
      icon: 'M2', 
      color: '#3b82f6',
      description: 'Écarts dus aux absences',
      key: 'm2_absence'
    },
    rendement: { 
      label: 'Rendement', 
      icon: 'M3', 
      color: '#8b5cf6',
      description: 'Écarts de rendement',
      key: 'm3_rendement'
    },
    methode: { 
      label: 'Méthode', 
      icon: 'M4', 
      color: '#06b6d4',
      description: 'Écarts dus aux méthodes de travail',
      key: 'm4_methode'
    },
    maintenance: { 
      label: 'Maintenance', 
      icon: 'M5', 
      color: '#f59e0b',
      description: 'Écarts dus à la maintenance',
      key: 'm5_maintenance'
    },
    qualite: { 
      label: 'Qualité', 
      icon: 'M6', 
      color: '#10b981',
      description: 'Écarts de qualité',
      key: 'm6_qualite'
    },
    environnement: { 
      label: 'Environnement', 
      icon: 'M7', 
      color: '#ec4899',
      description: 'Écarts environnementaux',
      key: 'm7_environnement'
    }
  };

  private apiUrl = 'http://102.207.250.53:3000/stats';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const today = new Date();
    this.maxDate = this.formatDate(today);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateDebut = this.formatDate(firstDay);
    this.dateFin = this.maxDate;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formaterNomLigne(nom: string): string {
    if (nom.includes(':')) {
      const parts = nom.split(':');
      return `${parts[0]} - ${parts[1]}`;
    }
    if (nom.includes('-')) {
      const parts = nom.split('-');
      if (parts[0].toUpperCase() === 'UNION') {
        return `Union (${parts[1]})`;
      }
      return nom.replace('-', ' - ');
    }
    return nom;
  }

  async chargerStatsPeriode(): Promise<void> {
    if (!this.dateDebut || !this.dateFin) {
      this.errorMessage = 'Veuillez sélectionner une date de début et une date de fin';
      return;
    }

    const debut = new Date(this.dateDebut);
    const fin = new Date(this.dateFin);

    if (debut > fin) {
      this.errorMessage = 'La date de début doit être avant la date de fin';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const response = await this.http.get<StatsPeriode>(
        `${this.apiUrl}/stats-periode`,
        {
          params: {
            dateDebut: this.dateDebut,
            dateFin: this.dateFin
          }
        }
      ).toPromise();

      if (response) {
        this.statsData = response;
        console.log('✅ Données reçues:', response);
        console.log('✅ Resume 7M:', response.resume7M);
        console.log('✅ Détails non-conformités:', response.detailsNonConformites);
        setTimeout(() => {
          this.creerGraphique();
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement des statistiques:', error);
      this.errorMessage = error?.error?.message || 'Erreur lors du chargement des données';
    } finally {
      this.isLoading = false;
    }
  }

  private creerGraphique(): void {
    if (!this.chartCanvas || !this.statsData) {
      console.warn('⚠️ Canvas ou données manquants');
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('❌ Impossible d\'obtenir le contexte du canvas');
      return;
    }

    const lignesAvecProduction = this.statsData.statsParLigne
      .filter(stat => stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0)
      .sort((a, b) => b.production.pcs - a.production.pcs);
    
    const labels = lignesAvecProduction.map(stat => this.formaterNomLigne(stat.ligne));
    const data = lignesAvecProduction.map(stat => stat.production.pcs);
    
    const backgroundColors = data.map(pcs => {
      if (pcs >= 90) return 'rgba(34, 197, 94, 0.8)';
      if (pcs >= 70) return 'rgba(251, 146, 60, 0.8)';
      return 'rgba(239, 68, 68, 0.8)';
    });

    const borderColors = data.map(pcs => {
      if (pcs >= 90) return 'rgba(34, 197, 94, 1)';
      if (pcs >= 70) return 'rgba(251, 146, 60, 1)';
      return 'rgba(239, 68, 68, 1)';
    });

    console.log('📊 Création du graphique avec', lignesAvecProduction.length, 'lignes');

    const canvas = this.chartCanvas.nativeElement;
    canvas.onclick = (event) => this.onBarClick(event);


    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'PCS (%)',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const ligne = lignesAvecProduction[index];
            if (ligne) {
              this.openLigneModal(ligne);
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => {
                const ligne = lignesAvecProduction[context.dataIndex];
                return [
                  `PCS: ${ligne.production.pcs.toFixed(1)}%`,
                  `Quantité source: ${ligne.production.totalQteSource.toLocaleString()}`,
                  `Déclaré: ${ligne.production.totalDecProduction.toLocaleString()}`,
                  `Références: ${ligne.nombreReferences}`
                ];
              },
              afterLabel: (context) => {
                const ligne = lignesAvecProduction[context.dataIndex];
                const m = ligne.causes7M;
                const ecarts = [];
                
                if (m.matierePremiere.pourcentage > 0) ecarts.push(`M1: ${m.matierePremiere.pourcentage.toFixed(1)}%`);
                if (m.absence.pourcentage > 0) ecarts.push(`M2: ${m.absence.pourcentage.toFixed(1)}%`);
                if (m.rendement.pourcentage > 0) ecarts.push(`M3: ${m.rendement.pourcentage.toFixed(1)}%`);
                if (m.methode.pourcentage > 0) ecarts.push(`M4: ${m.methode.pourcentage.toFixed(1)}%`);
                if (m.maintenance.pourcentage > 0) ecarts.push(`M5: ${m.maintenance.pourcentage.toFixed(1)}%`);
                if (m.qualite.pourcentage > 0) ecarts.push(`M6: ${m.qualite.pourcentage.toFixed(1)}%`);
                if (m.environnement.pourcentage > 0) ecarts.push(`M7: ${m.environnement.pourcentage.toFixed(1)}%`);
                
                return ecarts.length > 0 ? ['', '--- Écarts 7M ---', ...ecarts] : [];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%',
              font: { size: 12 }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            title: {
              display: true,
              text: 'PCS (%)',
              font: { size: 14, weight: 'bold' }
            }
          },
          x: {
            ticks: {
              font: { size: 11, weight: 'bold' },
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              display: false
            },
            title: {
              display: true,
              text: 'Lignes de Production',
              font: { size: 14, weight: 'bold' }
            }
          }
        }
      }
    });

    console.log('✅ Graphique créé avec succès');
  }

  getColorForM(mKey: string): string {
    return this.mDetails[mKey]?.color || '#999';
  }

  getPourcentageM(mKey: string): number {
    if (!this.statsData || !this.statsData.resume7M) {
      console.warn('⚠️ Pas de données 7M disponibles');
      return 0;
    }
    const pourcentage = this.statsData.resume7M.pourcentages[mKey as keyof typeof this.statsData.resume7M.pourcentages];
    return pourcentage || 0;
  }

  getValeurM(mKey: string): number {
    if (!this.statsData || !this.statsData.resume7M) {
      console.warn('⚠️ Pas de données 7M disponibles');
      return 0;
    }
    const valeur = this.statsData.resume7M.totaux[mKey as keyof typeof this.statsData.resume7M.totaux];
    return valeur || 0;
  }

  getValeurTotal(mKey: string): string {
    if (!this.statsData || !this.statsData.resume7M) return '0';
    const valeur = this.getValeurM(mKey);
    const total = this.getTotalEcarts();
    return `${valeur.toLocaleString()} / ${total.toLocaleString()}`;
  }

  getTotalEcarts(): number {
    if (!this.statsData || !this.statsData.resume7M) return 0;
    const totaux = this.statsData.resume7M.totaux;
    return Object.values(totaux).reduce((sum, val) => sum + val, 0);
  }

  /**
   * Ouvrir la modale de détails pour un M spécifique
   */
 toggleMDetails(mKey: string): void {
  if (!this.statsData || !this.statsData.detailsNonConformites) {
    console.warn('⚠️ Pas de détails de non-conformités disponibles');
    return;
  }

  const mInfo = this.mDetails[mKey];
  const columnKey = mInfo.key;

  // Filtrer et trier par date
  const detailsFiltres = this.statsData.detailsNonConformites
    .filter((detail: any) => detail[columnKey] > 0)
    .sort((a, b) => {
      // Trier par date (plus récent en premier)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  if (detailsFiltres.length === 0) {
    console.log(`Aucune non-conformité pour ${mInfo.label}`);
    return;
  }

  // Calculer les statistiques
  this.detailsModalStats = this.calculerStatistiquesModal(detailsFiltres, columnKey);
  
  // Préparer les données de la modale
  this.detailsModalTitle = `Détails des Non-Conformités - ${mInfo.label}`;
  this.detailsModalData = detailsFiltres;
  this.detailsModalCause = mInfo.label;
  this.showDetailsModal = true;

  console.log('📋 Modale ouverte pour', mInfo.label);
  console.log('📅 Première date:', detailsFiltres[0]?.date);
  console.log('📅 Dernière date:', detailsFiltres[detailsFiltres.length - 1]?.date);
}

getPeriodeDisplay(): string {
  if (!this.statsData || !this.statsData.periode) {
    return '';
  }
  
  const debut = this.statsData.periode.dateDebut;
  const fin = this.statsData.periode.dateFin;
  
  if (!debut || !fin) {
    return '';
  }
  
  try {
    const dateDebut = new Date(debut);
    const dateFin = new Date(fin);
    
    const formatDate = (date: Date): string => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    return `${formatDate(dateDebut)} - ${formatDate(dateFin)}`;
  } catch {
    return '';
  }
}

  /**
   * Calculer les statistiques pour la modale
   */
  private calculerStatistiquesModal(details: DetailNonConformite[], columnKey: string): any {
    let totalQtyPlanifiee = 0;
    let totalQtyProduite = 0;
    let totalDelta = 0;
    let total7M = 0;
    let nbReferencesAvecNonConf = 0;
    let nbReferencesTotal = 0;

    details.forEach((detail: any) => {
      totalQtyPlanifiee += detail.qtyPlanifiee || 0;
      totalQtyProduite += detail.qtyProduite || 0;
      totalDelta += Math.abs(detail.delta || 0);
      total7M += detail[columnKey] || 0;
      
      if (detail[columnKey] > 0) {
        nbReferencesAvecNonConf++;
      }
      nbReferencesTotal++;
    });

    const tauxConformite = totalQtyPlanifiee > 0 
      ? ((totalQtyProduite / totalQtyPlanifiee) * 100).toFixed(1)
      : '0.0';

    return {
      totalReferences: nbReferencesTotal,
      referencesAvecNonConf: nbReferencesAvecNonConf,
      totalQtyPlanifiee,
      totalQtyProduite,
      totalDelta,
      total7M,
      tauxConformite,
      causesPrincipales: this.detailsModalCause
    };
  }

  /**
   * Fermer la modale
   */
  closeModal(): void {
    this.showDetailsModal = false;
    this.detailsModalData = [];
    this.detailsModalTitle = '';
  }

  reinitialiser(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateDebut = this.formatDate(firstDay);
    this.dateFin = this.maxDate;
    this.statsData = null;
    this.errorMessage = '';
    this.selectedM = null;
    
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  getCircleStyle(percentage: number): any {
    const circumference = 2 * Math.PI * 60;
    const offset = circumference - (circumference * percentage) / 100;
    return {
      'stroke-dasharray': circumference,
      'stroke-dashoffset': offset
    };
  }

  getNombreJours(): number {
    if (!this.statsData) return 0;
    const debut = new Date(this.statsData.periode.dateDebut);
    const fin = new Date(this.statsData.periode.dateFin);
    const diffTime = Math.abs(fin.getTime() - debut.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }

  getStatutProduction(pcs: number): string {
    if (pcs >= 90) return 'Excellent';
    if (pcs >= 70) return 'Bon';
    if (pcs >= 50) return 'Moyen';
    return 'Faible';
  }

  getCouleurStatut(pcs: number): string {
    if (pcs >= 90) return '#10b981';
    if (pcs >= 70) return '#f59e0b';
    if (pcs >= 50) return '#ef4444';
    return '#dc2626';
  }

  /**
   * Obtenir la couleur du delta
   */
  getDeltaColor(delta: number): string {
    if (delta === 0) return '#10b981'; // Vert
    if (delta < 0) return '#ef4444'; // Rouge (perte)
    return '#f59e0b'; // Orange (écart positif rare)
  }

  showLigneModal: boolean = false;
ligneModalTitle: string = '';
ligneModalData: LigneDetail | null = null;
ligneModalReferences: any[] = [];


onBarClick(event: any): void {
  if (!this.chart || !this.statsData) return;
  
  // Récupérer l'élément cliqué
  const points = this.chart.getElementsAtEventForMode(
    event, 
    'nearest', 
    { intersect: true }, 
    true
  );

  if (!points || points.length === 0) return;

  const index = points[0].index;
  
  // Filtrer les lignes qui ont des données
  const lignesAvecProduction = this.statsData.statsParLigne
    .filter(stat => stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0)
    .sort((a, b) => b.production.pcs - a.production.pcs);

  if (index < 0 || index >= lignesAvecProduction.length) return;

  const ligne = lignesAvecProduction[index];
  this.openLigneModal(ligne);
}



/**
 * Ouvrir la modale avec les détails d'une ligne
 */
// Ajoutez cette méthode
openLigneModal(ligne: any): void {
  this.ligneModalTitle = `Détails de la ligne ${this.formaterNomLigne(ligne.ligne)}`;
  this.ligneModalData = ligne;
  
  // Récupérer les références détaillées
  if (ligne.detailsReferences && Array.isArray(ligne.detailsReferences)) {
    this.ligneModalReferences = ligne.detailsReferences;
  } else {
    this.ligneModalReferences = [];
  }
  
  this.showLigneModal = true;
}
/**
 * Fermer la modale de ligne
 */
closeLigneModal(): void {
  this.showLigneModal = false;
  this.ligneModalData = null;
  this.ligneModalReferences = [];
}

// Ajoutez ces méthodes
getPourcentageMForLigne(mKey: string): number {
  if (!this.ligneModalData) return 0;
  
  // Utiliser un switch case pour gérer chaque clé
  switch(mKey) {
    case 'matierePremiere':
      return this.ligneModalData.causes7M.matierePremiere?.pourcentage || 0;
    case 'absence':
      return this.ligneModalData.causes7M.absence?.pourcentage || 0;
    case 'rendement':
      return this.ligneModalData.causes7M.rendement?.pourcentage || 0;
    case 'methode':
      return this.ligneModalData.causes7M.methode?.pourcentage || 0;
    case 'maintenance':
      return this.ligneModalData.causes7M.maintenance?.pourcentage || 0;
    case 'qualite':
      return this.ligneModalData.causes7M.qualite?.pourcentage || 0;
    case 'environnement':
      return this.ligneModalData.causes7M.environnement?.pourcentage || 0;
    default:
      return 0;
  }
}

getQuantiteMForLigne(mKey: string): number {
  if (!this.ligneModalData) return 0;
  
  // Utiliser un switch case pour gérer chaque clé
  switch(mKey) {
    case 'matierePremiere':
      return this.ligneModalData.causes7M.matierePremiere?.quantite || 0;
    case 'absence':
      return this.ligneModalData.causes7M.absence?.quantite || 0;
    case 'rendement':
      return this.ligneModalData.causes7M.rendement?.quantite || 0;
    case 'methode':
      return this.ligneModalData.causes7M.methode?.quantite || 0;
    case 'maintenance':
      return this.ligneModalData.causes7M.maintenance?.quantite || 0;
    case 'qualite':
      return this.ligneModalData.causes7M.qualite?.quantite || 0;
    case 'environnement':
      return this.ligneModalData.causes7M.environnement?.quantite || 0;
    default:
      return 0;
  }
}

getReferencesMForLigne(mKey: string): string[] {
  if (!this.ligneModalData) return [];
  
  if (mKey === 'matierePremiere') {
    return this.ligneModalData.causes7M.matierePremiere?.references || [];
  }
  
  if (mKey === 'qualite') {
    return this.ligneModalData.causes7M.qualite?.references || [];
  }
  
  return [];
}

}