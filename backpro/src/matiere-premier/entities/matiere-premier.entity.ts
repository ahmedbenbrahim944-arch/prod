// src/matiere-premier/entities/matiere-premier.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column,
  Index
} from 'typeorm';

@Entity('matiere_premier')
export class MatierePremier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  @Index()
  ligne: string;

  @Column({ length: 50 })
  @Index()
  refMatierePremier: string;
}