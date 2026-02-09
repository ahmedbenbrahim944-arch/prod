// src/saisie-non-conf/dto/create-saisie-non-conf.dto.ts
import { IsString, IsNumber, IsDateString, IsOptional, IsIn, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSaisieNonConfDto {
  @IsString()
  @IsIn(['fournisseur', 'interne'])
  sourceType: string;

  @ValidateIf(o => o.sourceType === 'interne')
  @IsString()
  @IsIn(['Essai d\'arrachement', 'Essai de maintenance', 'Machine', 'Main-d\'œuvre', 'Matière'])
  typeInterne?: string;

  @IsString()
  ligne: string;

  @IsString()
  reference: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  qteRebut: number;

  @IsString()
  defauts: string;

  @IsString()
  @IsIn(['MP', 'SE'])
  type: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  sortieLigne: number;

  @IsDateString()
  date: string;

  @IsOptional()
  createdById?: number;

  // NOUVEAU CHAMP : Statut (optionnel, valeur par défaut gérée par l'entité)
  @IsOptional()
  @IsString()
  @IsIn(['en attente', 'déclaré'])
  statut?: string;
}