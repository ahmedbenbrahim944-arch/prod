// src/non-conf/non-conf.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NonConfController } from './non-conf.controller';
import { NonConfService } from './non-conf.service';
import { NonConformite } from './entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { Commentaire } from '../commentaire/entities/commentaire.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity'; // AJOUTEZ CE IMPORT
import { SemaineModule } from '../semaine/semaine.module';
import { CommentaireModule } from '../commentaire/commentaire.module';
import { Phase } from 'src/phase/entities/phase.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NonConformite, 
      Planification, 
      Commentaire, 
      Ouvrier, 
       Phase
    ]),
    forwardRef(() => SemaineModule),
    forwardRef(() => CommentaireModule)
  ],
  controllers: [NonConfController],
  providers: [NonConfService],
  exports: [NonConfService]
})
export class NonConfModule {}