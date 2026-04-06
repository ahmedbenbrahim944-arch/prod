// src/plann-mag/entities/matiere-premiere.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('matiere_premiere')
export class MatierePremiere {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  ligne: string;

  @Column({ type: 'varchar', length: 50, name: 'reference_ligne' })
  referenceLigne: string;

  @Column({ type: 'varchar', length: 50, name: 'ref_mp' })
  refMp: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'coeff_impiego' })
  coeffImpiego: number;
}