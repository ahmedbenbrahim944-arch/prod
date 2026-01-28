// src/planning-selection/dto/create-planning-selection.dto.ts
import { 
  IsNotEmpty, 
  IsNumber, 
  IsString, 
  IsDateString,
  Min,
  IsPositive,
  IsOptional
} from 'class-validator';

export class CreatePlanningSelectionDto {
  @IsNotEmpty({ message: 'La date est obligatoire' })
  @IsDateString({}, { message: 'Format de date invalide (YYYY-MM-DD)' })
  date: string;

  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  @IsNumber({}, { message: 'Le matricule doit être un nombre' })
  @IsPositive({ message: 'Le matricule doit être positif' })
  matricule: number;

  @IsOptional() // Rendre optionnel pour la création automatique
  @IsString({ message: 'La référence doit être une chaîne de caractères' })
  reference?: string; // Peut être Product OU MatierePremier

  @IsOptional() // Rendre optionnel pour la création automatique
  @IsNumber({}, { message: 'La quantité à sélectionner doit être un nombre' })
  @Min(1, { message: 'La quantité à sélectionner doit être supérieure à 0' })
  qteASelectionne?: number;

  @IsOptional() // Rendre optionnel pour la création automatique
  @IsNumber({}, { message: "L'objectif par heure doit être un nombre" })
  @Min(1, { message: "L'objectif par heure doit être supérieur à 0" })
  objectifHeure?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La quantité sélectionnée doit être un nombre' })
  @Min(0, { message: 'La quantité sélectionnée ne peut pas être négative' })
  qteSelection?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Le nombre d\'heures doit être un nombre' })
  @Min(0.1, { message: 'Le nombre d\'heures doit être supérieur à 0' })
  nHeures?: number;

  // ✅ NOUVEAUX CHAMPS
  @IsOptional()
  @IsString({ message: 'Le numéro de ticket doit être une chaîne de caractères' })
  numTicket?: string; // Si non saisi → "non num"

  @IsOptional()
  @IsNumber({}, { message: 'Le rebut doit être un nombre' })
  @Min(0, { message: 'Le rebut ne peut pas être négatif' })
  rebut?: number; // Valeur par défaut: 0
}