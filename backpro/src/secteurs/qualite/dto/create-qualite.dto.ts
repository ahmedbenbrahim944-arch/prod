import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Poste } from '../qualite.entity';

export class CreateQualiteDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(Poste)
  poste: Poste;
}