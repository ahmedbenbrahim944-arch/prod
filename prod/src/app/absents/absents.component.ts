// src/absents/absents.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AbsentsService, AbsentOuvrier, AbsentsResponse } from './absents.service';

@Component({
  selector: 'app-absents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './absents.component.html',
  styleUrls: ['./absents.component.css']
})
export class AbsentsComponent implements OnInit {

  // ── État ──────────────────────────────────────────────────────────────────
  dateDebut: string = '';
  dateFin: string = '';
  isLoading: boolean = false;
  erreur: string | null = null;
  donneesChargees: boolean = false;

  // ── Données brutes ────────────────────────────────────────────────────────
  absentsRaw: AbsentOuvrier[] = [];
  nombreAbsents: number = 0;

  // ── Filtres ───────────────────────────────────────────────────────────────
  filtreMatricule: string = '';
  filtreNomPrenom: string = '';
  filtreNomDocteur: string = '';

  // ── Gestion des saisies et sauvegardes ───────────────────────────────────
  saisiesDocteur: { [key: number]: string } = {};
  statutSauvegarde: { [key: number]: 'saving' | 'saved' | 'error' } = {};

  constructor(
    private absentsService: AbsentsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialiser avec la semaine en cours
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() - today.getDay() + 7); // Dimanche
    
    this.dateDebut = startOfWeek.toISOString().split('T')[0];
    this.dateFin = endOfWeek.toISOString().split('T')[0];
  }

  // ── Chargement par période ────────────────────────────────────────────────
  chargerAbsentsParPeriode(): void {
    if (!this.dateDebut || !this.dateFin) {
      this.erreur = 'Veuillez sélectionner une date début et une date fin.';
      return;
    }

    if (new Date(this.dateDebut) > new Date(this.dateFin)) {
      this.erreur = 'La date début doit être antérieure à la date fin.';
      return;
    }

    this.isLoading = true;
    this.erreur = null;
    this.donneesChargees = false;
    this.reinitialiserFiltres();
    
    // Réinitialiser les états de saisie
    this.saisiesDocteur = {};
    this.statutSauvegarde = {};

    this.absentsService.getAbsentsByPeriode(this.dateDebut, this.dateFin).subscribe({
      next: (response: AbsentsResponse) => {
        this.absentsRaw = response.absents;
        this.nombreAbsents = response.nombreAbsents;
        this.donneesChargees = true;
        this.isLoading = false;
        
        // Initialiser les saisies avec les valeurs existantes
        this.absentsRaw.forEach(absent => {
          if (absent.nomDocteur) {
            this.saisiesDocteur[absent.id] = absent.nomDocteur;
          }
        });
      },
      error: (err) => {
        console.error('Erreur chargement absents:', err);
        this.erreur = err.error?.message || 'Erreur lors du chargement des absents.';
        this.isLoading = false;
      }
    });
  }

  // ── Sauvegarde du nom du docteur ──────────────────────────────────────────
  sauvegarderDocteur(absent: AbsentOuvrier): void {
    const nouvelleValeur = this.saisiesDocteur[absent.id];
    
    if (!nouvelleValeur || nouvelleValeur === (absent.nomDocteur || '')) {
      if (!nouvelleValeur) {
        console.log('Veuillez saisir un nom de docteur');
      }
      return;
    }

    this.statutSauvegarde[absent.id] = 'saving';

    this.absentsService.updateNomDocteur(absent.id, nouvelleValeur).subscribe({
      next: (response) => {
        absent.nomDocteur = nouvelleValeur;
        this.statutSauvegarde[absent.id] = 'saved';
        
        setTimeout(() => {
          if (this.statutSauvegarde[absent.id] === 'saved') {
            delete this.statutSauvegarde[absent.id];
          }
        }, 2000);
      },
      error: (err) => {
        console.error('Erreur lors de la sauvegarde:', err);
        this.statutSauvegarde[absent.id] = 'error';
        
        setTimeout(() => {
          if (this.statutSauvegarde[absent.id] === 'error') {
            delete this.statutSauvegarde[absent.id];
          }
        }, 3000);
      }
    });
  }

  // ── Filtres ────────────────────────────────────────────────────────────────
  get absentsFiltres(): AbsentOuvrier[] {
    return this.absentsRaw.filter(absent => {
      const matchMatricule = !this.filtreMatricule ||
        absent.matricule.toString().includes(this.filtreMatricule.trim());

      const matchNom = !this.filtreNomPrenom ||
        absent.nomPrenom.toLowerCase().includes(this.filtreNomPrenom.toLowerCase().trim());

      const matchDocteur = !this.filtreNomDocteur ||
        (absent.nomDocteur ?? '').toLowerCase().includes(this.filtreNomDocteur.toLowerCase().trim());

      return matchMatricule && matchNom && matchDocteur;
    });
  }

  reinitialiserFiltres(): void {
    this.filtreMatricule = '';
    this.filtreNomPrenom = '';
    this.filtreNomDocteur = '';
  }

  get aucunResultatApresFiltre(): boolean {
    return this.donneesChargees && this.absentsFiltres.length === 0 && this.absentsRaw.length > 0;
  }

  get aFiltresActifs(): boolean {
    return !!(this.filtreMatricule || this.filtreNomPrenom || this.filtreNomDocteur);
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────
  goBack(): void {
    history.back();
  }

  formaterDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formaterDateCourte(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  }
  // ── KPI helpers ────────────────────────────────────────────────────────────

getMoisCouverts(): number {
  if (!this.dateDebut || !this.dateFin) return 0;
  const debut = new Date(this.dateDebut);
  const fin = new Date(this.dateFin);
  const mois =
    (fin.getFullYear() - debut.getFullYear()) * 12 +
    (fin.getMonth() - debut.getMonth()) + 1;
  return Math.max(1, mois);
}

getSansDocteur(): number {
  return this.absentsRaw.filter(a => !a.nomDocteur).length;
}
}