import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-tracking-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-dashboard.component.html',
  styleUrls: ['./tracking-dashboard.component.css']
})
export class TrackingDashboardComponent implements OnInit {
  Math = Math;
  activities: any[] = [];
  stats: any = {
    totalActivities: 0,
    uniqueUsers: 0,
    activitiesByType: [],
    topPages: [],
    recentErrors: []
  };
  
  loading = false;
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;

  filters = {
    matricule: '',
    userType: '',
    actionType: '',
    startDate: '',
    endDate: ''
  };

  userTypes = ['admin', 'user'];
  actionTypes = ['PAGE_VIEW', 'API_CALL', 'ERROR', 'LOGIN', 'LOGOUT'];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDashboard();
    this.loadActivities();
  }

  loadDashboard() {
    this.http.get(`http://102.207.250.53:3000/tracking/dashboard`).subscribe({
      next: (data: any) => {
        this.stats = data;
      },
      error: (err) => console.error('Erreur chargement dashboard:', err)
    });
  }

  loadActivities() {
    this.loading = true;
    const params: any = {
      limit: this.itemsPerPage,
      offset: (this.currentPage - 1) * this.itemsPerPage
    };

    if (this.filters.matricule) params.matricule = this.filters.matricule;
    if (this.filters.userType) params.userType = this.filters.userType;
    if (this.filters.actionType) params.actionType = this.filters.actionType;
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;

    this.http.get(`http://102.207.250.53:3000/tracking/activities`, { params }).subscribe({
      next: (response: any) => {
        this.activities = response.data;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement activités:', err);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadActivities();
    this.loadDashboard();
  }

  resetFilters() {
    this.filters = {
      matricule: '',
      userType: '',
      actionType: '',
      startDate: '',
      endDate: ''
    };
    this.applyFilters();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadActivities();
  }

  exportToExcel() {
    this.loading = true;
    const params: any = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;

    this.http.get(`http://102.207.250.53:3000/tracking/export/excel`, {
      params,
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, 'user_activities.xlsx');
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur export Excel:', err);
        this.loading = false;
      }
    });
  }

  exportToCSV() {
    this.loading = true;
    const params: any = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;

    this.http.get(`http://102.207.250.53:3000/tracking/export/csv`, {
      params,
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, 'user_activities.csv');
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur export CSV:', err);
        this.loading = false;
      }
    });
  }

 getUserTypeClass(type: string): string {
  const classes: { [key: string]: string } = {  // ✅ Ajout de l'index signature
    'admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    'user': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  };
  return `px-2 py-1 rounded-full text-xs font-medium ${classes[type] || 'bg-gray-100 text-gray-800'}`;
}
  getActionTypeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'PAGE_VIEW': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'API_CALL': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'ERROR': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'LOGIN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'LOGOUT': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${classes[type] || 'bg-gray-100 text-gray-800'}`;
  }

  getStatusClass(status: number): string {
    if (status >= 200 && status < 300) {
      return 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
    if (status >= 400 && status < 500) {
      return 'px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
    if (status >= 500) {
      return 'px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
    return 'px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getStatusIcon(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '✅';
    if (statusCode >= 400 && statusCode < 500) return '⚠️';
    if (statusCode >= 500) return '❌';
    return 'ℹ️';
  }

  getActionIcon(actionType: string): string {
    const icons: { [key: string]: string } = {
      'PAGE_VIEW': '👁️',
      'API_CALL': '🌐',
      'ERROR': '🚨',
      'LOGIN': '🔑',
      'LOGOUT': '🚪'
    };
    return icons[actionType] || '📌';
  }
}