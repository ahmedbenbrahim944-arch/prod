export class CreateTrackingDto {
  matricule?: string;
  userType: string;
  userId?: number;
  adminId?: number;
  actionType: string;
  url: string;
  route?: string;
  componentName?: string;
  method: string;
  requestData?: any;
  responseData?: any;
  statusCode: number;
  responseTime?: number;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  pageLoadTime?: number;
}