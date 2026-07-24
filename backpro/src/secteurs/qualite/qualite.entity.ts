import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum Poste {
  PREMIERE = '1ere poste',
  DEUXIEME = '2eme poste',
}

@Entity('qualite')
export class Qualite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  matricule: string;

  @Column()
  nomPrenom: string;

  @Column({
    type: 'enum',
    enum: Poste,
  })
  poste: Poste;
}