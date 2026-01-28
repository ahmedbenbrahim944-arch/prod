// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Admin } from './entities/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]) // Import de l'entity Admin
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService], // Export pour utiliser dans AuthModule
})
export class AdminModule {}