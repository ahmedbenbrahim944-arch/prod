import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListeService, ProductiviteOuvrier } from './liste.service';

@Component({
  selector: 'app-liste',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste.component.html',
  styleUrls: ['./liste.component.css']
})
export class ListeComponent {
  // État de la vue (filtre ou tableau)
  showFiltre: boolean = true;
  
  // Données du filtre
  dateDebut: string = '';
  dateFin: string = '';
  errorMessage: string = '';
  
  // Données du tableau
  data: ProductiviteOuvrier[] = [];
  loading: boolean = false;

  constructor(private listeService: ListeService) {}

  /**
   * Valide les dates saisies
   */
  validerDates(): boolean {
    this.errorMessage = '';

    if (!this.dateDebut || !this.dateFin) {
      this.errorMessage = 'Veuillez renseigner les deux dates';
      return false;
    }

    const debut = new Date(this.dateDebut);
    const fin = new Date(this.dateFin);

    if (debut > fin) {
      this.errorMessage = 'La date de début doit être antérieure à la date de fin';
      return false;
    }

    return true;
  }

  /**
   * Applique le filtre et affiche le tableau
   */
appliquerFiltre(): void {
  if (!this.validerDates()) {
    return;
  }

  this.loading = true;
  console.log('🔍 Appel API avec:', { dateDebut: this.dateDebut, dateFin: this.dateFin });
  
  this.listeService.getProductiviteOuvriers(this.dateDebut, this.dateFin).subscribe({
    next: (data) => {
      console.log('✅ Données reçues dans le component:', data);
      console.log('📊 Type des données:', typeof data);
      console.log('📊 Est un tableau?', Array.isArray(data));
      console.log('📊 Nombre d\'ouvriers:', data.length);
      
      if (data.length === 0) {
        console.log('⚠️ Tableau vide reçu, vérifiez les logs du service');
      } else {
        console.log('🔍 Premier élément:', data[0]);
        console.log('🔍 Structure du premier élément:', JSON.stringify(data[0], null, 2));
      }
      
      this.data = data;
      this.loading = false;
      this.showFiltre = false;
    },
    error: (error) => {
      console.error('❌ Erreur:', error);
      this.errorMessage = `Erreur: ${error.status} - ${error.statusText || 'Impossible de récupérer les données'}`;
      this.loading = false;
      this.data = [];
    }
  });
}
  /**
   * Retourne à la vue filtre
   */
  retourFiltre(): void {
    this.showFiltre = true;
  }

  /**
   * Réinitialise le formulaire
   */
  reinitialiser(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.errorMessage = '';
  }

  /**
   * Formate la date pour l'affichage
   */
  formatDate(date: string | undefined | null): string {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return date;
    }
  }

  /**
   * Formate un nombre avec pourcentage
   */
  formatPourcentage(value: number | undefined | null): string {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(1)}%`;
  }

  /**
   * Affiche la valeur ou un tiret si vide
   */
  afficherValeur(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    return value.toString();
  }

  /**
   * Récupère une valeur en essayant plusieurs clés possibles
   */
  getValue(row: any, keys: string[]): any {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return row[key];
      }
    }
    return null;
  }


}