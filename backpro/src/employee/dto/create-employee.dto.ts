import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { SituationFamiliale } from '../entities/employee.entity';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  matricule: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  nomPrenom: string;

  @IsDateString()
  @IsNotEmpty()
  dateNaissance: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 20)
  cin: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+\s\-]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  numTel: string;

  @IsDateString()
  @IsNotEmpty()
  dateEmbauche: string;

  @IsEnum(SituationFamiliale)
  @IsNotEmpty()
  situationFamiliale: SituationFamiliale;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  bus?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  lieu: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  service: string;
}