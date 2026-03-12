// src/scanner/dto/create-scan.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  fullnumber: string;

  @IsNumber()
  semaineId: number;

  @IsNumber()
  scanneParId: number;

  /**
   * Optionnel — fourni seulement si l'utilisateur a choisi manuellement
   * une ligne parmi plusieurs (code produit avec plusieurs lignes).
   */
  // 'L1', 'L2', ou absent/null = vide
  @IsOptional()
  @IsString()
  ligneChoix?: 'L1' | 'L2' | null;
}