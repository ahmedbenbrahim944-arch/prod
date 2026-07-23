import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResumeProductionDto {
  @IsNotEmpty()
  sessionId: number;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}