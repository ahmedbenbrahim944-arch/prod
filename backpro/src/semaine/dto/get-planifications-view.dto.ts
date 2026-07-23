// src/semaine/dto/get-planifications-view.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GetPlanificationsViewDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;
}