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

  // Signals pour les données
  dashboardData = signal<AdminDashboardOverview | null>(null);
  periodStats = signal<AdminPeriodStats | null>(null);
  pauseHistory = signal<AdminPauseHistory | null>(null);
  mCategoryStats = signal<MCategoryStats | null>(null);
  
  loading = signal(false);
  error = signal<string | null>(null);
  
  // Filtres
  filters = signal({
    startDate: this.getDefaultStartDate(), // 30 jours avant
    endDate: this.getDefaultEndDate(),     // Aujourd'hui
    ligne: 'all',
    status: 'all',
    mCategory: 'all'
  });

  // Vue active (cartes, tableau, graphiques)
  activeView = signal<'cards' | 'table' | 'stats'>('cards');

  // Auto-refresh
  private refreshSubscription?: Subscription;
  autoRefresh = signal(true);
  refreshInterval = signal(30); // secondes

  // Pagination pour l'historique des pauses
  currentPage = signal(1);
  pageSize = signal(20);

  // Computed pour les statistiques
  totalActiveLines = computed(() => 
    this.dashboardData()?.overview.activeLines || 0
  );

  totalPausedLines = computed(() => 
    this.dashboardData()?.overview.pausedLines || 0
  );

  totalInactiveLines = computed(() => 
    this.dashboardData()?.overview.inactiveLines || 0
  );

  ngOnInit(): void {
    this.loadAllData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  /**
   * 🔄 Charger toutes les données
   */
  loadAllData(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentFilters = this.filters();

    // 1. Dashboard overview
    this.adminService.getDashboardOverview({
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      ligne: currentFilters.ligne !== 'all' ? currentFilters.ligne : undefined,
      status: currentFilters.status !== 'all' ? currentFilters.status : undefined
    }).subscribe({
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

    // 2. Period stats
    this.adminService.getPeriodStats(
      currentFilters.startDate,
      currentFilters.endDate
    ).subscribe({
      next: (data) => this.periodStats.set(data),
      error: (err) => console.error('Erreur stats période:', err)
    });

    // 3. M Category stats
    this.adminService.getMCategoryStats(
      currentFilters.startDate,
      currentFilters.endDate
    ).subscribe({
      next: (data) => this.mCategoryStats.set(data),
      error: (err) => console.error('Erreur stats M:', err)
    });

    // 4. Pause history
    this.loadPauseHistory();
  }

  /**
   * 📋 Charger l'historique des pauses
   */
  loadPauseHistory(): void {
    const currentFilters = this.filters();

    this.adminService.getPauseHistory({
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      ligne: currentFilters.ligne !== 'all' ? currentFilters.ligne : undefined,
      mCategory: currentFilters.mCategory !== 'all' ? currentFilters.mCategory : undefined,
      page: this.currentPage(),
      limit: this.pageSize()
    }).subscribe({
      next: (data) => this.pauseHistory.set(data),
      error: (err) => console.error('Erreur historique pauses:', err)
    });
  }

  /**
   * 🔄 Auto-refresh
   */
  startAutoRefresh(): void {
    if (!this.autoRefresh()) return;

    this.refreshSubscription = interval(this.refreshInterval() * 1000)
      .pipe(
        switchMap(() => this.adminService.getDashboardOverview({
          startDate: this.filters().startDate,
          endDate: this.filters().endDate
        }))
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

  /**
   * 🔍 Appliquer les filtres
   */
  applyFilters(): void {
    this.currentPage.set(1); // Reset pagination
    this.loadAllData();
  }

  resetFilters(): void {
    this.filters.set({
      startDate: this.getDefaultStartDate(),
      endDate: this.getDefaultEndDate(),
      ligne: 'all',
      status: 'all',
      mCategory: 'all'
    });
    this.applyFilters();
  }

  /**
   * 📄 Pagination
   */
  changePage(page: number): void {
    this.currentPage.set(page);
    this.loadPauseHistory();
  }

  nextPage(): void {
    const totalPages = this.pauseHistory()?.pagination.totalPages || 1;
    if (this.currentPage() < totalPages) {
      this.changePage(this.currentPage() + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.changePage(this.currentPage() - 1);
    }
  }

  /**
   * 🎨 Helpers UI
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-400';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'paused': return 'En Pause';
      case 'inactive': return 'Inactive';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  }

  getMCategoryLabel(code: string): string {
    const labels: { [key: string]: string } = {
      'M1': 'Matière Première',
      'M2': 'Main d\'œuvre',
      'M3': 'Méthode',
      'M4': 'Maintenance',
      'M5': 'Qualité',
      'M6': 'Environnement'
    };
    return labels[code] || code;
  }

  /**
   * 📅 Dates par défaut
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30 jours avant
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 📊 Navigation vers détails
   */
  viewLineDetails(ligne: string): void {
    this.router.navigate(['/production'], { 
      queryParams: { ligne } 
    });
  }

  viewPauseDetails(pauseId: number): void {
    // Implémenter si nécessaire
    console.log('Voir détails pause:', pauseId);
  }

  /**
   * 📥 Export
   */
  exportData(): void {
    const currentFilters = this.filters();
    
    this.adminService.exportData(
      currentFilters.startDate,
      currentFilters.endDate,
      'json'
    ).subscribe({
      next: (data) => {
        // Télécharger le fichier JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-stats-${currentFilters.startDate}-${currentFilters.endDate}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Erreur export:', err);
        alert('Erreur lors de l\'export des données');
      }
    });
  }

  /**
   * 🔄 Rafraîchir manuellement
   */
  refresh(): void {
    this.loadAllData();
  }

  /**
   * 🏠 Retour
   */
  goBack(): void {
    this.router.navigate(['/']);
  }
}