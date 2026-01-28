// src/stats/dto/get-affectation-personnel.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GetAffectationPersonnelDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;
}