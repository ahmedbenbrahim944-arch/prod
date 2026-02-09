// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { Admin } from './admin/entities/admin.entity';
import { User } from './user/entities/user.entity';
import { ProductModule } from './product/product.module';
import { SemaineModule } from './semaine/semaine.module';
import { OuvrierModule } from './ouvrier/ouvrier.module';
import { TempsSecModule } from './temps-sec/temps-sec.module';
import { Phase } from './phase/entities/phase.entity';
import { PhaseModule } from './phase/phase.module';
import { MatierePremierModule } from './matiere-premier/matiere-premier.module';
import { SaisieRapportModule } from './saisie-rapport/saisie-rapport.module';
import { NonConfModule } from './non-conf/non-conf.module';
import { StatsModule } from './stats/stats.module';
import { MagasinModule } from './magasin/magasin.module';
import { StatutModule } from './statut/statut.module';
import { PlanningSelectionModule } from './planning-selection/planning-selection.module';
import { CommentaireModule } from './commentaire/commentaire.module';
import { SaisieNonConfModule } from './saisie-non-conf/saisie-non-conf.module';

@Module({
  imports: [
    // Configuration TypeORM directement ici
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root', // Change selon ta config
      password: '', // Change selon ta config  
      database: 'production', // Change le nom de ta base
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // ⚠️ Mettre à false en production
      logging: true, // Pour voir les requêtes SQL
      autoLoadEntities: true,
      timezone: 'Z',  // Force UTC
  dateStrings: true,  // Garde les dates en string
    }),
    AdminModule,
    UserModule,
    AuthModule,
    ProductModule,
    SemaineModule,
    OuvrierModule,
    TempsSecModule,
    PhaseModule,
    MatierePremierModule,
    SaisieRapportModule,
    NonConfModule,
    StatsModule,
    MagasinModule,
    StatutModule,
    PlanningSelectionModule,
    CommentaireModule,
    SaisieNonConfModule

  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
