// src/phase/entities/phase.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column,
  Index
} from 'typeorm';

@Entity('phases')
export class Phase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  @Index() // Index pour améliorer les performances de recherche
  ligne: string;

  @Column({ length: 10 })
  phase: string;
}