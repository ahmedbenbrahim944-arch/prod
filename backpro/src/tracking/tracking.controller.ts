import { 
  Controller, 
  Get, 
  Query, 
  UseGuards, 
  Param,
  StreamableFile
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import * as ExcelJS from 'exceljs';

@Controller('tracking')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get('activities')
  async getActivities(
    @Query('matricule') matricule?: string,
    @Query('userType') userType?: string,
    @Query('actionType') actionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
  ) {
    return await this.trackingService.getActivities({
      matricule,
      userType,
      actionType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  }

  @Get('dashboard')
  async getDashboardStats() {
    return await this.trackingService.getDashboardStats();
  }

  @Get('user/:matricule/timeline')
  async getUserTimeline(@Param('matricule') matricule: string) {
    return await this.trackingService.getUserTimeline(matricule);
  }

  @Get('export/csv')
  async exportToCSV(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<StreamableFile> {
    const data = await this.trackingService.exportData({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const csvContent = this.convertToCSV(data);
    
    return new StreamableFile(Buffer.from(csvContent, 'utf-8'), {
      type: 'text/csv',
      disposition: 'attachment; filename="user_activities.csv"',
    });
  }

  @Get('export/excel')
  async exportToExcel(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<StreamableFile> {
    const data = await this.trackingService.exportData({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Activités utilisateurs');

    worksheet.columns = [
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Type', key: 'userType', width: 15 },
      { header: 'Action', key: 'actionType', width: 15 },
      { header: 'URL', key: 'url', width: 50 },
      { header: 'Méthode', key: 'method', width: 10 },
      { header: 'Status', key: 'statusCode', width: 10 },
      { header: 'Temps (ms)', key: 'responseTime', width: 15 },
      { header: 'Date', key: 'createdAt', width: 25 },
      { header: 'Erreur', key: 'errorMessage', width: 50 },
    ];

    data.forEach(activity => {
      worksheet.addRow({
        matricule: activity.matricule,
        userType: activity.userType,
        actionType: activity.actionType,
        url: activity.url,
        method: activity.method,
        statusCode: activity.statusCode,
        responseTime: activity.responseTime,
        createdAt: activity.createdAt,
        errorMessage: activity.errorMessage,
      });
    });

    // Générer le buffer Excel
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Convertir le buffer en Uint8Array pour StreamableFile
    const uint8Array = new Uint8Array(buffer as ArrayBuffer);

    return new StreamableFile(uint8Array, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="user_activities.xlsx"',
    });
  }

  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';
    
    const headers = ['Matricule', 'Type', 'Action', 'URL', 'Méthode', 'Status', 'Temps (ms)', 'Date', 'Erreur'];
    const rows = data.map(item => [
      item.matricule || '',
      item.userType || '',
      item.actionType || '',
      item.url || '',
      item.method || '',
      item.statusCode || '',
      item.responseTime || '',
      new Date(item.createdAt).toLocaleString('fr-FR'),
      item.errorMessage || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }
}