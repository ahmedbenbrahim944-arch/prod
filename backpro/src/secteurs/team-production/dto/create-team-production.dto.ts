import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Poste } from '../team-production.entity';

export class CreateTeamProductionDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(Poste)
  poste: Poste;
}