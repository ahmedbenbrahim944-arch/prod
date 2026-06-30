import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { TypeStatutManuel, TypeMaladie } from '../entites/statut-manuel.entity';

export class CreateStatutManuelDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(TypeStatutManuel)
  statut: TypeStatutManuel;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsOptional()
  @IsString()
  commentaire?: string;

  // ── Obligatoire uniquement si statut === MALADIE ──
  @ValidateIf((o) => o.statut === TypeStatutManuel.MALADIE)
  @IsEnum(TypeMaladie)
  typeMaladie?: TypeMaladie;

  // ── Optionnel, pertinent seulement si typeMaladie === CERTIFICAT ──
  @ValidateIf((o) => o.typeMaladie === TypeMaladie.CERTIFICAT)
  @IsOptional()
  @IsString()
  nomDocteur?: string;
}