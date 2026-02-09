// src/non-conf/non-conf.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NonConfController } from './non-conf.controller';
import { NonConfService } from './non-conf.service';
import { NonConformite } from './entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { Commentaire } from '../commentaire/entities/commentaire.entity'; // AJOUTÉ
import { SemaineModule } from '../semaine/semaine.module';
import { CommentaireModule } from '../commentaire/commentaire.module'; // AJOUTÉ

@Module({
  imports: [
    TypeOrmModule.forFeature([NonConformite, Planification, Commentaire]), // AJOUTÉ Commentaire
    forwardRef(() => SemaineModule),
    forwardRef(() => CommentaireModule) // AJOUTÉ
  ],
  controllers: [NonConfController],
  providers: [NonConfService],
  exports: [NonConfService]
})
export class NonConfModule {}