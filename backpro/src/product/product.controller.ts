// src/product/product.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete,
  Patch,
  Query,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  Req,
  ParseArrayPipe,
  UseInterceptors,
  UploadedFile,
  Res
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchLineDto } from './dto/search-line.dto';
import { AddReferencesDto } from './dto/add-references.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { multerConfig } from '../config/multer.config';
import * as fs from 'fs';
import * as path from 'path';


@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // === ROUTES ADMIN === //

  // Créer une nouvelle ligne avec références ET image
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(
    @Body() createProductDto: CreateProductDto, 
    @UploadedFile() imageFile: any,
    @Req() req
  ) {
    const result = await this.productService.create(createProductDto, req.user, imageFile);
    
    let message = 'Ligne créée avec succès';
    if (imageFile) {
      message += ' avec image';
    }
    
    return {
      message,
      ...result
    };
  }

  // Recherche d'une ligne spécifique (avec body)
  @Post('search')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async searchLine(@Body() searchLineDto: SearchLineDto) {
    const result = await this.productService.searchLine(searchLineDto.ligne);
    
    return {
      message: 'Ligne trouvée avec succès',
      ...result
    };
  }

  // Ajouter des références à une ligne existante
  @Patch('lines/:ligne/references')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async addReferences(
    @Param('ligne') ligne: string,
    @Body('references', new ParseArrayPipe({ items: String, separator: ',' })) references: string[],
    @Req() req
  ) {
    const result = await this.productService.addReferences(ligne, references, req.user);
    
    return {
      message: 'Références ajoutées avec succès',
      ...result
    };
  }

  // Ajouter des références à une ligne (avec body complet)
  @Post('ajouterref')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async addReferencesToLine(@Body() addReferencesDto: AddReferencesDto, @Req() req) {
    const result = await this.productService.addReferencesToLine(addReferencesDto, req.user);
    
    let message = 'Références ajoutées avec succès';
    if (result.existingReferences.length > 0) {
      message = `${result.addedReferences.length} référence(s) ajoutée(s), ${result.existingReferences.length} référence(s) existaient déjà`;
    }
    
    return {
      message,
      ...result
    };
  }

  // Ajouter une image à une ligne existante
  @Post('lines/:ligne/image')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async addImageToLine(
    @Param('ligne') ligne: string,
    @UploadedFile() imageFile: any,
    @Req() req
  ) {
    const result = await this.productService.addImageToLine(ligne, imageFile, req.user);
    
    return {
      message: 'Image ajoutée avec succès',
      ...result
    };
  }

  // Supprimer une ligne complète
  @Delete('lines/:ligne')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async removeLine(@Param('ligne') ligne: string) {
    await this.productService.removeLine(ligne);
    return { message: `Ligne "${ligne}" et toutes ses références supprimées avec succès` };
  }

  // === ROUTES PUBLIQUES === //

  // Récupérer toutes les lignes
  @Get('lines')
  async findAllLines() {
    const result = await this.productService.findAllLines();
    
    return {
      lines: result.lines,
      total: result.total
    };
  }

  // Récupérer une ligne spécifique (par URL)
  @Get('lines/:ligne')
  async findOneLine(@Param('ligne') ligne: string) {
    return await this.productService.findOneLine(ligne);
  }

  // Récupérer l'image d'une ligne
  @Get('lines/:ligne/image')
  async getLineImage(@Param('ligne') ligne: string) {
    const result = await this.productService.findOneLine(ligne);
    return {
      ligne: result.ligne,
      imageUrl: result.imageUrl,
      imageOriginalName: result.imageOriginalName
    };
  }

  // Servir les fichiers uploadés
  @Get('uploads/products/:filename')
  serveProductImage(@Param('filename') filename: string, @Res() res) {
    return res.sendFile(filename, { root: './uploads/products' });
  }

  // Recherche simple
  @Get('search')
  async searchLines(@Query('q') query: string) {
    if (!query) {
      return this.findAllLines();
    }

    // Recherche avec await
    const searchResults = await this.productRepository
      .createQueryBuilder('product')
      .select('product.ligne')
      .addSelect('COUNT(product.reference)', 'referenceCount')
      .addSelect('MAX(product.createdAt)', 'lastCreated')
      .addSelect('product.imageUrl')
      .addSelect('product.imageOriginalName')
      .where('product.ligne LIKE :query', { query: `%${query}%` })
      .groupBy('product.ligne')
      .addGroupBy('product.imageUrl')
      .addGroupBy('product.imageOriginalName')
      .orderBy('lastCreated', 'DESC')
      .getRawMany();

    const linesWithReferences = await Promise.all(
      searchResults.map(async (line) => {
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

    return {
      lines: linesWithReferences,
      query: query
    };
  }

  // Vérifier si une ligne existe
  @Get('lines/:ligne/exists')
  async lineExists(@Param('ligne') ligne: string) {
    const exists = await this.productService.lineExists(ligne);
    return { ligne, exists };
  }

  // Statistiques
  @Get('stats')
  async getStats() {
    const totalLines = await this.productService.countLines();
    return { totalLines };
  }

  @Get('debug/upload-status')
async debugUploadStatus() {
  const uploadsPath = path.join(process.cwd(), 'uploads', 'products');
  
  try {
    // Vérifier si le dossier existe
    const folderExists = fs.existsSync(uploadsPath);
    
    // Lister les fichiers avec typage correct
    let files: string[] = [];
    if (folderExists) {
      files = fs.readdirSync(uploadsPath) as string[];
    }
    
    // Vérifier les permissions
    let canWrite = false;
    if (folderExists) {
      try {
        const testFile = path.join(uploadsPath, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        canWrite = true;
      } catch (e) {
        canWrite = false;
      }
    }
    
    return {
      currentDirectory: process.cwd(),
      uploadsPath: uploadsPath,
      folderExists: folderExists,
      canWrite: canWrite,
      files: files,
      totalFiles: files.length
    };
  } catch (error: any) {
    return {
      error: error.message,
      currentDirectory: process.cwd(),
      uploadsPath: uploadsPath
    };
  }
}
}