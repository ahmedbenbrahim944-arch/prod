// src/planning-selection/entities/planning-selection.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Selection } from 'src/secteurs/selection/selection.entity';
import { Product } from '../../product/entities/product.entity';
import { Semaine } from '../../semaine/entities/semaine.entity';
import { MatierePremier } from '../../matiere-premier/entities/matiere-premier.entity';

@Entity('planning_selection')
export class PlanningSelection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int' })
  semaine: number;

  @Column({ type: 'int', nullable: true })
  semaineId: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  semaineNom: string | null;

  @ManyToOne(() => Semaine, { nullable: true })
  @JoinColumn({ name: 'semaineId' })
  semaineEntity: Semaine | null;

  // Relation avec la base "sélection"
  // ⚠️ Pas de @ManyToOne/@JoinColumn ici : matricule est int côté planning_selection
  // et varchar côté table selection (types incompatibles pour une vraie FK TypeORM).
  // Ce champ est peuplé manuellement dans le service (loadRelationsForPlanning(s)),
  // il n'est ni persisté ni utilisé pour une jointure automatique.
  @Column()
  matricule: number;

  ouvrier: Selection | null;

  @Column({ type: 'varchar', length: 100 })
  nomPrenom: string;

  @Column({ type: 'varchar', length: 255, default: 'selection' })
  ligne: string;

  // 🆕 MODIFIÉ: reference devient nullable avec valeur par défaut
  @Column({ type: 'varchar', length: 100, default: 'À définir', nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 255 })
  ligneRef: string;

  @Column({ type: 'varchar', length: 50, default: 'product' })
  typeReference: string;

  // ✅ CORRECTION: Ajouter | null au type TypeScript
  @Column({ type: 'int', nullable: true })
  productId: number | null;

  // ✅ CORRECTION: Ajouter | null au type TypeScript
  @Column({ type: 'int', nullable: true })
  matierePremierId: number | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @ManyToOne(() => MatierePremier, { nullable: true })
  @JoinColumn({ name: 'matierePremierId' })
  matierePremier: MatierePremier | null;

  // 🆕 MODIFIÉ: statut avec nouvelle valeur par défaut pour les entrées automatiques
  @Column({ type: 'varchar', length: 50, default: 'en attente' })
  statut: string;

  @Column({ type: 'varchar', length: 100, default: 'non num' })
  numTicket: string;

  // 🆕 MODIFIÉ: qteASelectionne devient nullable avec valeur par défaut 0
  @Column({ type: 'int', default: 0, nullable: true })
  qteASelectionne: number | null;

  // 🆕 MODIFIÉ: objectifHeure devient nullable avec valeur par défaut 0
  @Column({ type: 'int', default: 0, nullable: true })
  objectifHeure: number | null;

  @Column({ type: 'int', default: 0 })
  qteSelection: number;

  @Column({ type: 'int', default: 0 })
  rebut: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  nHeures: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rendement: number;
  
  @Column({ type: 'varchar', length: 3, default: 'non' })
terminer: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}