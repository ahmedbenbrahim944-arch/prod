import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
    });
  }

  // ============================================================
  // ENVOI EMAIL M1
  // TO  : M1_REPORT_EMAIL       → warehouse1@seraftunisie.com
  // CC  : M1_REPORT_CC          → mohamed.youssef@seraftunisie.com
  //                                planning@seraftunisie.com
  // ============================================================
  async sendM1DailyReport(payload: M1ReportPayload): Promise<boolean> {
    const { jour, semaine, date, recipientEmail } = payload;

    const subject = `Rapport M1 Matieres Premieres - ${jour} ${date} (${semaine})`;
    const html    = this.buildM1HtmlEmail(payload);
    const text    = this.buildM1TextEmail(payload);

    const ccM1 = this.configService.get<string>(
      'M1_REPORT_CC',
      'mohamed.youssef@seraftunisie.com,planning@seraftunisie.com,marco.carrea@seraftunisie.com',
    );

    try {
      const info = await this.transporter.sendMail({
        from:    `"ProdSeraf - Systeme" <${this.configService.get<string>('SMTP_USER')}>`,
        to:      recipientEmail,
        cc:      ccM1,
        subject,
        html,
        text,
      });

      this.logger.log(
        `Email M1 envoye : ${info.messageId} | TO: ${recipientEmail} | CC: ${ccM1}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Erreur envoi email M1 : ${error.message}`);
      this.logger.error(`Code SMTP  : ${error.code}`);
      this.logger.error(`Reponse    : ${error.response}`);
      return false;
    }
  }

  // ============================================================
  // ENVOI EMAIL M5
  // TO  : M5_REPORT_EMAIL       → quality@seraftunisie.com
  // CC  : M5_REPORT_CC          → faycal.boulares@seraftunisie.com
  // ============================================================
  async sendM5DailyReport(payload: M5ReportPayload): Promise<boolean> {
    const { jour, semaine, date, recipientEmail } = payload;

    const subject = `Rapport M5 Qualite - ${jour} ${date} (${semaine})`;
    const html    = this.buildM5HtmlEmail(payload);
    const text    = this.buildM5TextEmail(payload);

    const ccM5 = this.configService.get<string>(
      'M5_REPORT_CC',
      'faycal.boulares@seraftunisie.com,marco.carrea@seraftunisie.com',
    );

    try {
      const info = await this.transporter.sendMail({
        from:    `"ProdSeraf - Systeme" <${this.configService.get<string>('SMTP_USER')}>`,
        to:      recipientEmail,
        cc:      ccM5,
        subject,
        html,
        text,
      });

      this.logger.log(
        `Email M5 envoye : ${info.messageId} | TO: ${recipientEmail} | CC: ${ccM5}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Erreur envoi email M5 : ${error.message}`);
      this.logger.error(`Code SMTP  : ${error.code}`);
      this.logger.error(`Reponse    : ${error.response}`);
      return false;
    }
  }

  // ============================================================
  // VERIFICATION CONNEXION SMTP
  // ============================================================
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Connexion SMTP verifiee avec succes');
      return true;
    } catch (error) {
      this.logger.error(`Erreur connexion SMTP : ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // TEMPLATE HTML M1 — TABLEAU SIMPLE COMPATIBLE OUTLOOK
  // ============================================================
  private buildM1HtmlEmail(payload: M1ReportPayload): string {
    const { jour, semaine, date, lignes, totalM1Global } = payload;

    const totalLignes  = lignes.filter(l => l.references.length > 0).length;
    const totalEntrees = lignes.reduce((s, l) => s + l.references.length, 0);

    const lignesHtml = lignes
      .filter(l => l.references.length > 0)
      .map(ligne => {
        const rowsHtml = ligne.references
          .map((ref, idx) => {
            const bg = idx % 2 === 0 ? '#f5f5f5' : '#ffffff';
            return `
              <tr style="background-color: ${bg};">
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000;">
                  ${ref.reference}
                </td>
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000;">
                  ${ref.referencesMP.length > 0 ? ref.referencesMP.join(', ') : 'Non precisee'}
                </td>
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000; text-align: center;">
                  ${ref.quantite}
                </td>
              </tr>
            `;
          })
          .join('');

        return `
          <tr>
            <td colspan="3" style="padding: 0; border: none;">

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="background-color: #1e3a5f; padding: 10px 14px;
                             font-family: Arial, sans-serif; font-size: 14px;
                             font-weight: bold; color: #ffffff;
                             border: 1px solid #1e3a5f;">
                    ${ligne.ligne}
                  </td>
                  <td style="background-color: #1e3a5f; padding: 10px 14px;
                             font-family: Arial, sans-serif; font-size: 13px;
                             color: #ffffff; text-align: right;
                             border: 1px solid #1e3a5f;">
                    Total : ${ligne.totalM1Ligne} pieces
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #dce8f5;">
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: left; text-transform: uppercase;">
                      Reference Produit
                    </th>
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: left; text-transform: uppercase;">
                      Reference(s) MP
                    </th>
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: center; text-transform: uppercase;">
                      Quantite
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

            </td>
          </tr>
        `;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0;
             font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background-color: #f0f0f0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border: 1px solid #cccccc;">

          <!-- EN-TETE -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 24px 28px;
                       text-align: center;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 20px; font-weight: bold;
                        color: #ffffff; letter-spacing: 1px;">
                RAPPORT M1 - MATIERES PREMIERES
              </p>
              <p style="margin: 8px 0 0 0; font-family: Arial, sans-serif;
                        font-size: 13px; color: #b0c8e8;">
                ${jour.charAt(0).toUpperCase() + jour.slice(1)} ${date}
                &nbsp;|&nbsp; ${semaine.toUpperCase()}
              </p>
            </td>
          </tr>

          <!-- RESUME GLOBAL -->
          <tr>
            <td style="background-color: #fff8dc; padding: 14px 28px;
                       border-top: 3px solid #e6c200;
                       border-bottom: 1px solid #e0d080;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 13px; color: #000000;">
                <strong>Resume global :</strong>
                &nbsp;&nbsp;
                <strong>${totalLignes} ligne(s)</strong> concernee(s)
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <strong>${totalEntrees} entree(s)</strong> M1
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <strong>${totalM1Global} pieces</strong> au total
              </p>
            </td>
          </tr>

          <!-- CONTENU -->
          <tr>
            <td style="padding: 20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${lignesHtml.length > 0
                  ? lignesHtml
                  : `<tr><td style="padding: 20px; text-align: center;
                                    font-family: Arial, sans-serif;
                                    font-size: 13px; color: #888888;">
                       Aucune non-conformite M1 enregistree pour ce jour.
                     </td></tr>`
                }
              </table>
            </td>
          </tr>

          <!-- PIED DE PAGE -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 14px 28px;
                       border-top: 1px solid #cccccc; text-align: center;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 11px; color: #888888;">
                Genere automatiquement par ProdSeraf a 09h30
                &nbsp;|&nbsp; Ne pas repondre a cet email
              </p>
              <p style="margin: 4px 0 0 0; font-family: Arial, sans-serif;
                        font-size: 10px; color: #aaaaaa;">
                &copy; ${new Date().getFullYear()} ProdSeraf
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // ============================================================
  // TEMPLATE HTML M5 — TABLEAU SIMPLE COMPATIBLE OUTLOOK
  // ============================================================
  private buildM5HtmlEmail(payload: M5ReportPayload): string {
    const { jour, semaine, date, lignes, totalM5Global } = payload;

    const totalLignes  = lignes.filter(l => l.references.length > 0).length;
    const totalEntrees = lignes.reduce((s, l) => s + l.references.length, 0);

    const lignesHtml = lignes
      .filter(l => l.references.length > 0)
      .map(ligne => {
        const rowsHtml = ligne.references
          .map((ref, idx) => {
            const bg = idx % 2 === 0 ? '#f5f5f5' : '#ffffff';
            return `
              <tr style="background-color: ${bg};">
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000;">
                  ${ref.reference}
                </td>
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000;">
                  ${ref.referenceQualite.length > 0
                    ? ref.referenceQualite.join(', ')
                    : 'Non precisee'}
                </td>
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000; text-align: center;">
                  ${ref.quantite}
                </td>
                <td style="padding: 8px 12px; border: 1px solid #cccccc;
                           font-family: Arial, sans-serif; font-size: 13px;
                           color: #000000;">
                  ${ref.commentaire ? ref.commentaire : '-'}
                </td>
              </tr>
            `;
          })
          .join('');

        return `
          <tr>
            <td colspan="4" style="padding: 0; border: none;">

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="background-color: #4c1d95; padding: 10px 14px;
                             font-family: Arial, sans-serif; font-size: 14px;
                             font-weight: bold; color: #ffffff;
                             border: 1px solid #4c1d95;">
                    ${ligne.ligne}
                  </td>
                  <td style="background-color: #4c1d95; padding: 10px 14px;
                             font-family: Arial, sans-serif; font-size: 13px;
                             color: #ffffff; text-align: right;
                             border: 1px solid #4c1d95;">
                    Total : ${ligne.totalM5Ligne} pieces
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #e8ddf5;">
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: left; text-transform: uppercase;">
                      Reference Produit
                    </th>
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: left; text-transform: uppercase;">
                      Reference(s) Qualite
                    </th>
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: center; text-transform: uppercase;">
                      Quantite
                    </th>
                    <th style="padding: 8px 12px; border: 1px solid #cccccc;
                               font-family: Arial, sans-serif; font-size: 12px;
                               font-weight: bold; color: #000000;
                               text-align: left; text-transform: uppercase;">
                      Commentaire
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

            </td>
          </tr>
        `;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0;
             font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background-color: #f0f0f0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border: 1px solid #cccccc;">

          <!-- EN-TETE -->
          <tr>
            <td style="background-color: #4c1d95; padding: 24px 28px;
                       text-align: center;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 20px; font-weight: bold;
                        color: #ffffff; letter-spacing: 1px;">
                RAPPORT M5 - QUALITE
              </p>
              <p style="margin: 8px 0 0 0; font-family: Arial, sans-serif;
                        font-size: 13px; color: #c4b5fd;">
                ${jour.charAt(0).toUpperCase() + jour.slice(1)} ${date}
                &nbsp;|&nbsp; ${semaine.toUpperCase()}
              </p>
            </td>
          </tr>

          <!-- RESUME GLOBAL -->
          <tr>
            <td style="background-color: #f0ebff; padding: 14px 28px;
                       border-top: 3px solid #7c3aed;
                       border-bottom: 1px solid #d4c5f0;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 13px; color: #000000;">
                <strong>Resume qualite :</strong>
                &nbsp;&nbsp;
                <strong>${totalLignes} ligne(s)</strong> concernee(s)
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <strong>${totalEntrees} entree(s)</strong> M5
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <strong>${totalM5Global} pieces</strong> au total
              </p>
            </td>
          </tr>

          <!-- CONTENU -->
          <tr>
            <td style="padding: 20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${lignesHtml.length > 0
                  ? lignesHtml
                  : `<tr><td style="padding: 20px; text-align: center;
                                    font-family: Arial, sans-serif;
                                    font-size: 13px; color: #888888;">
                       Aucune non-conformite M5 enregistree pour ce jour.
                     </td></tr>`
                }
              </table>
            </td>
          </tr>

          <!-- PIED DE PAGE -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 14px 28px;
                       border-top: 1px solid #cccccc; text-align: center;">
              <p style="margin: 0; font-family: Arial, sans-serif;
                        font-size: 11px; color: #888888;">
                Genere automatiquement par ProdSeraf a 09h30
                &nbsp;|&nbsp; Ne pas repondre a cet email
              </p>
              <p style="margin: 4px 0 0 0; font-family: Arial, sans-serif;
                        font-size: 10px; color: #aaaaaa;">
                &copy; ${new Date().getFullYear()} ProdSeraf
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // ============================================================
  // TEXTE BRUT M1
  // ============================================================
  private buildM1TextEmail(payload: M1ReportPayload): string {
    const { jour, semaine, date, lignes, totalM1Global } = payload;
    let text = `RAPPORT M1 - MATIERES PREMIERES\n${'='.repeat(50)}\n`;
    text += `Jour : ${jour} ${date} | ${semaine}\n`;
    text += `Total global : ${totalM1Global} pieces\n\n`;

    lignes.forEach(ligne => {
      if (ligne.references.length === 0) return;
      text += `\n--- ${ligne.ligne} (Total: ${ligne.totalM1Ligne}) ---\n`;
      ligne.references.forEach(ref => {
        text += `  Reference : ${ref.reference}`;
        text += ` | MP : ${ref.referencesMP.join(', ') || 'N/A'}`;
        text += ` | Quantite : ${ref.quantite}\n`;
      });
    });

    text += `\n\nGenere automatiquement par ProdSeraf a 09h30.`;
    return text;
  }

  // ============================================================
  // TEXTE BRUT M5
  // ============================================================
  private buildM5TextEmail(payload: M5ReportPayload): string {
    const { jour, semaine, date, lignes, totalM5Global } = payload;
    let text = `RAPPORT M5 - QUALITE\n${'='.repeat(50)}\n`;
    text += `Jour : ${jour} ${date} | ${semaine}\n`;
    text += `Total global : ${totalM5Global} pieces\n\n`;

    lignes.forEach(ligne => {
      if (ligne.references.length === 0) return;
      text += `\n--- ${ligne.ligne} (Total: ${ligne.totalM5Ligne}) ---\n`;
      ligne.references.forEach(ref => {
        text += `  Reference    : ${ref.reference}\n`;
        text += `  Ref. Qualite : ${ref.referenceQualite.join(', ') || 'N/A'}\n`;
        text += `  Quantite     : ${ref.quantite}\n`;
        text += `  Commentaire  : ${ref.commentaire || 'N/A'}\n`;
        text += `  ---\n`;
      });
    });

    text += `\n\nGenere automatiquement par ProdSeraf a 09h30.`;
    return text;
  }
}

// ============================================================
// INTERFACES M1
// ============================================================
export interface M1ReferenceEntry {
  reference: string;
  referencesMP: string[];
  quantite: number;
  semaine: string;
  jour: string;
}

export interface M1LigneReport {
  ligne: string;
  references: M1ReferenceEntry[];
  totalM1Ligne: number;
}

export interface M1ReportPayload {
  jour: string;
  semaine: string;
  date: string;
  lignes: M1LigneReport[];
  totalM1Global: number;
  recipientEmail: string;
}

// ============================================================
// INTERFACES M5
// ============================================================
export interface M5ReferenceEntry {
  reference: string;
  referenceQualite: string[];
  quantite: number;
  commentaire: string;
  semaine: string;
  jour: string;
}

export interface M5LigneReport {
  ligne: string;
  references: M5ReferenceEntry[];
  totalM5Ligne: number;
}

export interface M5ReportPayload {
  jour: string;
  semaine: string;
  date: string;
  lignes: M5LigneReport[];
  totalM5Global: number;
  recipientEmail: string;
}