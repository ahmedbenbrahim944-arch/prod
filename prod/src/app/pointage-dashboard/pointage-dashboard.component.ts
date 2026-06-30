import {
  Component, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PointageService, PresenceData, Present, Absent,
  PresenceEmployeeData, RecapPoste
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

  // ── Partie 1 : vue d'ensemble globale (ouvriers + tous services) ──
  globalStats: { presents: number; absents: number; total: number } | null = null;

  // ── Partie 2 : mode "Ouvrier" avec sous-filtre poste ──────────────
  ouvrierMode = false; // true quand le bouton "Ouvrier" est actif
  selectedPoste: '1ere poste' | '2eme poste' | null = null;
  posteStats: { totalAffectes: number; presents: number; absents: number } | null = null;
  readonly postes: ('1ere poste' | '2eme poste')[] = ['1ere poste', '2eme poste'];

  // ── Stats par ligne ───────────────────────────────────────────
  ligneStats: { ligne: string; presents: number; total: number; pct: number }[] = [];

  // ── Stats arrivées par heure ──────────────────────────────────
  arriveeStats: { heure: string; count: number; peak: boolean }[] = [];

  // ── Derniers pointages ticker ─────────────────────────────────
  dernierPointages: Present[] = [];

  // Filtre par service (Employee)
  selectedService: string | null = null;
  readonly services = ['Administratif', 'Maintenance', 'Magasin', 'Qualité'];

  constructor(
    private svc: PointageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadGlobalStats();
  }

  loadGlobalStats(): void {
    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;
    const isToday = debut === new Date().toISOString().split('T')[0] && fin === debut;

    const ouvriers$ = isToday
      ? this.svc.getPresenceToday()
      : this.svc.getPresencePeriode(debut, fin);

    const employees$ = isToday
      ? this.svc.getPresenceTodayEmployees()
      : this.svc.getPresencePeriodeEmployees(debut, fin);

    ouvriers$.subscribe({
      next: (ouv) => {
        employees$.subscribe({
          next: (emp) => {
            this.globalStats = {
              presents: ouv.presents.length + emp.totalPresents,
              absents: ouv.absents.length + emp.totalAbsents,
              total: ouv.presents.length + ouv.absents.length + emp.totalEmployes,
            };
            this.cdr.markForCheck();
          },
        });
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Partie 2 : bouton "Ouvrier" + sous-filtre poste
  // ════════════════════════════════════════════════════════════════
  selectOuvrier(): void {
    if (this.ouvrierMode) {
      // re-clic → on désactive le mode, retour à la vue ouvrier normale
      this.ouvrierMode = false;
      this.selectedPoste = null;
      this.posteStats = null;
      return;
    }
    this.ouvrierMode = true;
    this.selectedPoste = null;
    this.posteStats = null;

    // sécurité : on désactive le filtre service en parallèle
    if (this.selectedService) {
      this.selectedService = null;
    }
    this.load(); // recharge la liste ouvrier classique en dessous
  }

  selectPoste(poste: '1ere poste' | '2eme poste'): void {
    // re-clic sur le même poste → on revient à la vue "Ouvrier" globale
    if (this.selectedPoste === poste) {
      this.selectedPoste = null;
      this.posteStats = null;
      return;
    }

    this.selectedPoste = poste;
    this.loading = true;

    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;
    const isToday = debut === new Date().toISOString().split('T')[0] && fin === debut;

    const obs = isToday
      ? this.svc.getRecapPosteToday()
      : this.svc.getRecapPostePeriode(debut, fin);

    obs.subscribe({
      next: (rows: RecapPoste[]) => {
        const filtres = rows.filter(r => r.poste === poste);
        this.posteStats = filtres.reduce(
          (acc, r) => ({
            totalAffectes: acc.totalAffectes + r.totalAffectes,
            presents: acc.presents + r.presents,
            absents: acc.absents + r.absents,
          }),
          { totalAffectes: 0, presents: 0, absents: 0 }
        );
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }
  get totalOuvriers(): number {
    if (this.posteStats) return this.posteStats.totalAffectes;
    return (this.data?.presents.length || 0) + (this.data?.absents.length || 0);
  }

  get totalPresents(): number {
    if (this.posteStats) return this.posteStats.presents;
    return this.data?.presents.length || 0;
  }

  get totalAbsents(): number {
    if (this.posteStats) return this.posteStats.absents;
    return this.data?.absents.length || 0;
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  refresh(): void {
    if (this.selectedService) {
      this.loadServiceData();
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
      error: () => { this.loading = false; }
    });
  }

  // ── Sélection d'un service ──────────────────────────────────────
  selectService(service: string): void {
    // re-clic sur le même bouton → retour à la vue normale (Ouvrier)
    if (this.selectedService === service) {
      this.clearServiceFilter();
      return;
    }
    this.selectedService = service;
    this.loadServiceData(); // ✅ MODIFIÉ — respecte maintenant dateDebut/dateFin
  }

  // ✅ MODIFIÉ — utilise l'endpoint période (et non plus "today" en dur)
  // ça permet d'appliquer la même date début/fin que pour les ouvriers
  private loadServiceData(): void {
    if (!this.selectedService) return;
    this.loading = true;

    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;

    this.svc.getPresencePeriodeEmployees(debut, fin).subscribe({
      next: (data) => {
        this.applyServiceFilter(data);
        this.lastSync = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
  }

  // ✅ MODIFIÉ — reçoit maintenant les données en paramètre (plus de cache)
  private applyServiceFilter(data: PresenceEmployeeData): void {
    if (!this.selectedService) return;

    const presents = data.presents.filter(
      (p) => p.service === this.selectedService
    ) as unknown as Present[];

    const absents = data.absents.filter(
      (a) => a.service === this.selectedService
    ) as unknown as Absent[];

    this.data = { total: presents.length, presents, absents };
    this.computeStats(this.data);
  }

  // ✅ MODIFIÉ — repart sur l'endpoint ouvrier en respectant la période en cours
  clearServiceFilter(): void {
    this.selectedService = null;

    const today = new Date().toISOString().split('T')[0];
    if (this.dateDebut === today && this.dateFin === today) {
      this.load();
    } else {
      this.loadPeriode();
    }
  }

  computeStats(data: PresenceData): void {
    this.dernierPointages = [...data.presents]
      .filter(p => !!p.heureEntree)
      .sort((a, b) =>
        new Date(b.heureEntree).getTime() - new Date(a.heureEntree).getTime()
      )
      .slice(0, 5);

    const heureMap = new Map<string, number>();
    data.presents.forEach(p => {
      if (!p.heureEntree) return;
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

    const lignePresents = new Map<string, number>();
    data.presents.forEach(p => {
      if (!p.timbratrice) return;
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
  

  get tauxPresence(): number {
    if (!this.totalOuvriers) return 0;
    return Math.round((this.totalPresents / this.totalOuvriers) * 100);
  }

  get maxArrivee(): number {
    return Math.max(...this.arriveeStats.map(a => a.count), 1);
  }

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

  // ✅ MODIFIÉ — ne réinitialise plus selectedService
  loadToday(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dateDebut = today;
    this.dateFin   = today;

    this.loadGlobalStats(); // ✅ NOUVEAU

    if (this.selectedPoste) {
      this.selectPoste(this.selectedPoste);
    } else if (this.selectedService) {
      this.loadServiceData();
    } else {
      this.load();
    }
  }

  // ✅ MODIFIÉ — ne réinitialise plus selectedService
 loadPeriode(): void {
    if (!this.dateDebut || !this.dateFin) return;

    this.loadGlobalStats(); // ✅ NOUVEAU

    if (this.selectedPoste) {
      this.selectPoste(this.selectedPoste);
      return;
    }
    if (this.selectedService) {
      this.loadServiceData();
      return;
    }

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