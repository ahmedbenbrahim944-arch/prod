// src/temps-sec/entities/temps-sec.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';

@Entity('temps_sec')
export class TempsSec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  ligne: string;

  @Column({ length: 50 })
  reference: string;

  @Column({ type: 'int' })
  seconde: number;

  
}