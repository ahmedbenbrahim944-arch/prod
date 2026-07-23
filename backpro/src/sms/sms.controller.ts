// src/sms/sms.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UsePipes,
  ValidationPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SmsService } from './sms.service';
import { SendManualSmsDto } from './dto/send-manual-sms.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sms')
@UseGuards(JwtAuthGuard) // toutes les routes SMS nécessitent une auth
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * POST /sms/send-manual
   * 
   * Envoi manuel d'une alerte SMS par l'utilisateur.
   * Body: { ligne, mCategory, comment? }
   * 
   * Exemple de body:
   * {
   *   "ligne": "Ligne A",
   *   "mCategory": "M4",
   *   "comment": "Convoyeur principal bloqué"
   * }
   */
  @Post('send-manual')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async sendManual(@Body() dto: SendManualSmsDto) {
    const result = await this.smsService.sendManualAlert(dto);

    return {
      message: `SMS envoyé avec succès à ${result.recipientCount} destinataire(s)`,
      ...result,
    };
  }

  /**
   * GET /sms/categories
   * 
   * Retourne la liste des catégories M disponibles.
   * Utilisé par le frontend pour alimenter le select.
   */
  @Get('categories')
  getCategories() {
    return {
      categories: this.smsService.getCategoryOptions(),
    };
  }
}