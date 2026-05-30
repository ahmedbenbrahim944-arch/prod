import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { GetPlanificationMagasinDto } from './dto/get-planification-magasin.dto';
import { UpdateDeclarationMagasinDto } from './dto/update-declaration-magasin.dto';


@Injectable()
export class MagasinService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,
  ) {}

  // Méthode utilitaire pour obtenir la quantité source
  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  // Récupérer les planifications pour le magasin
  // magasin.service.ts - méthode getPlanificationsMagasin

async getPlanificationsMagasin(dto: GetPlanificationMagasinDto) {
  const { semaine } = dto;

  const semaineEntity = await this.semaineRepository.findOne({
    where: { nom: semaine }
  });

  if (!semaineEntity) {
    throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
  }

  // ✅ Récupérer TOUTES les planifications sans fusionner les postes
  const planifications = await this.planificationRepository.find({
    where: { semaine },
    order: { 
      reference: 'ASC', 
      poste: 'ASC',   // ← poste1 avant poste2
      jour: 'ASC' 
    }
  });

  // ✅ Filtrer : garder seulement celles avec une quantité > 0
  const avecQuantite = planifications.filter(
    p => p.qtePlanifiee > 0 || p.qteModifiee > 0
  );

  // ✅ Construire les détails EN GARDANT poste séparé
  const details = avecQuantite.map(plan => ({
    id: plan.id,
    semaine: plan.semaine,
    jour: plan.jour,
    ligne: plan.ligne,
    reference: plan.reference,
    poste: plan.poste || 'poste1',   // ← CHAMP CLÉ
    of: plan.of,
    qtePlanifiee: plan.qtePlanifiee,
    qteModifiee: plan.qteModifiee,
    quantiteSource: plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee,
    decMagasin: plan.decMagasin,
    exp: plan.exp,
    emballage: plan.emballage,
    updatedAt: plan.updatedAt,
    typeQuantite: plan.qteModifiee > 0 ? 'modifiée' : 'planifiée'
  }));

  // ✅ Regrouper par ligne pour la structure "lignes"
  const lignesMap = new Map<string, any>();
  details.forEach(d => {
    if (!lignesMap.has(d.ligne)) {
      lignesMap.set(d.ligne, {
        ligne: d.ligne,
        // total = somme poste1 + poste2
        totalQtePlanifiee: 0,
        totalDecMagasin: 0,
        references: new Map()
      });
    }
    const ligneEntry = lignesMap.get(d.ligne);
    ligneEntry.totalQtePlanifiee += d.quantiteSource;
    ligneEntry.totalDecMagasin += d.decMagasin;

    const refKey = `${d.reference}|${d.jour}`;
    if (!ligneEntry.references.has(refKey)) {
      ligneEntry.references.set(refKey, {
        reference: d.reference,
        jour: d.jour,
        postes: []
      });
    }
    // ← Chaque référence/jour a maintenant un tableau de postes
    ligneEntry.references.get(refKey).postes.push(d);
  });

  const lignes = Array.from(lignesMap.values()).map(l => ({
    ...l,
    references: Array.from(l.references.values())
  }));

  return {
    message: `Planifications magasin`,
    semaine: {
      id: semaineEntity.id,
      nom: semaineEntity.nom,
      dateDebut: semaineEntity.dateDebut,
      dateFin: semaineEntity.dateFin
    },
    filtre: semaine,
    totals: {
      totalQtePlanifiee: details.reduce((s, d) => s + d.quantiteSource, 0),
      totalQteModifiee: details.reduce((s, d) => s + d.qteModifiee, 0),
      totalQuantiteSource: details.reduce((s, d) => s + d.quantiteSource, 0),
      totalDecMagasin: details.reduce((s, d) => s + d.decMagasin, 0),
      totalExp: details.reduce((s, d) => s + (d.exp || 0), 0),
      nombreLignes: lignesMap.size,
      nombrePlanifications: details.length
    },
    lignes,
    details  // ← liste plate avec poste1 ET poste2 séparés
  };
}

  // Mettre à jour la déclaration magasin (inchangé)
  async updateDeclarationMagasin(updateDto: UpdateDeclarationMagasinDto, username: string) {
    const { semaine, jour, ligne, reference, decMagasin } = updateDto;

    // Trouver la planification
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    // Mettre à jour DM
    planification.decMagasin = decMagasin;
    planification.updatedAt = new Date();

    const updatedPlanification = await this.planificationRepository.save(planification);

    return {
      message: 'Déclaration magasin mise à jour',
      planification: {
        id: updatedPlanification.id,
        semaine: updatedPlanification.semaine,
        jour: updatedPlanification.jour,
        ligne: updatedPlanification.ligne,
        reference: updatedPlanification.reference,
        qtePlanifiee: updatedPlanification.qtePlanifiee,
        qteModifiee: updatedPlanification.qteModifiee,
        quantiteSource: this.getQuantitySource(updatedPlanification),
        decMagasin: updatedPlanification.decMagasin,
        updatedAt: updatedPlanification.updatedAt
      }
    };
  }
}