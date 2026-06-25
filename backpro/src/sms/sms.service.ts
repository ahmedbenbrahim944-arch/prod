// src/sms/sms.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { SendManualSmsDto } from './dto/send-manual-sms.dto';

// Définition claire du type pour la lisibilité
type MCategory = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6';

interface SmsRule {
  phone: string;
  categories: MCategory[];
  label?: string; // nom affiché dans les logs
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /**
   * Table de routage SMS : chaque numéro reçoit les alertes
   * des catégories listées dans son tableau `categories`.
   * 
   * IMPORTANT : un même numéro peut apparaître plusieurs fois
   * (ex: +21652408933 reçoit M4 ET tous les M*).
   * Les doublons sont dédupliqués dans `getRecipients()`.
   */
  private readonly SMS_RULES: SmsRule[] = [
    { phone: '+21658619727', categories: ['M1'],                              label: 'Responsable M1' },
    { phone: '+21652408931', categories: ['M5'],                              label: 'Responsable M5 (1)' },
    { phone: '+21652408921', categories: ['M5'],                              label: 'Responsable M5 (2)' },
    { phone: '+21652408933', categories: ['M4'],                              label: 'Responsable M4' },
    { phone: '+21652408929', categories: ['M1','M2','M3','M4','M5','M6'],    label: 'Superviseur général' },
    { phone: '+21652408942', categories: ['M1'],},
    { phone: '+21650174242', categories: ['M1'],}
    
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Alerte automatique déclenchée lors d'une pause de ligne.
   * Appelée depuis le service métier (pause de production).
   */
  async sendPauseAlert(
    ligne: string,
    mCategory: string,
    refs: string[],
    subCategory?: string,
  ): Promise<void> {
    const message = this.buildMessage(ligne, mCategory, refs);
    await this.dispatchSms(mCategory, message, 'AUTO');
  }

  /**
   * Envoi manuel déclenché par l'utilisateur depuis le frontend.
   * Valide la catégorie, construit le message avec commentaire éventuel,
   * puis envoie aux destinataires correspondants.
   */
  async sendManualAlert(dto: SendManualSmsDto): Promise<{
    success: boolean;
    recipientCount: number;
    recipients: string[];
    category: string;
    ligne: string;
  }> {
    const { ligne, mCategory, comment } = dto;

    const recipients = this.getRecipients(mCategory);

    if (recipients.length === 0) {
      throw new BadRequestException(
        `Aucun destinataire configuré pour la catégorie ${mCategory}`,
      );
    }

    const message = this.buildMessage(ligne, mCategory, [], comment);

    this.logger.log(
      `📱 [MANUEL] Envoi SMS (${mCategory}) → ${recipients.length} numéro(s): ${recipients.join(', ')}`,
    );

    await this.dispatchSms(mCategory, message, 'MANUEL', recipients);

    // On masque partiellement les numéros dans la réponse (RGPD / sécurité)
    const maskedRecipients = recipients.map(p => this.maskPhone(p));

    return {
      success: true,
      recipientCount: recipients.length,
      recipients: maskedRecipients,
      category: mCategory,
      ligne,
    };
  }

  /**
   * Retourne la liste des catégories disponibles avec leur libellé.
   * Utile pour alimenter le select du frontend.
   */
  getCategoryOptions(): { value: string; label: string }[] {
    return [
      { value: 'M1', label: 'M1 – Manque Matière Première' },
      { value: 'M2', label: 'M2 – Main d\'œuvre' },
      { value: 'M3', label: 'M3 – Méthode' },
      { value: 'M4', label: 'M4 – Panne Machine' },
      { value: 'M5', label: 'M5 – Qualité' },
      { value: 'M6', label: 'M6 – Environnement' },
    ];
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Construit le corps du SMS selon la catégorie.
   * Le commentaire est ajouté en bas si fourni.
   */
  private buildMessage(
    ligne: string,
    mCategory: string,
    refs: string[] = [],
    comment?: string,
  ): string {
    const refsText = refs.length > 0 ? refs.join(', ') : 'Non spécifiée';
    const heure = new Date().toLocaleTimeString('fr-TN');
    const commentLine = comment ? `\nCommentaire: ${comment}` : '';

    const templates: Record<string, string> = {
      M1: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Manque Matière Première (M1)\nRéférences: ${refsText}\nHeure: ${heure}${commentLine}`,
      M2: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Main d'œuvre (M2)\nHeure: ${heure}${commentLine}`,
      M3: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Méthode (M3)\nHeure: ${heure}${commentLine}`,
      M4: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Panne Machine (M4)\nPhases: ${refsText}\nHeure: ${heure}${commentLine}`,
      M5: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Qualité (M5)\nRéférences: ${refsText}\nHeure: ${heure}${commentLine}`,
      M6: `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: Environnement (M6)\nHeure: ${heure}${commentLine}`,
    };

    return templates[mCategory] ?? 
      `⚠️ ARRET PRODUCTION\nLigne: ${ligne}\nCause: ${mCategory}\nHeure: ${heure}${commentLine}`;
  }

  /**
   * Retourne les numéros uniques correspondant à une catégorie.
   * La déduplication évite d'envoyer deux fois au même numéro.
   */
  private getRecipients(mCategory: string): string[] {
    const phones = this.SMS_RULES
      .filter(rule => rule.categories.includes(mCategory as MCategory))
      .map(rule => rule.phone);

    // Dédupliquer — Set préserve l'ordre d'insertion
    return [...new Set(phones)];
  }

  /**
   * Envoie le message à tous les destinataires fournis (ou calculés).
   * Le paramètre `source` sert uniquement au logging.
   */
  private async dispatchSms(
    mCategory: string,
    message: string,
    source: 'AUTO' | 'MANUEL',
    recipients?: string[],
  ): Promise<void> {
    const targets = recipients ?? this.getRecipients(mCategory);

    for (const phone of targets) {
      await this.sendViaWinSms(phone, message, source);
    }
  }

  private formatPhone(phone: string): string {
    // WinSMS attend le format 216XXXXXXXX (sans le +)
    return phone.replace('+', '');
  }

  /** Masque partiellement un numéro pour les logs/réponses API */
  private maskPhone(phone: string): string {
    // Ex: +21658619727  →  +216XXXXX727
    return phone.length > 5
      ? `${phone.slice(0, 4)}XXXXX${phone.slice(-3)}`
      : '***';
  }

  private async sendViaWinSms(
    phoneNumber: string,
    message: string,
    source: 'AUTO' | 'MANUEL' = 'AUTO',
  ): Promise<void> {
    const apiKey   = this.configService.get<string>('WINSMS_API_KEY');
    const senderId = this.configService.get<string>('WINSMS_SENDER_ID');
    const apiUrl   = this.configService.get<string>('WINSMS_API_URL');

    const to = this.formatPhone(phoneNumber);

    const params = new URLSearchParams({
      action:  'send-sms',
      api_key: apiKey ?? '',
      to,
      sms:     message,
      from:    senderId ?? '',
    });

    const url = `${apiUrl}?${params.toString()}`;

    this.logger.log(`📤 [${source}] WinSMS → ${to}`);

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      this.logger.log(
        `✅ SMS envoyé à ${phoneNumber} - Réponse: ${JSON.stringify(response.data)}`,
      );
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        this.logger.error(`❌ Échec SMS à ${phoneNumber}`);
        this.logger.error(`❌ Status HTTP: ${error.response?.status}`);
        this.logger.error(`❌ Réponse API: ${JSON.stringify(error.response?.data)}`);
        this.logger.error(`❌ Message: ${error.message}`);
      } else {
        this.logger.error(`❌ Erreur inconnue: ${JSON.stringify(error)}`);
      }
    }
  }
}