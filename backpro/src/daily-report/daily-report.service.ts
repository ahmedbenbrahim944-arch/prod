import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import {
  EmailService,
  M1LigneReport,
  M1ReferenceEntry,
  M5LigneReport,
  M5ReferenceEntry,
} from '../email/email.service';

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  // Mapping numéro JS (getDay()) → nom du jour en français (minuscules, comme en DB)
  private readonly JOURS: Record<number, string> = {
    0: 'dimanche',
    1: 'lundi',
    2: 'mardi',
    3: 'mercredi',
    4: 'jeudi',
    5: 'vendredi',
    6: 'samedi',
  };

  constructor(
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  // ============================================================
  // CRON JOB — Déclenché tous les jours à 09h30 (lundi→samedi)
  // ============================================================
  @Cron('0 30 9 * * 1-5', {
    name: 'daily-m1-m5-report',
    timeZone: 'Africa/Tunis',
  })
  async handleDailyM1Report(): Promise<void> {
    this.logger.log('⏰ Déclenchement cron 09h30 — Rapports M1 + M5 (données de HIER)');
    const hier = this.getYesterday();
    await this.sendM1Report(hier);
  }

  // ============================================================
  // MÉTHODE PRINCIPALE — Collecte + Envoi M1 et M5
  // targetDate : date dont on veut les données
  //   → depuis le cron        : hier automatiquement
  //   → depuis le controller  : date choisie ou hier par défaut
  // ============================================================
  async sendM1Report(targetDate?: Date): Promise<{
    success: boolean;
    message: string;
    stats?: {
      m1: { totalLignes: number; totalEntrees: number; totalM1: number };
      m5: { totalLignes: number; totalEntrees: number; totalM5: number };
    };
  }> {
    try {
      const dateReference = targetDate || this.getYesterday();

      const jourIndex = dateReference.getDay();
      const jour      = this.JOURS[jourIndex];
      const semaine   = this.getCurrentSemaineName(dateReference);

      const dateStr = dateReference.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day:     '2-digit',
        month:   '2-digit',
        year:    'numeric',
      });

      this.logger.log(
        `📅 Collecte M1 + M5 pour la VEILLE : ${jour} ${dateStr} (${semaine})`,
      );

      // ─────────────────────────────────────────────────────────
      // 1. Requête unique : M1 (matierePremiere > 0) OU M5 (qualite > 0)
      //    On joint aussi le commentaire pour le rapport M5
      // ─────────────────────────────────────────────────────────
      const nonConfs = await this.nonConfRepository
        .createQueryBuilder('nc')
        .leftJoinAndSelect('nc.planification', 'plan')
        .leftJoinAndSelect('nc.commentaireObjet', 'commentaire')
        .where('plan.jour = :jour', { jour })
        .andWhere('plan.semaine = :semaine', { semaine })
        .andWhere('(nc.matierePremiere > 0 OR nc.qualite > 0)')
        .orderBy('plan.ligne', 'ASC')
        .addOrderBy('plan.reference', 'ASC')
        .getMany();

      this.logger.log(
        `📊 ${nonConfs.length} entrée(s) non-conformes trouvée(s) pour ${jour} ${semaine}`,
      );

      // ─────────────────────────────────────────────────────────
      // 2. Séparer M1 et M5
      // ─────────────────────────────────────────────────────────
      const nonConfsM1 = nonConfs.filter(nc => nc.matierePremiere > 0);
      const nonConfsM5 = nonConfs.filter(nc => nc.qualite > 0);

      // ─────────────────────────────────────────────────────────
      // 3. Construire le payload M1
      // ─────────────────────────────────────────────────────────
      const lignesMapM1 = new Map<string, M1ReferenceEntry[]>();

      nonConfsM1.forEach(nc => {
        const plan     = nc.planification;
        const ligneKey = plan.ligne;

        if (!lignesMapM1.has(ligneKey)) {
          lignesMapM1.set(ligneKey, []);
        }

        const referencesMP = this.parseReferences(nc.referenceMatierePremiere);

        lignesMapM1.get(ligneKey)!.push({
          reference:   plan.reference,
          referencesMP,
          quantite:    nc.matierePremiere,
          semaine:     plan.semaine,
          jour:        plan.jour,
        });
      });

      const lignesM1: M1LigneReport[] = [];
      let totalM1Global = 0;

      const sortedLignesM1 = Array.from(lignesMapM1.keys()).sort(
        (a, b) => this.extractLigneNumber(a) - this.extractLigneNumber(b),
      );

      sortedLignesM1.forEach(ligneName => {
        const refs       = lignesMapM1.get(ligneName)!;
        const totalLigne = refs.reduce((s, r) => s + r.quantite, 0);
        totalM1Global   += totalLigne;

        lignesM1.push({
          ligne:        ligneName,
          references:   refs,
          totalM1Ligne: totalLigne,
        });
      });

      // ─────────────────────────────────────────────────────────
      // 4. Construire le payload M5
      // ─────────────────────────────────────────────────────────
      const lignesMapM5 = new Map<string, M5ReferenceEntry[]>();

      nonConfsM5.forEach(nc => {
        const plan     = nc.planification;
        const ligneKey = plan.ligne;

        if (!lignesMapM5.has(ligneKey)) {
          lignesMapM5.set(ligneKey, []);
        }

        const referenceQualite = this.parseReferences(nc.referenceQualite);

        // Récupérer le texte du commentaire (relation ou champ direct)
        const commentaireTexte: string =
          (nc as any).commentaireObjet?.commentaire ??
          (nc as any).commentaire?.commentaire ??
          '';

        lignesMapM5.get(ligneKey)!.push({
          reference:       plan.reference,
          referenceQualite,
          quantite:        nc.qualite,
          commentaire:     commentaireTexte,
          semaine:         plan.semaine,
          jour:            plan.jour,
        });
      });

      const lignesM5: M5LigneReport[] = [];
      let totalM5Global = 0;

      const sortedLignesM5 = Array.from(lignesMapM5.keys()).sort(
        (a, b) => this.extractLigneNumber(a) - this.extractLigneNumber(b),
      );

      sortedLignesM5.forEach(ligneName => {
        const refs       = lignesMapM5.get(ligneName)!;
        const totalLigne = refs.reduce((s, r) => s + r.quantite, 0);
        totalM5Global   += totalLigne;

        lignesM5.push({
          ligne:        ligneName,
          references:   refs,
          totalM5Ligne: totalLigne,
        });
      });

      // ─────────────────────────────────────────────────────────
      // 5. Destinataires
      // ─────────────────────────────────────────────────────────
      const recipientEmailM1 = this.configService.get<string>(
        'M1_REPORT_EMAIL',
        'responsable@seraftunisie.com',
      );

      const recipientEmailM5 = this.configService.get<string>(
        'M5_REPORT_EMAIL',
        'quality@seraftunisie.com',
      );

      // ─────────────────────────────────────────────────────────
      // 6. Envoi M1 + M5 en parallèle
      // ─────────────────────────────────────────────────────────
      const [sentM1, sentM5] = await Promise.all([
        this.emailService.sendM1DailyReport({
          jour,
          semaine,
          date:          dateStr,
          lignes:        lignesM1,
          totalM1Global,
          recipientEmail: recipientEmailM1,
        }),
        this.emailService.sendM5DailyReport({
          jour,
          semaine,
          date:          dateStr,
          lignes:        lignesM5,
          totalM5Global,
          recipientEmail: recipientEmailM5,
        }),
      ]);

      // ─────────────────────────────────────────────────────────
      // 7. Résultat
      // ─────────────────────────────────────────────────────────
      const statsM1 = {
        totalLignes:  lignesM1.filter(l => l.references.length > 0).length,
        totalEntrees: nonConfsM1.length,
        totalM1:      totalM1Global,
      };

      const statsM5 = {
        totalLignes:  lignesM5.filter(l => l.references.length > 0).length,
        totalEntrees: nonConfsM5.length,
        totalM5:      totalM5Global,
      };

      if (sentM1) {
        this.logger.log(
          `✅ Email M1 envoyé → ${recipientEmailM1} | ` +
          `Lignes: ${statsM1.totalLignes} | Total: ${statsM1.totalM1} | Date: ${dateStr}`,
        );
      } else {
        this.logger.warn(`⚠️ Échec envoi email M1 → ${recipientEmailM1}`);
      }

      if (sentM5) {
        this.logger.log(
          `✅ Email M5 envoyé → ${recipientEmailM5} | ` +
          `Lignes: ${statsM5.totalLignes} | Total: ${statsM5.totalM5} | Date: ${dateStr}`,
        );
      } else {
        this.logger.warn(`⚠️ Échec envoi email M5 → ${recipientEmailM5}`);
      }

      // On considère un succès si au moins un email est parti
      const globalSuccess = sentM1 || sentM5;

      return {
        success: globalSuccess,
        message: globalSuccess
          ? `Rapports M1 (${dateStr}) → ${recipientEmailM1} | M5 → ${recipientEmailM5}`
          : "Erreur lors de l'envoi des deux emails — vérifiez la config SMTP",
        stats: { m1: statsM1, m5: statsM5 },
      };

    } catch (error) {
      this.logger.error(
        `❌ Erreur sendM1Report : ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Erreur interne : ${error.message}`,
      };
    }
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  /**
   * Retourne la date d'hier à minuit (heure locale Tunis)
   */
  private getYesterday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const jourSemaine = today.getDay(); // 0=dim, 1=lun, ..., 6=sam

  let joursAReculer: number;

  switch (jourSemaine) {
    case 1: // Lundi → vendredi précédent
      joursAReculer = 3;
      break;
    case 0: // Dimanche (ne devrait pas arriver) → vendredi
      joursAReculer = 2;
      break;
    case 6: // Samedi (ne devrait pas arriver) → vendredi
      joursAReculer = 1;
      break;
    default: // Mardi(2), Mercredi(3), Jeudi(4), Vendredi(5) → hier
      joursAReculer = 1;
      break;
  }

  const dernierJourOuvre = new Date(today);
  dernierJourOuvre.setDate(today.getDate() - joursAReculer);
  return dernierJourOuvre;
}

  /**
   * Parse "8,60,136" → ["8", "60", "136"]
   * Parse null / ""  → []
   */
  private parseReferences(refsString: string | null): string[] {
    if (!refsString || refsString.trim() === '') return [];
    return refsString
      .split(',')
      .map(r => r.trim())
      .filter(r => r !== '');
  }

  /**
   * Extrait le numéro d'une ligne (ex: "L04:RXT1" → 4, "L42:RA1" → 42)
   * Utilisé pour le tri numérique des lignes dans les rapports
   */
  private extractLigneNumber(ligne: string): number {
    const match = ligne.match(/L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Calcule "semaine20" à partir d'une date
   */
  private getCurrentSemaineName(date: Date): string {
    const weekNumber = this.getISOWeekNumber(date);
    return `semaine${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Numéro de semaine ISO 8601
   */
  private getISOWeekNumber(date: Date): number {
    const d      = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Test connexion SMTP (utilisé par le controller)
   */
  async testSmtpConnection(): Promise<boolean> {
    return this.emailService.verifyConnection();
  }
}