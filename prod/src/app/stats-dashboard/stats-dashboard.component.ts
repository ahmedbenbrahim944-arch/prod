import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsService, StatsDashboard, FichePersonne } from './stats.service';

type QuickRange = 'week' | 'month' | 'quarter' | 'year';

@Component({
  selector: 'app-stats-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats-dashboard.component.html',
  styleUrls: ['./stats-dashboard.component.css'],
})
export class StatsDashboardComponent implements OnInit {
  dateDebut = '';
  dateFin = '';
  activeRange: QuickRange = 'week';

  loading = false;
  error: string | null = null;
  data: StatsDashboard | null = null;

  couleursType: Record<string, string> = {
    sans_statut: '#9aa4b8',
    absence_non_justifiee: '#c0392b',
    conge: '#7c9bf0',
    maladie_courte_duree: '#c2760c',
    maladie_longue_duree: '#a15c00',
    maladie_accouchement: '#f2a65a',
    mission: '#5b657a',
    raison_familiale: '#b98ed6',
    attente_justification: '#c9ced9',
    fin_contrat: '#8a94a6',
    mise_a_pied: '#8a94a6',
    autre: '#8a94a6',
  };

  // ── Recherche individuelle ──────────────────────────────────
  matSearch = '';
  ficheData: FichePersonne | null = null;
  ficheLoading = false;
  ficheError: string | null = null;

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.setQuickRange('week');
  }

  setQuickRange(range: QuickRange): void {
    this.activeRange = range;
    const today = new Date();
    const fin = this.toDateStr(today);
    let debutDate = new Date(today);

    switch (range) {
      case 'week':
        debutDate.setDate(today.getDate() - 6);
        break;
      case 'month':
        debutDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        debutDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      case 'year':
        debutDate = new Date(today.getFullYear(), 0, 1);
        break;
    }

    this.dateDebut = this.toDateStr(debutDate);
    this.dateFin = fin;
    this.load();
  }

 load(): void {
    if (!this.dateDebut || !this.dateFin) return;
    this.loading = true;
    this.error = null;

    this.statsService.getDashboard(this.dateDebut, this.dateFin, this.selectedService).subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: (err) => {
        console.error(err);
        this.error = 'Impossible de charger les statistiques.';
        this.loading = false;
      },
    });
  }

  // ── Recherche individuelle ──────────────────────────────────
  rechercherFiche(): void {
    const matricule = this.matSearch.trim();
    if (!matricule) return;
    this.ficheLoading = true;
    this.ficheError = null;
    this.ficheData = null;

    this.statsService.getFiche(matricule, this.dateDebut, this.dateFin).subscribe({
      next: (res) => { this.ficheData = res; this.ficheLoading = false; },
      error: (err) => {
        console.error(err);
        this.ficheError =
          err?.status === 404
            ? `Aucune personne trouvée pour le matricule "${matricule}".`
            : 'Impossible de charger la fiche.';
        this.ficheLoading = false;
      },
    });
  }

  etatClass(etat: string): string {
    if (etat === 'present') return 'tblock present';
    if (etat === 'absence_non_justifiee') return 'tblock absent';
    if (etat === 'maladie') return 'tblock maladie';
    if (etat === 'conge' || etat === 'mission' || etat === 'raison_familiale') return 'tblock conge';
    return 'tblock autre';
  }

  etatLabel(etat: string): string {
    const labels: Record<string, string> = {
      present: 'Présent',
      absence_non_justifiee: 'Absence non justifiée',
      conge: 'Congé',
      maladie: 'Maladie',
      mission: 'Mission',
      raison_familiale: 'Raison familiale',
      attente_justification: 'En attente de justification',
      fin_contrat: 'Fin de contrat',
      mise_a_pied: 'Mise à pied',
      autre: 'Autre',
    };
    return labels[etat] || etat;
  }

  jourLabelCourt(jourStr: string): string {
    const [, m, d] = jourStr.split('-');
    return `${d}/${m}`;
  }

  // ── Helpers d'affichage — répartition par type ───────────────
  maxTypeCount(): number {
    if (!this.data?.repartitionParType.length) return 1;
    return Math.max(...this.data.repartitionParType.map((t) => t.count));
  }

  couleurType(statut: string): string {
    return this.couleursType[statut] || '#8a94a6';
  }

  badgeClass(occurrences: number): string {
    if (occurrences >= 4) return 'badge r';
    if (occurrences >= 3) return 'badge a';
    return 'badge g';
  }

  // ── Helpers d'affichage — courbe de tendance ──────────────────
  get trendPointsArr(): { x: number; y: number; jour: string; taux: number }[] {
    if (!this.data?.tendance?.length) return [];
    const vals = this.data.tendance.map((t) => t.tauxAbsence);
    const max = Math.max(...vals, 1);
    const n = this.data.tendance.length;
    return this.data.tendance.map((t, i) => ({
      x: n > 1 ? 20 + (i * 600) / (n - 1) : 320,
      y: 160 - (t.tauxAbsence / max) * 120,
      jour: t.jour,
      taux: t.tauxAbsence,
    }));
  }

  get trendPolyline(): string {
    return this.trendPointsArr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  private toDateStr(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  services: string[] = ['tous', 'Administratif', 'Maintenance', 'Magasin', 'Qualité', 'Ouvriers'];
  selectedService = 'tous';

  setService(s: string): void {
    this.selectedService = s;
    this.load();
  }
}