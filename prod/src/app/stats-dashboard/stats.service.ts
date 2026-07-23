import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StatsKpis {
  effectifSuivi: number;
  tauxAbsenteisme: number;
  totalJoursAbsent: number;
  absencesNonJustifiees: number;
  joursSansStatut: number;
  joursCongePoses: number;
  personnesEnConge: number;
  enAttenteJustification: number;
}

export interface RepartitionType { statut: string; label: string; count: number; }
export interface RepartitionGroupe { groupe: string; total: number; tauxAbsence: number; }
export interface Recurrence { matricule: string; nomPrenom: string; groupe: string; occurrences: number; }
export interface TendanceJour { jour: string; tauxAbsence: number; }

export interface StatsDashboard {
  periode: { dateDebut: string; dateFin: string; nbJours: number };
  kpis: StatsKpis;
  tendance: TendanceJour[];
  repartitionParType: RepartitionType[];
  repartitionParGroupe: RepartitionGroupe[];
  recurrences: Recurrence[];
}

export interface FicheTimelineJour { jour: string; etat: string; }
export interface FichePersonne {
  matricule: string;
  nomPrenom: string;
  groupe: string;
  periode: { dateDebut: string; dateFin: string };
  resume: {
    joursPresent: number;
    joursAbsentNonJustifie: number;
    joursJustifies: number;
    tauxPresence: number;
  };
  timeline: FicheTimelineJour[];
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private api = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    });
  }

   getDashboard(dateDebut: string, dateFin: string, service?: string): Observable<StatsDashboard> {
    const params: any = { debut: dateDebut, fin: dateFin };
    if (service && service !== 'tous') params.service = service;
    return this.http.get<StatsDashboard>(
      `${this.api}/pointage/stats-dashboard`,
      { headers: this.headers(), params },
    );
  }

  getFiche(matricule: string, dateDebut: string, dateFin: string): Observable<FichePersonne> {
    return this.http.get<FichePersonne>(
      `${this.api}/pointage/fiche-personne`,
      { headers: this.headers(), params: { matricule, debut: dateDebut, fin: dateFin } },
    );
  }
}