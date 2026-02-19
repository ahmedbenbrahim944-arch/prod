import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PauseSession } from './pause-session.entity';

@Entity('production_sessions')
export class ProductionSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ligne: string;

  @Column()
  ligneId: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  startedBy: User;

  @CreateDateColumn()
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ default: 'active' })
  status: 'active' | 'paused' | 'completed' | 'cancelled';

  @Column({ nullable: true })
  productType: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @OneToMany(() => PauseSession, pause => pause.productionSession, { cascade: true })
  pauses: PauseSession[];

  @Column({ default: 0 })
  totalProductionSeconds: number;

  @Column({ default: 0 })
  totalPauseSeconds: number;

  @Column({ nullable: true })
  quantityProduced: number;

  @Column({ nullable: true })
  qualityStatus: string;

  @Column({ nullable: true })
  userName: string; // Nom de l'utilisateur pour affichage
  
}