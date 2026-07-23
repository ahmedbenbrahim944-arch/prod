import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn } from 'class-validator';
 
export class CreatePlanificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;
 
  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;
 
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;
 
  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;
 
  // ✅ NOUVEAU : Poste de travail — 'poste1' (6h-14h) ou 'poste2' (14h-22h)
  @IsString()
  @IsOptional()
  @IsIn(['poste1', 'poste2'], { message: 'Le poste doit être poste1 ou poste2' })
  poste?: string;
 
  @IsString()
  @IsOptional()
  of?: string;
 
  @IsNumber()
  @IsOptional()
  qtePlanifiee?: number;
 
  @IsNumber()
  @IsOptional()
  qteModifiee?: number;
 
  @IsString()
  @IsOptional()
  emballage?: string;
 
  @IsString()
  @IsOptional()
  note?: string;
}