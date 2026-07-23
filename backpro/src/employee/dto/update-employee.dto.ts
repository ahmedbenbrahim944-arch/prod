// src/employee/dto/update-employee.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { SituationFamiliale } from '../entities/employee.entity';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  matricule?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  nomPrenom?: string;

  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  cin?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s\-]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  numTel?: string;

  @IsOptional()
  @IsDateString()
  dateEmbauche?: string;

  @IsOptional()
  @IsEnum(SituationFamiliale, {
    message: `situationFamiliale doit être : ${Object.values(SituationFamiliale).join(', ')}`,
  })
  situationFamiliale?: SituationFamiliale;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  bus?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  lieu?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  service?: string;
}