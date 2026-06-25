import {
  Component, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PointageService, PresenceData, Present, Absent,
  PresenceEmployeeData // ✅ NOUVEAU
} from './pointage.service';

@Component({
  selector: 'app-pointage-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pointage-dashboard.component.html',
  styleUrls: ['./pointage-dashboard.component.css'],
})
export class PointageDashboardComponent implements OnInit, OnDestroy {

  // ── Data ─────────────────────────────────────────────────────
  data: PresenceData | null = null;
  loading = true;
  lastSync = '';
  filterTab: 'tous' | 'presents' | 'absents' = 'tous';
  searchTerm = '';
  private interval: any;

  // ── Stats par ligne ───────────────────────────────────────────
  ligneStats: { ligne: string; presents: number; total: number; pct: number }[] = [];

  // ── Stats arrivées par heure ──────────────────────────────────
  arriveeStats: { heure: string; count: number; peak: boolean }[] = [];

  // ── Derniers pointages ticker ─────────────────────────────────
  dernierPointages: Present[] = [];

  // ✅ NOUVEAU — Filtre par service (Employee)
  selectedService: string | null = null;
  private employeeData: PresenceEmployeeData | null = null;
  readonly services = ['Administratif', 'Maintenance', 'Magasin', 'Qualité'];

  constructor(
    private svc: PointageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();

  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  // ✅ NOUVEAU — rafraîchit selon le mode courant
  refresh(): void {
    if (this.selectedService) {
      this.employeeData = null; // force un re-fetch
      this.selectService(this.selectedService);
    } else {
      this.load();
    }
  }

  load(): void {
    this.svc.getPresenceToday().subscribe({
      next: (data) => {
        this.data = data;
        this.lastSync = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        this.computeStats(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // ✅ NOUVEAU — clic sur un bouton service
  selectService(service: string): void {
    // re-clic sur le même bouton → retour à la vue normale (Ouvrier)
    if (this.selectedService === service && this.employeeData) {
      this.clearServiceFilter();
      return;
    }

    this.selectedService = service;
    this.loading = true;

    if (this.employeeData) {
      this.applyServiceFilter();
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.svc.getPresenceTodayEmployees().subscribe({
      next: (data) => {
        this.employeeData = data;
        this.applyServiceFilter();
        this.lastSync = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }

  // ✅ NOUVEAU — applique le filtre service sur les données en cache
  private applyServiceFilter(): void {
    if (!this.employeeData || !this.selectedService) return;

    const presents = this.employeeData.presents.filter(
      (p) => p.service === this.selectedService
    ) as unknown as Present[];

    const absents = this.employeeData.absents.filter(
      (a) => a.service === this.selectedService
    ) as unknown as Absent[];

    this.data = { total: presents.length, presents, absents };
    this.computeStats(this.data);
  }

  // ✅ NOUVEAU — annule le filtre service, retour à la vue Ouvrier normale
  clearServiceFilter(): void {
    this.selectedService = null;
    this.load();
  }

  computeStats(data: PresenceData): void {
    // ── derniers pointages (5 derniers par heure) ─────────────
    this.dernierPointages = [...data.presents]
      .filter(p => !!p.heureEntree) // ✅ garde-fou si heureEntree null
      .sort((a, b) =>
        new Date(b.heureEntree).getTime() - new Date(a.heureEntree).getTime()
      )
      .slice(0, 5);

    // ── arrivées par heure ────────────────────────────────────
    const heureMap = new Map<string, number>();
    data.presents.forEach(p => {
      if (!p.heureEntree) return; // ✅ garde-fou
      const h = new Date(p.heureEntree).getHours();
      const key = `${h.toString().padStart(2, '0')}h`;
      heureMap.set(key, (heureMap.get(key) || 0) + 1);
    });

    const allHeures = ['05h','06h','07h','08h','09h','10h','11h','12h','13h','14h'];
    const counts = allHeures.map(h => heureMap.get(h) || 0);
    const maxCount = Math.max(...counts, 1);

    this.arriveeStats = allHeures.map((h, i) => ({
      heure: h,
      count: counts[i],
      peak: counts[i] === maxCount,
    }));

    // ── stats par timbratrice (ligne) ─────────────────────────
    const lignePresents = new Map<string, number>();

    data.presents.forEach(p => {
      if (!p.timbratrice) return; // ✅ garde-fou
      const l = p.timbratrice;
      lignePresents.set(l, (lignePresents.get(l) || 0) + 1);
    });

    this.ligneStats = Array.from(lignePresents.entries())
      .map(([ligne, presents]) => ({
        ligne,
        presents,
        total: presents,
        pct: 100,
      }))
      .sort((a, b) => b.presents - a.presents)
      .slice(0, 6);
  }

  // ── Getters ───────────────────────────────────────────────────
  get totalOuvriers(): number {
    return (this.data?.presents.length || 0) + (this.data?.absents.length || 0);
  }

  get totalPresents(): number {
    return this.data?.presents.length || 0;
  }

  get totalAbsents(): number {
    return this.data?.absents.length || 0;
  }

  get tauxPresence(): number {
    if (!this.totalOuvriers) return 0;
    return Math.round((this.totalPresents / this.totalOuvriers) * 100);
  }

  get maxArrivee(): number {
    return Math.max(...this.arriveeStats.map(a => a.count), 1);
  }

  // ✅ NOUVEAU — libellé dynamique selon le mode
  get totalLabel(): string {
    return this.selectedService ? 'employés' : 'ouvriers';
  }

  get filteredList(): any[] {
    let list: any[] = [];
    if (this.filterTab === 'tous') {
      list = [...(this.data?.presents || []), ...(this.data?.absents || [])];
    } else if (this.filterTab === 'presents') {
      list = this.data?.presents || [];
    } else {
      list = this.data?.absents || [];
    }

    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      list = list.filter(o =>
        o.nomPrenom.toLowerCase().includes(s) ||
        o.matricule.toString().includes(s)
      );
    }

    return list;
  }

  formatHeure(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });
  }

  today(): string {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ── Filtre dates ──────────────────────────────────────────────
  dateDebut: string = new Date().toISOString().split('T')[0];
  dateFin: string   = new Date().toISOString().split('T')[0];

  get maxLigne(): number {
    return Math.max(...this.ligneStats.map(l => l.presents), 1);
  }

  loadToday(): void {
    this.selectedService = null; // ✅ on quitte le mode service
    const today = new Date().toISOString().split('T')[0];
    this.dateDebut = today;
    this.dateFin   = today;
    this.load();
  }

  loadPeriode(): void {
    if (!this.dateDebut || !this.dateFin) return;
    this.selectedService = null; // ✅ on quitte le mode service
    this.loading = true;
    this.svc.getPresencePeriode(this.dateDebut, this.dateFin).subscribe({
      next: (data) => {
        this.data = data;
        this.lastSync = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        this.computeStats(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }
}