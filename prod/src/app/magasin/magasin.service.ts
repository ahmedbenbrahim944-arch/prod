// src/app/services/magasin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface GetPlanificationRequest {
  ligne: string;
  semaine: string;
}

export interface PlanificationMagasin {
  id?: number;
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  qtePlanifiee: number;
  qteModifiee: number;
  quantiteSource: number;
  decMagasin: number;
  of?: string;
  emballage?: string;
  updatedAt?: Date;
  typeQuantite: string;
}

export interface PlanificationMagasinResponse {
  message: string;
  semaine: {
    id: number;
    nom: string;
    dateDebut: string;
    dateFin: string;
  };
  ligne: string;
  filtre: string;
  totals: {
    totalQtePlanifiee: number;
    totalQteModifiee: number;
    totalQuantiteSource: number;
    totalDecMagasin: number;
    nombreReferences: number;
    nombrePlanifications: number;
    referencesAvecQtePlanifiee: number;
    referencesAvecQteModifiee: number;
  };
  references: any[];
  details: PlanificationMagasin[];
}

export interface UpdateDeclarationRequest {
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  decMagasin: number;
}

@Injectable({
  providedIn: 'root'
})
export class MagasinService {
  private apiUrl = 'http://102.207.250.53:3000/magasin';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Récupérer les planifications pour une ligne/semaine
  getPlanificationsMagasin(request: GetPlanificationRequest): Observable<PlanificationMagasinResponse> {
    return this.http.post<PlanificationMagasinResponse>(
      this.apiUrl,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  // Mettre à jour la déclaration magasin
  updateDeclarationMagasin(request: UpdateDeclarationRequest): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/declaration`,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  // Générer le PDF côté client
  generatePDF(data: any[], semaine: string, ligne: string): void {
    const doc = this.createPDFDocument(data, semaine, ligne);
    doc.save(`Magasin-${ligne}-${semaine}.pdf`);
  }

  private createPDFDocument(data: any[], semaine: string, ligne: string): any {
    // Implémentation de génération de PDF avec jsPDF
    // Note: Vous devrez installer jsPDF: npm install jspdf
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(16);
    doc.text(`Ligne : ${ligne}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Semaine : ${semaine}`, 20, 30);
    
    // Tableau
    doc.setFontSize(10);
    let y = 50;
    
    // En-têtes du tableau
    doc.text('REF', 20, y);
    doc.text('C/DM', 80, y);
    doc.text('Chiffre', 110, y);
    doc.text('Jour', 150, y);
    
    y += 10;
    doc.line(20, y, 190, y);
    y += 5;
    
    // Données
    data.forEach(item => {
      doc.text(item.reference, 20, y);
      doc.text('C', 80, y);
      doc.text(item.quantiteSource.toString(), 110, y);
      y += 10;
      
      doc.text('', 20, y); // Espace pour REF
      doc.text('DM', 80, y);
      doc.text(item.decMagasin > 0 ? item.decMagasin.toString() : '', 110, y);
      y += 10;
      
      doc.text('', 20, y); // Espace pour REF
      doc.text('', 80, y);
      doc.text('', 110, y);
      doc.text(`jour: ${item.jour}`, 150, y - 10);
      y += 10;
      
      // Ligne séparatrice
      doc.line(20, y, 190, y);
      y += 5;
      
      // Nouvelle page si nécessaire
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    
    return doc;
  }
}