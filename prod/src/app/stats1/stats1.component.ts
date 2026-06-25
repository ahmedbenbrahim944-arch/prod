import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  date: string;
  jour: string;
  ligne: string;
  nombreReferences?: number;
}

interface StatsSelection {
  message: string;
  periode: {
    dateDebut: string;
    dateFin: string;
    dateCalcul: string;
  };
  global: {
    totalPersonnesDistinctes: number;
    totalAffectations: number;
    nombreJoursAvecActivite: number;
    moyennePersonnesParJour: number;
    listeOuvriersDistincts: Array<{ matricule: number; nomPrenom: string }>;
  };
  detailParJour: Array<{
    date: string;
    nombrePersonnes: number;
    ouvriers: Array<{ matricule: number; nomPrenom: string }>;
  }>;
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

// ── Composant ─────────────────────────────────────────────────────

@Component({
  selector: 'app-stats1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats1.component.html',
  styleUrls: ['./stats1.component.css']
})
export class Stats1Component implements OnInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  // ── Propriétés générales ──────────────────────────────────────
  dateDebut: string = '';
  dateFin: string = '';
  maxDate: string = '';
  statsData: StatsPeriode | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  private chart: Chart | null = null;
  selectedM: string | null = null;
  private autoReloadTimer: any;
  private derniereDateChargee: string = '';

  // ── Personnel ─────────────────────────────────────────────────
  private personnelParDate: any[] = [];
  personnelComptesReels = {
    total: 0, presents: 0, absents: 0, conges: 0, selections: 0
  };

  // ── Sélection ─────────────────────────────────────────────────
  statsSelection: StatsSelection | null = null;
  isLoadingSelection: boolean = false;
  showSelectionDetail: boolean = false;

  // ── Modales ───────────────────────────────────────────────────
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

  showLigneModal: boolean = false;
  ligneModalTitle: string = '';
  ligneModalData: LigneDetail | null = null;
  ligneModalReferences: any[] = [];
  expandedCause7M: string | null = null;

  // ── Config 7M ─────────────────────────────────────────────────
  mDetails: { [key: string]: any } = {
    matierePremiere: { label: 'M1:Matière Première', icon: 'M1', color: '#ef4444', description: 'Écarts liés aux matières premières', key: 'm1_matierePremiere' },
    absence:         { label: 'M2:Absence',          icon: 'M2', color: '#3b82f6', description: 'Écarts dus aux absences',           key: 'm2_absence'         },
    rendement:       { label: 'M2:Rendement',         icon: 'M3', color: '#8b5cf6', description: 'Écarts de rendement',               key: 'm3_rendement'       },
    methode:         { label: 'M3:Méthode',           icon: 'M4', color: '#06b6d4', description: 'Écarts dus aux méthodes de travail', key: 'm4_methode'         },
    maintenance:     { label: 'M4:Maintenance',       icon: 'M5', color: '#f59e0b', description: 'Écarts dus à la maintenance',        key: 'm5_maintenance'     },
    qualite:         { label: 'M5:Qualité',           icon: 'M6', color: '#10b981', description: 'Écarts de qualité',                 key: 'm6_qualite'         },
    environnement:   { label: 'M6:Environnement',     icon: 'M6', color: '#ec4899', description: 'Écarts environnementaux',           key: 'm7_environnement'   }
  };

  private apiUrl = 'http://102.207.250.53:3000/stats';

  constructor(private http: HttpClient) {}

  // ── Cycle de vie ──────────────────────────────────────────────

  ngOnInit(): void {
    this.initialiserDatesHier();
    this.chargerStatsPeriode();
    this.programmerRechargementHoraire();
  }

  ngOnDestroy(): void {
    if (this.autoReloadTimer) {
      clearInterval(this.autoReloadTimer);
    }
  }

  // ── Helpers token ─────────────────────────────────────────────

  private getToken(): string {
    return localStorage.getItem('access_token') || '';
  }

  private getAuthHeaders(): { [key: string]: string } {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // ── Helpers date ──────────────────────────────────────────────

  private formatDate(date: Date): string {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getNomJourSemaine(date: Date): string {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return jours[date.getDay()];
  }

  private initialiserDatesHier(): void {
    const today = new Date();
    let hier = new Date(today);
    hier.setDate(today.getDate() - 1);

    while (hier.getDay() === 0 || hier.getDay() === 6) {
      hier.setDate(hier.getDate() - 1);
    }

    this.dateDebut = this.formatDate(hier);
    this.dateFin   = this.formatDate(hier);
    this.maxDate   = this.formatDate(today);
  }

  // ── Rechargement automatique ──────────────────────────────────

  private programmerRechargementHoraire(): void {
    const maintenant = new Date();
    const prochainRechargement = new Date();
    prochainRechargement.setHours(maintenant.getHours() + 1, 0, 0, 0);
    const tempsAttente = prochainRechargement.getTime() - maintenant.getTime();

    setTimeout(() => {
      this.executerRechargementHoraire();
      setInterval(() => { this.executerRechargementHoraire(); }, 60 * 60 * 1000);
    }, tempsAttente);
  }

  private executerRechargementHoraire(): void {
    const maintenant = new Date();
    if (maintenant.getDay() === 0) return;
    this.statsData = null;
    this.initialiserDatesHier();
    setTimeout(() => { this.chargerStatsPeriode(); }, 100);
  }

  // ── Chargement principal ──────────────────────────────────────

  async chargerStatsPeriode(): Promise<void> {
    if (!this.dateDebut || !this.dateFin) {
      this.errorMessage = 'Veuillez sélectionner une date de début et une date de fin';
      return;
    }

    if (new Date(this.dateDebut) > new Date(this.dateFin)) {
      this.errorMessage = 'La date de début doit être avant la date de fin';
      return;
    }

    this.isLoading    = true;
    this.errorMessage = '';

    try {
      const response = await this.http.get<StatsPeriode>(
        `${this.apiUrl}/stats-periode`,
        {
          params:  { dateDebut: this.dateDebut, dateFin: this.dateFin },
          headers: this.getAuthHeaders()
        }
      ).toPromise();

      if (response) {
        this.statsData = response;

        // Lancer les deux appels en parallèle
        await Promise.all([
          this.chargerPersonnelParDate(),
          this.chargerStatsSelection()
        ]);

        setTimeout(() => { this.creerGraphique(); }, 100);
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Erreur lors du chargement des données';
    } finally {
      this.isLoading = false;
    }
  }

  // ── Chargement personnel ──────────────────────────────────────

  private async chargerPersonnelParDate(): Promise<void> {
    if (!this.dateDebut || !this.dateFin) return;

    try {
      const dataFin: any = await this.http.get<any>(
        'http://102.207.250.53:3000/statut/par-date',
        { params: { date: this.dateFin }, headers: this.getAuthHeaders() }
      ).toPromise();

      const ouvriersFin: any[] = dataFin?.statistiques?.ouvriers || dataFin?.ouvriers || [];
      const propresFin = ouvriersFin
        .map((o: any) => ({ ...o, statut: (o.statut ?? '').toString().trim(), matricule: o.matricule?.toString().trim() }))
        .filter(o => !o.matricule?.toUpperCase().startsWith('S '));

      const dates: string[] = [];
      const current = new Date(this.dateDebut);
      const fin     = new Date(this.dateFin);
      while (current <= fin) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      let totalPresents = 0, totalAbsents = 0, totalConges = 0, totalSelections = 0;

      for (const date of dates) {
        try {
          const data: any = await this.http.get<any>(
            'http://102.207.250.53:3000/statut/par-date',
            { params: { date }, headers: this.getAuthHeaders() }
          ).toPromise();

          const ouvriers: any[] = data?.statistiques?.ouvriers || data?.ouvriers || [];
          if (ouvriers.length === 0) continue;

          const propres = ouvriers
            .map((o: any) => ({ ...o, statut: (o.statut ?? '').toString().trim(), matricule: o.matricule?.toString().trim() }))
            .filter(o => !o.matricule?.toUpperCase().startsWith('S '));

          totalPresents   += propres.filter(o => o.statut === 'P').length;
          totalAbsents    += propres.filter(o => o.statut === 'AB').length;
          totalConges     += propres.filter(o => o.statut === 'C').length;
          totalSelections += propres.filter(o => o.statut === 'S').length;
        } catch {
          continue;
        }
      }

      this.personnelComptesReels = {
        total:      totalPresents + totalAbsents + totalConges + totalSelections,
        presents:   totalPresents,
        absents:    totalAbsents,
        conges:     totalConges,
        selections: totalSelections
      };
    } catch {
      // silencieux
    }
  }

  // ── Chargement sélection ──────────────────────────────────────

  async chargerStatsSelection(): Promise<void> {
    if (!this.dateDebut || !this.dateFin) return;

    this.isLoadingSelection  = true;
    this.statsSelection      = null;
    this.showSelectionDetail = false;

    try {
      const response = await this.http
        .get<StatsSelection>(
          `${this.apiUrl}/personnes-selection`,
          {
            params:  { dateDebut: this.dateDebut, dateFin: this.dateFin },
            headers: this.getAuthHeaders()
          }
        )
        .toPromise();

      this.statsSelection = response ?? null;
    } catch {
      this.statsSelection = null;
    } finally {
      this.isLoadingSelection = false;
    }
  }

  toggleSelectionDetail(): void {
    this.showSelectionDetail = !this.showSelectionDetail;
  }

  // ── Réinitialisation ──────────────────────────────────────────

  reinitialiser(): void {
    this.initialiserDatesHier();
    this.statsData           = null;
    this.errorMessage        = '';
    this.selectedM           = null;
    this.statsSelection      = null;
    this.showSelectionDetail = false;
    this.isLoadingSelection  = false;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.chargerStatsPeriode();
  }

  // ── Graphique ─────────────────────────────────────────────────

  private creerGraphique(): void {
    if (!this.chartCanvas || !this.statsData) return;
    if (this.chart) { this.chart.destroy(); }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const lignesAvecProduction = this.statsData.statsParLigne
      .filter(stat => stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0)
      .sort((a, b) => b.production.pcs - a.production.pcs);

    const labels           = lignesAvecProduction.map(stat => this.formaterNomLigne(stat.ligne));
    const data             = lignesAvecProduction.map(stat => stat.production.pcs);
    const backgroundColors = data.map(pcs => pcs >= 90 ? 'rgba(34,197,94,0.8)'  : pcs >= 70 ? 'rgba(251,146,60,0.8)'  : 'rgba(239,68,68,0.8)');
    const borderColors     = data.map(pcs => pcs >= 90 ? 'rgba(34,197,94,1)'    : pcs >= 70 ? 'rgba(251,146,60,1)'    : 'rgba(239,68,68,1)');

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'PCS (%)',
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const ligne = lignesAvecProduction[elements[0].index];
            if (ligne) { this.openLigneModal(ligne); }
          }
        },
        layout: { padding: { left: 10, right: 30, top: 20, bottom: 20 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => {
                const l = lignesAvecProduction[context.dataIndex];
                return [`PCS: ${l.production.pcs.toFixed(1)}%`, `Quantité source: ${l.production.totalQteSource.toLocaleString()}`, `Déclaré: ${l.production.totalDecProduction.toLocaleString()}`, `Références: ${l.nombreReferences}`];
              },
              afterLabel: (context) => {
                const m = lignesAvecProduction[context.dataIndex].causes7M;
                const ecarts: string[] = [];
                if (m.matierePremiere.pourcentage > 0) ecarts.push(`M1: ${m.matierePremiere.pourcentage.toFixed(1)}%`);
                if (m.absence.pourcentage > 0)         ecarts.push(`M2: ${m.absence.pourcentage.toFixed(1)}%`);
                if (m.rendement.pourcentage > 0)       ecarts.push(`M3: ${m.rendement.pourcentage.toFixed(1)}%`);
                if (m.methode.pourcentage > 0)         ecarts.push(`M4: ${m.methode.pourcentage.toFixed(1)}%`);
                if (m.maintenance.pourcentage > 0)     ecarts.push(`M5: ${m.maintenance.pourcentage.toFixed(1)}%`);
                if (m.qualite.pourcentage > 0)         ecarts.push(`M6: ${m.qualite.pourcentage.toFixed(1)}%`);
                if (m.environnement.pourcentage > 0)   ecarts.push(`M7: ${m.environnement.pourcentage.toFixed(1)}%`);
                return ecarts.length > 0 ? ['', '--- Écarts 7M ---', ...ecarts] : [];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true, max: 100,
            grid: { color: 'rgba(0,0,0,0.05)' },
            title: { display: true, text: 'PCS (%)', font: { size: 14, weight: 'bold' } },
            ticks: { callback: (value) => value + '%', font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: 500 }, autoSkip: false, maxRotation: 0, minRotation: 0 }
          }
        }
      }
    });
  }

  // ── Helpers affichage ─────────────────────────────────────────

  formaterNomLigne(nom: string): string {
    if (nom.includes(':')) { const p = nom.split(':'); return `${p[0]} - ${p[1]}`; }
    if (nom.includes('-')) { const p = nom.split('-'); if (p[0].toUpperCase() === 'UNION') return `Union (${p[1]})`; return nom.replace('-', ' - '); }
    return nom;
  }

  getColorForM(mKey: string): string { return this.mDetails[mKey]?.color || '#999'; }

  getPourcentageM(mKey: string): number {
    if (!this.statsData?.resume7M) return 0;
    return this.statsData.resume7M.pourcentages[mKey as keyof typeof this.statsData.resume7M.pourcentages] || 0;
  }

  getValeurM(mKey: string): number {
    if (!this.statsData?.resume7M) return 0;
    return this.statsData.resume7M.totaux[mKey as keyof typeof this.statsData.resume7M.totaux] || 0;
  }

  getTotalEcarts(): number {
    if (!this.statsData?.resume7M) return 0;
    return Object.values(this.statsData.resume7M.totaux).reduce((sum, val) => sum + val, 0);
  }

  getValeurTotal(mKey: string): string {
    if (!this.statsData?.resume7M) return '0';
    return `${this.getValeurM(mKey).toLocaleString()} / ${this.getTotalEcarts().toLocaleString()}`;
  }

  getCircleStyle(percentage: number): any {
    const circumference = 2 * Math.PI * 60;
    return { 'stroke-dasharray': circumference, 'stroke-dashoffset': circumference - (circumference * percentage) / 100 };
  }

  getNombreJours(): number {
    if (!this.statsData) return 0;
    const diffTime = Math.abs(new Date(this.statsData.periode.dateFin).getTime() - new Date(this.statsData.periode.dateDebut).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
    if (delta < 0)  return '#ef4444';
    return '#f59e0b';
  }

  getPeriodeDisplay(): string {
    if (!this.statsData?.periode) return '';
    try {
      const fmt = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      return `${fmt(new Date(this.statsData.periode.dateDebut))} - ${fmt(new Date(this.statsData.periode.dateFin))}`;
    } catch { return ''; }
  }

  // ── Modale 7M ─────────────────────────────────────────────────

  toggleMDetails(mKey: string): void {
    if (!this.statsData?.detailsNonConformites) return;
    const mInfo      = this.mDetails[mKey];
    const columnKey  = mInfo.key;
    const detailsFiltres = this.statsData.detailsNonConformites
      .filter((d: any) => d[columnKey] > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (detailsFiltres.length === 0) return;
    this.detailsModalStats    = this.calculerStatistiquesModal(detailsFiltres, columnKey);
    this.detailsModalTitle    = `Détails des Non-Conformités - ${mInfo.label}`;
    this.detailsModalData     = detailsFiltres;
    this.detailsModalCause    = mInfo.label;
    this.showDetailsModal     = true;
  }

  private calculerStatistiquesModal(details: DetailNonConformite[], columnKey: string): any {
    let totalQtyPlanifiee = 0, totalQtyProduite = 0, totalDelta = 0, total7M = 0;
    let nbReferencesAvecNonConf = 0;
    details.forEach((detail: any) => {
      totalQtyPlanifiee += detail.qtyPlanifiee || 0;
      totalQtyProduite  += detail.qtyProduite  || 0;
      totalDelta        += Math.abs(detail.delta || 0);
      total7M           += detail[columnKey]   || 0;
      if (detail[columnKey] > 0) nbReferencesAvecNonConf++;
    });
    return {
      totalReferences: details.length,
      referencesAvecNonConf: nbReferencesAvecNonConf,
      totalQtyPlanifiee, totalQtyProduite, totalDelta, total7M,
      tauxConformite: totalQtyPlanifiee > 0 ? ((totalQtyProduite / totalQtyPlanifiee) * 100).toFixed(1) : '0.0',
      causesPrincipales: this.detailsModalCause
    };
  }

  closeModal(): void { this.showDetailsModal = false; this.detailsModalData = []; this.detailsModalTitle = ''; }

  // ── Modale ligne ──────────────────────────────────────────────

  openLigneModal(ligne: any): void {
    this.ligneModalTitle = `Détails de la ligne ${this.formaterNomLigne(ligne.ligne)}`;
    this.ligneModalData  = ligne;
    if (this.statsData?.detailsNonConformites && Array.isArray(this.statsData.detailsNonConformites)) {
      this.ligneModalReferences = this.statsData.detailsNonConformites
        .filter(detail => detail.ligne === ligne.ligne)
        .map(detail => ({
          date: detail.date, reference: detail.reference, of: detail.of,
          qtePlanifiee: detail.qtyPlanifiee, qteModifiee: detail.qtyProduite,
          decProduction: detail.qtyProduite,
          pcsProd: detail.qtyPlanifiee > 0 ? (detail.qtyProduite / detail.qtyPlanifiee) * 100 : 0,
          causes7M: { matierePremiere: detail.m1_matierePremiere || 0, absence: detail.m2_absence || 0, rendement: detail.m3_rendement || 0, methode: detail.m4_methode || 0, maintenance: detail.m5_maintenance || 0, qualite: detail.m6_qualite || 0, environnement: detail.m7_environnement || 0, total: detail.total7M || 0 }
        }));
    } else if (ligne.detailsReferences && Array.isArray(ligne.detailsReferences)) {
      this.ligneModalReferences = ligne.detailsReferences;
    } else {
      this.ligneModalReferences = [];
    }
    this.showLigneModal = true;
  }

  closeLigneModal(): void { this.showLigneModal = false; this.ligneModalData = null; this.ligneModalReferences = []; }

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
    if (mKey === 'qualite')        return this.ligneModalData.causes7M.qualite?.references          || [];
    return [];
  }

  toggleCause7M(mKey: string): void { this.expandedCause7M = this.expandedCause7M === mKey ? null : mKey; }
  isCause7MExpanded(mKey: string): boolean { return this.expandedCause7M === mKey; }

  getReferencesForCause7M(mKey: string): any[] {
    if (!this.ligneModalReferences?.length) return [];
    return this.ligneModalReferences.filter(ref => ref.causes7M && ref.causes7M[mKey] && ref.causes7M[mKey] > 0);
  }

  hasCause7MReferences(mKey: string): boolean { return this.getReferencesForCause7M(mKey).length > 0; }

  getRefMPForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date);
      return orig?.refMP || '-';
    }
    return ref.refMP || '-';
  }

  getRefQualiteForReference(ref: any): string {
    if (this.statsData?.detailsNonConformites) {
      const orig = this.statsData.detailsNonConformites.find(d => d.reference === ref.reference && d.of === ref.of && d.date === ref.date);
      return orig?.refQualite || '-';
    }
    return ref.refQualite || '-';
  }

  onBarClick(event: any): void {
    if (!this.chart || !this.statsData) return;
    const points = this.chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (!points?.length) return;
    const lignes = this.statsData.statsParLigne
      .filter(stat => stat.production.totalQteSource > 0 || stat.production.totalDecProduction > 0)
      .sort((a, b) => b.production.pcs - a.production.pcs);
    const index = points[0].index;
    if (index >= 0 && index < lignes.length) { this.openLigneModal(lignes[index]); }
  }
}