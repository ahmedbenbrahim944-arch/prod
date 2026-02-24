import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  StatsService1, 
  ProductiviteOuvriersResponse,
  LigneProductivite
} from '../statistiques1/stats.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-liste-productivite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-productivite.component.html',
  styleUrls: ['./liste-productivite.component.css']
})
export class ListeProductiviteComponent implements OnInit, OnDestroy {
  
  // ============================================
  // PROPRIÉTÉS POUR LA PRODUCTIVITÉ DES OUVRIERS
  // ============================================
  
  // Chargement et affichage
  isLoadingProductivite: boolean = false;
  productiviteOuvriers: ProductiviteOuvriersResponse | null = null;
  
  // Dates
  dateDebutProductivite: string = '';
  dateFinProductivite: string = '';
  maxDate: string = '';
  
  // Filtrage
  champFiltre: string = '';
  valeurFiltre: string = '';
  minPourcentage: number = 0;
  maxPourcentage: number = 100;
  productiviteMin: number | null = null;
  productiviteMax: number | null = null;
  ligneSelectionnee: string | null = null;
  productiviteFiltree: LigneProductivite[] = [];
  
  // Tri
  productiviteSortDirection: 'asc' | 'desc' | null = null;
  productiviteDataSorted: LigneProductivite[] = [];
  
  // ============================================
  // PROPRIÉTÉS POUR LE DÉFILEMENT AUTOMATIQUE
  // ============================================
  
  private scrollInterval: any = null;
  private isUserInteracting: boolean = false;
  private scrollTimeout: any = null;
  
  // Propriétés pour le rechargement automatique
  private autoReloadTimer: any;
  private derniereDateChargee: string = '';
  
  // ============================================
  // CONSTRUCTOR & LIFECYCLE
  // ============================================
  
  constructor(
    private statsService: StatsService1,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // 1. Initialiser avec la date d'hier (en évitant dimanche)
    this.initialiserDatesHier();
    
    // 2. Charger immédiatement les stats
    this.chargerProductiviteOuvriers();
    
    // 3. Programmer le rechargement automatique à 10h00
    this.programmerRechargement10h();
  }
  
  ngOnDestroy(): void {
    this.stopAutoScroll();
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.autoReloadTimer) {
      clearInterval(this.autoReloadTimer);
    }
  }
  
  /**
   * Initialise avec le dernier jour ouvré (hier, sauf si hier est dimanche)
   */
  private initialiserDatesHier(): void {
    const today = new Date();
    let hier = new Date(today);
    hier.setDate(today.getDate() - 1);
    
    // Vérifier si hier est dimanche (0 = dimanche en JavaScript)
    while (hier.getDay() === 0) { // 0 = Dimanche
      console.log(`📅 ${this.formatDate(hier)} est un dimanche (pas de données), on prend la veille`);
      hier.setDate(hier.getDate() - 1);
    }
    
    const hierFormatted = this.formatDate(hier);
    
    this.dateDebutProductivite = hierFormatted;
    this.dateFinProductivite = hierFormatted;
    this.maxDate = this.formatDate(today);
    
    console.log(`📅 Dates initialisées: ${this.dateDebutProductivite} (${this.getNomJourSemaine(hier)})`);
  }

  /**
   * Formatte une date en YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Fonction utilitaire pour obtenir le nom du jour de la semaine
   */
  private getNomJourSemaine(date: Date): string {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return jours[date.getDay()];
  }

  /**
   * Programme le rechargement automatique à 10h00 pile
   * avec adaptation pour éviter les dimanches
   */
  private programmerRechargement10h(): void {
    const maintenant = new Date();
    
    // Calculer le prochain 10h00
    const prochain10h = new Date();
    prochain10h.setHours(10, 0, 0, 0); // 10:00:00.000
    
    // Si on est déjà après 10h aujourd'hui, programmer pour demain
    if (maintenant >= prochain10h) {
      prochain10h.setDate(prochain10h.getDate() + 1);
    }
    
    // Vérifier que le jour de rechargement n'est pas un dimanche
    // Si le prochain rechargement tombe un dimanche, on passe au lundi
    if (prochain10h.getDay() === 0) { // 0 = Dimanche
      console.log(`📅 ${this.formatDate(prochain10h)} est un dimanche, rechargement reporté au lundi`);
      prochain10h.setDate(prochain10h.getDate() + 1);
    }
    
    const tempsAttente = prochain10h.getTime() - maintenant.getTime();
    
    console.log(`⏰ Prochain rechargement automatique à 10h00 le ${this.formatDate(prochain10h)} (dans ${Math.round(tempsAttente / 1000 / 60)} minutes)`);
    
    // Programmer le rechargement
    setTimeout(() => {
      this.executerRechargement10h();
      
      // Puis re-programmer tous les jours à 10h00 (en évitant les dimanches)
      setInterval(() => {
        this.executerRechargement10h();
      }, 24 * 60 * 60 * 1000); // Toutes les 24h
      
    }, tempsAttente);
  }

  /**
   * Exécute le rechargement complet à 10h00 avec gestion des dimanches
   */
  private executerRechargement10h(): void {
    console.log('🕙 10h00 - DÉCLENCHEMENT DU RECHARGEMENT AUTOMATIQUE');
    
    // Vérifier si aujourd'hui est dimanche (ne devrait pas arriver avec notre logique)
    const aujourdhui = new Date();
    if (aujourdhui.getDay() === 0) {
      console.log('⚠️ Aujourd\'hui est dimanche, pas de rechargement automatique');
      return;
    }
    
    // 1. Retour à l'écran filtre
    this.productiviteOuvriers = null;
    
    // 2. Mise à jour des dates avec la logique anti-dimanche
    this.initialiserDatesHier();
    
    // 3. Petit délai pour que l'UI se mette à jour
    setTimeout(() => {
      // 4. Rechargement automatique des statistiques
      this.chargerProductiviteOuvriers();
      
      console.log('✅ Statistiques rechargées automatiquement à 10h00');
    }, 100);
  }

  /**
   * Surcharge de retour à la sélection avec réinitialisation
   */
  retourChoix(): void {
    this.productiviteOuvriers = null;
    this.reinitialiserFiltres();
    this.router.navigate(['/choix']); // Adaptez selon votre routing
  }

  /**
   * Réinitialiser manuellement (comme le bouton de réinitialisation)
   */
  reinitialiser(): void {
    this.initialiserDatesHier();
    this.productiviteOuvriers = null;
    this.reinitialiserFiltres();
    
    // Recharger automatiquement
    this.chargerProductiviteOuvriers();
    
    const date = new Date(this.dateDebutProductivite);
    console.log(`🔄 Réinitialisation manuelle avec ${this.dateDebutProductivite} (${this.getNomJourSemaine(date)})`);
  }
  
  // ============================================
  // MÉTHODES DE CHARGEMENT
  // ============================================
  
  /**
   * Charger la productivité des ouvriers
   */
  chargerProductiviteOuvriers(): void {
    if (!this.dateDebutProductivite || !this.dateFinProductivite) {
      alert('Veuillez sélectionner une date de début et une date de fin');
      return;
    }

    if (new Date(this.dateDebutProductivite) > new Date(this.dateFinProductivite)) {
      alert('La date de début doit être antérieure à la date de fin');
      return;
    }

    // Vérification supplémentaire : ne pas charger si c'est un dimanche
    const dateDebut = new Date(this.dateDebutProductivite);
    if (dateDebut.getDay() === 0) {
      console.warn('⚠️ Tentative de chargement pour un dimanche, ajustement automatique');
      this.initialiserDatesHier();
      // Recharger avec les nouvelles dates
      this.chargerProductiviteOuvriers();
      return;
    }

    this.isLoadingProductivite = true;

    this.statsService.getProductiviteOuvriers(this.dateDebutProductivite, this.dateFinProductivite).subscribe({
      next: (response) => {
        console.log('✅ Réponse brute du backend:', response);
        
        let tableauData: LigneProductivite[] = [];
        
        // Extraire les données selon la structure
        if (response.tableau && Array.isArray(response.tableau)) {
          tableauData = response.tableau;
        } else if (response.donneesFormatees?.lignes && Array.isArray(response.donneesFormatees.lignes)) {
          tableauData = response.donneesFormatees.lignes;
        }
        
        // Créer un nouvel objet avec le tableau
        const responseAvecTableau: ProductiviteOuvriersResponse = {
          ...response,
          tableau: tableauData
        };
        
        // Si pas de statistiques, créer des statistiques minimales
        if (!responseAvecTableau.statistiques && tableauData.length > 0) {
          const totalHeures = tableauData.reduce((total, ligne) => total + (ligne["N°HEURS"] || 0), 0);
          const productiviteMoyenne = tableauData.reduce((sum, ligne) => sum + (ligne.PRODUCTIVITE || 0), 0) / tableauData.length;
          const matriculesUniques = new Set(tableauData.map(l => l.MAT)).size;
          
          responseAvecTableau.statistiques = {
            periode: {
              dateDebut: this.dateDebutProductivite,
              dateFin: this.dateFinProductivite,
              joursTotal: 1
            },
            resume: {
              nombreOuvriers: matriculesUniques,
              nombreRapports: tableauData.length,
              nombreJoursCouverts: 1,
              totalHeures: totalHeures,
              productiviteMoyenneGenerale: productiviteMoyenne
            },
            repartitionParLigne: {},
            causes5MTotales: {
              totaux: { M1: 0, M2: 0, M3: 0, M4: 0, M5: 0, M6: 0, M7: 0 },
              moyennes: { M1: 0, M2: 0, M3: 0, M4: 0, M5: 0, M6: 0, M7: 0 },
              nombreLignesAvecCauses: 0
            },
            verificationTotaux: {
              statistiquesVerif: [],
              resume: {
                totalLignesVerifiees: 0,
                lignesValides: 0,
                lignesInvalides: 0,
                tauxValidite: 100
              }
            }
          };
        }
        
        this.productiviteOuvriers = responseAvecTableau;
        this.isLoadingProductivite = false;
        
        console.log('✅ Productivité ouvriers chargée:', this.productiviteOuvriers);
        console.log('✅ Nombre de lignes dans le tableau:', this.productiviteOuvriers?.tableau?.length);
        
        // ✅ Réinitialiser les filtres après chargement
        this.reinitialiserFiltres();
        
        // ✅ Démarrer le défilement automatique après un court délai
        setTimeout(() => {
          const tableauContainer = document.querySelector('.tableau-container');
          if (tableauContainer) {
            tableauContainer.scrollTop = 0;
          }
          this.startAutoScroll();
        }, 100);
      },
      error: (error) => {
        console.error('❌ Erreur chargement productivité:', error);
        this.isLoadingProductivite = false;
        alert('Erreur lors du chargement de la productivité des ouvriers');
      }
    });
  }

  // ✅ Méthode pour réinitialiser les filtres
  reinitialiserFiltres(): void {
    this.champFiltre = '';
    this.valeurFiltre = '';
    this.ligneSelectionnee = null;
    this.productiviteMin = null;
    this.productiviteMax = null;
    this.productiviteFiltree = [];
    this.productiviteSortDirection = null;
    this.productiviteDataSorted = [];
    
    // Réinitialiser le scroll et redémarrer le défilement
    setTimeout(() => {
      const tableauContainer = document.querySelector('.tableau-container');
      if (tableauContainer) {
        tableauContainer.scrollTop = 0;
      }
      this.isUserInteracting = false;
      this.startAutoScroll();
    }, 100);
  }

  // ✅ Vérifier si un filtre est actif
  get hasActiveFilter(): boolean {
    return !!(this.valeurFiltre || 
              this.ligneSelectionnee || 
              this.productiviteMin !== null || 
              this.productiviteMax !== null);
  }

  // ✅ Calculer le total des heures
  private calculerTotalHeures(tableau: LigneProductivite[]): number {
    return tableau.reduce((total, ligne) => total + (ligne["N°HEURS"] || 0), 0);
  }

  // ✅ Calculer la productivité moyenne
  private calculerProductiviteMoyenne(tableau: LigneProductivite[]): number {
    if (tableau.length === 0) return 0;
    const total = tableau.reduce((sum, ligne) => sum + (ligne.PRODUCTIVITE || 0), 0);
    return total / tableau.length;
  }
  
  // ============================================
  // MÉTHODES DE NAVIGATION
  // ============================================
  
  /**
   * Retour à la page précédente
   */
  /* retourChoix déjà défini plus haut */
  
  // ============================================
  // MÉTHODES DE FILTRAGE
  // ============================================
  
  /**
   * Obtenir les lignes uniques pour le filtre
   */
  get lignesUniques(): string[] {
    if (!this.productiviteOuvriers?.tableau) return [];
    
    const lignes = new Set(this.productiviteOuvriers.tableau.map(l => l.LIGNES));
    return Array.from(lignes).sort();
  }
  
  /**
   * Réinitialiser le champ de recherche quand on change le champ de filtre
   */
  onChampFiltreChange(): void {
    this.valeurFiltre = '';
    this.appliquerFiltre();
  }
  
  /**
   * Appliquer le filtre
   */
  appliquerFiltre(): void {
    if (!this.productiviteOuvriers?.tableau) {
      this.productiviteFiltree = [];
      return;
    }
    
    let donnees = [...this.productiviteOuvriers.tableau];
    
    // Filtre par ligne
    if (this.ligneSelectionnee) {
      donnees = donnees.filter(ligne => ligne.LIGNES === this.ligneSelectionnee);
    }
    
    // Filtre par productivité
    if (this.productiviteMin !== null || this.productiviteMax !== null) {
      const min = this.productiviteMin ?? 0;
      const max = this.productiviteMax ?? 100;
      donnees = donnees.filter(ligne => 
        ligne.PRODUCTIVITE >= min && 
        ligne.PRODUCTIVITE <= max
      );
    }
    
    // Pas de filtre par champ ET valeur
    if (!this.champFiltre && !this.valeurFiltre) {
      this.productiviteFiltree = [...donnees];
      this.productiviteDataSorted = [];
      // Réinitialiser le tri si pas de filtre
      this.productiviteSortDirection = null;
      
      // Réinitialiser le scroll et redémarrer le défilement
      setTimeout(() => {
        const tableauContainer = document.querySelector('.tableau-container');
        if (tableauContainer) {
          tableauContainer.scrollTop = 0;
        }
        this.isUserInteracting = false;
        this.startAutoScroll();
      }, 100);
      
      return;
    }
    
    // Appliquer le filtre par champ/valeur
    this.productiviteFiltree = donnees.filter(ligne => {
      // Si pas de champ spécifique, chercher dans tous les champs
      if (!this.champFiltre) {
        const valeurRecherche = this.valeurFiltre.toLowerCase();
        return (
          ligne.JOURS.toLowerCase().includes(valeurRecherche) ||
          ligne.MAT.toString().includes(valeurRecherche) ||
          ligne["NOM ET PRENOM"].toLowerCase().includes(valeurRecherche) ||
          ligne["N°HEURS"].toString().includes(valeurRecherche) ||
          ligne.LIGNES.toLowerCase().includes(valeurRecherche) ||
          ligne.PRODUCTIVITE.toString().includes(valeurRecherche) ||
          ligne.M1.toString().includes(valeurRecherche) ||
          ligne.M2.toString().includes(valeurRecherche) ||
          ligne.M3.toString().includes(valeurRecherche) ||
          ligne.M4.toString().includes(valeurRecherche) ||
          ligne.M5.toString().includes(valeurRecherche) ||
          ligne.M6.toString().includes(valeurRecherche) ||
          ligne.M7.toString().includes(valeurRecherche) ||
          (ligne["PRODUCTIVITE MOYENNE"] && ligne["PRODUCTIVITE MOYENNE"].toString().includes(valeurRecherche)) ||
          (ligne.NOTE && ligne.NOTE.toLowerCase().includes(valeurRecherche))
        );
      }
      
      // Recherche dans un champ spécifique
      const valeurRecherche = this.valeurFiltre.toLowerCase();
      switch (this.champFiltre) {
        case 'JOURS':
          return ligne.JOURS.toLowerCase().includes(valeurRecherche);
        case 'MAT':
          return ligne.MAT.toString().includes(valeurRecherche);
        case 'NOM_ET_PRENOM':
          return ligne["NOM ET PRENOM"].toLowerCase().includes(valeurRecherche);
        case 'N_HEURES':
          return ligne["N°HEURS"].toString().includes(valeurRecherche);
        case 'LIGNES':
          return ligne.LIGNES.toLowerCase().includes(valeurRecherche);
        case 'PRODUCTIVITE':
          return ligne.PRODUCTIVITE.toString().includes(valeurRecherche);
        case 'M1':
          return ligne.M1.toString().includes(valeurRecherche);
        case 'M2':
          return ligne.M2.toString().includes(valeurRecherche);
        case 'M3':
          return ligne.M3.toString().includes(valeurRecherche);
        case 'M4':
          return ligne.M4.toString().includes(valeurRecherche);
        case 'M5':
          return ligne.M5.toString().includes(valeurRecherche);
        case 'M6':
          return ligne.M6.toString().includes(valeurRecherche);
        case 'M7':
          return ligne.M7.toString().includes(valeurRecherche);
        case 'PRODUCTIVITE_MOYENNE':
          return ligne["PRODUCTIVITE MOYENNE"]?.toString().includes(valeurRecherche) || false;
        case 'NOTE':
          return ligne.NOTE?.toLowerCase().includes(valeurRecherche) || false;
        default:
          return false;
      }
    });
    
    // Réinitialiser le tri quand on applique un filtre
    this.productiviteSortDirection = null;
    this.productiviteDataSorted = [];
    
    // Réinitialiser le scroll et redémarrer le défilement
    setTimeout(() => {
      const tableauContainer = document.querySelector('.tableau-container');
      if (tableauContainer) {
        tableauContainer.scrollTop = 0;
      }
      this.isUserInteracting = false;
      this.startAutoScroll();
    }, 100);
  }
  
  /**
   * Réinitialiser tous les filtres
   */
  resetFilters(): void {
    this.reinitialiserFiltres();
  }
  
  // ============================================
  // MÉTHODES DE TRI
  // ============================================
  
  /**
   * Basculer le tri par productivité
   */
  toggleProductiviteSort(): void {
    if (this.productiviteSortDirection === null || this.productiviteSortDirection === 'desc') {
      this.productiviteSortDirection = 'asc';
      this.trierProductiviteCroissant();
    } else {
      this.productiviteSortDirection = 'desc';
      this.trierProductiviteDecroissant();
    }
    
    // Réinitialiser le scroll et redémarrer le défilement
    setTimeout(() => {
      const tableauContainer = document.querySelector('.tableau-container');
      if (tableauContainer) {
        tableauContainer.scrollTop = 0;
      }
      this.isUserInteracting = false;
      this.startAutoScroll();
    }, 100);
  }
  
  /**
   * Trier par productivité croissante
   */
  trierProductiviteCroissant(): void {
    let donnees = [];
    
    if (this.hasActiveFilter) {
      donnees = [...this.productiviteFiltree];
    } else {
      donnees = [...(this.productiviteOuvriers?.tableau || [])];
    }
    
    // Trier par productivité croissante
    this.productiviteDataSorted = donnees.sort((a, b) => {
      const aVal = a.PRODUCTIVITE || 0;
      const bVal = b.PRODUCTIVITE || 0;
      return aVal - bVal;
    });
  }
  
  /**
   * Trier par productivité décroissante
   */
  trierProductiviteDecroissant(): void {
    let donnees = [];
    
    if (this.hasActiveFilter) {
      donnees = [...this.productiviteFiltree];
    } else {
      donnees = [...(this.productiviteOuvriers?.tableau || [])];
    }
    
    // Trier par productivité décroissante
    this.productiviteDataSorted = donnees.sort((a, b) => {
      const aVal = a.PRODUCTIVITE || 0;
      const bVal = b.PRODUCTIVITE || 0;
      return bVal - aVal;
    });
  }
  
  // ============================================
  // MÉTHODES DE GESTION DU SCROLL AUTOMATIQUE
  // ============================================

  /**
   * Démarrer le défilement automatique
   */
  startAutoScroll(): void {
    // Nettoyer l'intervalle existant
    this.stopAutoScroll();
    
    // Démarrer un nouvel intervalle
    this.scrollInterval = setInterval(() => {
      this.scrollTable();
    }, 1000); // 5 secondes
  }

  /**
   * Arrêter le défilement automatique
   */
  stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  /**
   * Faire défiler le tableau
   */
  scrollTable(): void {
    // Ne pas défiler si l'utilisateur interagit
    if (this.isUserInteracting) {
      return;
    }
    
    const tableauContainer = document.querySelector('.tableau-container');
    if (tableauContainer) {
      const currentScroll = tableauContainer.scrollTop;
      const scrollHeight = tableauContainer.scrollHeight;
      const clientHeight = tableauContainer.clientHeight;
      
      // Si on est en bas, revenir en haut
      if (currentScroll + clientHeight >= scrollHeight - 10) {
        tableauContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Sinon, défiler vers le bas (hauteur d'une ligne environ)
        tableauContainer.scrollTo({
          top: currentScroll + 40, // 40px approximativement la hauteur d'une ligne
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Gérer le début de l'interaction utilisateur
   */
  onUserInteraction(): void {
    this.isUserInteracting = true;
    
    // Réactiver le défilement après 10 secondes d'inactivité
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    this.scrollTimeout = setTimeout(() => {
      this.isUserInteracting = false;
    }, 10000); // 10 secondes d'inactivité
  }
  
  // ============================================
  // MÉTHODES D'EXPORT
  // ============================================
  
  /**
   * Exporter en Excel
   */
  exporterExcel(): void {
    // Déterminer les données à exporter
    let donneesAExporter: LigneProductivite[] = [];
    
    if (this.hasActiveFilter) {
      // Exporter les données filtrées
      donneesAExporter = this.productiviteFiltree;
    } else {
      // Exporter toutes les données
      donneesAExporter = this.productiviteOuvriers?.tableau || [];
    }
    
    if (donneesAExporter.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }
    
    // Préparer les données pour l'export
    const donneesFormatees = donneesAExporter.map(ligne => ({
      'Date': new Date(ligne.JOURS).toLocaleDateString('fr-FR'),
      'Matricule': ligne.MAT,
      'Nom et Prénom': ligne['NOM ET PRENOM'],
      'N° Heures': ligne['N°HEURS'],
      'Ligne': ligne.LIGNES,
      'Productivité (%)': ligne.PRODUCTIVITE.toFixed(1),
      'M1 - Matière (%)': ligne.M1 > 0 ? ligne.M1.toFixed(1) : '-',
      'M2 - Méthode (%)': ligne.M2 > 0 ? ligne.M2.toFixed(1) : '-',
      'M3 - Maintenance (%)': ligne.M3 > 0 ? ligne.M3.toFixed(1) : '-',
      'M4 - Qualité (%)': ligne.M4 > 0 ? ligne.M4.toFixed(1) : '-',
      'M5 - Absence (%)': ligne.M5 > 0 ? ligne.M5.toFixed(1) : '-',
      'M6 - Rendement (%)': ligne.M6 > 0 ? ligne.M6.toFixed(1) : '-',
      'M7 - Environnement (%)': ligne.M7 > 0 ? ligne.M7.toFixed(1) : '-',
      'Productivité Moyenne': ligne['PRODUCTIVITE MOYENNE'] || '-',
      'Note': ligne.NOTE || '-'
    }));
    
    // Créer le workbook
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(donneesFormatees);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productivité Ouvriers');
    
    // Générer le nom du fichier
    const dateDebut = new Date(this.dateDebutProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const dateFin = new Date(this.dateFinProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const nomFichier = `Productivite_Ouvriers_${dateDebut}_au_${dateFin}.xlsx`;
    
    // Télécharger le fichier
    XLSX.writeFile(wb, nomFichier);
    
    console.log(`✅ Export Excel réussi: ${donneesAExporter.length} lignes exportées`);
  }
  
  /**
   * Exporter en CSV
   */
  exporterCSV(): void {
    // Déterminer les données à exporter
    let donneesAExporter: LigneProductivite[] = [];
    
    if (this.hasActiveFilter) {
      // Exporter les données filtrées
      donneesAExporter = this.productiviteFiltree;
    } else {
      // Exporter toutes les données
      donneesAExporter = this.productiviteOuvriers?.tableau || [];
    }
    
    if (donneesAExporter.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }
    
    // Préparer les en-têtes
    const entetes = [
      'Date',
      'Matricule',
      'Nom et Prénom',
      'N° Heures',
      'Ligne',
      'Productivité (%)',
      'M1 - Matière (%)',
      'M2 - Méthode (%)',
      'M3 - Maintenance (%)',
      'M4 - Qualité (%)',
      'M5 - Absence (%)',
      'M6 - Rendement (%)',
      'M7 - Environnement (%)',
      'Productivité Moyenne',
      'Note'
    ];
    
    // Préparer les lignes
    const lignesCSV = donneesAExporter.map(ligne => [
      new Date(ligne.JOURS).toLocaleDateString('fr-FR'),
      ligne.MAT,
      `"${ligne['NOM ET PRENOM']}"`, // Échapper les guillemets pour les noms avec virgules
      ligne['N°HEURS'],
      ligne.LIGNES,
      ligne.PRODUCTIVITE.toFixed(1),
      ligne.M1 > 0 ? ligne.M1.toFixed(1) : '-',
      ligne.M2 > 0 ? ligne.M2.toFixed(1) : '-',
      ligne.M3 > 0 ? ligne.M3.toFixed(1) : '-',
      ligne.M4 > 0 ? ligne.M4.toFixed(1) : '-',
      ligne.M5 > 0 ? ligne.M5.toFixed(1) : '-',
      ligne.M6 > 0 ? ligne.M6.toFixed(1) : '-',
      ligne.M7 > 0 ? ligne.M7.toFixed(1) : '-',
      ligne['PRODUCTIVITE MOYENNE'] || '-',
      ligne.NOTE || '-'
    ].join(';'));
    
    // Créer le contenu CSV
    const csvContent = [
      entetes.join(';'),
      ...lignesCSV
    ].join('\n');
    
    // Créer le blob avec BOM pour Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Créer le lien de téléchargement
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Générer le nom du fichier
    const dateDebut = new Date(this.dateDebutProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const dateFin = new Date(this.dateFinProductivite).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const nomFichier = `Productivite_Ouvriers_${dateDebut}_au_${dateFin}.csv`;
    
    link.setAttribute('download', nomFichier);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`✅ Export CSV réussi: ${donneesAExporter.length} lignes exportées`);
  }

  // ============================================
  // GETTERS POUR LE TEMPLATE
  // ============================================

  /**
   * Vérifie si des données de productivité sont disponibles
   */
  get hasProductiviteData(): boolean {
    return !!this.productiviteOuvriers?.tableau?.length;
  }

  /**
   * Obtient les données de productivité (safe)
   */
  get safeProductiviteTableau(): LigneProductivite[] {
    return this.productiviteOuvriers?.tableau || [];
  }

  /**
   * Obtient les statistiques de productivité (safe)
   */
  get safeProductiviteStats(): any {
    return this.productiviteOuvriers?.statistiques?.resume || {};
  }
  
  getProd(ligne: LigneProductivite): number {
    const val = ligne.PRODUCTIVITE ?? 0;
    return val === 0 ? 100 : val;
  }

  /**
   * Couleur selon la productivité réelle (après conversion 0→100)
   */
  getColorForProductivite(productivite: number): string {
    const real = productivite === 0 ? 100 : productivite;
    if (real >= 90) return '#00e5a0'; // vert
    if (real >= 70) return '#4db8ff'; // bleu
    return '#ff8c42';                 // orange
  }
}