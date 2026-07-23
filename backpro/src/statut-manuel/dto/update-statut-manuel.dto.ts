import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { TypeStatutManuel, TypeMaladie } from '../entites/statut-manuel.entity';

export class UpdateStatutManuelDto {
  @IsOptional()
  @IsString()
  matricule?: string;

  @IsOptional()
  @IsString()
  nomPrenom?: string;

  @IsOptional()
  @IsEnum(TypeStatutManuel)
  statut?: TypeStatutManuel;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  commentaire?: string;

  @IsOptional()
  @IsEnum(TypeMaladie)
  typeMaladie?: TypeMaladie;

  @IsOptional()
  @IsString()
  nomDocteur?: string;
}