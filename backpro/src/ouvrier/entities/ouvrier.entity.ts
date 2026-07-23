// src/ouvrier/entities/ouvrier.entity.ts
import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn
} from 'typeorm';

@Entity('ouvriers')
export class Ouvrier {
  @PrimaryColumn()
  matricule: number;

  @Column({ length: 100 })
  nomPrenom: string;

}