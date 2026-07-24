import {
  Component, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PointageService, PresenceData, Present, Absent, EnConge,
  PresenceEmployeeData, RecapPoste
} from './pointage.service';

import { SemaineService, Planification } from '../prod/semaine.service';

import { AuthService } from '../login/auth.service';

import { StatsService1, Causes7MLigne } from '../stats/stats.service';

// ── Libellés FR pour les statuts manuels ─────────────────────────
const STATUT_LABELS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  conge: 'Congé',
  maladie: 'Congé maladie',
  mission: 'Mission',
  autre: 'Autre',
  badge_oublie: 'Badge oublié',
  absence_non_justifiee: 'Absence non justifiée',
  attente_justification: 'En attente de justification',
  raison_familiale: 'Raison familiale',
  fin_contrat: 'Fin de contrat',
  mise_a_pied: 'Mise à pied',
};

// ✅ NOUVEAU — une ligne du récap "Récup Production" (groupée par LIGNE, toutes références confondues)
interface RecupLigneTotal {
  ligne: string;         // ex: "L04"
  poste1: { planifie: number; declare: number };
  poste2: { planifie: number; declare: number };
  totalPlanifie: number;
  totalDeclare: number;
}

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
  filterTab: 'tous' | 'presents' | 'absents' | 'conge' = 'tous'; // ✅ NOUVEAU : 'conge'
  searchTerm = '';
  private interval: any;

  // ── Partie 1 : vue d'ensemble globale (ouvriers + tous services) ──
  globalStats: { presents: number; absents: number; enConge: number; total: number } | null = null;

  // ✅ NOUVEAU — anneaux de présence par poste (1ere/2eme), affichés à côté de l'anneau global
  posteRings: { label: string; presents: number; absents: number; enConge: number; total: number; pct: number }[] = [];

  // ✅ MODIFIÉ — anneaux de présence par (service, poste) pour les 5 secteurs
  serviceRings: { label: string; service: string; poste: '1ere poste' | '2eme poste'; presents: number; absents: number; enConge: number; total: number; pct: number }[] = [];

  // ✅ NOUVEAU — contrôle d'accès : true si matricule === '2600'
  get hasLimitedAccess(): boolean {
    const userMatricule = this.authSvc.getUserMatricule();
    return userMatricule === '2600';
  }

  // ── Partie 2 : mode "Ouvrier" avec sous-filtre poste ──────────────
  ouvrierMode = false; // true quand le bouton "Ouvrier" est actif
  selectedPoste: '1ere poste' | '2eme poste' | null = null;
  posteStats: { totalAffectes: number; presents: number; absents: number; enConge: number } | null = null;
  readonly postes: ('1ere poste' | '2eme poste')[] = ['1ere poste', '2eme poste'];

  // ── Stats par ligne ───────────────────────────────────────────
  ligneStats: { ligne: string; presents: number; total: number; pct: number }[] = [];

  // ── Stats arrivées par heure ──────────────────────────────────
  arriveeStats: { heure: string; count: number; peak: boolean }[] = [];

  // ── Derniers pointages ticker ─────────────────────────────────
  dernierPointages: Present[] = [];

  // Filtre par service (Employee + 5 secteurs)
  selectedService: string | null = null;
  readonly services = ['Administratif', 'Maintenance', 'Magasin', 'Qualité', 'Sélection', 'Team Production'];

  // ✅ NOUVEAU — les 5 secteurs qui ont un champ poste (1ere/2eme), contrairement à Administratif
  readonly servicesAvecPoste = ['Maintenance', 'Magasin', 'Qualité', 'Sélection', 'Team Production'];

  // ✅ NOUVEAU — sous-filtre poste quand un des 5 secteurs est sélectionné
  selectedServicePoste: '1ere poste' | '2eme poste' | null = null;

  // ✅ NOUVEAU — cache des données brutes du service sélectionné (pour ré-appliquer le sous-filtre poste sans refetch)
  private serviceRawData: PresenceEmployeeData | null = null;

  // ════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — état pour la modal "Récup Production"
  // ════════════════════════════════════════════════════════════════
  showRecupModal = false;
  recupDate: string = new Date().toISOString().split('T')[0];
  recupLoading = false;
  recupError: string | null = null;
  recupRows: RecupLigneTotal[] = [];
  recupSelected: RecupLigneTotal | null = null; // ✅ NOUVEAU — ligne sélectionnée (vue détail)
  private readonly JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  recupCauses7MLoading = false;
recupCausePrincipale: { label: string; pct: number } | null = null;
recupAutresCauses: { label: string; pct: number }[] = [];

private readonly CAUSE_LABELS: Record<string, string> = {
  matierePremiere: 'M1 : Matière Première',
  absence: 'M2 : Absence',
  rendement: 'M3 : Rendement',
  methode: 'M4 : Méthode',
  maintenance: 'M5 : Maintenance',
  qualite: 'M6 : Qualité',
  environnement: 'M7 : Environnement',
};

  constructor(
    private svc: PointageService,
    private semaineSvc: SemaineService, // ✅ NOUVEAU
    private cdr: ChangeDetectorRef,
    private statsSvc: StatsService1,
    private authSvc: AuthService // ✅ NOUVEAU — pour contrôle d'accès matricule 2600
  ) {}

  ngOnInit(): void {
    // ✅ NOUVEAU — si matricule 2600, forcer le mode Ouvrier
    if (this.hasLimitedAccess) {
      this.ouvrierMode = true;
    }

    this.load();
    this.loadGlobalStats();
    this.loadPosteRings(); // ✅ NOUVEAU
    this.loadServiceRings(); // ✅ NOUVEAU — anneaux services
  }

  // ✅ NOUVEAU — calcule le % de présence + présents/absents/enConge pour chaque poste (1ere/2eme),
  // en sommant les lignes retournées par getRecapPosteToday/Periode (même source que le filtre poste existant).
  loadPosteRings(): void {
    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;
    const isToday = debut === new Date().toISOString().split('T')[0] && fin === debut;

    const obs = isToday
      ? this.svc.getRecapPosteToday()
      : this.svc.getRecapPostePeriode(debut, fin);

    obs.subscribe({
      next: (rows: RecapPoste[]) => {
        this.posteRings = this.postes.map((poste) => {
          const filtres = rows.filter(r => r.poste === poste);
          const presents = filtres.reduce((s, r) => s + r.presents, 0);
          const absents = filtres.reduce((s, r) => s + r.absents, 0);
          const enConge = filtres.reduce((s, r) => s + (r.enConge || 0), 0);
          const total = filtres.reduce((s, r) => s + r.totalAffectes, 0);
          return {
            label: poste,
            presents,
            absents,
            enConge,
            total,
            pct: total ? Math.round((presents / total) * 100) : 0,
          };
        });
        this.cdr.markForCheck();
      },
    });
  }

  // ✅ MODIFIÉ — calcule le % de présence + présents/absents/enConge pour chaque COUPLE
  // (secteur, poste), en groupant les données employees par service ET par poste.
  // Administratif n'a pas de poste : on ne lui construit pas d'anneau ici (inchangé).
  loadServiceRings(): void {
    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;
    const isToday = debut === new Date().toISOString().split('T')[0] && fin === debut;

    const obs = isToday
      ? this.svc.getPresenceTodayEmployees()
      : this.svc.getPresencePeriodeEmployees(debut, fin);

    obs.subscribe({
      next: (data: PresenceEmployeeData) => {
        const rings: {
          label: string; service: string; poste: '1ere poste' | '2eme poste';
          presents: number; absents: number; enConge: number; total: number; pct: number;
        }[] = [];

        for (const service of this.servicesAvecPoste) {
          for (const poste of this.postes) {
            const presents = data.presents.filter(p => p.service === service && p.poste === poste).length;
            const absents = data.absents.filter(a => a.service === service && a.poste === poste).length;
            const enConge = data.enConge.filter(e => e.service === service && e.poste === poste).length;
            const total = presents + absents + enConge;

            rings.push({
              label: `${service} — ${poste}`,
              service,
              poste,
              presents,
              absents,
              enConge,
              total,
              pct: total ? Math.round((presents / total) * 100) : 0,
            });
          }
        }

        this.serviceRings = rings;
        this.cdr.markForCheck();
      },
    });
  }

  // ✅ NOUVEAU — entre 08:00 et 14:15, le 2ème poste ouvrier n'a pas encore
  // commencé sa journée : on l'exclut du calcul du total global pour ne pas
  // fausser le pourcentage de présence. À partir de 14:15, il est réintégré.
  private shouldExcludePoste2Now(): boolean {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const debut = 8 * 60;       // 08:00
    const fin = 14 * 60 + 15;   // 14:15
    return minutes >= debut && minutes < fin;
  }

  loadGlobalStats(): void {
    const debut = this.dateDebut || new Date().toISOString().split('T')[0];
    const fin = this.dateFin || debut;
    const isToday = debut === new Date().toISOString().split('T')[0] && fin === debut;

    const employees$ = isToday
      ? this.svc.getPresenceTodayEmployees()
      : this.svc.getPresencePeriodeEmployees(debut, fin);

    // ✅ NOUVEAU — pour "aujourd'hui" uniquement, on passe par getRecapPosteToday()
    // (données groupées par poste) afin de pouvoir exclure le 2ème poste avant 14h15.
    // Pour une période (pas "aujourd'hui"), comportement inchangé : tous les postes comptent.
    if (isToday) {
      this.svc.getRecapPosteToday().subscribe({
        next: (rows: RecapPoste[]) => {
          employees$.subscribe({
            next: (emp) => {
              const excludePoste2 = this.shouldExcludePoste2Now();
              const postesInclus = excludePoste2
                ? rows.filter(r => r.poste === '1ere poste')
                : rows;

              const presentsOuv = postesInclus.reduce((s, r) => s + r.presents, 0);
              const absentsOuv = postesInclus.reduce((s, r) => s + r.absents, 0);
              const enCongeOuv = postesInclus.reduce((s, r) => s + (r.enConge || 0), 0);
              const totalOuv = postesInclus.reduce((s, r) => s + r.totalAffectes, 0);

              // ✅ NOUVEAU — même exclusion pour les 5 secteurs : un item sans poste
              // (Administratif) passe toujours ; un item en '2eme poste' est exclu
              // uniquement si excludePoste2 est actif.
              const gardePoste = (item: { poste?: string | null }) =>
                !excludePoste2 || item.poste !== '2eme poste';

              const presentsEmp = emp.presents.filter(gardePoste).length;
              const absentsEmp = emp.absents.filter(gardePoste).length;
              const enCongeEmp = emp.enConge.filter(gardePoste).length;
              const totalEmp = presentsEmp + absentsEmp + enCongeEmp;

              this.globalStats = {
                presents: presentsOuv + presentsEmp,
                absents: absentsOuv + absentsEmp,
                enConge: enCongeOuv + enCongeEmp,
                total: totalOuv + totalEmp,
              };
              this.cdr.markForCheck();
            },
          });
        },
      });
      return;
    }

    const ouvriers$ = this.svc.getPresencePeriode(debut, fin);

    ouvriers$.subscribe({
      next: (ouv) => {
        employees$.subscribe({
          next: (emp) => {
            this.globalStats = {
              presents: ouv.presents.length + emp.totalPresents,
              absents: ouv.absents.length + emp.totalAbsents,
              enConge: (ouv.enConge?.length || 0) + (emp.totalEnConge || 0), // ✅ NOUVEAU
              total:
                ouv.presents.length + ouv.absents.length + (ouv.enConge?.length || 0)
                + emp.totalEmployes,
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
  // re-clic sur le même poste → retour à la vue "Ouvrier" globale (non filtrée)
  if (this.selectedPoste === poste) {
    this.selectedPoste = null;
    this.posteStats = null;

    const today = new Date().toISOString().split('T')[0];
    this.loading = true;
    const obs = (this.dateDebut === today && this.dateFin === today)
      ? this.svc.getPresenceToday()
      : this.svc.getPresencePeriode(this.dateDebut, this.dateFin);

    obs.subscribe({
      next: (data) => {
        this.data = data;
        this.computeStats(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; }
    });
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
          enConge: acc.enConge + (r.enConge || 0), // ✅ NOUVEAU
        }),
        { totalAffectes: 0, presents: 0, absents: 0, enConge: 0 }
      );

      // ✅ construire la vraie liste filtrée par poste (c'est ce qui manquait)
      const presentsListe: Present[] = filtres.flatMap(r =>
        r.presentsListe.map(p => ({
          matricule: p.matricule,
          nomPrenom: p.nomPrenom,
          heureEntree: p.heureEntree || '',
          timbratrice: p.timbratrice || '',
          statut: p.statut,
          commentaire: p.commentaire ?? undefined,
        }))
      );

      const absentsListe: Absent[] = filtres.flatMap(r =>
        r.absentsListe.map(a => ({
          matricule: a.matricule,
          nomPrenom: a.nomPrenom,
          statut: a.statut,
          commentaire: a.commentaire ?? undefined,
        }))
      );

      // ✅ NOUVEAU — liste en congé/justifié filtrée par poste
      const enCongeListe: EnConge[] = filtres.flatMap(r =>
        (r.enCongeListe || []).map(c => ({
          matricule: c.matricule,
          nomPrenom: c.nomPrenom,
          statut: c.statut,
          commentaire: c.commentaire ?? undefined,
        }))
      );

      this.data = {
        total: presentsListe.length + absentsListe.length + enCongeListe.length,
        presents: presentsListe,
        absents: absentsListe,
        enConge: enCongeListe,
      };

      this.computeStats(this.data);
      this.loading = false;
      this.cdr.markForCheck();
    },
    error: () => { this.loading = false; }
  });
}
  get totalOuvriers(): number {
    if (this.posteStats) return this.posteStats.totalAffectes;
    return (this.data?.presents.length || 0) + (this.data?.absents.length || 0) + (this.data?.enConge.length || 0);
  }

  get totalPresents(): number {
    if (this.posteStats) return this.posteStats.presents;
    return this.data?.presents.length || 0;
  }

  get totalAbsents(): number {
    if (this.posteStats) return this.posteStats.absents;
    return this.data?.absents.length || 0;
  }

  // ✅ NOUVEAU
  get totalEnConge(): number {
    if (this.posteStats) return this.posteStats.enConge;
    return this.data?.enConge.length || 0;
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
    // ✅ NOUVEAU — refuser l'accès aux services si matricule 2600
    if (this.hasLimitedAccess) {
      return;
    }

    // re-clic sur le même bouton → retour à la vue normale (Ouvrier)
    if (this.selectedService === service) {
      this.clearServiceFilter();
      return;
    }
    this.selectedService = service;
    this.selectedServicePoste = null; // ✅ NOUVEAU — reset le sous-filtre poste en changeant de secteur
    this.loadServiceData(); // ✅ MODIFIÉ — respecte maintenant dateDebut/dateFin
  }

  // ✅ NOUVEAU — sous-filtre poste (1ere/2eme) pour un secteur sélectionné
  selectServicePoste(poste: '1ere poste' | '2eme poste'): void {
    this.selectedServicePoste = this.selectedServicePoste === poste ? null : poste;
    if (this.serviceRawData) {
      this.applyServiceFilter(this.serviceRawData);
    }
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
        this.serviceRawData = data; // ✅ NOUVEAU — cache pour le sous-filtre poste
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

  // ✅ MODIFIÉ — filtre aussi par poste si un sous-filtre poste est actif
  private applyServiceFilter(data: PresenceEmployeeData): void {
    if (!this.selectedService) return;

    const gardePoste = (item: { poste?: string | null }) =>
      !this.selectedServicePoste || item.poste === this.selectedServicePoste;

    const presents = data.presents.filter(
      (p) => p.service === this.selectedService && gardePoste(p)
    ) as unknown as Present[];

    const absents = data.absents.filter(
      (a) => a.service === this.selectedService && gardePoste(a)
    ) as unknown as Absent[];

    // ✅ NOUVEAU — filtrer aussi la liste en congé/justifié par service
    const enConge = (data.enConge || []).filter(
      (c) => c.service === this.selectedService && gardePoste(c)
    ) as unknown as EnConge[];

    this.data = { total: presents.length + absents.length + enConge.length, presents, absents, enConge };
    this.computeStats(this.data);
  }

  // ✅ MODIFIÉ — repart sur l'endpoint ouvrier en respectant la période en cours
  clearServiceFilter(): void {
    this.selectedService = null;
    this.selectedServicePoste = null; // ✅ NOUVEAU
    this.serviceRawData = null; // ✅ NOUVEAU

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
      list = [
        ...(this.data?.presents || []),
        ...(this.data?.absents || []),
        ...(this.data?.enConge || []), // ✅ NOUVEAU
      ];
    } else if (this.filterTab === 'presents') {
      list = this.data?.presents || [];
    } else if (this.filterTab === 'absents') {
      list = this.data?.absents || [];
    } else {
      // ✅ NOUVEAU — onglet "En congé"
      list = this.data?.enConge || [];
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

  // ✅ NOUVEAU — libellé FR lisible pour un statut manuel
  statutLabel(statut: string): string {
    return STATUT_LABELS[statut] || statut;
  }

  // ✅ NOUVEAU — la ligne fait-elle partie de la catégorie "en congé" ?
  estEnConge(statut: string): boolean {
    return statut !== 'present' && statut !== 'absent';
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
    this.loadPosteRings(); // ✅ NOUVEAU
    this.loadServiceRings(); // ✅ NOUVEAU — anneaux services

    // ✅ NOUVEAU — si accès limité, toujours rester en mode Ouvrier
    if (this.hasLimitedAccess) {
      if (this.selectedPoste) {
        this.selectPoste(this.selectedPoste);
      } else {
        this.load();
      }
      return;
    }

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
    this.loadPosteRings(); // ✅ NOUVEAU
    this.loadServiceRings(); // ✅ NOUVEAU — anneaux services

    // ✅ NOUVEAU — si accès limité, toujours rester en mode Ouvrier
    if (this.hasLimitedAccess) {
      if (this.selectedPoste) {
        this.selectPoste(this.selectedPoste);
      } else {
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
      return;
    }

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

  // ════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — "Récup Production" : récap planifié vs déclaré par
  // ligne:référence, pour une date précise (total + détail par poste)
  // ════════════════════════════════════════════════════════════════

  openRecupProduction(): void {
  this.showRecupModal = true;
  this.recupDate = new Date().toISOString().split('T')[0];
  this.recupError = null;
  this.recupRows = [];
  this.recupSelected = null;
  this.recupCausePrincipale = null; // ✅ NOUVEAU
  this.fetchRecupProduction();
}
// ✅ NOUVEAU — classe CSS selon l'importance de la cause principale
recupCauseSeverityClass(pct: number): string {
  if (pct >= 30) return 'recup-cause-high';
  if (pct >= 10) return 'recup-cause-medium';
  return 'recup-cause-low';
}

  closeRecupModal(): void {
    this.showRecupModal = false;
  }

  // ✅ NOUVEAU — navigation liste ⇄ détail
  selectRecupRow(row: RecupLigneTotal): void {
  this.recupSelected = row;
  this.loadCausePrincipale(row.ligne); // ✅ NOUVEAU
}

private loadCausePrincipale(ligne: string): void {
  this.recupCausePrincipale = null;
  this.recupAutresCauses = []; // ✅ NOUVEAU
  this.recupCauses7MLoading = true;

  this.statsSvc.getStatsPeriode(this.recupDate, this.recupDate).subscribe({
    next: (resp) => {
      const stat = resp.statsParLigne?.find(s => s.ligne === ligne);
      const toutes = this.computeToutesLesCauses(stat?.causes7M); // ✅ MODIFIÉ
      this.recupCausePrincipale = toutes[0] || null;
      this.recupAutresCauses = toutes.slice(1); // ✅ NOUVEAU
      this.recupCauses7MLoading = false;
      this.cdr.markForCheck();
    },
    error: () => {
      this.recupCauses7MLoading = false;
      this.cdr.markForCheck();
    }
  });
}

private computeToutesLesCauses(causes?: Causes7MLigne): { label: string; pct: number }[] {
  if (!causes) return [];
  const entries = Object.entries(causes) as [string, { quantite: number; pourcentage: number }][];
  return entries
    .map(([key, val]) => ({ label: this.CAUSE_LABELS[key] || key, pct: val?.pourcentage ?? 0 }))
    .filter(c => c.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

  backToRecupList(): void {
  this.recupSelected = null;
  this.recupCausePrincipale = null; // ✅ NOUVEAU
}

  fetchRecupProduction(): void {
    if (!this.recupDate) return;

    const jour = this.getJourName(this.recupDate);
    if (!jour) {
      this.recupRows = [];
      this.recupError = 'Aucune planification le dimanche.';
      return;
    }

    this.recupLoading = true;
    this.recupError = null;
    this.recupRows = [];
    this.recupSelected = null; // ✅ NOUVEAU — revient à la liste à chaque nouvelle recherche

    this.semaineSvc.getSemainesForPlanning().subscribe({
      next: (response) => {
        const weeks = this.semaineSvc.parseWeeksFromAPI(response);
        const cible = this.recupDate;

        const semaine = weeks.find(w => {
          const debut = this.toDateOnly(w.startDate);
          const fin = this.toDateOnly(w.endDate);
          return cible >= debut && cible <= fin;
        });

        if (!semaine) {
          this.recupLoading = false;
          this.recupError = 'Aucune semaine trouvée pour cette date.';
          this.cdr.markForCheck();
          return;
        }

        this.semaineSvc.getPlanificationsForWeek(semaine.display).subscribe({
          next: (planifsResponse: any) => {
            const planifs: Planification[] = Array.isArray(planifsResponse)
              ? planifsResponse
              : (planifsResponse?.planifications || []);

            const duJour = planifs.filter(p => p.jour === jour);
            this.recupRows = this.groupPlanifications(duJour);

            if (this.recupRows.length === 0) {
              this.recupError = 'Aucune planification trouvée pour cette date.';
            }

            this.recupLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.recupLoading = false;
            this.recupError = 'Erreur lors du chargement des planifications.';
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.recupLoading = false;
        this.recupError = 'Erreur lors du chargement des semaines.';
        this.cdr.markForCheck();
      }
    });
  }

  // ✅ MODIFIÉ — regroupe désormais par LIGNE seule (toutes références cumulées)
  // et cumule poste1/poste2 séparément + un total.
  private groupPlanifications(items: Planification[]): RecupLigneTotal[] {
    const map = new Map<string, RecupLigneTotal>();

    items.forEach(p => {
      const key = p.ligne;
      if (!map.has(key)) {
        map.set(key, {
          ligne: p.ligne,
          poste1: { planifie: 0, declare: 0 },
          poste2: { planifie: 0, declare: 0 },
          totalPlanifie: 0,
          totalDeclare: 0,
        });
      }
      const row = map.get(key)!;

      // ✅ règle validée : qteModifiee si renseignée, sinon qtePlanifiee
      const planifie = p.qteModifiee || p.qtePlanifiee || 0;
      const declare = p.decProduction || 0;

      if (p.poste === 'poste2') {
        row.poste2.planifie += planifie;
        row.poste2.declare += declare;
      } else {
        // poste1 par défaut si le champ poste n'est pas renseigné
        row.poste1.planifie += planifie;
        row.poste1.declare += declare;
      }

      row.totalPlanifie += planifie;
      row.totalDeclare += declare;
    });

    return Array.from(map.values())
      .sort((a, b) => a.ligne.localeCompare(b.ligne));
  }

  // 'lundi' | 'mardi' | ... | null si dimanche (pas de planification)
  private getJourName(dateStr: string): string | null {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay(); // 0 = dimanche
    if (dayIndex === 0) return null;
    return this.JOURS[dayIndex];
  }

  // Formate une Date en 'YYYY-MM-DD' en heure LOCALE (évite le bug UTC
  // déjà rencontré ailleurs dans le projet avec toISOString()).
  private toDateOnly(d: Date | string): string {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ✅ NOUVEAU — classe CSS de couleur selon l'écart déclaré/planifié
  // ratio >= 100% → vert (objectif atteint)
  // ratio 70–99%  → orange (en dessous mais proche)
  // ratio < 70%   → rouge (écart important)
  // planifié = 0 et déclaré = 0 → gris (neutre, rien à signaler)
  recupEcartClass(row: RecupLigneTotal): string {
    if (row.totalPlanifie <= 0) {
      return row.totalDeclare > 0 ? 'ecart-ok' : 'ecart-neutre';
    }
    const ratio = row.totalDeclare / row.totalPlanifie;
    if (ratio >= 1) return 'ecart-ok';
    if (ratio >= 0.7) return 'ecart-warning';
    return 'ecart-danger';
  }

  // ✅ NOUVEAU — pourcentage déclaré / planifié pour une ligne (affiché dans l'en-tête de la carte)
  recupPct(row: RecupLigneTotal): number {
    if (row.totalPlanifie <= 0) return 0;
    return Math.round((row.totalDeclare / row.totalPlanifie) * 100);
  }

  get recupTotalPlanifie(): number {
    return this.recupRows.reduce((s, r) => s + r.totalPlanifie, 0);
  }

  get recupTotalDeclare(): number {
    return this.recupRows.reduce((s, r) => s + r.totalDeclare, 0);
  }
}