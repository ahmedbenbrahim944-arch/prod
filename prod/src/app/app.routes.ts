// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProdComponent } from './prod/prod.component';
import { PlanificationComponent } from './planification/planification.component';
import { Prod2Component } from './prod2/prod2.component';
import { ChoixComponent } from './choix/choix.component';
import { StatistiquesComponent } from './statistiques/statistiques.component';
import { MagasinComponent } from './magasin/magasin.component';
import { Statistiques1Component } from './statistiques1/statistiques1.component';
import { Magasin1Component } from './magasin1/magasin1.component';
import { SelectionComponent } from './selection/selection.component';
import { Choix1Component } from './choix1/choix1.component';
import { PhaseComponent } from './phase/phase.component';
import { StatsComponent } from './stats/stats.component';
import { ListeComponent } from './liste/liste.component';
import { ListeProductiviteComponent } from './liste-productivite/liste-productivite.component';
import { NonconformiteComponent } from './nonconformite/nonconformite.component';
import { Choix2Component } from './choix2/choix2.component';
import { OuvrierComponent } from './ouvrier/ouvrier.component';
import { Stats1Component } from './stats1/stats1.component';
import { ProductionManagerComponent } from './production-manager/production-manager.component';
import { Planification1Component } from './planification1/planification1.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';


export const routes: Routes = [
  { path: '', component:LoginComponent },
  { path: 'planification', component: PlanificationComponent },
  { path: 'prod2', component: Prod2Component },
  { path: 'login', component: LoginComponent },
  { path: 'prod', component: ProdComponent },
  { path: 'choix', component: ChoixComponent },
  { path: 'stat', component: StatistiquesComponent },
  { path: 'magasin', component: MagasinComponent },
  { path: 'stat1', component: Statistiques1Component },
  { path: 'mag1', component: Magasin1Component },
  { path: 'sele', component: SelectionComponent },
 { path: 'choix1', component: Choix1Component },
  { path: 'pha', component: PhaseComponent }, 
  { path: 'statP', component: StatsComponent },
  { path: 'list', component: ListeComponent },
  { path: 'listP', component: ListeProductiviteComponent },
  { path: 'sais', component: NonconformiteComponent},
  { path: 'ch2', component: Choix2Component},
  { path: 'ouvrier', component: OuvrierComponent },
{ path: 'ecran', component: Stats1Component },
{
    path: 'production',
    component: ProductionManagerComponent,
    // Ajoutez un guard d'authentification si nécessaire
    // canActivate: [authGuard]
  },
  {
    path: 'pause-history',
    loadComponent: () => import('./pause-history/pause-history.component')
      .then(m => m.PauseHistoryComponent)
    // Page séparée pour l'historique des pauses (à créer)
  },
  { path: 'pl1', component: Planification1Component },
  { path: 'ad', component: AdminDashboardComponent },


  
];