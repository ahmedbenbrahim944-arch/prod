// src/product/entities/product.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  Index
} from 'typeorm';
import { Admin } from '../../admin/entities/admin.entity';

@Entity('products')
@Index(['ligne', 'reference'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  ligne: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  reference: string;

  @Column({ type: 'varchar', nullable: true, default: null }) // ✅ nullable avec default null
  imageUrl: string | null; // ✅ string ou null

  @Column({ type: 'varchar', nullable: true, default: null }) // ✅ nullable avec default null
  imageOriginalName: string | null; // ✅ string ou null

  @ManyToOne(() => Admin, (admin) => admin.productsCreated)
  createdBy: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}