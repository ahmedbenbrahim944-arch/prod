// pause-session.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { ProductionSession } from './production-session.entity';
import { User } from '../../user/entities/user.entity';

@Entity('pause_sessions')
export class PauseSession {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionSession, session => session.pauses, { onDelete: 'CASCADE' })
  productionSession: ProductionSession;

  @CreateDateColumn()
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column()
  mCategory: string; // M1, M2, M3, M4, M5, M6

  @Column({ nullable: true })
  subCategory: string;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  actionTaken: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  recordedBy: User;

  @Column({ default: 0 })
  durationSeconds: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true })
  userName: string; // Nom de l'utilisateur pour affichage

  // ✅ NOUVEAU: Pièces perdues pendant cette pause
  @Column({ default: 0 })
  lostPieces: number;

  // ✅ Références selon catégorie
  @Column({ type: 'simple-array', nullable: true })
  matierePremierRefs: string[]; // Pour M1

  @Column({ type: 'simple-array', nullable: true })
  productRefs: string[]; // Pour M5

  @Column({ type: 'simple-array', nullable: true })
  phasesEnPanne: string[]; // Pour M4
}