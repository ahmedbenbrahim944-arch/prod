import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../login/auth.service';


export interface TrackingData {
  matricule?: string;
  userType?: string;
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
  pageLoadTime?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TrackingService {
  private apiUrl = `http://102.207.250.53:3000/tracking`;
  private sessionId = this.generateSessionId();
  private pageStartTime: number = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private generateSessionId(): string {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  startPageTracking() {
    this.pageStartTime = performance.now();
  }

  trackPageView(url: string, componentName: string) {
    const user = this.authService.getCurrentUser();
    const loadTime = this.pageStartTime ? Math.round(performance.now() - this.pageStartTime) : 0;

    const trackingData: TrackingData = {
      matricule: user?.nom,
      userType: user?.type,
      actionType: 'PAGE_VIEW',
      url: url,
      route: this.getRouteWithoutParams(url),
      componentName: componentName,
      method: 'VIEW',
      statusCode: 200,
      pageLoadTime: loadTime
    };

    return this.sendTracking(trackingData);
  }

  trackApiCall(data: {
    url: string;
    method: string;
    requestData?: any;
    responseData?: any;
    statusCode: number;
    responseTime: number;
  }) {
    const user = this.authService.getCurrentUser();

    const trackingData: TrackingData = {
      matricule: user?.nom,
      userType: user?.type,
      actionType: 'API_CALL',
      url: data.url,
      route: this.getRouteWithoutParams(data.url),
      method: data.method,
      requestData: this.sanitizeData(data.requestData),
      responseData: this.sanitizeData(data.responseData),
      statusCode: data.statusCode,
      responseTime: data.responseTime
    };

    return this.sendTracking(trackingData);
  }

  trackError(error: any, url: string, method: string) {
    const user = this.authService.getCurrentUser();

    const trackingData: TrackingData = {
      matricule: user?.nom,
      userType: user?.type,
      actionType: 'ERROR',
      url: url,
      route: this.getRouteWithoutParams(url),
      method: method,
      statusCode: error.status || 500,
      errorMessage: error.message || 'Erreur inconnue',
      requestData: this.sanitizeData(error.requestData)
    };

    return this.sendTracking(trackingData);
  }

  trackLogin(matricule: string, userType: string) {
    const trackingData: TrackingData = {
      matricule: matricule,
      userType: userType,
      actionType: 'LOGIN',
      url: '/login',
      method: 'POST',
      statusCode: 200
    };

    return this.sendTracking(trackingData);
  }

  trackLogout() {
    const user = this.authService.getCurrentUser();

    const trackingData: TrackingData = {
      matricule: user?.nom,
      userType: user?.type,
      actionType: 'LOGOUT',
      url: '/logout',
      method: 'POST',
      statusCode: 200
    };

    return this.sendTracking(trackingData);
  }

  private sendTracking(data: TrackingData) {
    if (data.url.includes('/tracking')) {
      return;
    }

    this.http.post(`${this.apiUrl}/track`, data, {
      headers: { 'X-Session-Id': this.sessionId }
    }).subscribe({
      error: (err) => console.error('Erreur envoi tracking:', err)
    });
  }

  private getRouteWithoutParams(url: string): string {
    return url.split('?')[0];
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'token', 'authorization'];
    const sanitized = { ...data };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[FILTERED]';
      }
    });
    
    return sanitized;
  }
}