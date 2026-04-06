// src/app/plann-mag-scan/plann-mag-scan.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ScanResult {
  success:       boolean;
  alreadyServed: boolean;
  message:       string;
  codeDocument:  string;
  serviLe:       string;
  serviPar:      string | null;
  // Données planning
  of:            string;
  date:          string;
  dateFormatee:  string;
  jour:          string;
  semaine:       string;
  totalMp:       number;
  ligne:         string;
  planning:      any[];
}

export interface ScanError {
  alreadyServed: boolean;
  message:       string;
  codeDocument:  string;
  serviLe?:      string;
  serviPar?:     string | null;
  ligne?:        string;
  semaine?:      string;
  dateFormatee?: string;
}

@Injectable({ providedIn: 'root' })
export class PlannMagScanService {
  private apiUrl = `http://102.207.250.53:3000/plann-mag/scan`;

  constructor(private http: HttpClient) {}

  scan(codeDocument: string): Observable<ScanResult> {
    const token   = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<ScanResult>(
      this.apiUrl,
      { codeDocument },
      { headers },
    );
  }
}