// update-planning-selection.dto.ts
import { 
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  Min
} from 'class-validator';

export class UpdatePlanningSelectionDto {
  @IsOptional()
  @IsNumber({}, { message: 'Le nombre d\'heures doit être un nombre' })
  @Min(0.1, { message: 'Le nombre d\'heures doit être supérieur à 0' })
  nHeures?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La quantité sélectionnée doit être un nombre' })
  @Min(0, { message: 'La quantité sélectionnée ne peut pas être négative' })
  qteSelection?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Le rebut doit être un nombre' })
  @Min(0, { message: 'Le rebut ne peut pas être négatif' })
  rebut?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La quantité à sélectionner doit être un nombre' })
  @Min(1, { message: 'La quantité à sélectionner doit être supérieure à 0' })
  qteASelectionne?: number;

  @IsOptional()
  @IsNumber({}, { message: "L'objectif par heure doit être un nombre" })
  @Min(1, { message: "L'objectif par heure doit être supérieur à 0" })
  objectifHeure?: number;

  @IsOptional()
  @IsString({ message: 'La référence doit être une chaîne de caractères' })
  reference?: string;

  @IsOptional()
  @IsString({ message: 'Le numéro de ticket doit être une chaîne de caractères' })
  numTicket?: string;

  @IsOptional()
  @IsString()
  @IsIn(['oui', 'non'], { message: 'terminer doit être "oui" ou "non"' })
  terminer?: string;

  // ✅ AJOUTER CETTE LIGNE
  @IsOptional()
  @IsString({ message: 'Le statut doit être une chaîne de caractères' })
  statut?: string;
}