// src/admin/admin.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete,
  Patch,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  ClassSerializerInterceptor,
  UseInterceptors
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('admin')
@UseInterceptors(ClassSerializerInterceptor) // Exclure les champs @Exclude()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Route publique pour créer le premier admin
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() createAdminDto: CreateAdminDto) {
    const admin = await this.adminService.createAdmin(createAdminDto);
    
    return {
      message: 'Admin créé avec succès',
      admin: {
        id: admin.id,
        nom: admin.nom,
        prenom: admin.prenom,
        createdAt: admin.createdAt
      },
    };
  }

  // Routes protégées - Seulement pour les admins connectés
  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAll() {
    return await this.adminService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(@Param('id') id: string) {
    return await this.adminService.findOneById(+id);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async toggleActive(@Param('id') id: string) {
    return await this.adminService.toggleActive(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id') id: string) {
    await this.adminService.remove(+id);
    return { message: 'Admin supprimé avec succès' };
  }
}