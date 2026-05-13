import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async sendPauseAlert(
    ligne: string,
    mCategory: string,
    refs: string[],
    subCategory?: string,
  ): Promise<void> {

    // ✅ Seulement M1 et M4 déclenchent un SMS
    if (mCategory !== 'M1' && mCategory !== 'M4') {
      this.logger.log(`ℹ️ Pas de SMS pour la catégorie ${mCategory}`);
      return;
    }

    // ✅ Lire les numéros depuis .env
    const recipientsEnv = this.configService.get<string>('SMS_RECIPIENTS', '');
    const recipients = recipientsEnv
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (recipients.length === 0) {
      this.logger.warn('⚠️ Aucun numéro SMS configuré dans SMS_RECIPIENTS');
      return;
    }

    // ✅ Construire le message selon M1 ou M4
    let message = '';

    if (mCategory === 'M1') {
      const refsText = refs.length > 0 ? refs.join(', ') : 'Non spécifiée';
      message =
        `⚠️ ARRET PRODUCTION\n` +
        `Ligne: ${ligne}\n` +
        `Cause: Manque Matière Première (M1)\n` +
        `Références: ${refsText}\n` +
        `Heure: ${new Date().toLocaleTimeString('fr-TN')}`;
    }

    if (mCategory === 'M4') {
      const refsText = refs.length > 0 ? refs.join(', ') : 'Non spécifiée';
      message =
        `⚠️ ARRET PRODUCTION\n` +
        `Ligne: ${ligne}\n` +
        `Cause: Panne Machine (M4)\n` +
        `Phases en panne: ${refsText}\n` +
        `Heure: ${new Date().toLocaleTimeString('fr-TN')}`;
    }

    await this.sendSms(recipients, message);
  }

  private async sendSms(phoneNumbers: string[], message: string): Promise<void> {
    const apiKey = this.configService.get<string>('INFOBIP_API_KEY');
    const baseUrl = this.configService.get<string>('INFOBIP_BASE_URL');
    const sender = this.configService.get<string>('INFOBIP_SENDER', 'ERP');

    if (!apiKey || !baseUrl) {
      this.logger.warn('⚠️ SMS non configuré (INFOBIP_API_KEY ou INFOBIP_BASE_URL manquant)');
      return;
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/sms/2/text/advanced`,
          {
            messages: [{
              from: sender,
              // ✅ Envoyer vers tous les numéros en une seule requête
              destinations: phoneNumbers.map(num => ({ to: num })),
              text: message,
            }],
          },
          {
            headers: {
              Authorization: `App ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(`✅ SMS envoyé à ${phoneNumbers.length} numéro(s): ${phoneNumbers.join(', ')}`);
    } catch (error) {
      this.logger.error(`❌ Échec SMS: ${(error as Error).message}`);
    }
  }
}