// src/non-conf/dto/create-or-update-non-conf.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrUpdateNonConfDto {
  @IsString()
  @IsNotEmpty()
  semaine: string;

  @IsString()
  @IsNotEmpty()
  jour: string;

  @IsString()
  @IsNotEmpty()
  ligne: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsNumber()
  @IsOptional()
  matierePremiere?: number;

  @IsString()
  @IsOptional()
  referenceMatierePremiere?: string;

  @IsNumber()
  @IsOptional()
  absence?: number;

  @IsString()
  @IsOptional()
  matriculesAbsence?: string;

  @IsNumber()
  @IsOptional()
  rendement?: number;

  @IsString()
  @IsOptional()
  matriculesRendement?: string;

  @IsNumber()
  @IsOptional()
  methode?: number;

  @IsNumber()
  @IsOptional()
  maintenance?: number;

  @IsString()
  @IsOptional()
  phasesMaintenance?: string;

  @IsNumber()
  @IsOptional()
  qualite?: number;

  @IsString()
  @IsOptional()
  referenceQualite?: string;

  @IsNumber()
  @IsOptional()
  environnement?: number;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsNumber()
  @IsOptional()
  commentaireId?: number;

  // ✅ FIX : Valeurs fraîches du frontend pour calculer le delta correct.
  // Le modal causes s'ouvre AVANT que le DP soit persisté en base de données.
  // Ces deux champs permettent au service de calculer deltaProd = decProduction - quantiteSource
  // sans dépendre des valeurs périmées lues depuis la table planifications.
  @IsNumber()
  @IsOptional()
  decProduction?: number;

  @IsNumber()
  @IsOptional()
  qteModifiee?: number;
}