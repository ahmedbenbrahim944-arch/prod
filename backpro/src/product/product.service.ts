// src/product/product.service.ts
import { 
  Injectable, 
  NotFoundException,
  ConflictException,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { Admin } from '../admin/entities/admin.entity';
import { AddReferencesDto } from './dto/add-references.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Créer une nouvelle ligne avec ses références et image
   */
  async create(createProductDto: CreateProductDto, admin: Admin, imageFile?: any): Promise<{ 
    ligne: string, 
    references: string[],
    imageUrl?: string 
  }> {
    const { ligne, references } = createProductDto;

    // Vérifier si la ligne existe déjà
    const existingLine = await this.productRepository.findOne({
      where: { ligne }
    });

    if (existingLine) {
      throw new ConflictException(`La ligne "${ligne}" existe déjà`);
    }

    // Vérifier si des références existent déjà
    const existingReferences = await this.productRepository.find({
      where: { reference: In(references) }
    });

    if (existingReferences.length > 0) {
      const existingRefs = existingReferences.map(ref => ref.reference);
      throw new ConflictException(`Les références suivantes existent déjà: ${existingRefs.join(', ')}`);
    }

    try {
      // Préparer l'URL de l'image si elle existe
      const imageUrl = imageFile ? `/uploads/products/${imageFile.filename}` : null;
      const imageOriginalName = imageFile ? imageFile.originalname : null;

      // Créer chaque référence comme un produit individuel
      const products = references.map(reference => {
        const product = new Product();
        product.ligne = ligne;
        product.reference = reference;
        product.imageUrl = imageUrl;
        product.imageOriginalName = imageOriginalName;
        product.createdBy = admin;
        return product;
      });

      await this.productRepository.save(products);

      const result: { ligne: string, references: string[], imageUrl?: string } = { 
        ligne, 
        references 
      };
      
      if (imageUrl) {
        result.imageUrl = imageUrl;
      }

      return result;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Une ligne ou référence existe déjà');
      }
      throw new InternalServerErrorException('Erreur lors de la création des produits');
    }
  }

  /**
   * Récupérer toutes les lignes distinctes avec leurs références
   */
  async findAllLines(): Promise<{ lines: any[], total: number }> {
    // Récupérer toutes les lignes distinctes avec leurs images
    const lines = await this.productRepository
      .createQueryBuilder('product')
      .select('product.ligne')
      .addSelect('COUNT(product.reference)', 'referenceCount')
      .addSelect('MAX(product.createdAt)', 'lastCreated')
      .addSelect('product.imageUrl')
      .addSelect('product.imageOriginalName')
      .groupBy('product.ligne')
      .addGroupBy('product.imageUrl')
      .addGroupBy('product.imageOriginalName')
      .orderBy('lastCreated', 'DESC')
      .getRawMany();

    // Pour chaque ligne, récupérer ses références
    const linesWithReferences = await Promise.all(
      lines.map(async (line) => {
        const references = await this.productRepository.find({
          where: { ligne: line.product_ligne },
          select: ['reference', 'createdAt'],
          order: { createdAt: 'DESC' }
        });

        return {
          ligne: line.product_ligne,
          referenceCount: line.referenceCount,
          lastCreated: line.lastCreated,
          imageUrl: line.product_imageUrl,
          imageOriginalName: line.product_imageOriginalName,
          references: references.map(ref => ref.reference)
        };
      })
    );

    return { lines: linesWithReferences, total: lines.length };
  }

  /**
   * Récupérer une ligne spécifique avec toutes ses références
   */
  async findOneLine(ligne: string): Promise<any> {
    const products = await this.productRepository.find({
      where: { ligne },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' }
    });

    if (products.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    return {
      ligne,
      references: products.map(product => product.reference),
      totalReferences: products.length,
      imageUrl: products[0].imageUrl,
      imageOriginalName: products[0].imageOriginalName,
      createdBy: products[0].createdBy,
      createdAt: products[0].createdAt
    };
  }

  /**
   * Rechercher une ligne spécifique et retourner toutes ses références
   */
  async searchLine(ligne: string): Promise<any> {
    const products = await this.productRepository.find({
      where: { ligne },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' }
    });

    if (products.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    return {
      ligne,
      references: products.map(product => product.reference),
      totalReferences: products.length,
      imageUrl: products[0].imageUrl,
      imageOriginalName: products[0].imageOriginalName,
      createdBy: products[0].createdBy,
      createdAt: products[0].createdAt
    };
  }

  /**
   * Ajouter des références à une ligne existante
   */
  async addReferences(ligne: string, references: string[], admin: Admin): Promise<{ ligne: string, addedReferences: string[] }> {
    const existingProducts = await this.productRepository.find({
      where: { ligne }
    });

    if (existingProducts.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    const existingReferences = await this.productRepository.find({
      where: { reference: In(references) }
    });

    if (existingReferences.length > 0) {
      const existingRefs = existingReferences.map(ref => ref.reference);
      throw new ConflictException(`Les références suivantes existent déjà: ${existingRefs.join(', ')}`);
    }

    // Récupérer l'image de la ligne existante
    const existingImage = existingProducts[0].imageUrl;
    const existingImageName = existingProducts[0].imageOriginalName;

    const newProducts = references.map(reference => {
      const product = new Product();
      product.ligne = ligne;
      product.reference = reference;
      product.imageUrl = existingImage;
      product.imageOriginalName = existingImageName;
      product.createdBy = admin;
      return product;
    });

    await this.productRepository.save(newProducts);

    return { ligne, addedReferences: references };
  }

  /**
   * Ajouter des références à une ligne (avec body complet)
   */
  async addReferencesToLine(addReferencesDto: AddReferencesDto, admin: Admin): Promise<{ 
    ligne: string, 
    addedReferences: string[], 
    existingReferences: string[] 
  }> {
    const { ligne, references } = addReferencesDto;

    const existingProducts = await this.productRepository.find({
      where: { ligne }
    });

    if (existingProducts.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    const existingReferences = await this.productRepository.find({
      where: { reference: In(references) }
    });

    const existingRefs = existingReferences.map(ref => ref.reference);
    const newReferences = references.filter(ref => !existingRefs.includes(ref));

    if (newReferences.length === 0) {
      throw new ConflictException('Toutes les références existent déjà');
    }

    // Récupérer l'image de la ligne existante
    const existingImage = existingProducts[0].imageUrl;
    const existingImageName = existingProducts[0].imageOriginalName;

    const newProducts = newReferences.map(reference => {
      const product = new Product();
      product.ligne = ligne;
      product.reference = reference;
      product.imageUrl = existingImage;
      product.imageOriginalName = existingImageName;
      product.createdBy = admin;
      return product;
    });

    await this.productRepository.save(newProducts);

    return { 
      ligne, 
      addedReferences: newReferences, 
      existingReferences: existingRefs 
    };
  }

  /**
   * Ajouter une image à une ligne existante
   */
  async addImageToLine(ligne: string, imageFile: any, admin: Admin): Promise<{ ligne: string, imageUrl: string }> {
    const products = await this.productRepository.find({
      where: { ligne }
    });

    if (products.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    const imageUrl = `/uploads/products/${imageFile.filename}`;

    // Mettre à jour tous les produits de cette ligne
    for (const product of products) {
      product.imageUrl = imageUrl;
      product.imageOriginalName = imageFile.originalname;
      await this.productRepository.save(product);
    }

    return { ligne, imageUrl };
  }

  /**
   * Supprimer une ligne et toutes ses références
   */
  async removeLine(ligne: string): Promise<void> {
    const products = await this.productRepository.find({
      where: { ligne }
    });

    if (products.length === 0) {
      throw new NotFoundException(`Ligne "${ligne}" introuvable`);
    }

    await this.productRepository.remove(products);
  }

  /**
   * Vérifier si une ligne existe
   */
  async lineExists(ligne: string): Promise<boolean> {
    const count = await this.productRepository.count({
      where: { ligne }
    });
    return count > 0;
  }

  /**
   * Compter le nombre total de lignes
   */
  async countLines(): Promise<number> {
    const result = await this.productRepository
      .createQueryBuilder('product')
      .select('COUNT(DISTINCT product.ligne)', 'count')
      .getRawOne();
    
    return parseInt(result.count);
  }
}