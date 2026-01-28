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
  
];