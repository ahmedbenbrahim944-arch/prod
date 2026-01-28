// src/statut/statut.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In ,FindOperator,MoreThanOrEqual,LessThanOrEqual } from 'typeorm';
import { StatutOuvrier } from './entities/statut-ouvrier.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { PlanningSelection } from '../planning-selection/entities/planning-selection.entity';
import { UpdateStatutDto } from './dto/update-statut.dto';
import { GetStatutByDateDto } from './dto/get-statut-by-date.dto';


@Injectable()
export class StatutService {
  constructor(
    @InjectRepository(StatutOuvrier)
    private statutOuvrierRepository: Repository<StatutOuvrier>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    @InjectRepository(PlanningSelection)
    private planningSelectionRepository: Repository<PlanningSelection>,
  ) {}

  /**
   *
   * Méthode utilitaire pour convertir une date en semaine et jour
   * (à réutiliser depuis votre StatsService existant)
   */
  private convertirDateEnSemaineEtJour(dateStr: string): { semaine: string; jour: string } {
    try {
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Date invalide: ${dateStr}`);
      }

      // Méthode pour calculer la semaine ISO
      const getISOWeeks = (d: Date) => {
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
          target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      };

      const numeroSemaine = getISOWeeks(date);
      const semaine = `semaine${numeroSemaine}`;
      
      const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const jour = joursMap[date.getDay()];

      return { semaine, jour };
    } catch (error) {
      throw new BadRequestException(`Erreur lors de la conversion de la date: ${error.message}`);
    }
  }

  /**
   * Calculer le numéro de semaine (entier) à partir d'une date
   */
  private calculerNumeroSemaine(dateStr: string): number {
    try {
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Date invalide: ${dateStr}`);
      }

      const getISOWeek = (d: Date) => {
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
          target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      };

      return getISOWeek(date);
    } catch (error) {
      throw new BadRequestException(`Erreur lors du calcul de la semaine: ${error.message}`);
    }
  }

  /**
   * 🆕 Créer automatiquement une entrée dans planning_selection quand statut = 'S'
   */
  private async creerPlanningSelectionAutomatique(
    matricule: number,
    nomPrenom: string,
    date: string
  ): Promise<void> {
    try {
      console.log(`🟢 Création automatique du planning selection pour matricule ${matricule}`);

      // Calculer le numéro de semaine
      const numeroSemaine = this.calculerNumeroSemaine(date);
      const { semaine: semaineNom } = this.convertirDateEnSemaineEtJour(date);

      // Vérifier si une entrée existe déjà pour cet ouvrier à cette date
      const planningExistant = await this.planningSelectionRepository.findOne({
        where: {
          matricule: matricule,
          date: date
        }
      });

      if (planningExistant) {
        console.log(`⚠️ Planning déjà existant pour ${matricule} à la date ${date}`);
        return;
      }

      // Créer une nouvelle entrée avec valeurs par défaut
      const nouveauPlanning = this.planningSelectionRepository.create({
        date: date,
        semaine: numeroSemaine,
        semaineNom: semaineNom,
        matricule: matricule,
        nomPrenom: nomPrenom,
        ligne: 'selection',
        reference: 'À définir',
        ligneRef: `selection-${matricule}-${date}`,
        typeReference: 'product',
        statut: 'en attente',
        numTicket: 'non num',
        qteASelectionne: 0,
        objectifHeure: 0,
        qteSelection: 0,
        rebut: 0,
        nHeures: 0,
        rendement: 0
      });

      await this.planningSelectionRepository.save(nouveauPlanning);

      console.log(`✅ Planning selection créé avec succès pour ${matricule} - ${nomPrenom}`);

    } catch (error) {
      console.error(`❌ Erreur lors de la création du planning selection:`, error);
      // On ne throw pas l'erreur pour ne pas bloquer la création du statut
      // On log simplement l'erreur
    }
  }

  /**
   * Mettre à jour automatiquement le statut à 'P' pour les ouvriers qui ont saisi
   * Cette méthode peut être appelée après chaque saisie de rapport
   */
  async mettreAJourStatutsAutomatiquesPourDate(date: string): Promise<void> {
    try {
      console.log(`=== MISE À JOUR AUTOMATIQUE DES STATUTS POUR ${date} ===`);

      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);

      // 1. Récupérer tous les rapports saisis pour cette date
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine, jour }
      });

      console.log(`Nombre de rapports saisis: ${rapports.length}`);

      if (rapports.length === 0) {
        console.log('Aucun rapport saisi, aucun statut à mettre à jour automatiquement');
        return;
      }

      // 2. Pour chaque rapport, mettre à jour ou créer un statut 'P'
      const operations = rapports.map(async (rapport) => {
        try {
          // Utiliser upsert pour créer ou mettre à jour
          await this.statutOuvrierRepository.upsert(
            {
              matricule: rapport.matricule as any,
              nomPrenom: rapport.nomPrenom,
              date: date,
              statut: 'P',
              commentaire: 'Saisie automatique - Ouvrier a saisi son rapport'
            },
            ['matricule', 'date'] // Clé unique : matricule + date
          );
          console.log(`Statut 'P' mis à jour pour ${rapport.matricule} - ${rapport.nomPrenom}`);
        } catch (error) {
          console.error(`Erreur lors de la mise à jour du statut pour ${rapport.matricule}:`, error);
        }
      });

      await Promise.all(operations);
      console.log(`=== FIN MISE À JOUR AUTOMATIQUE DES STATUTS ===`);

    } catch (error) {
      console.error(`Erreur dans mettreAJourStatutsAutomatiquesPourDate:`, error);
      throw new InternalServerErrorException(
        `Erreur lors de la mise à jour automatique des statuts: ${error.message}`
      );
    }
  }

  /**
   * Mettre à jour le statut d'un ouvrier manuellement (AB, C, S)
   * 🆕 Si statut = 'S', créer automatiquement une entrée dans planning_selection
   */
  async updateStatut(updateStatutDto: UpdateStatutDto) {
    const { matricule, date, statut, nomPrenom, commentaire } = updateStatutDto;

    console.log(`=== MISE À JOUR STATUT MANUEL ===`);
    console.log(`Matricule: ${matricule}, Date: ${date}, Statut: ${statut}`);

    try {
      // 1. Vérifier que l'ouvrier existe
      const ouvrier = await this.ouvrierRepository.findOne({
        where: { matricule: updateStatutDto.matricule as any  }
      });

      if (!ouvrier) {
        throw new NotFoundException(`Ouvrier avec matricule ${matricule} non trouvé`);
      }

      // 2. Vérifier que l'ouvrier n'a pas saisi de rapport pour cette date
      // (on ne peut pas mettre AB/C/S si l'ouvrier a saisi)
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      const rapport = await this.saisieRapportRepository.findOne({
        where: {
          matricule: updateStatutDto.matricule as any ,
          semaine,
          jour
        }
      });

      if (rapport) {
        throw new BadRequestException(
          `L'ouvrier ${matricule} a déjà saisi un rapport pour le ${date}. ` +
          `Le statut doit rester 'P' (Présent).`
        );
      }

      // 3. Mettre à jour ou créer le statut
      const statutExistant = await this.statutOuvrierRepository.findOne({
        where: { matricule: updateStatutDto.matricule as any, date }
      });

      let resultat;
      
      if (statutExistant) {
        // Mettre à jour le statut existant
        statutExistant.statut = statut;
        statutExistant.commentaire = commentaire || `Statut manuel: ${this.getLibelleStatut(statut)}`;
        resultat = await this.statutOuvrierRepository.save(statutExistant);
        console.log(`Statut mis à jour pour ${matricule}`);
      } else {
        // Créer un nouveau statut
        const nouveauStatut = this.statutOuvrierRepository.create({
          matricule: updateStatutDto.matricule as any,
          nomPrenom: nomPrenom || ouvrier.nomPrenom,
          date,
          statut,
          commentaire: commentaire || `Statut manuel: ${this.getLibelleStatut(statut)}`
        });
        resultat = await this.statutOuvrierRepository.save(nouveauStatut);
        console.log(`Nouveau statut créé pour ${matricule}`);
      }

      // 🆕 4. Si le statut est 'S' (Sélection), créer automatiquement une entrée dans planning_selection
      if (statut === 'S') {
        await this.creerPlanningSelectionAutomatique(
          resultat.matricule,
          resultat.nomPrenom,
          resultat.date
        );
      }

      // 5. Retourner la réponse formatée
      return {
        message: `Statut mis à jour avec succès pour ${resultat.nomPrenom}`,
        statut: {
          id: resultat.id,
          matricule: resultat.matricule,
          nomPrenom: resultat.nomPrenom,
          date: resultat.date,
          statut: resultat.statut,
          libelleStatut: this.getLibelleStatut(resultat.statut),
          commentaire: resultat.commentaire,
          createdAt: resultat.createdAt
        }
      };

    } catch (error) {
      console.error(`Erreur dans updateStatut:`, error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la mise à jour du statut: ${error.message}`
      );
    }
  }

  /**
   * Mettre à jour les statuts de plusieurs ouvriers en une seule requête
   */
  async updateStatutsEnMasse(statuts: UpdateStatutDto[]) {
    console.log(`=== MISE À JOUR DES STATUTS EN MASSE ===`);
    console.log(`Nombre de statuts à mettre à jour: ${statuts.length}`);

    try {
    const resultats: any[] = []; // ✅ Déclarer le type
    const erreurs: any[] = []; // ✅ Déclarer le type

    for (const statutDto of statuts) {
      try {
        const resultat = await this.updateStatut(statutDto);
        resultats.push(resultat);
      } catch (error: any) { // ✅ Spécifier le type de error
        erreurs.push({
          matricule: statutDto.matricule,
          erreur: error.message,
          statut: statutDto.statut
        });
      }
    }

      return {
        message: `Mise à jour en masse terminée`,
        statistiques: {
          total: statuts.length,
          reussis: resultats.length,
          erreurs: erreurs.length
        },
        resultats,
        erreurs: erreurs.length > 0 ? erreurs : undefined
      };

    } catch (error) {
      console.error(`Erreur dans updateStatutsEnMasse:`, error);
      throw new InternalServerErrorException(
        `Erreur lors de la mise à jour des statuts en masse: ${error.message}`
      );
    }
  }

  /**
   * Obtenir tous les statuts pour une date donnée
   */
 /**
 * Obtenir tous les statuts pour une date donnée
 */
async getStatutsByDate(getStatutByDateDto: GetStatutByDateDto) {
  const { date } = getStatutByDateDto;

  console.log(`=== RÉCUPÉRATION DES STATUTS POUR ${date} ===`);

  try {
    // Vérifier la validité de la date
    const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);

    // 1. Récupérer tous les ouvriers actifs
    const tousLesOuvriers = await this.ouvrierRepository.find({
      order: { nomPrenom: 'ASC' }
    });

    console.log(`Nombre total d'ouvriers actifs: ${tousLesOuvriers.length}`);

    if (tousLesOuvriers.length === 0) {
      return {
        message: 'Aucun ouvrier actif trouvé',
        date,
        ouvriers: [],
        statistiques: {
          totalOuvriers: 0,
          repartitionStatuts: {
            P: 0,
            AB: 0,
            C: 0,
            S: 0,
            nonDefini: 0
          }
        }
      };
    }

    // 2. Récupérer tous les rapports saisis pour cette date
    const rapportsSaisis = await this.saisieRapportRepository.find({
      where: { semaine, jour }
    });

    const matriculesAyantSaisi = new Set(
      rapportsSaisis.map(r => r.matricule)
    );

    console.log(`Nombre d'ouvriers ayant saisi: ${matriculesAyantSaisi.size}`);

    // 3. Récupérer tous les statuts pour cette date
    const statuts = await this.statutOuvrierRepository.find({
      where: { date },
      order: { createdAt: 'DESC' }
    });

    // Créer une map pour accès rapide
    const statutMap = new Map();
    statuts.forEach(statut => {
      statutMap.set(statut.matricule, {
        id: statut.id,
        statut: statut.statut,
        libelle: this.getLibelleStatut(statut.statut),
        commentaire: statut.commentaire,
        createdAt: statut.createdAt
      });
    });

    // 4. Créer la liste complète avec tous les ouvriers
    const ouvriersAvecStatut = tousLesOuvriers.map(ouvrier => {
      const aSaisi = matriculesAyantSaisi.has(ouvrier.matricule);
      const statutInfo = statutMap.get(ouvrier.matricule);
      
      // Déterminer le statut effectif
      let statutEffectif = statutInfo ? statutInfo.statut : null;
      
      // Si l'ouvrier a saisi, son statut est forcément 'P'
      if (aSaisi) {
        statutEffectif = 'P';
      }

      return {
        matricule: ouvrier.matricule,
        nomPrenom: ouvrier.nomPrenom,
        aSaisi,
        statut: statutEffectif,
        libelleStatut: statutEffectif ? this.getLibelleStatut(statutEffectif) : 'Non défini',
        commentaire: statutInfo ? statutInfo.commentaire : null,
        statutId: statutInfo ? statutInfo.id : null,
        date,
        semaine,
        jour,
        peutModifier: !aSaisi,
        statutOptions: aSaisi ? [] : [
          { code: 'AB', libelle: 'Absent', couleur: '#f44336' },
          { code: 'C', libelle: 'Congé', couleur: '#2196f3' },
          { code: 'S', libelle: 'Sélection', couleur: '#4caf50' }
        ]
      };
    });

    // ✅ 5. Calculer les statistiques avec le BON FORMAT
    const statistiques = {
      totalOuvriers: tousLesOuvriers.length,
      repartitionStatuts: {
        P: ouvriersAvecStatut.filter(o => o.statut === 'P').length,
        AB: ouvriersAvecStatut.filter(o => o.statut === 'AB').length,
        C: ouvriersAvecStatut.filter(o => o.statut === 'C').length,
        S: ouvriersAvecStatut.filter(o => o.statut === 'S').length,
        nonDefini: ouvriersAvecStatut.filter(o => o.statut === null).length
      }
    };

    return {
      message: `Statuts pour le ${date}`,
      date,
      jour,
      semaine,
      statistiques,
      ouvriers: ouvriersAvecStatut
    };

  } catch (error) {
    console.error(`Erreur dans getStatutsByDate:`, error);
    
    if (error instanceof BadRequestException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors de la récupération des statuts: ${error.message}`
    );
  }
}

  /**
   * Obtenir uniquement les ouvriers qui n'ont pas encore saisi de rapport
   * (donc qui peuvent recevoir un statut AB, C, ou S)
   */
  async getOuvriersNonSaisisParDate(date: string) {
    console.log(`=== OUVRIERS NON-SAISIS POUR ${date} ===`);

    try {
      // Vérifier la validité de la date
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);

      // 1. Récupérer tous les ouvriers actifs
      const tousLesOuvriers = await this.ouvrierRepository.find({
        
        order: { nomPrenom: 'ASC' }
      });

      console.log(`Nombre total d'ouvriers actifs: ${tousLesOuvriers.length}`);

      if (tousLesOuvriers.length === 0) {
        return {
          message: 'Aucun ouvrier actif trouvé',
          date,
          ouvriers: []
        };
      }

      // 2. Récupérer tous les rapports saisis pour cette date
      const rapportsSaisis = await this.saisieRapportRepository.find({
        where: { semaine, jour }
      });

      const matriculesAyantSaisi = new Set(
        rapportsSaisis.map(r => r.matricule)
      );

      console.log(`Nombre d'ouvriers ayant saisi: ${matriculesAyantSaisi.size}`);

      // 3. Filtrer pour ne garder que les ouvriers qui n'ont PAS saisi
      const ouvriersNonSaisis = tousLesOuvriers.filter(
        ouvrier => !matriculesAyantSaisi.has(ouvrier.matricule)
      );

      console.log(`Nombre d'ouvriers non-saisis: ${ouvriersNonSaisis.length}`);

      // 4. Si aucun ouvrier non-saisi
      if (ouvriersNonSaisis.length === 0) {
        return {
          message: `Tous les ouvriers ont saisi leur rapport pour le ${date}`,
          date,
          jour,
          semaine,
          nombreTotalOuvriers: tousLesOuvriers.length,
          nombreOuvriersSaisis: matriculesAyantSaisi.size,
          nombreOuvriersNonSaisis: 0,
          ouvriers: []
        };
      }

      // 5. Récupérer les statuts existants (AB, C, S) depuis la table statuts
      const matriculesNonSaisis = ouvriersNonSaisis.map(o => o.matricule);
      const statutsExistants = await this.statutOuvrierRepository.find({
        where: {
          matricule: In(matriculesNonSaisis),
          date: date
        }
      });

      // Créer une map pour accès rapide
      const statutMap = new Map();
      statutsExistants.forEach(statut => {
        statutMap.set(statut.matricule, {
          statut: statut.statut,
          libelle: this.getLibelleStatut(statut.statut),
          commentaire: statut.commentaire,
          id: statut.id
        });
      });

      // 6. Préparer la réponse
      const ouvriersFormates = ouvriersNonSaisis.map(ouvrier => {
        const statutInfo = statutMap.get(ouvrier.matricule);
        const statutActuel = statutInfo ? statutInfo.statut : null;
        
        return {
          matricule: ouvrier.matricule,
          nomPrenom: ouvrier.nomPrenom,
          statut: statutActuel,
          libelleStatut: statutActuel ? this.getLibelleStatut(statutActuel) : 'Non défini',
          commentaire: statutInfo ? statutInfo.commentaire : null,
          statutId: statutInfo ? statutInfo.id : null,
          aSaisi: false,
          date: date,
          semaine: semaine,
          jour: jour,
          // Options disponibles pour le statut (uniquement pour non-saisis)
          statutOptions: [
            { code: 'AB', libelle: 'Absent', couleur: '#f44336' },
            { code: 'C', libelle: 'Congé', couleur: '#2196f3' },
            { code: 'S', libelle: 'Sélection', couleur: '#4caf50' }
          ],
          // Pour l'interface frontend : indiquer si modifiable
          peutModifier: true // Toujours modifiable car non-saisi
        };
      });

      return {
        message: `Ouvriers non-saisis pour le ${date}`,
        date: date,
        jour: jour,
        semaine: semaine,
        nombreTotalOuvriers: tousLesOuvriers.length,
        nombreOuvriersSaisis: matriculesAyantSaisi.size,
        nombreOuvriersNonSaisis: ouvriersNonSaisis.length,
        repartitionStatutsNonSaisis: {
          AB: ouvriersFormates.filter(o => o.statut === 'AB').length,
          C: ouvriersFormates.filter(o => o.statut === 'C').length,
          S: ouvriersFormates.filter(o => o.statut === 'S').length,
          nonDefini: ouvriersFormates.filter(o => o.statut === null).length
        },
        ouvriers: ouvriersFormates
      };

    } catch (error) {
      console.error(`Erreur dans getOuvriersNonSaisisParDate:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la récupération des ouvriers non-saisis: ${error.message}`
      );
    }
  }

  /**
   * Obtenir l'historique des statuts d'un ouvrier
   */
  async getHistoriqueStatutsOuvrier(matricule: string, mois?: number, annee?: number) {
    console.log(`=== HISTORIQUE DES STATUTS POUR ${matricule} ===`);

    try {
      // Vérifier que l'ouvrier existe
      const ouvrier = await this.ouvrierRepository.findOne({
        where: {  matricule: matricule as any }
      });

      if (!ouvrier) {
        throw new NotFoundException(`Ouvrier avec matricule ${matricule} non trouvé`);
      }

      // Construire les critères de recherche
      const where: any = { matricule };

      if (annee) {
        if (mois) {
          // Filtre par mois et année
          const debutMois = new Date(annee, mois - 1, 1);
          const finMois = new Date(annee, mois, 0);
          where.date = {
            $gte: debutMois.toISOString().split('T')[0],
            $lte: finMois.toISOString().split('T')[0]
          };
        } else {
          // Filtre par année seulement
          const debutAnnee = new Date(annee, 0, 1);
          const finAnnee = new Date(annee, 11, 31);
          where.date = {
            $gte: debutAnnee.toISOString().split('T')[0],
            $lte: finAnnee.toISOString().split('T')[0]
          };
        }
      }

      // Récupérer les statuts
      const statuts = await this.statutOuvrierRepository.find({
        where,
        order: { date: 'DESC' },
        take: 100 // Limiter à 100 résultats
      });

      // Calculer les statistiques
      const statistiques = {
        totalJours: statuts.length,
        repartition: {
          P: statuts.filter(s => s.statut === 'P').length,
          AB: statuts.filter(s => s.statut === 'AB').length,
          C: statuts.filter(s => s.statut === 'C').length,
          S: statuts.filter(s => s.statut === 'S').length
        }
      };

      return {
        message: `Historique des statuts pour ${ouvrier.nomPrenom}`,
        ouvrier: {
          matricule: ouvrier.matricule,
          nomPrenom: ouvrier.nomPrenom
        },
        periode: {
          mois: mois || 'Tous',
          annee: annee || 'Toutes'
        },
        statistiques,
        statuts: statuts.map(statut => ({
          date: statut.date,
          statut: statut.statut,
          libelleStatut: this.getLibelleStatut(statut.statut),
          commentaire: statut.commentaire,
          createdAt: statut.createdAt
        }))
      };

    } catch (error) {
      console.error(`Erreur dans getHistoriqueStatutsOuvrier:`, error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la récupération de l'historique: ${error.message}`
      );
    }
  }

  /**
   * Méthode utilitaire pour obtenir le libellé d'un statut
   */
  private getLibelleStatut(code: string): string {
    const libelles = {
      'P': 'Présent',
      'AB': 'Absent',
      'C': 'Congé',
      'S': 'Sélection'
    };
    return libelles[code] || 'Inconnu';
  }

  /**
   * Supprimer un statut
   */
  async deleteStatut(id: number) {
    try {
      const statut = await this.statutOuvrierRepository.findOne({
        where: { id }
      });

      if (!statut) {
        throw new NotFoundException(`Statut avec ID ${id} non trouvé`);
      }

      // Vérifier que ce n'est pas un statut automatique (P)
      if (statut.statut === 'P' && statut.commentaire?.includes('Saisie automatique')) {
        throw new BadRequestException(
          'Impossible de supprimer un statut automatique (Présent). ' +
          'Le statut sera automatiquement recréé si l\'ouvrier saisit un rapport.'
        );
      }

      await this.statutOuvrierRepository.delete(id);

      return {
        message: `Statut supprimé avec succès pour ${statut.nomPrenom} (${statut.date})`,
        statutSupprime: {
          id: statut.id,
          matricule: statut.matricule,
          nomPrenom: statut.nomPrenom,
          date: statut.date,
          statut: statut.statut
        }
      };

    } catch (error) {
      console.error(`Erreur dans deleteStatut:`, error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la suppression du statut: ${error.message}`
      );
    }
  }
}