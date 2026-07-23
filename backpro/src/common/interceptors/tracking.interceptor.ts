import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler,
  Inject,
  Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { TrackingService } from 'src/tracking/tracking.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TrackingInterceptor.name);

  constructor(
    @Inject(TrackingService) private trackingService: TrackingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Générer ou récupérer un ID de session
    let sessionId = request.headers['x-session-id'] as string;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    // Récupérer les infos utilisateur
    const user = request.user as any;
    const matricule = user?.nom || 'anonymous';
    const userType = user?.type || 'anonymous';
    const userId = user?.id;
    const adminId = user?.type === 'admin' ? userId : null;

    // Extraire la route sans les paramètres
    const route = request.route?.path || request.url.split('?')[0];

    return next.handle().pipe(
      tap((responseData) => {
        const responseTime = Date.now() - startTime;
        
        // Ne pas tracker les appels au tracking lui-même pour éviter les boucles
        if (!request.url.includes('/tracking')) {
          this.trackingService.track({
            matricule,
            userType,
            userId: userType === 'user' ? userId : undefined,
            adminId: userType === 'admin' ? adminId : undefined,
            actionType: 'API_CALL',
            url: request.url,
            route,
            method: request.method,
            requestData: this.sanitizeData(request.body),
            responseData: this.sanitizeData(responseData),
            statusCode: 200,
            responseTime,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            sessionId,
          }).catch(err => this.logger.error('Erreur tracking:', err));
        }
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        
        if (!request.url.includes('/tracking')) {
          this.trackingService.track({
            matricule,
            userType,
            userId: userType === 'user' ? userId : undefined,
            adminId: userType === 'admin' ? adminId : undefined,
            actionType: 'ERROR',
            url: request.url,
            route,
            method: request.method,
            requestData: this.sanitizeData(request.body),
            statusCode: error.status || 500,
            errorMessage: error.message,
            responseTime,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            sessionId,
          }).catch(err => this.logger.error('Erreur tracking:', err));
        }

        throw error;
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Supprimer les données sensibles
    const sensitiveFields = ['password', 'token', 'secret'];
    const sanitized = { ...data };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[FILTERED]';
      }
    });
    
    return sanitized;
  }
}