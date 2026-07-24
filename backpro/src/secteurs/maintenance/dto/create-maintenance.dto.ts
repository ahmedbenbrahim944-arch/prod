import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Poste } from '../maintenance.entity';

export class CreateMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(Poste)
  poste: Poste;
}