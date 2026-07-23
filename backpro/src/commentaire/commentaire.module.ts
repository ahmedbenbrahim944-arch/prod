// src/commentaire/commentaire.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentaireService } from './commentaire.service';
import { CommentaireController } from './commentaire.controller';
import { Commentaire } from './entities/commentaire.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commentaire])],
  controllers: [CommentaireController],
  providers: [CommentaireService],
  exports: [CommentaireService],
})
export class CommentaireModule {}