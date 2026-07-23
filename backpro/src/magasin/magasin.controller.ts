import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  UsePipes, 
  ValidationPipe,
  Patch,
  Req
} from '@nestjs/common';
import { MagasinService } from './magasin.service';
import { GetPlanificationMagasinDto } from './dto/get-planification-magasin.dto';
import { UpdateDeclarationMagasinDto } from './dto/update-declaration-magasin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('magasin')
export class MagasinController {
  constructor(private readonly magasinService: MagasinService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getPlanificationsMagasin(@Body() getPlanificationDto: GetPlanificationMagasinDto) {
    return this.magasinService.getPlanificationsMagasin(getPlanificationDto);
  }

  @Patch('declaration')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateDeclarationMagasin(
    @Body() updateDto: UpdateDeclarationMagasinDto,
    @Req() req
  ) {
    return this.magasinService.updateDeclarationMagasin(updateDto, req.user.username);
  }
}