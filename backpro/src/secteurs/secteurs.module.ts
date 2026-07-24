import { Module } from '@nestjs/common';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MagasinModule } from './magasin/magasin.module';
import { QualiteModule } from './qualite/qualite.module';
import { SelectionModule } from './selection/selection.module';
import { TeamProductionModule } from './team-production/team-production.module';

@Module({
  imports: [
    MaintenanceModule,
    MagasinModule,
    QualiteModule,
    SelectionModule,
    TeamProductionModule,
  ],
})
export class SecteursModule {}