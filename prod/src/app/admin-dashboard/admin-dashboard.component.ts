// admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { 
  AdminDashboardService, 
  AdminDashboardOverview, 
  LineStatusAdmin,
  AdminPeriodStats,
  AdminPauseHistory,
  MCategoryStats
} from './admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminDashboardService);
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