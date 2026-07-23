// src/sms/dto/send-manual-sms.dto.ts
import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class SendManualSmsDto {
  @IsString()
  ligne: string;

  @IsString()
  @IsIn(['M1', 'M2', 'M3', 'M4', 'M5', 'M6'], {
    message: 'mCategory doit être M1, M2, M3, M4, M5 ou M6',
  })
  mCategory: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Le commentaire ne peut pas dépasser 200 caractères' })
  comment?: string;
}