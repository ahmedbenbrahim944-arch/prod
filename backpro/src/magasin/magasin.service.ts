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
  async getPlanificationsMagasin(getPlanificationDto: GetPlanificationMagasinDto) {
    const { semaine } = getPlanificationDto;

    console.log(`=== MAGASIN - ${semaine} ===`);

    // Vérifier si la semaine existe
    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
    }

    // Récupérer toutes les planifications pour cette semaine (toutes lignes)
    const planifications = await this.planificationRepository.find({
      where: { 
        semaine: semaine
      },
      order: { ligne: 'ASC', reference: 'ASC', jour: 'ASC' }
    });

    if (planifications.length === 0) {
      return {
        message: `Aucune planification trouvée pour la semaine ${semaine}`,
        semaine: semaine,
        lignes: [],
        planifications: []
      };
    }

    // FILTRER: ne garder que les planifications avec qtePlanifiee > 0 OU qteModifiee > 0
    const planificationsFiltrees = planifications.filter(plan => 
      plan.qtePlanifiee > 0 || plan.qteModifiee > 0
    );

    if (planificationsFiltrees.length === 0) {
      return {
        message: `Aucune planification avec quantité planifiée ou modifiée > 0 pour la semaine ${semaine}`,
        semaine: semaine,
        lignes: [],
        references: []
      };
    }

    // Grouper par ligne
    const lignesMap = new Map<string, any>();

    planificationsFiltrees.forEach(plan => {
      const ligneKey = plan.ligne;
      
      if (!lignesMap.has(ligneKey)) {
        lignesMap.set(ligneKey, {
          ligne: plan.ligne,
          references: new Map<string, any>(),
          detailsParJour: [],
          // Totaux par ligne
          totalQtePlanifiee: 0,
          totalQteModifiee: 0,
          totalQuantiteSource: 0,
          totalDecMagasin: 0
        });
      }

      const ligneData = lignesMap.get(ligneKey);
      
      // Grouper par référence à l'intérieur de chaque ligne
      const refKey = plan.reference;
      const quantiteSource = this.getQuantitySource(plan);
      
      if (!ligneData.references.has(refKey)) {
        ligneData.references.set(refKey, {
          reference: plan.reference,
          qtePlanifiee: 0,
          qteModifiee: 0,
          quantiteSource: 0,
          decMagasin: 0,
          detailsParJour: [],
          // Nouveaux champs pour indiquer le type de quantité
          aQtePlanifiee: false,
          aQteModifiee: false
        });
      }

      const refData = ligneData.references.get(refKey);
      
      // Ajouter aux totaux de la référence
      refData.qtePlanifiee += plan.qtePlanifiee;
      refData.qteModifiee += plan.qteModifiee;
      refData.quantiteSource += quantiteSource;
      refData.decMagasin += plan.decMagasin;

      // Mettre à jour les indicateurs
      if (plan.qtePlanifiee > 0) refData.aQtePlanifiee = true;
      if (plan.qteModifiee > 0) refData.aQteModifiee = true;

      // Détails par jour pour la référence
      if (plan.qtePlanifiee > 0 || plan.qteModifiee > 0) {
        refData.detailsParJour.push({
          jour: plan.jour,
          qtePlanifiee: plan.qtePlanifiee,
          qteModifiee: plan.qteModifiee,
          quantiteSource: quantiteSource,
          decMagasin: plan.decMagasin,
          of: plan.of,
          emballage: plan.emballage,
          typeQuantite: plan.qteModifiee > 0 ? 'MODIFIEE' : 'PLANIFIEE'
        });
      }

      // Ajouter aux totaux de la ligne
      ligneData.totalQtePlanifiee += plan.qtePlanifiee;
      ligneData.totalQteModifiee += plan.qteModifiee;
      ligneData.totalQuantiteSource += quantiteSource;
      ligneData.totalDecMagasin += plan.decMagasin;

      // Ajouter aux détails de la ligne
      ligneData.detailsParJour.push({
        id: plan.id,
        jour: plan.jour,
        reference: plan.reference,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: quantiteSource,
        decMagasin: plan.decMagasin,
        of: plan.of,
        emballage: plan.emballage,
        typeQuantite: plan.qteModifiee > 0 ? 'MODIFIEE' : 'PLANIFIEE'
      });
    });

    // Convertir la Map des lignes en tableau
    const lignes = Array.from(lignesMap.values())
      .sort((a, b) => a.ligne.localeCompare(b.ligne));

    // Convertir les références Map en tableau pour chaque ligne
    lignes.forEach(ligne => {
      ligne.references = Array.from(ligne.references.values())
       .sort((a: any, b: any) => a.reference.localeCompare(b.reference));
      
      // Statistiques pour la ligne
      ligne.statistiques = {
        nombreReferences: ligne.references.length,
        referencesAvecQtePlanifiee: ligne.references.filter(ref => ref.aQtePlanifiee).length,
        referencesAvecQteModifiee: ligne.references.filter(ref => ref.aQteModifiee).length,
        nombrePlanifications: ligne.detailsParJour.length
      };
    });

    // Calculer les totaux globaux
    const totals = {
      totalQtePlanifiee: lignes.reduce((sum, ligne) => sum + ligne.totalQtePlanifiee, 0),
      totalQteModifiee: lignes.reduce((sum, ligne) => sum + ligne.totalQteModifiee, 0),
      totalQuantiteSource: lignes.reduce((sum, ligne) => sum + ligne.totalQuantiteSource, 0),
      totalDecMagasin: lignes.reduce((sum, ligne) => sum + ligne.totalDecMagasin, 0),
      nombreLignes: lignes.length,
      nombrePlanifications: planificationsFiltrees.length
    };

    return {
      message: `Planifications magasin pour la semaine ${semaine} (toutes lignes)`,
      semaine: {
        id: semaineEntity.id,
        nom: semaineEntity.nom,
        dateDebut: semaineEntity.dateDebut,
        dateFin: semaineEntity.dateFin
      },
      filtre: "Seules les références avec qtePlanifiee > 0 OU qteModifiee > 0 sont affichées",
      totals: totals,
      lignes: lignes,
      // Version détaillée par planification (filtrée)
      details: planificationsFiltrees.map(plan => ({
        id: plan.id,
        semaine: plan.semaine,
        jour: plan.jour,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        decMagasin: plan.decMagasin,
        emballage: plan.emballage,
        typeQuantite: plan.qteModifiee > 0 ? 'MODIFIEE' : (plan.qtePlanifiee > 0 ? 'PLANIFIEE' : 'VIDE'),
        updatedAt: plan.updatedAt
      }))
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