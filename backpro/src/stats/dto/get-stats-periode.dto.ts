import { IsString, IsDateString, IsOptional } from 'class-validator';

export class GetStatsPeriodeDto {
  @IsString()
  @IsDateString()
  dateDebut: string;

  @IsString()
  @IsDateString()
  dateFin: string;
}