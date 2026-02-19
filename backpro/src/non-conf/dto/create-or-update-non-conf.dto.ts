// src/non-conf/dto/create-or-update-non-conf.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional, Min, Matches } from 'class-validator';

export class CreateOrUpdateNonConfDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;

  @IsNumber()
  @Min(0, { message: 'Matière première doit être positif ou zéro' })
  @IsOptional()
  matierePremiere?: number;

  @IsString()
  @IsOptional()
  referenceMatierePremiere?: string;

  @IsNumber()
  @Min(0, { message: 'Absence doit être positif ou zéro' })
  @IsOptional()
  absence?: number;

  @IsString()
  @IsOptional()
  @Matches(/^(\d+(,\d+)*)?$/, {
    message: 'Format invalide pour les matricules. Utilisez: 1234,5678,91011'
  })
  matriculesAbsence?: string;

  @IsNumber()
  @Min(0, { message: 'Rendement doit être positif ou zéro' })
  @IsOptional()
  rendement?: number;

   @IsString()
  @IsOptional()
  @Matches(/^(\d+(,\d+)*)?$/, {
    message: 'Format invalide pour les matricules. Utilisez: 1234,5678,91011'
  })
  matriculesRendement?: string; 

  @IsNumber()
  @Min(0, { message: 'Méthode doit être positif ou zéro' })
  @IsOptional()
  methode?: number;

  @IsNumber()
  @Min(0, { message: 'Maintenance doit être positif ou zéro' })
  @IsOptional()
  maintenance?: number;

  @IsString()
@IsOptional()
@Matches(/^(\d+(,\d+)*)?$/, {
  message: 'Format invalide pour les phases maintenance. Utilisez: 1,2,3'
})
phasesMaintenance?: string;

  @IsNumber()
  @Min(0, { message: 'Qualité doit être positif ou zéro' })
  @IsOptional()
  qualite?: number;

  @IsString()
  @IsOptional()
  referenceQualite?: string;

  // === NOUVEAU CHAMP : ID DU COMMENTAIRE ===
  @IsNumber()
  @IsOptional()
  commentaireId?: number; // ID du commentaire sélectionné
  // ==========================================

  @IsNumber()
  @Min(0, { message: 'Environnement doit être positif ou zéro' })
  @IsOptional()
  environnement?: number;

  @IsString()
  @IsOptional()
  commentaire?: string; // Garder pour commentaire libre
}