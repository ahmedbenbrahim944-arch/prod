import { IsInt, Min } from 'class-validator';

export class CreateAutosaisieMatriculeDto {
  @IsInt()
  @Min(1)
  matricule: number;
}