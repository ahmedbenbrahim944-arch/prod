import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, FindOptionsWhere, LessThan } from 'typeorm';
import { UserActivity } from './entities/tracking.entity';
import { CreateTrackingDto } from './dto/create-tracking.dto';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(UserActivity)
    private trackingRepository: Repository<UserActivity>,
  ) {}

  async track(createTrackingDto: CreateTrackingDto): Promise<UserActivity | null> {
    try {
      const activity = this.trackingRepository.create(createTrackingDto);
      return await this.trackingRepository.save(activity);
    } catch (error) {
      console.error('Erreur tracking:', error);
      return null;
    }
  }

  async getActivities(filters: {
    matricule?: string;
    userType?: string;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    route?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: FindOptionsWhere<UserActivity> = {};
    
    if (filters.matricule) {
      where.matricule = Like(`%${filters.matricule}%`);
    }
    
    if (filters.userType) {
      where.userType = filters.userType;
    }
    
    if (filters.actionType) {
      where.actionType = filters.actionType;
    }
    
    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    }

    const [data, total] = await this.trackingRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    return { data, total };
  }

  async getDashboardStats() {
    const totalActivities = await this.trackingRepository.count();
    
    const uniqueUsers = await this.trackingRepository
      .createQueryBuilder('activity')
      .select('COUNT(DISTINCT activity.matricule)', 'count')
      .where('activity.matricule IS NOT NULL')
      .getRawOne();

    const activitiesByType = await this.trackingRepository
      .createQueryBuilder('activity')
      .select('activity.actionType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.actionType')
      .getRawMany();

    const topPages = await this.trackingRepository
      .createQueryBuilder('activity')
      .select('activity.route', 'route')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT activity.matricule)', 'uniqueVisitors')
      .where('activity.actionType = :type', { type: 'PAGE_VIEW' })
      .andWhere('activity.route IS NOT NULL')
      .groupBy('activity.route')
      .orderBy('visits', 'DESC')
      .limit(10)
      .getRawMany();

    const recentErrors = await this.trackingRepository
      .createQueryBuilder('activity')
      .where('activity.actionType = :type', { type: 'ERROR' })
      .andWhere('activity.createdAt > :date', { 
        date: new Date(Date.now() - 24 * 60 * 60 * 1000)
      })
      .orderBy('activity.createdAt', 'DESC')
      .limit(20)
      .getMany();

    return {
      totalActivities,
      uniqueUsers: parseInt(uniqueUsers?.count || '0'),
      activitiesByType,
      topPages,
      recentErrors,
    };
  }

  async getUserTimeline(matricule: string, limit: number = 50) {
    return await this.trackingRepository.find({
      where: { matricule },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async exportData(filters: any) {
    const { data } = await this.getActivities({ ...filters, limit: 10000 });
    return data;
  }

  async cleanupOldData(daysToKeep: number = 90) {
    const date = new Date();
    date.setDate(date.getDate() - daysToKeep);
    
    await this.trackingRepository.delete({
      createdAt: LessThan(date),
    });
  }
}