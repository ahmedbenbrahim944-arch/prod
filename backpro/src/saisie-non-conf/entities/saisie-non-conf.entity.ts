// src/saisie-non-conf/entities/saisie-non-conf.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Admin } from '../../admin/entities/admin.entity';

@Entity('saisie_non_conf')
@Index(['sourceType', 'typeInterne', 'ligne', 'reference', 'date'], { unique: false })
export class SaisieNonConf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'fournisseur'
  })
  sourceType: string;

  @Column({ 
    type: 'varchar', 
    length: 50,
    nullable: true 
  })
  typeInterne: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  ligne: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  reference: string;

  @Column({ type: 'int', default: 0 })
  qteRebut: number;

  @Column({ type: 'text', nullable: true })
  defauts: string;

  @Column({ type: 'varchar', length: 10, default: 'MP' })
  type: string;

  @Column({ type: 'int', default: 0 })
  sortieLigne: number;

  @Column({ type: 'date' })
  date: Date;

  // NOUVEAU CHAMP : Statut
  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'en attente' // Valeur par défaut
  })
  @Index()
  statut: string; // 'en attente' | 'déclaré'

  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Admin;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}