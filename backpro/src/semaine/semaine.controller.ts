// src/semaine/semaine.controller.ts - Version simplifiée
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  UsePipes, 
  ValidationPipe,
  Patch,
  ParseIntPipe,
  Delete,
  Req
} from '@nestjs/common';
import { SemaineService } from './semaine.service';
import { CreateSemaineDto } from './dto/create-semaine.dto';
import { CreatePlanificationDto } from './dto/create-planification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { UpdatePlanificationByCriteriaDto } from './dto/update-planification-by-criteria.dto';
import { GetPlanificationsViewDto } from './dto/get-planifications-view.dto';
import { UpdateProductionPlanificationDto } from './dto/update-production-planification.dto';
import { GetPlanificationsVuProdDto } from './dto/get-planifications-vuprod.dto';
import { UpdateMagasinPlanificationDto } from './dto/update-magasin-planification.dto';


@Controller()
export class SemaineController {
  constructor(private readonly semaineService: SemaineService) {}

  // ==================== SEMAINES ====================
  @Post('semaines')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createSemaine(@Body() createSemaineDto: CreateSemaineDto, @Req() req) {
    return this.semaineService.createSemaine(createSemaineDto, req.user);
  }

  @Get('semaines')
  @UseGuards(JwtAuthGuard,AdminRoleGuard)
  async getSemaines() {
    return this.semaineService.getSemaines();
  }

  @Delete('semaines/:id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async deleteSemaine(@Param('id', ParseIntPipe) id: number) {
    return this.semaineService.deleteSemaine(id);
  }

  // ==================== PLANIFICATIONS (ADMIN) ====================
  @Post('planifications')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createPlanification(@Body() createPlanificationDto: CreatePlanificationDto) {
    return this.semaineService.createPlanification(createPlanificationDto);
  }

  @Get('planifications')
  @UseGuards(JwtAuthGuard)
  async getAllPlanifications() {
    return this.semaineService.getAllPlanifications();
  }

  @Get('planifications/semaine/:semaine')
  @UseGuards(JwtAuthGuard)
  async getPlanificationsBySemaine(@Param('semaine') semaine: string) {
    return this.semaineService.getPlanificationsBySemaine(semaine);
  }

  @Patch('planifications')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updatePlanificationByCriteria(@Body() updatePlanificationDto: UpdatePlanificationByCriteriaDto) {
    return this.semaineService.updatePlanificationByCriteria(updatePlanificationDto);
  }

  @Delete('planifications/:id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async deletePlanification(@Param('id', ParseIntPipe) id: number) {
    return this.semaineService.deletePlanification(id);
  }

  // ==================== VUE UTILISATEUR ====================
  @Post('planifications/vue')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getPlanificationsView(@Body() getPlanificationsViewDto: GetPlanificationsViewDto) {
    return this.semaineService.getPlanificationsView(getPlanificationsViewDto);
  }

  @Patch('planifications/prod')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateProductionPlanification(@Body() updateProductionDto: UpdateProductionPlanificationDto) {
    return this.semaineService.updateProductionPlanification(updateProductionDto);
  }
  

@Post('planifications/vuprod')
@UseGuards(JwtAuthGuard) // Pas besoin de AdminRoleGuard pour cette route
@UsePipes(new ValidationPipe({ whitelist: true }))
async getPlanificationsVuProd(@Body() getPlanificationsVuProdDto: GetPlanificationsVuProdDto) {
  const { semaine, ligne } = getPlanificationsVuProdDto;
  return this.semaineService.getPlanificationsVuProd(semaine, ligne);
}
// semaine.controller.ts
@Get('semaines/public')
async getSemainesPublic() {
  // Cette route est accessible sans authentification
  return this.semaineService.getSemaines();
}
// Dans semaine.controller.ts, ajouter cette méthode
@Patch('planifications/magasin')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
async updateMagasinPlanification(@Body() updateMagasinDto: UpdateMagasinPlanificationDto) {
  return this.semaineService.updateMagasinPlanification(updateMagasinDto);
}
}