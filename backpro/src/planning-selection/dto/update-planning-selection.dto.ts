// src/planning-selection/dto/update-planning-selection.dto.ts
import { 
  IsOptional,
  IsNumber,
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
  qteSelection?: number; // Fourni manuellement

  // ✅ NOUVEAU CHAMP
  @IsOptional()
  @IsNumber({}, { message: 'Le rebut doit être un nombre' })
  @Min(0, { message: 'Le rebut ne peut pas être négatif' })
  rebut?: number; // Utilisé pour calculer le rendement
}