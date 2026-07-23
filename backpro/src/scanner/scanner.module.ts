// src/scanner/scanner.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerRecord } from './entities/scanner-record.entity';
import { CodeProduit } from './entities/code-produit.entity';
import { SemaineModule } from '../semaine/semaine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScannerRecord, CodeProduit]),
    SemaineModule, // pour accéder à l'entité Semaine
  ],
  controllers: [ScannerController],
  providers: [ScannerService],
  exports: [ScannerService],
})
export class ScannerModule {}