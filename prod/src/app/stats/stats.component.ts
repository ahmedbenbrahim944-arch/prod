import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ── Interfaces ────────────────────────────────────────────────────

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
  matriculesAbsence?: string;
  matriculesRendement?: string;
  phasesMaintenance?: string;
  commentaireTexte?: string;
  date: string;
  jour: string;
  ligne: string;
  nombreReferences?: number;
}

interface LigneDetail {
  ligne: string;
  nombreReferences: number;
  production: {
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
    date: string;
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
    totalPresences: number;
    totalSelections: number;
    totalConges: number;
    totalAbsences: number;
    moyennePresences: number;
    moyenneSelections: number;
    moyenneConges: number;
    moyenneAbsences: number;
    moyenneAutres: number;
    tauxPresence: number;
    joursDansPeriode: number;
    presents: number;
    selections: number;
    conges: number;
    absents: number;
    autresStatuts: number;
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

// Interface ouvrier — même structure que statistiques1 (OuvrierSaisie)
interface OuvrierPersonnel {
  matricule: string | number;
  nomPrenom: string;
  ligne?: string;
  statut?: 'AB' | 'C' | 'S' | 'P' | null;
  libelleStatut?: string;
  commentaire?: string | null;
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

  // ── Modale 7M ─────────────────────────────────────────────────
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

  // ── Modale ligne ───────────────────────────────────────────────
  showLigneModal: boolean = false;
  ligneModalTitle: string = '';
  ligneModalData: LigneDetail | null = null;
  ligneModalReferences: any[] = [];
  expandedCause7M: string | null = null;

  // ── Filtre par ligne ───────────────────────────────────────────
  selectedLignes: string[] = [];
  ligneSearchFilter: string = '';

  // ── Modale Personnel ──────────────────────────────────────────
  // Même logique que statistiques1.component.ts :
  // endpoint GET http://102.207.250.53:3000/statut/par-date?date=YYYY-MM-DD
  // response.statistiques.ouvriers[] → filtre par o.statut === code
  showPersonnelModal: boolean = false;
  personnelModalTitle: string = '';
  personnelModalStatut: string = '';
  personnelModalList: OuvrierPersonnel[] = [];
  isLoadingPersonnel: boolean = false;

  readonly statutOptions = [
    { code: 'P',  libelle: 'Présent',   couleur: '#10b981', icon: '✅' },
    { code: 'AB', libelle: 'Absent',    couleur: '#ef4444', icon: '🚫' },
    { code: 'C',  libelle: 'Congé',     couleur: '#f59e0b', icon: '🏖️' },
    { code: 'S',  libelle: 'Sélection', couleur: '#3b82f6', icon: '✔️'  }
  ];

  // ── Config 7M ─────────────────────────────────────────────────
  mDetails: { [key: string]: any } = {
    matierePremiere: {
      label: 'M1:Matière Première',
      icon: 'M1',
      color: '#ef4444',
      description: 'Écarts liés aux matières premières',
      key: 'm1_matierePremiere'
    },
    absence: {
      label: 'M2:Absence',
      icon: 'M2',
      color: '#3b82f6',
      description: 'Écarts dus aux absences',
      key: 'm2_absence'
    },
    rendement: {
      label: 'M2:Rendement',
      icon: 'M3',
      color: '#8b5cf6',
      description: 'Écarts de rendement',
      key: 'm3_rendement'
    },
    methode: {
      label: 'M3:Méthode',
      icon: 'M4',
      color: '#06b6d4',
      description: 'Écarts dus aux méthodes de travail',
      key: 'm4_methode'
    },
    maintenance: {
      label: 'M4:Maintenance',
      icon: 'M5',
      color: '#f59e0b',
      description: 'Écarts dus à la maintenance',
      key: 'm5_maintenance'
    },
    qualite: {
      label: 'M5:Qualité',
      icon: 'M6',
      color: '#10b981',
      description: 'Écarts de qualité',
      key: 'm6_qualite'
    },
    environnement: {
      label: 'M6:Environnement',
      icon: 'M6',
      color: '#ec4899',
      description: 'Écarts environnementaux',
      key: 'm7_environnement'
    }
  };

  private apiUrl = 'http://102.207.250.53:3000/stats';
  // URL statut personnel — même que statistiques1
  private statutApiUrl = 'http://102.207.250.53:3000/statut/par-date';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const today = new Date();
    this.maxDate = this.formatDate(today);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateDebut = this.formatDate(firstDay);
    this.dateFin = this.maxDate;
  }

  // ── Utilitaires ───────────────────────────────────────────────

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

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
    });
  }

  // ── Chargement stats période ──────────────────────────────────

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
        setTimeout(() => {
          this.creerGraphique();
        }, 100);
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Erreur lors du chargement des données';
    } finally {
      this.isLoading = false;
    }
  }

  // ── Graphique ─────────────────────────────────────────────────

  private creerGraphique(): void {
    if (!this.chartCanvas || !this.statsData) return;
    if (this.chart) this.chart.destroy();

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const lignesAvecProduction = this.statsData.statsParLigne
      .filter(stat => {
        const hasData = stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0;
        const isSelected = this.selectedLignes.length === 0 || this.selectedLignes.includes(stat.ligne);
        return hasData && isSelected;
      })
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
            if (ligne) this.openLigneModal(ligne);
          }
        },
        plugins: {
          legend: { display: false },
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
                const ecarts: string[] = [];
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
            ticks: { callback: (value) => value + '%', font: { size: 12 } },
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            title: { display: true, text: 'PCS (%)', font: { size: 14, weight: 'bold' } }
          },
          x: {
            ticks: { font: { size: 11, weight: 'bold' }, maxRotation: 45, minRotation: 45 },
            grid: { display: false },
            title: { display: true, text: 'Lignes de Production', font: { size: 14, weight: 'bold' } }
          }
        }
      }
    });
  }

  // ── 7M ────────────────────────────────────────────────────────

  getColorForM(mKey: string): string {
    return this.mDetails[mKey]?.color || '#999';
  }

  getPourcentageM(mKey: string): number {
    if (!this.statsData?.resume7M) return 0;
    return this.statsData.resume7M.pourcentages[mKey as keyof typeof this.statsData.resume7M.pourcentages] || 0;
  }

  getValeurM(mKey: string): number {
    if (!this.statsData?.resume7M) return 0;
    return this.statsData.resume7M.totaux[mKey as keyof typeof this.statsData.resume7M.totaux] || 0;
  }

  getValeurTotal(mKey: string): string {
    if (!this.statsData?.resume7M) return '0';
    const valeur = this.getValeurM(mKey);
    const total = this.getTotalEcarts();
    return `${valeur.toLocaleString()} / ${total.toLocaleString()}`;
  }

  getTotalEcarts(): number {
    if (!this.statsData?.resume7M) return 0;
    return Object.values(this.statsData.resume7M.totaux).reduce((sum, val) => sum + val, 0);
  }

  toggleMDetails(mKey: string): void {
    if (!this.statsData?.detailsNonConformites) return;

    const mInfo = this.mDetails[mKey];
    const columnKey = mInfo.key;

    const detailsFiltres = this.statsData.detailsNonConformites
      .filter((detail: any) => detail[columnKey] > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (detailsFiltres.length === 0) return;

    this.detailsModalStats = this.calculerStatistiquesModal(detailsFiltres, columnKey);
    this.detailsModalTitle = `Détails des Non-Conformités - ${mInfo.label}`;
    this.detailsModalData = detailsFiltres;
    this.detailsModalCause = mInfo.label;
    this.showDetailsModal = true;
  }

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
      if (detail[columnKey] > 0) nbReferencesAvecNonConf++;
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

  closeModal(): void {
    this.showDetailsModal = false;
    this.detailsModalData = [];
    this.detailsModalTitle = '';
  }

  // ── Réinitialisation ──────────────────────────────────────────

  reinitialiser(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateDebut = this.formatDate(firstDay);
    this.dateFin = this.maxDate;
    this.statsData = null;
    this.errorMessage = '';
    this.selectedM = null;
    this.selectedLignes = [];
    this.ligneSearchFilter = '';
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  // ── Utilitaires affichage ─────────────────────────────────────

  getCircleStyle(percentage: number): any {
    const circumference = 2 * Math.PI * 60;
    const offset = circumference - (circumference * percentage) / 100;
    return { 'stroke-dasharray': circumference, 'stroke-dashoffset': offset };
  }

  getNombreJours(): number {
    if (!this.statsData) return 0;
    const debut = new Date(this.statsData.periode.dateDebut);
    const fin = new Date(this.statsData.periode.dateFin);
    return Math.ceil(Math.abs(fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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

  getDeltaColor(delta: number): string {
    if (delta === 0) return '#10b981';
    if (delta < 0) return '#ef4444';
    return '#f59e0b';
  }

  getPeriodeDisplay(): string {
    if (!this.statsData?.periode) return '';
    try {
      const formatDate = (d: Date) =>
        `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      return `${formatDate(new Date(this.statsData.periode.dateDebut))} - ${formatDate(new Date(this.statsData.periode.dateFin))}`;
    } catch { return ''; }
  }

  // ── Filtre par ligne ──────────────────────────────────────────

  get lignesDisponibles(): string[] {
    if (!this.statsData) return [];
    return this.statsData.statsParLigne
      .filter(s => s.production.totalQteSource > 0 || s.production.totalDecProduction > 0)
      .sort((a, b) => b.production.pcs - a.production.pcs)
      .map(s => s.ligne);
  }

  get lignesFiltrees(): string[] {
    const search = this.ligneSearchFilter.toLowerCase().trim();
    if (!search) return this.lignesDisponibles;
    return this.lignesDisponibles.filter(l =>
      this.formaterNomLigne(l).toLowerCase().includes(search)
    );
  }

  isLigneSelected(ligne: string): boolean {
    return this.selectedLignes.includes(ligne);
  }

  toggleLigneSelection(ligne: string): void {
    const idx = this.selectedLignes.indexOf(ligne);
    if (idx > -1) this.selectedLignes.splice(idx, 1);
    else this.selectedLignes.push(ligne);
    setTimeout(() => this.creerGraphique(), 0);
  }

  clearLigneFilter(): void {
    this.selectedLignes = [];
    this.ligneSearchFilter = '';
    setTimeout(() => this.creerGraphique(), 0);
  }

  selectAllLignes(): void {
    this.selectedLignes = [...this.lignesDisponibles];
    setTimeout(() => this.creerGraphique(), 0);
  }

  getLignePcs(ligne: string): number {
    return this.statsData?.statsParLigne.find(s => s.ligne === ligne)?.production.pcs ?? 0;
  }

  get isFilterActive(): boolean { return this.selectedLignes.length > 0; }

  private get statsParLigneActives() {
    if (!this.statsData) return [];
    const all = this.statsData.statsParLigne;
    return this.isFilterActive ? all.filter(s => this.selectedLignes.includes(s.ligne)) : all;
  }

  get productionFiltree() {
    if (!this.statsData) return null;
    if (!this.isFilterActive) return this.statsData.productionGlobale;
    const lignes = this.statsParLigneActives;
    if (!lignes.length) return this.statsData.productionGlobale;
    const totalQteSource = lignes.reduce((s, l) => s + l.production.totalQteSource, 0);
    const totalDecProduction = lignes.reduce((s, l) => s + l.production.totalDecProduction, 0);
    const pcsTotal = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;
    return { totalQteSource, totalDecProduction, pcsTotal, oee: null };
  }

  private get resume7MFiltre() {
    if (!this.statsData) return null;
    if (!this.isFilterActive) return this.statsData.resume7M;
    const lignes = this.statsParLigneActives;
    if (!lignes.length) return this.statsData.resume7M;
    const keys = ['matierePremiere','absence','rendement','methode','maintenance','qualite','environnement'] as const;
    const totaux: any = {};
    keys.forEach(k => { totaux[k] = lignes.reduce((s, l) => s + (l.causes7M[k]?.quantite ?? 0), 0); });
    const totalQteSource = lignes.reduce((s, l) => s + l.production.totalQteSource, 0);
    const pourcentages: any = {};
    keys.forEach(k => { pourcentages[k] = totalQteSource > 0 ? (totaux[k] / totalQteSource) * 100 : 0; });
    return { totaux, pourcentages, _qteSource: totalQteSource };
  }

  getPourcentageMFiltre(mKey: string): number {
    return (this.resume7MFiltre?.pourcentages as any)?.[mKey] ?? 0;
  }

  getValeurMFiltre(mKey: string): number {
    return (this.resume7MFiltre?.totaux as any)?.[mKey] ?? 0;
  }

  getValeurTotalFiltre(mKey: string): string {
    if (!this.statsData) return '0 / 0';
    const valeur = this.getValeurMFiltre(mKey);
    const qteSource = this.isFilterActive
      ? this.statsParLigneActives.reduce((s, l) => s + l.production.totalQteSource, 0)
      : this.statsData.productionGlobale.totalQteSource;
    return `${valeur.toLocaleString()} / ${qteSource.toLocaleString()}`;
  }

  // ── Modale ligne ──────────────────────────────────────────────

  onBarClick(event: any): void {
    if (!this.chart || !this.statsData) return;
    const points = this.chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (!points || points.length === 0) return;
    const lignesAvecProduction = this.statsData.statsParLigne
      .filter(stat => stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0)
      .sort((a, b) => b.production.pcs - a.production.pcs);
    const ligne = lignesAvecProduction[points[0].index];
    if (ligne) this.openLigneModal(ligne);
  }

  openLigneModal(ligne: any): void {
    this.ligneModalTitle = `Détails de la ligne ${this.formaterNomLigne(ligne.ligne)}`;
    this.ligneModalData = ligne;

    if (this.statsData?.detailsNonConformites && Array.isArray(this.statsData.detailsNonConformites)) {
      this.ligneModalReferences = this.statsData.detailsNonConformites
        .filter(detail => detail.ligne === ligne.ligne)
        .map(detail => ({
          date: detail.date,
          reference: detail.reference,
          of: detail.of,
          qtePlanifiee: detail.qtyPlanifiee,
          qteModifiee: detail.qtyProduite,
          decProduction: detail.qtyProduite,
          pcsProd: detail.qtyPlanifiee > 0 ? (detail.qtyProduite / detail.qtyPlanifiee) * 100 : 0,
          refMP: detail.refMP,
          refQualite: detail.refQualite,
          matriculesAbsence: detail.matriculesAbsence,
          matriculesRendement: detail.matriculesRendement,
          phasesMaintenance: detail.phasesMaintenance,
          commentaireTexte: detail.commentaireTexte,
          causes7M: {
            matierePremiere: detail.m1_matierePremiere || 0,
            absence: detail.m2_absence || 0,
            rendement: detail.m3_rendement || 0,
            methode: detail.m4_methode || 0,
            maintenance: detail.m5_maintenance || 0,
            qualite: detail.m6_qualite || 0,
            environnement: detail.m7_environnement || 0,
            total: detail.total7M || 0
          }
        }));
    } else if (ligne.detailsReferences && Array.isArray(ligne.detailsReferences)) {
      this.ligneModalReferences = ligne.detailsReferences;
    } else {
      this.ligneModalReferences = [];
    }
    this.showLigneModal = true;
  }

  closeLigneModal(): void {
    this.showLigneModal = false;
    this.ligneModalData = null;
    this.ligneModalReferences = [];
  }

  getPourcentageMForLigne(mKey: string): number {
    if (!this.ligneModalData) return 0;
    return (this.ligneModalData.causes7M as any)[mKey]?.pourcentage || 0;
  }

  getQuantiteMForLigne(mKey: string): number {
    if (!this.ligneModalData) return 0;
    return (this.ligneModalData.causes7M as any)[mKey]?.quantite || 0;
  }

  getReferencesMForLigne(mKey: string): string[] {
    if (!this.ligneModalData) return [];
    if (mKey === 'matierePremiere') return this.ligneModalData.causes7M.matierePremiere?.references || [];
    if (mKey === 'qualite') return this.ligneModalData.causes7M.qualite?.references || [];
    return [];
  }

  toggleCause7M(mKey: string): void {
    this.expandedCause7M = this.expandedCause7M === mKey ? null : mKey;
  }

  isCause7MExpanded(mKey: string): boolean {
    return this.expandedCause7M === mKey;
  }

  getReferencesForCause7M(mKey: string): any[] {
    if (!this.ligneModalReferences?.length) return [];
    return this.ligneModalReferences.filter(ref => {
      const causeValue = ref.causes7M?.[mKey];
      return causeValue && causeValue > 0;
    });
  }

  hasCause7MReferences(mKey: string): boolean {
    return this.getReferencesForCause7M(mKey).length > 0;
  }

  getRefMPForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.refMP || '-';
    }
    return ref.refMP || '-';
  }

  getRefQualiteForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.refQualite || '-';
    }
    return ref.refQualite || '-';
  }

  getPhaseMaintenanceForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.phasesMaintenance || '-';
    }
    return ref.phasesMaintenance || '-';
  }

  getMatriculesAbsenceForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.matriculesAbsence || '-';
    }
    return ref.matriculesAbsence || '-';
  }

  getMatriculesRendementForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.matriculesRendement || '-';
    }
    return ref.matriculesRendement || '-';
  }

  getCommentaireQualiteForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(
        d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date
      );
      return orig?.commentaireTexte || '-';
    }
    return ref.commentaireTexte || '-';
  }

  // ── Modale Personnel ──────────────────────────────────────────
  // Copié exactement de statistiques1.component.ts :
  // getStatutsByDate → response.statistiques.repartitionStatuts + response.statistiques.ouvriers

  openPersonnelModal(statutCode: string): void {
    const labelMap: Record<string, string> = {
      'P':  '✅ Présents',
      'AB': '🚫 Absents',
      'C':  '🏖️ En Congé',
      'S':  '✔️ Sélections'
    };

    this.personnelModalStatut = statutCode;
    this.personnelModalTitle  = `Personnel — ${labelMap[statutCode] || statutCode}`;
    this.personnelModalList   = [];
    this.showPersonnelModal   = true;
    this.isLoadingPersonnel   = true;

    // Même endpoint que statistiques1 : GET /statut/par-date?date=YYYY-MM-DD
    // On utilise la dateFin de la période sélectionnée comme référence
    this.http.get<any>(this.statutApiUrl, {
      params: { date: this.dateFin },
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data: any) => {
        // Structure identique à statistiques1 :
        // data.statistiques.repartitionStatuts → compteurs { P, AB, C, S }
        // data.statistiques.ouvriers           → liste complète des ouvriers
        const tousOuvriers: OuvrierPersonnel[] =
          data?.statistiques?.ouvriers ||
          data?.ouvriers               ||
          [];

        // Filtrer par le statut cliqué — même logique que statistiques1
        this.personnelModalList = tousOuvriers.filter(
          (o: OuvrierPersonnel) => o.statut === statutCode
        );
        this.isLoadingPersonnel = false;
      },
      error: (err: any) => {
        console.error('Erreur chargement personnel:', err);
        this.isLoadingPersonnel = false;
      }
    });
  }

  closePersonnelModal(): void {
    this.showPersonnelModal   = false;
    this.personnelModalList   = [];
    this.personnelModalStatut = '';
  }

  getPersonnelModalColor(statutCode: string): string {
    return this.statutOptions.find(s => s.code === statutCode)?.couleur || '#6b7280';
  }

  getPersonnelModalIcon(statutCode: string): string {
    return this.statutOptions.find(s => s.code === statutCode)?.icon || '';
  }

  getLibelleStatutPersonnel(code: string | null | undefined): string {
    if (!code) return 'Non défini';
    return this.statutOptions.find(s => s.code === code)?.libelle || 'Non défini';
  }
}