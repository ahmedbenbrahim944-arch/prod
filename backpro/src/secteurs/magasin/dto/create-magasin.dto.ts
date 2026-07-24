import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Poste } from '../magasin.entity';

export class CreateMagasinDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(Poste)
  poste: Poste;
}