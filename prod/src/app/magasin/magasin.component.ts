import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SemaineService, Semaine } from '../prod/semaine.service';
import { MagasinService, PlanificationMagasin, GetPlanificationRequest } from './magasin.service';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface LigneData {
  ligne: string;
  horizontalTableData: any[];
  daysWithData: string[];
  totals?: any;
}

@Component({
  selector: 'app-magasin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './magasin.component.html',
  styleUrls: ['./magasin.component.css']
})
export class MagasinComponent implements OnInit {
  semaines: Semaine[] = [];
  selectedSemaine: string = '';
  
  lignesData: Map<string, LigneData> = new Map();
  isLoading: boolean = false;
  errorMessage: string = '';
  
  weekDays: string[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  
  constructor(
    private semaineService: SemaineService,
    private magasinService: MagasinService
  ) {}
  
  ngOnInit(): void {
    this.loadSemaines();
  }
  
  loadSemaines(): void {
    this.semaines = this.getWeeksList().map(nom => ({
      nom: nom,
      dateDebut: '',
      dateFin: ''
    }));
    
    if (this.semaines.length > 0) {
      this.selectedSemaine = this.semaines[0].nom;
    }
  }
  
  onSemaineChange(): void {
    this.errorMessage = '';
    this.lignesData.clear();
  }
  
  loadMagasinData(): void {
    if (!this.selectedSemaine) {
      this.errorMessage = 'Veuillez sélectionner une semaine';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.lignesData.clear();
    
    const request: GetPlanificationRequest = {
      ligne: '',
      semaine: this.selectedSemaine
    };
    
    this.magasinService.getPlanificationsMagasin(request).subscribe({
      next: (response) => {
        if (response.details && response.details.length > 0) {
          const lignesMap = new Map<string, PlanificationMagasin[]>();
          
          response.details.forEach((planif: PlanificationMagasin) => {
            if (!lignesMap.has(planif.ligne)) {
              lignesMap.set(planif.ligne, []);
            }
            lignesMap.get(planif.ligne)!.push(planif);
          });
          
          lignesMap.forEach((planifications, ligneName) => {
            const ligneData = this.organizeDataForLigne(ligneName, planifications);
            this.lignesData.set(ligneName, ligneData);
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur chargement données magasin:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des données';
        this.isLoading = false;
        this.lignesData.clear();
      }
    });
  }
  
  organizeDataForLigne(ligneName: string, planifications: PlanificationMagasin[]): LigneData {
    const horizontalTableData: any[] = [];
    const daysWithData: string[] = [];
    const refMap = new Map<string, any>();
    const daysSet = new Set<string>();
    
    planifications.forEach((item: PlanificationMagasin) => {
      if (item.quantiteSource > 0) {
        if (!refMap.has(item.reference)) {
          refMap.set(item.reference, {
            reference: item.reference,
            lundi: { quantiteSource: 0, of: '' },
            mardi: { quantiteSource: 0, of: '' },
            mercredi: { quantiteSource: 0, of: '' },
            jeudi: { quantiteSource: 0, of: '' },
            vendredi: { quantiteSource: 0, of: '' },
            samedi: { quantiteSource: 0, of: '' }
          });
        }
        
        const refData = refMap.get(item.reference);
        const day = item.jour.toLowerCase();
        
        if (refData[day]) {
          refData[day] = {
            quantiteSource: item.quantiteSource,
            of: item.of || ''
          };
          
          if (item.quantiteSource > 0) {
            daysSet.add(day);
          }
        }
      }
    });
    
    const sortedData = Array.from(refMap.values()).sort((a, b) => 
      a.reference.localeCompare(b.reference)
    );
    
    const filteredDays = this.weekDays.filter(day => daysSet.has(day));
    
    return {
      ligne: ligneName,
      horizontalTableData: sortedData,
      daysWithData: filteredDays
    };
  }
  
  get allLignesArray(): LigneData[] {
    return Array.from(this.lignesData.values()).sort((a, b) => 
      a.ligne.localeCompare(b.ligne)
    );
  }
  
  // AJOUTER CETTE MÉTHODE POUR L'EXPORT EXCEL
  downloadExcel(): void {
    if (this.lignesData.size === 0) {
      this.errorMessage = 'Aucune donnée à exporter en Excel';
      return;
    }
    
    this.generateSingleSheetExcel();
  }
  
  private generateSingleSheetExcel(): void {
    try {
      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];
      
      // 1. Titre principal
      worksheetData.push([`Extraction Données - Semaine ${this.selectedSemaine}`]);
      worksheetData.push([]); // Ligne vide
      
      // 2. En-têtes du tableau (identique au CSV)
      const headers = [
        'LIGNE', 
        'Référence', 
        '1.lundi', 
        '2.mardi', 
        '3.mercredi', 
        '4.jeudi', 
        '5.vendredi', 
        '6.samedi', 
        'TOTAL', 
        '', // Colonne vide
        'total', 
        'Note'
      ];
      worksheetData.push(headers);
      
      // 3. Préparer toutes les données triées par ligne puis par référence
      const allData: any[] = [];
      const sortedLignes = Array.from(this.lignesData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      sortedLignes.forEach(([ligneName, ligneData]) => {
        const horizontalTableData = ligneData.horizontalTableData || [];
        
        horizontalTableData.forEach((item: any) => {
          allData.push({
            ligne: ligneName,
            reference: item.reference,
            lundi: item.lundi?.quantiteSource || 0,
            mardi: item.mardi?.quantiteSource || 0,
            mercredi: item.mercredi?.quantiteSource || 0,
            jeudi: item.jeudi?.quantiteSource || 0,
            vendredi: item.vendredi?.quantiteSource || 0,
            samedi: item.samedi?.quantiteSource || 0,
            of: this.getFirstOfValue(item, this.weekDays),
            note: ''
          });
        });
      });
      
      // 4. Trier les données par référence
      allData.sort((a, b) => {
        if (a.ligne !== b.ligne) {
          return a.ligne.localeCompare(b.ligne);
        }
        return a.reference.localeCompare(b.reference);
      });
      
      // 5. Ajouter les lignes de données
      allData.forEach((item: any) => {
        const row: any[] = [];
        
        // LIGNE
        row.push(item.ligne);
        
        // Référence
        row.push(item.reference);
        
        // Jours avec leurs numéros
        row.push(item.lundi > 0 ? item.lundi : 0);
        row.push(item.mardi > 0 ? item.mardi : 0);
        row.push(item.mercredi > 0 ? item.mercredi : 0);
        row.push(item.jeudi > 0 ? item.jeudi : 0);
        row.push(item.vendredi > 0 ? item.vendredi : 0);
        row.push(item.samedi > 0 ? item.samedi : 0);
        
        // TOTAL (sera une formule Excel)
        row.push(''); // Laissé vide pour la formule
        row.push(''); // Colonne vide
        row.push(''); // total (laissé vide)
        row.push(''); // Note
        
        worksheetData.push(row);
      });
      
      // 6. Créer la feuille de calcul
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // 7. Définir les formules Excel pour les colonnes TOTAL
      const dataStartRow = 4; // La ligne 4 (index 3) est la première ligne de données (après l'en-tête)
      const dataEndRow = worksheetData.length;
      
      // Ajouter les formules SUM pour chaque ligne
      for (let i = dataStartRow; i < dataEndRow; i++) {
        // Colonne I (TOTAL) = SOMME(C:H)
        const totalCell = `I${i + 1}`;
        const sumRange = `C${i + 1}:H${i + 1}`;
        
        if (!worksheet[totalCell]) {
          worksheet[totalCell] = {};
        }
        worksheet[totalCell].f = `SUM(${sumRange})`;
        worksheet[totalCell].t = 'n';
        
        // Colonne K (total) = même valeur que TOTAL
        const total2Cell = `K${i + 1}`;
        if (!worksheet[total2Cell]) {
          worksheet[total2Cell] = {};
        }
        worksheet[total2Cell].f = `I${i + 1}`;
        worksheet[total2Cell].t = 'n';
      }
      
      // 8. Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 15 }, // LIGNE
        { wch: 20 }, // Référence
        { wch: 10 }, // 1.lundi
        { wch: 10 }, // 2.mardi
        { wch: 12 }, // 3.mercredi
        { wch: 10 }, // 4.jeudi
        { wch: 12 }, // 5.vendredi
        { wch: 12 }, // 6.samedi
        { wch: 10 }, // TOTAL
        { wch: 5 },  // Colonne vide
        { wch: 10 }, // total
        { wch: 20 }  // Note
      ];
      worksheet['!cols'] = colWidths;
      
      // 9. Ajouter la feuille au workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Planification');
      
      // 10. Générer le fichier
      const fileName = `Planification-Magasin-${this.selectedSemaine}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      console.log(`Fichier Excel généré avec ${allData.length} références`);
      
    } catch (error) {
      console.error('Erreur génération Excel:', error);
      this.errorMessage = 'Erreur lors de la génération du fichier Excel';
    }
  }
  
  downloadPDF(): void {
    if (this.lignesData.size === 0) {
      this.errorMessage = 'Aucune donnée à exporter en PDF';
      return;
    }
    
    this.generateMultiLignesPDF();
  }
  
  private generateMultiLignesPDF(): void {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      
      let isFirstPage = true;
      
      const sortedLignes = Array.from(this.lignesData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      sortedLignes.forEach(([ligneName, ligneData]) => {
        if (!isFirstPage) {
          doc.addPage('landscape');
        }
        isFirstPage = false;
        
        this.generatePageForLigne(doc, ligneName, ligneData, pageWidth, pageHeight, margin);
      });
      
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} / ${pageCount}`, 
                pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
      
      const fileName = `Magasin-ToutesLignes-${this.selectedSemaine}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }
  
  private generatePageForLigne(
    doc: any, 
    ligneName: string, 
    ligneData: LigneData, 
    pageWidth: number, 
    pageHeight: number, 
    margin: number
  ): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Extraction données ', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Ligne: ${ligneName}`, margin, 25);
    doc.text(`Semaine: ${this.selectedSemaine}`, pageWidth - margin, 25, { align: 'right' });
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);
    
    const horizontalTableData = ligneData.horizontalTableData || [];
    const daysWithData = ligneData.daysWithData || [];
    
    if (daysWithData.length === 0 || horizontalTableData.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text('Aucune donnée disponible pour cette ligne', pageWidth / 2, pageHeight / 2, { align: 'center' });
      return;
    }
    
    const refColWidth = 35;
    const cdmColWidth = 12;
    const ofColWidth = 25;
    const availableWidth = pageWidth - (2 * margin) - refColWidth - cdmColWidth - ofColWidth;
    const dayColWidth = availableWidth / daysWithData.length;
    
    let currentY = 35;
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    let currentX = margin;
    
    doc.rect(currentX, currentY, refColWidth, 8);
    doc.text('REF', currentX + refColWidth / 2, currentY + 5, { align: 'center' });
    currentX += refColWidth;
    
    doc.rect(currentX, currentY, cdmColWidth, 8);
    doc.text('C/DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
    currentX += cdmColWidth;
    
    doc.rect(currentX, currentY, ofColWidth, 8);
    doc.text('OF', currentX + ofColWidth / 2, currentY + 5, { align: 'center' });
    currentX += ofColWidth;
    
    daysWithData.forEach((day: string) => {
      doc.rect(currentX, currentY, dayColWidth, 8);
      const dayLabel = this.getFrenchDayAbbreviation(day);
      doc.setTextColor(0, 0, 0); 
      doc.text(dayLabel, currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
      currentX += dayColWidth;
    });
    
    currentY += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    horizontalTableData.forEach((item: any, index: number) => {
      if (currentY > pageHeight - 30) {
        doc.addPage('landscape');
        currentY = margin;
        
        currentX = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
        
        doc.rect(currentX, currentY, refColWidth, 8);
        doc.text('REF', currentX + refColWidth / 2, currentY + 5, { align: 'center' });
        currentX += refColWidth;
        
        doc.rect(currentX, currentY, cdmColWidth, 8);
        doc.text('C/DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
        currentX += cdmColWidth;
        
        doc.rect(currentX, currentY, ofColWidth, 8);
        doc.text('OF', currentX + ofColWidth / 2, currentY + 5, { align: 'center' });
        currentX += ofColWidth;
        
        daysWithData.forEach((day: string) => {
          doc.rect(currentX, currentY, dayColWidth, 8);
          const dayLabel = this.getFrenchDayAbbreviation(day);
          doc.setTextColor(0, 0, 0);
          doc.text(dayLabel, currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
          currentX += dayColWidth;
        });
        
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      }
      
      currentX = margin;
      
      doc.rect(currentX, currentY, refColWidth, 16);
      doc.setTextColor(0, 0, 0);
      const refText = item.reference.length > 20 ? item.reference.substring(0, 12) + '...' : item.reference;
      doc.text(refText, currentX + 2, currentY + 10);
      currentX += refColWidth;
      
      doc.rect(currentX, currentY, cdmColWidth, 8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 100, 0);
      doc.text('C', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
      currentX += cdmColWidth;
      
      const ofValue = this.getFirstOfValue(item, daysWithData);
      doc.rect(currentX, currentY, ofColWidth, 16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (ofValue) {
        const ofText = ofValue.length > 8 ? ofValue.substring(0, 8) + '...' : ofValue;
        doc.text(ofText, currentX + 2, currentY + 10);
      }
      currentX += ofColWidth;
      
      daysWithData.forEach((day: string) => {
        doc.rect(currentX, currentY, dayColWidth, 8);
        const value = item[day]?.quantiteSource || 0;
        if (value > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(value.toString(), currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
        }
        doc.setFont('helvetica', 'normal');
        currentX += dayColWidth;
      });
      
      currentY += 8;
      
      currentX = margin + refColWidth;
      
      doc.rect(currentX, currentY, cdmColWidth, 8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 100, 0);
      doc.text('DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
      currentX += cdmColWidth + ofColWidth;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      daysWithData.forEach((day: string) => {
        doc.rect(currentX, currentY, dayColWidth, 8);
        const dmValue = item[day]?.decMagasin || 0;
        if (dmValue > 0) {
          doc.text(dmValue.toString(), currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
        }
        currentX += dayColWidth;
      });
      
      currentY += 8;
      
      if (index < horizontalTableData.length - 1) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 2;
      }
    });
  }
  
  getFirstOfValue(item: any, daysWithData: string[]): string {
    for (const day of daysWithData) {
      if (item[day]?.of) {
        return item[day].of;
      }
    }
    return '';
  }
  
  getFrenchDayAbbreviation(day: string): string {
    const abbreviations: { [key: string]: string } = {
      'lundi': 'Lun',
      'mardi': 'Mar',
      'mercredi': 'Mer',
      'jeudi': 'Jeu',
      'vendredi': 'Ven',
      'samedi': 'Sam'
    };
    return abbreviations[day.toLowerCase()] || day.substring(0, 3);
  }
  
  getWeeksList(): string[] {
    const weeks = [];
    for (let i = 1; i <= 52; i++) {
      weeks.push(`semaine${i}`);
    }
    return weeks;
  }
}