// dto/admin-dashboard-filter.dto.ts
import { IsOptional, IsDateString, IsString } from 'class-validator';

export class AdminDashboardFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Format ISO: 2026-01-01

  @IsOptional()
  @IsDateString()
  endDate?: string; // Format ISO: 2026-12-31

  @IsOptional()
  @IsString()
  ligne?: string; // Filtrer par ligne spécifique

  @IsOptional()
  @IsString()
  status?: 'active' | 'paused' | 'completed' | 'cancelled' | 'all'; // Filtrer par statut
}