// src/autosaisie/autosaisie.service.ts - Version avec typage correct

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from './entities/badge.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { CreateAutosaisieDto } from './dto/create-autosaisie.dto';
import { AffectationService } from '../affectation/affectation.service';
import { SaisieRapportService } from '../saisie-rapport/saisie-rapport.service';
import { CreateSaisieRapportDto } from '../saisie-rapport/dto/create-saisie-rapport.dto';
import { OuvrierService } from '../ouvrier/ouvrier.service';

@Injectable()
export class AutosaisieService {
  constructor(
    @InjectRepository(Badge)
    private badgeRepository: Repository<Badge>,
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    private affectationService: AffectationService,
    private saisieRapportService: SaisieRapportService,
    private ouvrierService: OuvrierService,
  ) {}

  /**
   * Obtenir la semaine ISO au format "semaineX"
   */
  private getSemaineISO(date: Date = new Date()): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dayOfWeek = d.getDay();
    const targetDay = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    d.setDate(d.getDate() + targetDay);
    const yearStart = new Date(d.getFullYear(), 0, 4);
    const daysDiff = Math.floor((d.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((daysDiff + 1) / 7);
    return `semaine${weekNumber}`;
  }

  /**
   * Obtenir le jour de la semaine en français
   */
  private getJourFrancais(date: Date = new Date()): string {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return jours[date.getDay()];
  }

  /**
   * Créer une autosaisie à partir du badge
   */
  async create(dto: CreateAutosaisieDto) {
    const dateActuelle = new Date();
    const semaine = this.getSemaineISO(dateActuelle);
    const jour = this.getJourFrancais(dateActuelle);

    console.log('=== DÉBUT AUTOSAISIE ===');
    console.log('Date:', dateActuelle);
    console.log('Semaine:', semaine);
    console.log('Jour:', jour);
    console.log('N° Badge:', dto.n_badget);

    // 1. Récupérer le matricule à partir du badge
    const badge = await this.badgeRepository.findOne({
      where: { n_badget: dto.n_badget },
    });

    if (!badge) {
      throw new NotFoundException(
        `Badge "${dto.n_badget}" non trouvé. Veuillez vérifier le numéro.`,
      );
    }

    const matricule = badge.matricule;
    console.log('Matricule trouvé:', matricule);

    // 2. Récupérer les informations de l'ouvrier
    let nomPrenom: string; // Changement: enlever le type null
    try {
      const ouvrier = await this.ouvrierService.findOneByMatricule(matricule);
      nomPrenom = ouvrier.nomPrenom;
      console.log('Ouvrier trouvé:', nomPrenom);
    } catch (error) {
      console.log(`Ouvrier avec matricule ${matricule} non trouvé`);
      nomPrenom = `Ouvrier ${matricule}`;
    }

    // 3. Récupérer l'affectation de l'ouvrier
    let affectation;
    try {
      affectation = await this.affectationService.findByMatricule(matricule);
      console.log('Affectation trouvée:', affectation.ligne);
      console.log('Phases:', affectation.phases);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `L'ouvrier ${nomPrenom} (matricule: ${matricule}) n'a pas d'affectation. Veuillez d'abord créer une affectation.`,
        );
      }
      throw error;
    }

    // 4. Préparer les phases pour le rapport
    let phasesPourRapport;
    if (dto.phases && dto.phases.length > 0) {
      phasesPourRapport = dto.phases;
      console.log('Utilisation des phases personnalisées:', phasesPourRapport);
    } else {
      phasesPourRapport = affectation.phases.map(p => ({
        phase: p.phase,
        heures: p.heures,
      }));
      console.log('Utilisation des phases de l\'affectation:', phasesPourRapport);
    }

    // 5. Calculer le total des heures
    const totalHeures = phasesPourRapport.reduce((sum, p) => sum + p.heures, 0);
    
    if (totalHeures > 8) {
      throw new BadRequestException(
        `Total des heures (${totalHeures}h) dépasse la limite de 8h par jour`,
      );
    }

    // 6. Vérifier si un rapport existe déjà pour ce jour
    let rapportExistant: SaisieRapport | null = null;
    try {
      rapportExistant = await this.saisieRapportRepository.findOne({
        where: { 
          semaine, 
          jour, 
          ligne: affectation.ligne, 
          matricule 
        }
      });
      console.log('Rapport existant:', rapportExistant ? `Oui (ID: ${rapportExistant.id})` : 'Non');
    } catch (error) {
      console.log('Erreur vérification rapport:', error.message);
    }

    // 7. Préparer le DTO pour le rapport
    const rapportDto: CreateSaisieRapportDto = {
      semaine,
      jour,
      ligne: affectation.ligne,
      matricule,
      phases: phasesPourRapport,
    };

    let resultat;
    if (rapportExistant) {
      console.log('Rapport existant trouvé, mise à jour...');
      resultat = await this.saisieRapportService.updateRapport(rapportDto);
    } else {
      console.log('Création d\'un nouveau rapport...');
      resultat = await this.saisieRapportService.createRapport(rapportDto);
    }

    console.log('=== AUTOSAISIE TERMINÉE AVEC SUCCÈS ===');

    return {
      message: rapportExistant 
        ? 'Autosaisie mise à jour avec succès'
        : 'Autosaisie créée avec succès',
      data: {
        ...resultat,
        badge: {
          n_badget: badge.n_badget,
          matricule,
          nomPrenom,
        },
        date: {
          dateActuelle,
          semaine,
          jour,
        },
      },
    };
  }

  /**
   * Créer un badge (association badge → matricule)
   */
  async createBadge(n_badget: string, matricule: number) {
    // Vérifier si le badge existe déjà
    const existing = await this.badgeRepository.findOne({
      where: { n_badget },
    });

    if (existing) {
      throw new BadRequestException(
        `Le badge "${n_badget}" est déjà associé à l'ouvrier matricule ${existing.matricule}`,
      );
    }

    const badge = new Badge();
    badge.n_badget = n_badget;
    badge.matricule = matricule;

    const saved = await this.badgeRepository.save(badge);
    
    return {
      message: 'Badge créé avec succès',
      badge: {
        id: saved.id,
        n_badget: saved.n_badget,
        matricule: saved.matricule,
      },
    };
  }

  /**
   * Supprimer un badge
   */
  async removeBadge(n_badget: string) {
    const badge = await this.badgeRepository.findOne({
      where: { n_badget },
    });

    if (!badge) {
      throw new NotFoundException(`Badge "${n_badget}" non trouvé`);
    }

    await this.badgeRepository.remove(badge);

    return {
      message: `Badge "${n_badget}" supprimé avec succès`,
    };
  }

  /**
   * Récupérer tous les badges
   */
  async findAllBadges() {
    const badges = await this.badgeRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Récupérer les noms des ouvriers
    const badgesWithNames = await Promise.all(
      badges.map(async (badge) => {
        let nomPrenom: string; // Changement: enlever le type null
        try {
          const ouvrier = await this.ouvrierService.findOneByMatricule(badge.matricule);
          nomPrenom = ouvrier.nomPrenom;
        } catch (error) {
          nomPrenom = `Ouvrier ${badge.matricule} (non trouvé)`;
        }
        return {
          id: badge.id,
          n_badget: badge.n_badget,
          matricule: badge.matricule,
          nomPrenom,
          createdAt: badge.createdAt,
          updatedAt: badge.updatedAt,
        };
      })
    );

    return {
      total: badges.length,
      badges: badgesWithNames,
    };
  }

  /**
   * Récupérer un badge par son numéro
   */
  async findBadgeByNumero(n_badget: string) {
    const badge = await this.badgeRepository.findOne({
      where: { n_badget },
    });

    if (!badge) {
      throw new NotFoundException(`Badge "${n_badget}" non trouvé`);
    }

    let nomPrenom: string; // Changement: enlever le type null
    try {
      const ouvrier = await this.ouvrierService.findOneByMatricule(badge.matricule);
      nomPrenom = ouvrier.nomPrenom;
    } catch (error) {
      nomPrenom = `Ouvrier ${badge.matricule} (non trouvé)`;
    }

    return {
      n_badget: badge.n_badget,
      matricule: badge.matricule,
      nomPrenom,
    };
  }
  async createByMatricule(matricule: number) {
    const dateActuelle = new Date();
    const semaine = this.getSemaineISO(dateActuelle);
    const jour = this.getJourFrancais(dateActuelle);

    console.log('=== DÉBUT AUTOSAISIE (MATRICULE) ===');
    console.log('Matricule:', matricule);
    console.log('Semaine:', semaine, '| Jour:', jour);

    // 1. Récupérer les informations de l'ouvrier
    let nomPrenom: string;
    try {
      const ouvrier = await this.ouvrierService.findOneByMatricule(matricule);
      nomPrenom = ouvrier.nomPrenom;
    } catch {
      throw new NotFoundException(
        `Ouvrier avec le matricule "${matricule}" introuvable.`,
      );
    }

    // 2. Récupérer l'affectation de l'ouvrier
    let affectation;
    try {
      affectation = await this.affectationService.findByMatricule(matricule);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `L'ouvrier ${nomPrenom} (matricule: ${matricule}) n'a pas d'affectation.`,
        );
      }
      throw error;
    }

    // 3. Préparer les phases depuis l'affectation
    const phasesPourRapport = affectation.phases.map((p) => ({
      phase: p.phase,
      heures: p.heures,
    }));

    // 4. Vérifier le total des heures
    const totalHeures = phasesPourRapport.reduce((sum, p) => sum + p.heures, 0);
    if (totalHeures > 8) {
      throw new BadRequestException(
        `Total des heures (${totalHeures}h) dépasse la limite de 8h par jour`,
      );
    }

    // 5. Vérifier si un rapport existe déjà pour ce jour
    let rapportExistant: SaisieRapport | null = null;
    try {
      rapportExistant = await this.saisieRapportRepository.findOne({
        where: { semaine, jour, ligne: affectation.ligne, matricule },
      });
    } catch { /* ignoré */ }

    // 6. Créer ou mettre à jour le rapport
    const rapportDto: CreateSaisieRapportDto = {
      semaine,
      jour,
      ligne: affectation.ligne,
      matricule,
      phases: phasesPourRapport,
    };

    const resultat = rapportExistant
      ? await this.saisieRapportService.updateRapport(rapportDto)
      : await this.saisieRapportService.createRapport(rapportDto);

    console.log('=== AUTOSAISIE (MATRICULE) TERMINÉE ===');

    return {
      message: rapportExistant
        ? 'Autosaisie mise à jour avec succès'
        : 'Autosaisie créée avec succès',
      data: {
        ...resultat,
        nomPrenom,
        badge: null,
        date: { dateActuelle, semaine, jour },
      },
    };
  }
}