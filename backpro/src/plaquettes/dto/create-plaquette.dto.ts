// src/plaquettes/dto/create-plaquette.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlaquetteDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  semaineId: number;

  @IsString()
  @IsNotEmpty()
  ligne: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  // ID du matricule machine — doit exister dans matricules_machines
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  matriculeMachineId: number;

  // ID du type plaquette — obligatoire, doit exister dans type_plaquettes
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  typePlaquetteId: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantiteDonnee: number;
}