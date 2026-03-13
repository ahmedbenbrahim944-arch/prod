// admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap, catchError,  } from 'rxjs/operators';
import { 
  AdminDashboardService, 
  AdminDashboardOverview, 
  LineStatusAdmin,
  AdminPeriodStats,
  AdminPauseHistory,
  MCategoryStats,
  ActivePauseDetails
} from './admin-dashboard.service';
import { ProductionService } from '../production-manager/Production.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminDashboardService);
  private productionService = inject(ProductionService);
  private router = inject(Router);

  dashboardData = signal<AdminDashboardOverview | null>(null);
  periodStats = signal<AdminPeriodStats | null>(null);
  
  loading = signal(false);
  error = signal<string | null>(null);

  activeView = signal<'cards' | 'table'>('cards');

  private refreshSubscription?: Subscription;
  autoRefresh = signal(true);
  refreshInterval = signal(60);

  currentPage = signal(1);
  pageSize = signal(20);

  // ── Modal Pause Details ───────────────────────────────────────────────────
  showPauseModal = signal(false);
  selectedLinePause = signal<ActivePauseDetails | null>(null);
  pauseModalLoading = signal(false);
  pauseModalError = signal<string | null>(null);

  // ── Computed globaux ──────────────────────────────────────────────────────
  totalActiveLines = computed(() => 
    this.dashboardData()?.overview.activeLines || 0
  );

  totalPausedLines = computed(() => 
    this.dashboardData()?.overview.pausedLines || 0
  );

  totalInactiveLines = computed(() => 
    this.dashboardData()?.overview.inactiveLines || 0
  );

  /**
   * Seulement les lignes actives ou en pause (masque les inactives)
   */
  activeAndPausedLines = computed(() => {
    const lines = this.dashboardData()?.lines || [];
    return lines.filter(l => l.status === 'active' || l.status === 'paused');
  });

  ngOnInit(): void {
    this.loadAllData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  loadAllData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getDashboardOverview().subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement du dashboard');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  // ── Auto-refresh ──────────────────────────────────────────────────────────

  startAutoRefresh(): void {
    if (!this.autoRefresh()) return;
    this.refreshSubscription = interval(this.refreshInterval() * 1000)
      .pipe(
        switchMap(() => this.adminService.getDashboardOverview())
      )
      .subscribe({
        next: (data) => this.dashboardData.set(data),
        error: (err) => console.error('Erreur auto-refresh:', err)
      });
  }

  stopAutoRefresh(): void {
    this.refreshSubscription?.unsubscribe();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update(v => !v);
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active':    return 'Active';
      case 'paused':    return 'En Pause';
      case 'inactive':  return 'Inactive';
      case 'completed': return 'Terminee';
      case 'cancelled': return 'Annulee';
      default:          return status;
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /**
   * L'admin navigue vers la ligne avec le flag adminAccess=true
   */
  viewLineDetails(ligne: string): void {
    this.router.navigate(['/production'], { 
      queryParams: { 
        ligne,
        adminAccess: 'true'
      } 
    });
  }

  /**
   * Ouvre le modal avec les détails de la pause en cours.
   * Stratégie en cascade :
   *  1. Essai GET /production/line/:ligne/active-pause  (endpoint dédié)
   *  2. Si 404/erreur → GET /production/line/:ligne/status (données complètes de la ligne)
   *  3. Si toujours rien → fallback sur dashboardData (données partielles sans refs)
   */
  openPauseModal(ligne: string): void {
    this.showPauseModal.set(true);
    this.selectedLinePause.set(null);
    this.pauseModalError.set(null);
    this.pauseModalLoading.set(true);

    // ── Étape 1 : endpoint dédié ──────────────────────────────────────────
    this.adminService.getActivePauseDetails(ligne).subscribe({
      next: (data) => {
        this.selectedLinePause.set(data);
        this.pauseModalLoading.set(false);
      },
      error: () => {
        // ── Étape 2 : getLineStatus pour récupérer currentPause complet ───
        this.productionService.getLineStatus(ligne).subscribe({
          next: (status: any) => {
            // Le status retourne { session, currentPause, realTime, ... }
            const pause = status?.currentPause ?? status?.session?.currentPause ?? status?.realTime?.pauseEnCours;
            if (pause) {
              this.selectedLinePause.set({
                ligne,
                sessionId: status?.session?.id ?? 0,
                pauseId:   pause.id ?? 0,
                mCategory: pause.mCategory,
                subCategory: pause.subCategory,
                reason:    pause.reason,
                startTime: pause.startTime ?? '',
                duration:  pause.duration ?? pause.duree ?? '',
                matierePremierRefs: pause.matierePremierRefs ?? [],
                phasesEnPanne:      pause.phasesEnPanne ?? [],
                productRefs:        pause.productRefs ?? [],
                lostPieces:         pause.lostPieces ?? pause.piecesPerdues ?? 0,
                planifications:     pause.planifications ?? []   // ✅ AJOUT
              });
            } else {
              this._fallbackFromDashboard(ligne);
            }
            this.pauseModalLoading.set(false);
          },
          error: () => {
            // ── Étape 3 : fallback dashboardData ────────────────────────
            this._fallbackFromDashboard(ligne);
            this.pauseModalLoading.set(false);
          }
        });
      }
    });
  }

  /** Fallback sur les données déjà chargées dans dashboardData (sans refs) */
  private _fallbackFromDashboard(ligne: string): void {
    const line = this.dashboardData()?.lines.find(l => l.ligne === ligne);
    const p = line?.realTime?.pauseEnCours;
    if (p) {
      this.selectedLinePause.set({
        ligne,
        sessionId:  line?.activeSession?.id ?? 0,
        pauseId:    p.id ?? 0,
        mCategory:  p.mCategory,
        duration:   p.duree ?? '',
        startTime:  '',
        lostPieces: p.piecesPerdues ?? 0,
        // refs absentes dans ce fallback — on affiche un message
        matierePremierRefs: [],
        phasesEnPanne:      [],
        productRefs:        []
      });
    } else {
      this.pauseModalError.set('Impossible de charger les détails de la pause');
    }
  }

  closePauseModal(): void {
    this.showPauseModal.set(false);
    this.selectedLinePause.set(null);
  }

  /**
   * Retourne le label complet d'une catégorie M
   */
  getMCategoryLabel(code: string): string {
    const labels: Record<string, string> = {
      'M1': 'Matière Première',
      'M2': "Main d'œuvre",
      'M3': 'Méthode',
      'M4': 'Maintenance',
      'M5': 'Qualité',
      'M6': 'Environnement'
    };
    return labels[code] || code;
  }

  /**
   * Retourne les classes Tailwind pour l'affichage d'une catégorie M
   */
  getMCategoryStyle(code: string): { card: string; iconBg: string; icon: string; badge: string; label: string } {
    const styles: Record<string, { card: string; iconBg: string; icon: string; badge: string; label: string }> = {
      'M1': {
        card:   'bg-amber-900/20 border-amber-400/40',
        iconBg: 'bg-amber-500/20',
        icon:   '📦',
        badge:  'bg-amber-500/30 text-amber-300',
        label:  'text-amber-200'
      },
      'M2': {
        card:   'bg-yellow-900/20 border-yellow-400/40',
        iconBg: 'bg-yellow-500/20',
        icon:   '👷',
        badge:  'bg-yellow-500/30 text-yellow-300',
        label:  'text-yellow-200'
      },
      'M3': {
        card:   'bg-slate-800/60 border-slate-500/40',
        iconBg: 'bg-slate-500/20',
        icon:   '📋',
        badge:  'bg-slate-500/30 text-slate-300',
        label:  'text-slate-300'
      },
      'M4': {
        card:   'bg-orange-900/20 border-orange-400/40',
        iconBg: 'bg-orange-500/20',
        icon:   '🔧',
        badge:  'bg-orange-500/30 text-orange-300',
        label:  'text-orange-200'
      },
      'M5': {
        card:   'bg-green-900/20 border-green-400/40',
        iconBg: 'bg-green-500/20',
        icon:   '✅',
        badge:  'bg-green-500/30 text-green-300',
        label:  'text-green-200'
      },
      'M6': {
        card:   'bg-emerald-900/20 border-emerald-400/40',
        iconBg: 'bg-emerald-500/20',
        icon:   '🌿',
        badge:  'bg-emerald-500/30 text-emerald-300',
        label:  'text-emerald-200'
      }
    };
    return styles[code] ?? {
      card:   'bg-slate-800/60 border-slate-500/40',
      iconBg: 'bg-slate-500/20',
      icon:   '⏸️',
      badge:  'bg-slate-500/30 text-slate-300',
      label:  'text-slate-300'
    };
  }

  viewPauseHistory(ligne: string): void {
    const line = this.dashboardData()?.lines.find(l => l.ligne === ligne);
    const sessionInfo = line ? {
      ligne: line.ligne,
      status: line.status,
      productionTime: line.realTime?.tempsProduction || '0s',
      sessionId: line.activeSession?.id
    } : { ligne };

    this.router.navigate(['/pause-history'], {
      queryParams: { ligne },
      state: { ligne, sessionInfo }
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportData(): void {
    const today = new Date().toISOString().split('T')[0];
    const startDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    this.adminService.exportData(startDate, today, 'json').subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-stats-${startDate}-${today}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Erreur export:', err);
        alert('Erreur lors de l\'export des donnees');
      }
    });
  }

  refresh(): void {
    this.loadAllData();
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}