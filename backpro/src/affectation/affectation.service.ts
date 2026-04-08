// src/affectation/affectation.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Affectation } from './entities/affectation.entity';
import { AffectationPhase } from './entities/affectation-phase.entity';
import { CreateAffectationDto } from './dto/create-affectation.dto';
import { UpdateAffectationDto } from './dto/update-affectation.dto';
import { AddPhaseDto } from './dto/add-phase.dto';
import { OuvrierService } from '../ouvrier/ouvrier.service';
import { PhaseService } from '../phase/phase.service';

@Injectable()
export class AffectationService {
  constructor(
    @InjectRepository(Affectation)
    private affectationRepository: Repository<Affectation>,

    @InjectRepository(AffectationPhase)
    private affectationPhaseRepository: Repository<AffectationPhase>,

    private ouvrierService: OuvrierService,
    private phaseService: PhaseService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private format(a: Affectation) {
    return {
      id: a.id,
      matricule: a.ouvrier.matricule,
      nomPrenom: a.ouvrier.nomPrenom,
      ligne: a.ligne,
      estCapitaine: a.estCapitaine,
      poste: a.poste, // ← ajouté
      phases: (a.phases ?? []).map((p) => ({
        id: p.id,
        phase: p.phase,
        heures: Number(p.heures),
      })),
      totalHeures: (a.phases ?? []).reduce((s, p) => s + Number(p.heures), 0),
      createdAt: a.createdAt,
    };
  }

  private async verifierCapitaineUnique(ligne: string, matriculeExclu?: number): Promise<void> {
    const capitaineExistant = await this.affectationRepository.findOne({
      where: {
        ligne,
        estCapitaine: true,
        ...(matriculeExclu && { ouvrier: { matricule: matriculeExclu } }),
      },
      relations: ['ouvrier'],
    });

    if (capitaineExistant && capitaineExistant.ouvrier.matricule !== matriculeExclu) {
      throw new ConflictException(
        `La ligne "${ligne}" a déjà un capitaine : ${capitaineExistant.ouvrier.nomPrenom} (matricule: ${capitaineExistant.ouvrier.matricule})`,
      );
    }
  }

  private async validateLignePhases(
    ligne: string,
    phases: { phase: string }[],
  ) {
    // Vérifier que la ligne existe
    const lignes = await this.phaseService.findAllLignes();
    if (!lignes.includes(ligne)) {
      throw new BadRequestException(`La ligne "${ligne}" n'existe pas`);
    }

    // Vérifier chaque phase
    const phasesLigne = await this.phaseService.findByLigne(ligne);
    const phaseNums = phasesLigne.map((p) => p.phase);

    for (const p of phases) {
      if (!phaseNums.includes(p.phase)) {
        throw new BadRequestException(
          `La phase "${p.phase}" n'appartient pas à la ligne "${ligne}"`,
        );
      }
    }

    // Vérifier les doublons dans la requête
    const seen = new Set<string>();
    for (const p of phases) {
      if (seen.has(p.phase)) {
        throw new BadRequestException(
          `La phase "${p.phase}" est dupliquée dans la requête`,
        );
      }
      seen.add(p.phase);
    }
  }

  // ─── Créer ────────────────────────────────────────────────────────────────

  async create(dto: CreateAffectationDto): Promise<any> {
    const ouvrier = await this.ouvrierService.findOneByMatricule(dto.matricule);
    await this.validateLignePhases(dto.ligne, dto.phases);

    // Vérifier que l'ouvrier n'a pas déjà une affectation
    const existing = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule: dto.matricule } },
    });
    if (existing) {
      throw new ConflictException(
        `L'ouvrier ${dto.matricule} a déjà une affectation sur la ligne "${existing.ligne}". Modifiez-la ou supprimez-la d'abord.`,
      );
    }

    // Si on veut que cet ouvrier soit capitaine, vérifier qu'il n'y a pas déjà un capitaine sur cette ligne
    if (dto.estCapitaine) {
      await this.verifierCapitaineUnique(dto.ligne);
    }

    try {
      const affectation = new Affectation();
      affectation.ouvrier = ouvrier;
      affectation.ligne = dto.ligne;
      affectation.estCapitaine = dto.estCapitaine || false;
      affectation.poste = dto.poste; // ← ajouté
      affectation.phases = dto.phases.map((p) => {
        const ap = new AffectationPhase();
        ap.phase = p.phase;
        ap.heures = p.heures;
        return ap;
      });

      const saved = await this.affectationRepository.save(affectation);
      return this.format(saved);
    } catch (error) {
      console.error('Erreur création affectation:', error);
      throw new InternalServerErrorException("Erreur lors de la création de l'affectation");
    }
  }

  // ─── Lire tout ────────────────────────────────────────────────────────────

  async findAll(): Promise<any[]> {
    const list = await this.affectationRepository.find({
      relations: ['ouvrier', 'phases'],
      order: { createdAt: 'DESC' },
    });
    return list.map((a) => this.format(a));
  }

  // ─── Lire par matricule ───────────────────────────────────────────────────

  async findByMatricule(matricule: number): Promise<any> {
    const a = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier', 'phases'],
    });
    if (!a) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }
    return this.format(a);
  }

  // ─── Lire par ligne ───────────────────────────────────────────────────────

  async findByLigne(ligne: string): Promise<any[]> {
    const list = await this.affectationRepository.find({
      where: { ligne },
      relations: ['ouvrier', 'phases'],
      order: { createdAt: 'DESC' },
    });
    return list.map((a) => this.format(a));
  }

  // ─── Modifier (remplace ligne et/ou phases) ───────────────────────────────

  async update(matricule: number, dto: UpdateAffectationDto): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier', 'phases'],
    });
    if (!affectation) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }

    const ligneCible = dto.ligne ?? affectation.ligne;

    // Gérer le changement de statut capitaine
    if (dto.estCapitaine !== undefined) {
      if (dto.estCapitaine === true) {
        await this.verifierCapitaineUnique(ligneCible, matricule);
      }
      affectation.estCapitaine = dto.estCapitaine;
    }

    // ← Gérer le changement de poste
    if (dto.poste !== undefined) {
      affectation.poste = dto.poste;
    }

    if (dto.phases) {
      await this.validateLignePhases(ligneCible, dto.phases);
      await this.affectationPhaseRepository.delete({ affectation: { id: affectation.id } });
      affectation.phases = dto.phases.map((p) => {
        const ap = new AffectationPhase();
        ap.phase = p.phase;
        ap.heures = p.heures;
        ap.affectation = affectation;
        return ap;
      });
    } else if (dto.ligne) {
      await this.validateLignePhases(
        dto.ligne,
        affectation.phases.map((p) => ({ phase: p.phase })),
      );
    }

    affectation.ligne = ligneCible;

    const saved = await this.affectationRepository.save(affectation);
    return this.format(saved);
  }

  // ─── Ajouter une phase à une affectation existante ────────────────────────

  async addPhase(matricule: number, dto: AddPhaseDto): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier', 'phases'],
    });
    if (!affectation) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }

    // Vérifier que la phase appartient à la ligne
    await this.validateLignePhases(affectation.ligne, [{ phase: dto.phase }]);

    // Vérifier que la phase n'est pas déjà assignée
    const exists = affectation.phases.some((p) => p.phase === dto.phase);
    if (exists) {
      throw new ConflictException(
        `La phase "${dto.phase}" est déjà assignée à cet ouvrier`,
      );
    }

    const ap = new AffectationPhase();
    ap.phase = dto.phase;
    ap.heures = dto.heures;
    ap.affectation = affectation;

    await this.affectationPhaseRepository.save(ap);

    return this.findByMatricule(matricule);
  }

  // ─── Modifier les heures d'une phase ──────────────────────────────────────

  async updatePhaseHeures(
    matricule: number,
    phase: string,
    heures: number,
  ): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier', 'phases'],
    });
    if (!affectation) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }

    const ap = affectation.phases.find((p) => p.phase === phase);
    if (!ap) {
      throw new NotFoundException(`Phase "${phase}" introuvable pour cet ouvrier`);
    }

    ap.heures = heures;
    await this.affectationPhaseRepository.save(ap);

    return this.findByMatricule(matricule);
  }

  // ─── Supprimer une phase ──────────────────────────────────────────────────

  async removePhase(matricule: number, phase: string): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier', 'phases'],
    });
    if (!affectation) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }

    if (affectation.phases.length <= 1) {
      throw new BadRequestException(
        "Impossible de supprimer la dernière phase. Supprimez l'affectation entière.",
      );
    }

    const ap = affectation.phases.find((p) => p.phase === phase);
    if (!ap) {
      throw new NotFoundException(`Phase "${phase}" introuvable`);
    }

    await this.affectationPhaseRepository.remove(ap);
    return this.findByMatricule(matricule);
  }

  // ─── Supprimer toute l'affectation ───────────────────────────────────────

  async remove(matricule: number): Promise<void> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['phases'],
    });
    if (!affectation) {
      throw new NotFoundException(`Aucune affectation pour l'ouvrier ${matricule}`);
    }
    await this.affectationRepository.remove(affectation);
  }

  // ─── Nommer capitaine ─────────────────────────────────────────────────────

  async nommerCapitaine(matricule: number): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule } },
      relations: ['ouvrier'],
    });

    if (!affectation) {
      throw new NotFoundException(
        `L'ouvrier ${matricule} n'a pas d'affectation. Créez d'abord une affectation.`,
      );
    }

    await this.verifierCapitaineUnique(affectation.ligne, matricule);

    affectation.estCapitaine = true;
    const saved = await this.affectationRepository.save(affectation);

    return {
      message: `${saved.ouvrier.nomPrenom} (matricule: ${matricule}) est maintenant capitaine de la ligne "${saved.ligne}"`,
      data: this.format(saved),
    };
  }

  // ─── Retirer le statut capitaine ──────────────────────────────────────────

  async retirerCapitaine(matricule: number): Promise<any> {
    const affectation = await this.affectationRepository.findOne({
      where: { ouvrier: { matricule }, estCapitaine: true },
      relations: ['ouvrier'],
    });

    if (!affectation) {
      throw new NotFoundException(
        `L'ouvrier ${matricule} n'est pas capitaine ou n'a pas d'affectation.`,
      );
    }

    affectation.estCapitaine = false;
    const saved = await this.affectationRepository.save(affectation);

    return {
      message: `${saved.ouvrier.nomPrenom} n'est plus capitaine de la ligne "${saved.ligne}"`,
      data: this.format(saved),
    };
  }

  // ─── Lire tous les capitaines ─────────────────────────────────────────────

  async findAllCapitaines(): Promise<any[]> {
    const capitaines = await this.affectationRepository.find({
      where: { estCapitaine: true },
      relations: ['ouvrier', 'phases'],
      order: { ligne: 'ASC' },
    });

    return capitaines.map((c) => ({
      ligne: c.ligne,
      matricule: c.ouvrier.matricule,
      nomPrenom: c.ouvrier.nomPrenom,
      affectation: this.format(c),
    }));
  }

  // ─── Lire le capitaine d'une ligne spécifique ─────────────────────────────

  async findCapitaineByLigne(ligne: string): Promise<any> {
    const capitaine = await this.affectationRepository.findOne({
      where: { ligne, estCapitaine: true },
      relations: ['ouvrier', 'phases'],
    });

    if (!capitaine) {
      throw new NotFoundException(`Aucun capitaine trouvé pour la ligne "${ligne}"`);
    }

    return this.format(capitaine);
  }
}