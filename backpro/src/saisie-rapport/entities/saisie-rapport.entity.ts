// src/saisie-rapport/entities/saisie-rapport.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index 
} from 'typeorm';

@Entity('saisie_rapports')
@Index(['semaine', 'jour', 'ligne', 'matricule'], { unique: true }) // ✅ CORRECTION : virgule entre chaque champ
export class SaisieRapport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  semaine: string;

  @Column({ type: 'varchar', length: 20 })
  jour: string;

  @Column({ type: 'varchar', length: 50 })
  ligne: string;

  @Column({ type: 'int' })
  matricule: number;

  @Column({ type: 'varchar', length: 100 })
  nomPrenom: string;

  @Column({ type: 'json' })
  phases: { phase: string; heures: number }[];

  @Column({ type: 'float' })
  totalHeuresJour: number;

  @Column({ type: 'float' })
  heuresRestantes: number;

  @Column({ type: 'int' })
  nbPhasesJour: number;

  @Column({ type: 'float', default: 0 })
  pcsProdLigne: number;

  @Column({ type: 'float', default: 0, name: 'pourcentage_total_ecart' })
  pourcentageTotalEcart: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}