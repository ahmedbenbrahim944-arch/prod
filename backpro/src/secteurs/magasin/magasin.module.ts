import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Magasin } from './magasin.entity';
import { MagasinService } from './magasin.service';
import { MagasinController } from './magasin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Magasin])],
  controllers: [MagasinController],
  providers: [MagasinService],
})
export class MagasinModule {}