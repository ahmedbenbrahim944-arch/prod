// src/planning-selection/planning-selection.service.ts
import { 
  Injectable, 
  NotFoundException,
  InternalServerErrorException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { PlanningSelection } from './entities/planning-selection.entity';
import { CreatePlanningSelectionDto } from './dto/create-planning-selection.dto';
import { UpdatePlanningSelectionDto } from './dto/update-planning-selection.dto';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Product } from '../product/entities/product.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';

@Injectable()
export class PlanningSelectionService {
  constructor(
    @InjectRepository(PlanningSelection)
    private planningRepository: Repository<PlanningSelection>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,
    @InjectRepository(MatierePremier)
    private matierePremierRepository: Repository<MatierePremier>,
  ) {}

  /**
   * Trouver la semaine correspondant à une date
   */
  private async findSemaineForDate(date: string): Promise<Semaine> {
    const targetDate = new Date(date);
    
    const semaine = await this.semaineRepository
      .createQueryBuilder('semaine')
      .where(':date BETWEEN semaine.dateDebut AND semaine.dateFin', { date })
      .getOne();

    if (!semaine) {
      throw new NotFoundException(
        `Aucune semaine définie pour la date ${date}. ` +
        `Veuillez créer une semaine dans le module Semaine d'abord.`
      );
    }

    return semaine;
  }

  /**
   * Chercher une référence dans Product ou MatierePremier
   */
  private async findReferenceAndLine(reference: string): Promise<{
    type: 'product' | 'matiere_premier';
    id: number;
    ligne: string;
  }> {
    // 1. Chercher d'abord dans Product
    const product = await this.productRepository.findOne({
      where: { reference }
    });

    if (product) {
      return {
        type: 'product',
        id: product.id,
        ligne: product.ligne
      };
    }

    // 2. Si pas trouvé dans Product, chercher dans MatierePremier
    const matierePremier = await this.matierePremierRepository.findOne({
      where: { refMatierePremier: reference }
    });

    if (matierePremier) {
      return {
        type: 'matiere_premier',
        id: matierePremier.id,
        ligne: matierePremier.ligne
      };
    }

    // 3. Si pas trouvé du tout
    throw new NotFoundException(
      `Référence "${reference}" introuvable dans les produits ou les matières premières`
    );
  }

  /**
   * Extraire le numéro de semaine du nom
   */
  private extractWeekNumberFromName(nom: string): number {
    const match = nom.match(/semaine(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    throw new BadRequestException(`Format de nom de semaine invalide: ${nom}`);
  }

  /**
   * Créer un nouveau planning de sélection
   */
  
async create(createDto: CreatePlanningSelectionDto): Promise<PlanningSelection> {
  const { 
    date, 
    matricule, 
    reference,
    qteASelectionne, 
    objectifHeure,
    qteSelection,
    nHeures,
    numTicket,
    rebut
  } = createDto;

  // 1. Trouver la semaine correspondant à la date
  const semaine = await this.findSemaineForDate(date);
  const semaineNumero = this.extractWeekNumberFromName(semaine.nom);

  // 2. Vérifier que l'ouvrier existe
  const ouvrier = await this.ouvrierRepository.findOne({ 
    where: { matricule } 
  });
  
  if (!ouvrier) {
    throw new NotFoundException(`Ouvrier avec le matricule ${matricule} introuvable`);
  }

  // 3. Vérifier que les champs obligatoires sont présents
  if (!reference || !qteASelectionne || !objectifHeure) {
    throw new BadRequestException(
      'Les champs référence, quantité à sélectionner et objectif par heure sont obligatoires'
    );
  }

  // 4. Chercher la référence et récupérer sa ligne
  const refInfo = await this.findReferenceAndLine(reference);

  // 5. Le rendement sera calculé lors de l'update (pas lors de la création)
  const rendement = 0;

  // 6. Créer le planning
  try {
    const planning = new PlanningSelection();
    planning.date = date;
    planning.semaine = semaineNumero;
    planning.semaineId = semaine.id;
    planning.semaineNom = semaine.nom;
    planning.matricule = matricule;
    planning.nomPrenom = ouvrier.nomPrenom;
    planning.ligne = 'selection';
    planning.reference = reference;
    planning.ligneRef = refInfo.ligne;
    planning.typeReference = refInfo.type;
    
    // ✅ CORRECTION: Assigner null au lieu de ne rien faire
    if (refInfo.type === 'product') {
      planning.productId = refInfo.id;
      planning.matierePremierId = null;
    } else {
      planning.matierePremierId = refInfo.id;
      planning.productId = null;
    }
    
    planning.statut = 'selection';
    planning.numTicket = numTicket || 'non num';
    planning.qteASelectionne = qteASelectionne;
    planning.objectifHeure = objectifHeure;
    planning.qteSelection = qteSelection || 0;
    planning.rebut = rebut || 0;
    planning.nHeures = nHeures || 0;
    planning.rendement = Number(rendement.toFixed(2));

    return await this.planningRepository.save(planning);
  } catch (error) {
    console.error('Erreur création planning:', error);
    throw new InternalServerErrorException('Erreur lors de la création du planning');
  }
}

  /**
   * Récupérer tous les plannings
   */
  async findAll(): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      order: { date: 'DESC', createdAt: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer un planning par ID
   */
  async findOne(id: number): Promise<PlanningSelection> {
    const planning = await this.planningRepository.findOne({
      where: { id }
    });

    if (!planning) {
      throw new NotFoundException(`Planning avec l'ID ${id} introuvable`);
    }

    await this.loadRelationsForPlanning(planning);

    return planning;
  }

  /**
   * Récupérer les plannings par date
   */
  async findByDate(date: string): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { date },
      order: { createdAt: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par matricule
   */
  async findByMatricule(matricule: number): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { matricule },
      order: { date: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings incomplets (en attente de remplissage)
   */
  async findIncomplets(): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { 
        statut: 'en attente'
      },
      order: { date: 'DESC', createdAt: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par date et matricule
   */
  async findByDateAndMatricule(date: string, matricule: number): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { date, matricule },
      order: { createdAt: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par période
   */
  async findByPeriod(startDate: string, endDate: string): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { 
        date: Between(startDate, endDate)
      },
      order: { date: 'DESC', createdAt: 'DESC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par semaine (numéro)
   */
  async findBySemaine(semaine: number): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { semaine },
      order: { date: 'ASC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par ID de semaine
   */
  async findBySemaineId(semaineId: number): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { semaineId },
      order: { date: 'ASC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par nom de semaine
   */
  async findBySemaineNom(semaineNom: string): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { semaineNom },
      order: { date: 'ASC' }
    });

    await this.loadRelationsForPlannings(plannings);

    return plannings;
  }

  /**
   * Récupérer les plannings par année et semaine
   */
  async findByAnneeSemaine(annee: number, semaine: number): Promise<PlanningSelection[]> {
    const plannings = await this.planningRepository.find({
      where: { semaine }
    });

    // Filtrer par année
    const filteredPlannings = plannings.filter(p => {
      const planningYear = new Date(p.date).getFullYear();
      return planningYear === annee;
    });

    await this.loadRelationsForPlannings(filteredPlannings);

    return filteredPlannings;
  }

  /**
   * Mettre à jour un planning par ID
   */
 async update(id: number, updateDto: UpdatePlanningSelectionDto): Promise<PlanningSelection> {
  const planning = await this.findOne(id);

  // Mettre à jour la référence si fournie
  if (updateDto.reference !== undefined) {
    const refInfo = await this.findReferenceAndLine(updateDto.reference);
    planning.reference = updateDto.reference;
    planning.ligneRef = refInfo.ligne;
    planning.typeReference = refInfo.type;
    
    if (refInfo.type === 'product') {
      planning.productId = refInfo.id;
      planning.matierePremierId = null;
    } else {
      planning.matierePremierId = refInfo.id;
      planning.productId = null;
    }
  }

  if (updateDto.qteASelectionne !== undefined) {
    planning.qteASelectionne = updateDto.qteASelectionne;
  }

  if (updateDto.objectifHeure !== undefined) {
    planning.objectifHeure = updateDto.objectifHeure;
  }

  if (updateDto.numTicket !== undefined) {
    planning.numTicket = updateDto.numTicket;
  }

  if (updateDto.nHeures !== undefined) {
    planning.nHeures = updateDto.nHeures;
  }

  if (updateDto.qteSelection !== undefined) {
    planning.qteSelection = updateDto.qteSelection;
  }

  if (updateDto.rebut !== undefined) {
    planning.rebut = updateDto.rebut;
  }

  if (updateDto.terminer !== undefined) {
    planning.terminer = updateDto.terminer;
  }

  // ✅ AJOUTER CETTE CONDITION
  if (updateDto.statut !== undefined) {
    planning.statut = updateDto.statut;
  }

  // Recalculer le rendement
  const nHeures = Number(planning.nHeures);
  const objectifHeure = Number(planning.objectifHeure ?? 0);
  
  if (nHeures > 0 && objectifHeure > 0) {
    const totalProduction = planning.qteSelection + planning.rebut;
    planning.rendement = Number(((totalProduction / (nHeures * objectifHeure)) * 100).toFixed(2));
  } else {
    planning.rendement = 0;
  }

  const updatedPlanning = await this.planningRepository.save(planning);
  await this.loadRelationsForPlanning(updatedPlanning);

  return updatedPlanning;
}

  /**
   * Mettre à jour un planning par matricule, référence et date
   */
  async updateByMatriculeReferenceDate(
  matricule: number,
  reference: string,
  date: string,
  updateDto: UpdatePlanningSelectionDto
): Promise<PlanningSelection> {
  const planning = await this.planningRepository.findOne({
    where: { matricule, reference, date }
  });

  if (!planning) {
    throw new NotFoundException(
      `Planning introuvable pour matricule=${matricule}, référence=${reference}, date=${date}`
    );
  }

  if (updateDto.reference !== undefined) {
    const refInfo = await this.findReferenceAndLine(updateDto.reference);
    planning.reference = updateDto.reference;
    planning.ligneRef = refInfo.ligne;
    planning.typeReference = refInfo.type;

    if (refInfo.type === 'product') {
      planning.productId = refInfo.id;
      planning.matierePremierId = null;
    } else {
      planning.matierePremierId = refInfo.id;
      planning.productId = null;
    }
  }

  if (updateDto.qteASelectionne !== undefined) {
    planning.qteASelectionne = updateDto.qteASelectionne;
  }

  if (updateDto.objectifHeure !== undefined) {
    planning.objectifHeure = updateDto.objectifHeure;
  }

  if (updateDto.numTicket !== undefined) {
    planning.numTicket = updateDto.numTicket;
  }

  if (updateDto.terminer !== undefined) {
    planning.terminer = updateDto.terminer;
  }

  if (updateDto.nHeures !== undefined) {
    planning.nHeures = updateDto.nHeures;
  }

  if (updateDto.qteSelection !== undefined) {
    planning.qteSelection = updateDto.qteSelection;
  }

  if (updateDto.rebut !== undefined) {
    planning.rebut = updateDto.rebut;
  }

  // Recalculer le rendement avec rebut
  const nHeures = Number(planning.nHeures);
  const objectifHeure = Number(planning.objectifHeure ?? 0);
  
  if (nHeures > 0 && objectifHeure > 0) {
    const totalProduction = planning.qteSelection + planning.rebut;
    planning.rendement = Number(((totalProduction / (nHeures * objectifHeure)) * 100).toFixed(2));
  } else {
    planning.rendement = 0;
  }

  const updatedPlanning = await this.planningRepository.save(planning);
  await this.loadRelationsForPlanning(updatedPlanning);

  return updatedPlanning;
}

  /**
   * Supprimer un planning
   */
  async remove(id: number): Promise<void> {
    const planning = await this.findOne(id);
    await this.planningRepository.remove(planning);
  }

  /**
   * Calculer les statistiques par ouvrier
   */
  async getStatsByOuvrier(matricule: number): Promise<any> {
    const plannings = await this.findByMatricule(matricule);

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour le matricule ${matricule}`);
    }

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const totalHeures = plannings.reduce((sum, p) => sum + Number(p.nHeures), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    return {
      matricule,
      nomPrenom: plannings[0].nomPrenom,
      totalPlannings: plannings.length,
      totalQteSelection,
      totalQteASelectionne,
      totalHeures: Number(totalHeures.toFixed(2)),
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      plannings
    };
  }

  /**
   * Calculer les statistiques par date
   */
  async getStatsByDate(date: string): Promise<any> {
    const plannings = await this.findByDate(date);

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour la date ${date}`);
    }

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    return {
      date,
      totalPlannings: plannings.length,
      totalOuvriers: new Set(plannings.map(p => p.matricule)).size,
      totalQteSelection,
      totalQteASelectionne,
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      plannings
    };
  }

  /**
   * Calculer les statistiques par semaine
   */
  async getStatsBySemaine(semaine: number): Promise<any> {
    const plannings = await this.findBySemaine(semaine);

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour la semaine ${semaine}`);
    }

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const totalHeures = plannings.reduce((sum, p) => sum + Number(p.nHeures), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    return {
      semaine,
      totalPlannings: plannings.length,
      totalOuvriers: new Set(plannings.map(p => p.matricule)).size,
      totalQteSelection,
      totalQteASelectionne,
      totalHeures: Number(totalHeures.toFixed(2)),
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      dates: [...new Set(plannings.map(p => p.date))].sort(),
      plannings
    };
  }

  /**
   * Calculer les statistiques par ID de semaine
   */
  async getStatsBySemaineId(semaineId: number): Promise<any> {
    const plannings = await this.findBySemaineId(semaineId);

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour la semaine ID ${semaineId}`);
    }

    const semaine = await this.semaineRepository.findOne({
      where: { id: semaineId }
    });

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const totalHeures = plannings.reduce((sum, p) => sum + Number(p.nHeures), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    return {
      semaineId,
      semaineNom: semaine?.nom,
      semaineNumero: semaine ? this.extractWeekNumberFromName(semaine.nom) : null,
      dateDebut: semaine?.dateDebut,
      dateFin: semaine?.dateFin,
      totalPlannings: plannings.length,
      totalOuvriers: new Set(plannings.map(p => p.matricule)).size,
      totalQteSelection,
      totalQteASelectionne,
      totalHeures: Number(totalHeures.toFixed(2)),
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      plannings
    };
  }

  /**
   * Calculer les statistiques par période
   */
  async getStatsByPeriod(startDate: string, endDate: string): Promise<any> {
    const plannings = await this.findByPeriod(startDate, endDate);

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour la période ${startDate} à ${endDate}`);
    }

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const totalHeures = plannings.reduce((sum, p) => sum + Number(p.nHeures), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    const statsParSemaine = {};
    plannings.forEach(p => {
      const semaineKey = `semaine${p.semaine}`;
      if (!statsParSemaine[semaineKey]) {
        statsParSemaine[semaineKey] = {
          semaine: p.semaine,
          semaineNom: p.semaineNom,
          totalPlannings: 0,
          totalQteSelection: 0,
          totalQteASelectionne: 0,
          totalHeures: 0
        };
      }
      statsParSemaine[semaineKey].totalPlannings++;
      statsParSemaine[semaineKey].totalQteSelection += p.qteSelection;
      statsParSemaine[semaineKey].totalQteASelectionne += (p.qteASelectionne ?? 0);
      statsParSemaine[semaineKey].totalHeures += Number(p.nHeures);
    });

    Object.values(statsParSemaine).forEach((stat: any) => {
      stat.rendementMoyen = stat.totalQteASelectionne > 0 ? 
        Number(((stat.totalQteSelection / stat.totalQteASelectionne) * 100).toFixed(2)) : 0;
      stat.totalHeures = Number(stat.totalHeures.toFixed(2));
    });

    return {
      startDate,
      endDate,
      totalPlannings: plannings.length,
      totalOuvriers: new Set(plannings.map(p => p.matricule)).size,
      totalQteSelection,
      totalQteASelectionne,
      totalHeures: Number(totalHeures.toFixed(2)),
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      statsParSemaine: Object.values(statsParSemaine),
      plannings
    };
  }

  /**
   * Charger les relations pour un planning
   */
  private async loadRelationsForPlanning(planning: PlanningSelection): Promise<void> {
    planning.ouvrier = await this.ouvrierRepository.findOne({ 
      where: { matricule: planning.matricule } 
    });

    if (planning.typeReference === 'product' && planning.productId) {
      planning.product = await this.productRepository.findOne({ 
        where: { id: planning.productId } 
      });
    } else if (planning.typeReference === 'matiere_premier' && planning.matierePremierId) {
      planning.matierePremier = await this.matierePremierRepository.findOne({ 
        where: { id: planning.matierePremierId } 
      });
    }

    if (planning.semaineId) {
      planning.semaineEntity = await this.semaineRepository.findOne({
        where: { id: planning.semaineId }
      });
    }
  }

  /**
   * Charger les relations pour plusieurs plannings
   */
  private async loadRelationsForPlannings(plannings: PlanningSelection[]): Promise<void> {
    if (plannings.length === 0) return;

    const matricules = [...new Set(plannings.map(p => p.matricule))];
    const productIds = plannings.filter(p => p.productId).map(p => p.productId!);
    const matierePremierIds = plannings.filter(p => p.matierePremierId).map(p => p.matierePremierId!);
    const semaineIds = plannings.filter(p => p.semaineId).map(p => p.semaineId!);

    const [ouvriers, products, matierePremiers, semaines] = await Promise.all([
      this.ouvrierRepository.find({ where: { matricule: In(matricules) } }),
      productIds.length > 0 ? this.productRepository.find({ where: { id: In(productIds) } }) : Promise.resolve([]),
      matierePremierIds.length > 0 ? this.matierePremierRepository.find({ where: { id: In(matierePremierIds) } }) : Promise.resolve([]),
      semaineIds.length > 0 ? this.semaineRepository.find({ where: { id: In(semaineIds) } }) : Promise.resolve([]),
    ]);

    const ouvrierMap = new Map(ouvriers.map(o => [o.matricule, o]));
    const productMap = new Map(products.map(p => [p.id, p]));
    const matierePremierMap = new Map(matierePremiers.map(m => [m.id, m]));
    const semaineMap = new Map(semaines.map(s => [s.id, s]));

    plannings.forEach(planning => {
      planning.ouvrier = ouvrierMap.get(planning.matricule) || null;
      
      if (planning.typeReference === 'product' && planning.productId) {
        planning.product = productMap.get(planning.productId) || null;
      } else if (planning.typeReference === 'matiere_premier' && planning.matierePremierId) {
        planning.matierePremier = matierePremierMap.get(planning.matierePremierId) || null;
      }
      
      if (planning.semaineId) {
        planning.semaineEntity = semaineMap.get(planning.semaineId) || null;
      }
    });
  }

  /**
   * Récupérer les statistiques par type de référence
   */
  async getStatsByTypeReference(type: 'product' | 'matiere_premier'): Promise<any> {
    const plannings = await this.planningRepository.find({
      where: { typeReference: type }
    });

    if (plannings.length === 0) {
      throw new NotFoundException(`Aucun planning trouvé pour le type ${type}`);
    }

    const totalQteSelection = plannings.reduce((sum, p) => sum + p.qteSelection, 0);
    const totalQteASelectionne = plannings.reduce((sum, p) => sum + (p.qteASelectionne ?? 0), 0);
    const totalHeures = plannings.reduce((sum, p) => sum + Number(p.nHeures), 0);
    const rendementMoyen = totalQteASelectionne > 0 ? 
      (totalQteSelection / totalQteASelectionne) * 100 : 0;

    const statsParReference = {};
    plannings.forEach(p => {
      const ref = p.reference ?? 'unknown';
      if (!statsParReference[ref]) {
        statsParReference[ref] = {
          reference: p.reference,
          ligneRef: p.ligneRef,
          totalPlannings: 0,
          totalQteSelection: 0,
          totalQteASelectionne: 0,
          totalHeures: 0
        };
      }
      statsParReference[ref].totalPlannings++;
      statsParReference[ref].totalQteSelection += p.qteSelection;
      statsParReference[ref].totalQteASelectionne += (p.qteASelectionne ?? 0);
      statsParReference[ref].totalHeures += Number(p.nHeures);
    });

    Object.values(statsParReference).forEach((stat: any) => {
      stat.rendementMoyen = stat.totalQteASelectionne > 0 ? 
        Number(((stat.totalQteSelection / stat.totalQteASelectionne) * 100).toFixed(2)) : 0;
      stat.totalHeures = Number(stat.totalHeures.toFixed(2));
    });

    return {
      typeReference: type,
      totalPlannings: plannings.length,
      totalOuvriers: new Set(plannings.map(p => p.matricule)).size,
      totalReferences: Object.keys(statsParReference).length,
      totalQteSelection,
      totalQteASelectionne,
      totalHeures: Number(totalHeures.toFixed(2)),
      rendementMoyen: Number(rendementMoyen.toFixed(2)),
      statsParReference: Object.values(statsParReference),
      plannings
    };
  }
}