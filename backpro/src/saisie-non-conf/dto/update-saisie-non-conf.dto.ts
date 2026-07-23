// src/saisie-non-conf/dto/update-saisie-non-conf.dto.ts
import { IsString, IsNumber, IsDateString, IsOptional, IsIn, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateSaisieNonConfDto {
  @IsOptional()
  @IsString()
  @IsIn(['fournisseur', 'interne'])
  sourceType?: string;

  @ValidateIf(o => o.sourceType === 'interne')
  @IsOptional()
  @IsString()
  @IsIn(['Essai d\'arrachement', 'Essai de maintenance', 'Machine', 'Main-d\'œuvre', 'Matière'])
  typeInterne?: string;

  @IsOptional()
  @IsString()
  ligne?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  qteRebut?: number;

  @IsOptional()
  @IsString()
  defauts?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MP', 'SE'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  sortieLigne?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  createdById?: number;

  // NOUVEAU CHAMP : Statut
  @IsOptional()
  @IsString()
  @IsIn(['en attente', 'déclaré'])
  statut?: string;
}