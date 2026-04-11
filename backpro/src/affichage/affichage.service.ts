// src/affichage/affichage.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { Affectation } from '../affectation/entities/affectation.entity';
import { ProductionRecord } from '../production/entities/production-record.entity';
import { GetAffichageDto } from './dto/get-affichage.dto';

@Injectable()
export class AffichageService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,

    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,

    @InjectRepository(Affectation)
    private affectationRepository: Repository<Affectation>,

    @InjectRepository(ProductionRecord)
    private productionRepository: Repository<ProductionRecord>,
  ) {}

  /**
   * Normalise la ligne : extrait le préfixe L04 depuis L04:RXT1, L04-RXT1, etc.
   * Retourne le préfixe court (ex: "L04") pour les recherches LIKE
   */
  private normalizeLigne(ligne: string): string {
    if (!ligne) return '';
    // Extraire le préfixe Lxx (ex: L04 depuis L04:RXT1 ou L04-RXT1)
    const match = ligne.trim().toUpperCase().match(/^(L\d{2})/);
    return match ? match[1] : ligne.trim().toUpperCase();
  }

  /**
   * Convertir une date (ex: "2026-04-06") en nom de jour
   */
  private getJourFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return jours[date.getDay()];
  }

  /**
   * Trouver la semaine qui contient une date donnée
   */
  private async findSemaineByDate(dateStr: string): Promise<Semaine | null> {
    const date = new Date(dateStr);
    const semaines = await this.semaineRepository.find();
    for (const semaine of semaines) {
      const debut = new Date(semaine.dateDebut);
      const fin = new Date(semaine.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      if (date >= debut && date <= fin) {
        return semaine;
      }
    }
    return null;
  }

  /**
   * Endpoint principal : récupérer les données d'affichage pour une ligne + date
   */
  async getAffichage(dto: GetAffichageDto) {
    const { date, ligne } = dto;

    // Normaliser la ligne pour la recherche (L04 -> cherche L04%)
    const lignePrefix = this.normalizeLigne(ligne);

    // ── 1. Trouver la semaine correspondant à la date ──────────────────────
    const semaine = await this.findSemaineByDate(date);
    if (!semaine) {
      throw new NotFoundException(
        `Aucune semaine trouvée pour la date "${date}". Vérifiez que cette date est couverte par une semaine planifiée.`,
      );
    }

    // ── 2. Trouver le jour de la semaine ──────────────────────────────────
    const jour = this.getJourFromDate(date);
    if (jour === 'dimanche') {
      throw new NotFoundException(`Le dimanche n'est pas un jour de travail planifié.`);
    }

    // ── 3. Récupérer les planifications avec LIKE pour matcher L04:RXT1, L04-RXT1, etc. ─
    const planifications = await this.planificationRepository
      .createQueryBuilder('p')
      .where('p.semaine = :semaine', { semaine: semaine.nom })
      .andWhere('p.jour = :jour', { jour })
      .andWhere('p.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .getMany();

    // Filtrer uniquement celles avec une quantité planifiée > 0
    const planificationsActives = planifications.filter(
      (p) => p.qtePlanifiee > 0 || p.qteModifiee > 0,
    );

    // ── 4. Calculer la qtéPlanifiée totale ────────────────────────────────
    const totalQtePlanifiee = planificationsActives.reduce((sum, p) => {
      const qteSource = p.qteModifiee > 0 ? p.qteModifiee : p.qtePlanifiee;
      return sum + qteSource;
    }, 0);

    const detailReferences = planificationsActives.map((p) => ({
      reference: p.reference,
      of: p.of,
      qtePlanifiee: p.qtePlanifiee,
      qteModifiee: p.qteModifiee,
      qteSource: p.qteModifiee > 0 ? p.qteModifiee : p.qtePlanifiee,
      emballage: p.emballage,
      nbOperateurs: p.nbOperateurs,
    }));

    // ── 5. Récupérer les affectations avec LIKE ────────────────────────────
    const affectations = await this.affectationRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.ouvrier', 'ouvrier')
      .leftJoinAndSelect('a.phases', 'phases')
      .where('a.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .getMany();

    const nbOuvriers = affectations.length;

    const ouvriersList = affectations.map((a) => ({
      matricule: a.ouvrier.matricule,
      nomPrenom: a.ouvrier.nomPrenom,
      estCapitaine: a.estCapitaine,
      phases: (a.phases ?? []).map((ph) => ({
        phase: ph.phase,
        heures: Number(ph.heures),
      })),
    }));

    // ── 6. Récupérer la qtéProduite ────────────────────────────────────────
    const dateDebut = new Date(date);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(date);
    dateFin.setHours(23, 59, 59, 999);

    const productionRecords = await this.productionRepository
      .createQueryBuilder('pr')
      .where('pr.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .andWhere('pr.dateScan BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .orderBy('pr.dateScan', 'ASC')
      .getMany();

    const totalQteProduite = productionRecords.reduce(
      (sum, record) => sum + record.quantite,
      0,
    );

    const detailProduction = productionRecords.map((r) => ({
      id: r.id,
      reference: r.reference,
      quantite: r.quantite,
      dateScan: r.dateScan,
    }));

    // ── 7. Calculer la productivité / OEE ─────────────────────────────────
    const productivite =
      totalQtePlanifiee > 0
        ? Math.round((totalQteProduite / totalQtePlanifiee) * 10000) / 100
        : 0;

    // ── 8. Construire et retourner la réponse ──────────────────────────────
    return {
      message: `Affichage pour la ligne "${ligne}" le ${date}`,
      date,
      jour,
      semaine: {
        id: semaine.id,
        nom: semaine.nom,
        dateDebut: semaine.dateDebut,
        dateFin: semaine.dateFin,
      },
      ligne,
      kpis: {
        productivite: `${productivite}%`,
        productiviteValeur: productivite,
        nbOuvriers,
        totalQtePlanifiee,
        totalQteProduite,
        delta: totalQteProduite - totalQtePlanifiee,
      },
      planification: {
        nbReferences: planificationsActives.length,
        references: detailReferences,
      },
      ouvriers: {
        total: nbOuvriers,
        capitaine: ouvriersList.find((o) => o.estCapitaine) ?? null,
        liste: ouvriersList,
      },
      production: {
        nbScans: productionRecords.length,
        enregistrements: detailProduction,
      },
    };
  }

  /**
   * Retourne les lignes disponibles (préfixes uniques ex: L04, L09...)
   */
  async getLignes(): Promise<string[]> {
  const result = await this.planificationRepository
    .createQueryBuilder('planification')
    .select('DISTINCT planification.ligne', 'ligne')
    .where('planification.ligne IS NOT NULL')
    .andWhere("planification.ligne != ''")
    .orderBy('planification.ligne', 'ASC')
    .getRawMany();

  // Retourner les lignes complètes, pas seulement les préfixes
  const lignes = result
    .map(item => String(item.ligne).trim())
    .filter(ligne => ligne.length > 0);
  
  // Dédupliquer et trier
  return [...new Set(lignes)].sort();
}
}