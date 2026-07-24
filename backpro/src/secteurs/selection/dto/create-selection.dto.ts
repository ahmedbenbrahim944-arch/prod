import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Poste } from '../selection.entity';

export class CreateSelectionDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  nomPrenom: string;

  @IsEnum(Poste)
  poste: Poste;
}