import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Qualite } from './qualite.entity';
import { QualiteService } from './qualite.service';
import { QualiteController } from './qualite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Qualite])],
  controllers: [QualiteController],
  providers: [QualiteService],
})
export class QualiteModule {}