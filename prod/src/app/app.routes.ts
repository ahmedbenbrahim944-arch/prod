import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProdComponent } from './prod/prod.component';
import { PlanificationComponent } from './planification/planification.component';
import { Prod2Component } from './prod2/prod2.component';
import { ChoixComponent } from './choix/choix.component';
import { StatistiquesComponent } from './statistiques/statistiques.component';
import { MagasinComponent } from './magasin/magasin.component';
import { Statistiques1Component } from './statistiques1/statistiques1.component';
import { SelectionComponent } from './selection/selection.component';
import { Choix1Component } from './choix1/choix1.component';
import { PhaseComponent } from './phase/phase.component';
import { StatsComponent } from './stats/stats.component';
import { ListeComponent } from './liste/liste.component';
import { ListeProductiviteComponent } from './liste-productivite/liste-productivite.component';
import { NonconformiteComponent } from './nonconformite/nonconformite.component';
import { OuvrierComponent } from './ouvrier/ouvrier.component';
import { ProductionManagerComponent } from './production-manager/production-manager.component';
import { Stats1Component } from './stats1/stats1.component';
import { Planification1Component } from './planification1/planification1.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { authGuard } from './guards/auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard'; // ✅ Importer le nouveau guard
import { StatistiqueSelectionComponent } from './statistique-selection/statistique-selection.component';
import { Planification2Component } from './planification2/planification2.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { PlaquettesComponent } from './plaquettes/plaquettes.component';
import { PlaquettesStatsComponent } from './plaquettes-stats/plaquettes-stats.component';
import { Choix3Component } from './choix3/choix3.component';
import { Magasin1Component } from './magasin1/magasin1.component';
import { ScannerComponent } from './scanner/scanner.component';
import { Choix4Component } from './choix4/choix4.component';
import { AdminScanComponent } from './admin-scan/admin-scan.component';
import { Stats2Component } from './stats2/stats2.component';
import { AffectationComponent } from './affectation/affectation.component';
import { PointageComponent } from './pointage/pointage.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'planification', component: PlanificationComponent },
  { path: 'prod2', component: Prod2Component },
  { path: 'prod', component: ProdComponent },
  { path: 'choix', component: ChoixComponent },
  { path: 'stat', component: StatistiquesComponent },
  { path: 'magasin', component: MagasinComponent },
  { path: 'stat1', component: Statistiques1Component },
  { path: 'sele', component: SelectionComponent },
  { path: 'choix1', component: Choix1Component },
  { path: 'pha', component: PhaseComponent },
  { path: 'statP', component: StatsComponent },
  { path: 'list', component: ListeComponent },
  { path: 'listP', component: ListeProductiviteComponent },
  { path: 'sais', component: NonconformiteComponent },
  { path: 'ouvrier', component: OuvrierComponent },
  {
    path: 'production',
    component: ProductionManagerComponent,
  },
  {
    path: 'pause-history',
    loadComponent: () => import('./pause-history/pause-history.component')
      .then(m => m.PauseHistoryComponent)
  },
  { path: 'ecran', component: Stats1Component },
  { path: 'pl1', component: Planification1Component },
  { path: 'ad', component: AdminDashboardComponent },
  
  // ✅ NOUVELLE ROUTE POUR LE DASHBOARD TRACKING
  {
    path: 'admin/tracking',
    loadComponent: () => import('./tracking-dashboard/tracking-dashboard.component')
      .then(m => m.TrackingDashboardComponent),
    canActivate: [authGuard, SuperAdminGuard] // ✅ Protégé par les deux guards
  },
  { path: 'stats', component: StatistiqueSelectionComponent },
  { path: 'mod', component: Planification2Component },
  { path: 'lan', component: LandingPageComponent },
  { path: 'plaq', component: PlaquettesComponent },
  { path: 'statp', component: PlaquettesStatsComponent },
  { path: 'ch3', component: Choix3Component },
  { path: 'magasin1', component: Magasin1Component },
  { path: 'scan', component: ScannerComponent },
  { path: 'ch4', component: Choix4Component },
  { path: 'adscan', component: AdminScanComponent },
  { path: 'stat2', component: Stats2Component },
  { path: 'aff', component: AffectationComponent },
  { path: 'auto', component: PointageComponent },


];