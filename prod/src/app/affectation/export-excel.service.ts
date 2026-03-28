// src/app/affectation/export-excel.service.ts
import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { Affectation } from './affectation.service';

@Injectable({ providedIn: 'root' })
export class ExportExcelService {

  /**
   * Nettoie le nom de la feuille pour Excel
   * Remplace les caractères invalides par des underscores
   */
  private sanitizeSheetName(name: string): string {
    // Caractères interdits dans les noms de feuilles Excel : * ? : \ / [ ]
    // Solution simple : remplacer tous les caractères problématiques un par un
    let sanitized = name
      .replace(/\*/g, '_')
      .replace(/\?/g, '_')
      .replace(/:/g, '_')
      .replace(/\\/g, '_')
      .replace(/\//g, '_')
      .replace(/\[/g, '_')
      .replace(/\]/g, '_');
    
    // Limite à 31 caractères (max Excel)
    if (sanitized.length > 31) {
      sanitized = sanitized.substring(0, 31);
    }
    
    // Éviter les noms vides
    if (sanitized.length === 0) {
      sanitized = 'Feuille';
    }
    
    return sanitized;
  }

  async exportAffectations(affectations: Affectation[]): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Système Affectations';
    wb.created  = new Date();

    // ── Couleurs & styles ────────────────────────────────────────────────────
    const C = {
      headerBg:   '1E3A5F',   // bleu marine — titre des colonnes
      ligneBg:    '2563EB',   // bleu accent — ligne de groupe
      ligneText:  'FFFFFF',
      phaseBg:    'EFF6FF',   // bleu très clair — lignes de données
      totalBg:    'FEF3C7',   // jaune — ligne total
      totalText:  '92400E',
      border:     'CBD5E1',
      white:      'FFFFFF',
    };

    const borderAll = (color: string): Partial<ExcelJS.Borders> => ({
      top:    { style: 'thin', color: { argb: color } },
      bottom: { style: 'thin', color: { argb: color } },
      left:   { style: 'thin', color: { argb: color } },
      right:  { style: 'thin', color: { argb: color } },
    });

    // ── Regrouper par ligne ──────────────────────────────────────────────────
    const grouped = new Map<string, Affectation[]>();
    affectations.forEach((a) => {
      if (!grouped.has(a.ligne)) grouped.set(a.ligne, []);
      grouped.get(a.ligne)!.push(a);
    });

    // ── Feuille globale "Toutes les affectations" ────────────────────────────
    const ws = wb.addWorksheet('Affectations', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Colonnes
    ws.columns = [
      { key: 'ligne',      width: 18 },
      { key: 'matricule',  width: 12 },
      { key: 'nomPrenom',  width: 28 },
      { key: 'phase',      width: 14 },
      { key: 'heures',     width: 12 },
      { key: 'totalH',     width: 14 },
    ];

    // En-tête
    const headers = ['Ligne', 'Matricule', 'Nom & Prénom', 'Phase', 'Heures (h)', 'Total Heures (h)'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, col) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
      cell.font   = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = borderAll(C.border);
    });

    // ── Données regroupées par ligne ─────────────────────────────────────────
    grouped.forEach((ouvriersList, ligneName) => {

      // ── Ligne de groupe (titre de la ligne) ──────────────────────────────
      const groupRow = ws.addRow([ligneName, '', '', '', '', '']);
      groupRow.height = 24;
      ws.mergeCells(`A${groupRow.number}:F${groupRow.number}`);
      const groupCell = groupRow.getCell(1);
      groupCell.value = `  ⬛  Ligne : ${ligneName}   (${ouvriersList.length} ouvrier${ouvriersList.length > 1 ? 's' : ''})`;
      groupCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
      groupCell.font  = { name: 'Arial', bold: true, size: 11, color: { argb: C.ligneText } };
      groupCell.alignment = { vertical: 'middle', horizontal: 'left' };
      groupCell.border = borderAll(C.border);

      // ── Ouvriers de cette ligne ───────────────────────────────────────────
      ouvriersList.forEach((ouvrier) => {
        const nbPhases = ouvrier.phases.length;

        ouvrier.phases.forEach((ph, idx) => {
          const dataRow = ws.addRow({
            ligne:     idx === 0 ? ouvrier.ligne : '',
            matricule: idx === 0 ? ouvrier.matricule : '',
            nomPrenom: idx === 0 ? ouvrier.nomPrenom : '',
            phase:     ph.phase,
            heures:    ph.heures,
            totalH:    idx === 0 ? ouvrier.totalHeures : '',
          });

          dataRow.height = 20;

          dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
            cell.font   = { name: 'Arial', size: 10, color: { argb: '1E293B' } };
            cell.border = borderAll(C.border);
            cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'left' : 'center' };
          });

          // Fusionner les cellules répétées si plusieurs phases
          if (nbPhases > 1 && idx === 0) {
            const r = dataRow.number;
            const rEnd = r + nbPhases - 1;
            ws.mergeCells(`A${r}:A${rEnd}`); // Ligne
            ws.mergeCells(`B${r}:B${rEnd}`); // Matricule
            ws.mergeCells(`C${r}:C${rEnd}`); // Nom
            ws.mergeCells(`F${r}:F${rEnd}`); // Total
          }
        });
      });

      // ── Ligne sous-total de la ligne ──────────────────────────────────────
      const totalHeuresLigne = ouvriersList.reduce((s, o) => s + o.totalHeures, 0);
      const subTotalRow = ws.addRow(['', '', `Sous-total ${ligneName}`, '', '', totalHeuresLigne]);
      subTotalRow.height = 22;
      subTotalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
        cell.font   = { name: 'Arial', bold: true, size: 10, color: { argb: C.totalText } };
        cell.border = borderAll(C.border);
        cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'right' : 'center' };
      });

      // Ligne vide de séparation
      const sep = ws.addRow([]);
      sep.height = 6;
    });

    // ── Ligne grand total ─────────────────────────────────────────────────────
    const grandTotal = affectations.reduce((s, a) => s + a.totalHeures, 0);
    const grandRow = ws.addRow(['', '', 'TOTAL GÉNÉRAL', '', '', grandTotal]);
    grandRow.height = 26;
    grandRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
      cell.font   = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
      cell.border = borderAll(C.border);
      cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'right' : 'center' };
    });

    // ── Une feuille par ligne (avec sanitisation du nom) ─────────────────────────────────
    grouped.forEach((ouvriersList, ligneName) => {
      // Sanitiser le nom de la ligne pour qu'il soit valide comme nom de feuille
      const sheetName = this.sanitizeSheetName(`Ligne ${ligneName}`);
      
      const wsL = wb.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      wsL.columns = [
        { key: 'matricule', width: 12 },
        { key: 'nomPrenom', width: 28 },
        { key: 'phase',     width: 14 },
        { key: 'heures',    width: 12 },
        { key: 'totalH',    width: 16 },
      ];

      // Titre feuille
      const titleRow = wsL.addRow([`Ligne : ${ligneName}`]);
      titleRow.height = 30;
      wsL.mergeCells(`A1:E1`);
      const titleCell = titleRow.getCell(1);
      titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
      titleCell.font  = { name: 'Arial', bold: true, size: 13, color: { argb: C.white } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // En-tête colonnes
      const hRow = wsL.addRow(['Matricule', 'Nom & Prénom', 'Phase', 'Heures (h)', 'Total Heures (h)']);
      hRow.height = 24;
      hRow.eachCell((cell) => {
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
        cell.font  = { name: 'Arial', bold: true, size: 10, color: { argb: C.white } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borderAll(C.border);
      });

      // Données
      ouvriersList.forEach((ouvrier) => {
        const nbPhases = ouvrier.phases.length;
        ouvrier.phases.forEach((ph, idx) => {
          const dr = wsL.addRow({
            matricule: idx === 0 ? ouvrier.matricule : '',
            nomPrenom: idx === 0 ? ouvrier.nomPrenom : '',
            phase:     ph.phase,
            heures:    ph.heures,
            totalH:    idx === 0 ? ouvrier.totalHeures : '',
          });
          dr.height = 20;
          dr.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
            cell.font   = { name: 'Arial', size: 10 };
            cell.border = borderAll(C.border);
            cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
          });

          if (nbPhases > 1 && idx === 0) {
            const r    = dr.number;
            const rEnd = r + nbPhases - 1;
            wsL.mergeCells(`A${r}:A${rEnd}`);
            wsL.mergeCells(`B${r}:B${rEnd}`);
            wsL.mergeCells(`E${r}:E${rEnd}`);
          }
        });
      });

      // Total feuille
      const ligneTotal = ouvriersList.reduce((s, o) => s + o.totalHeures, 0);
      const tRow = wsL.addRow(['', 'TOTAL', '', '', ligneTotal]);
      tRow.height = 22;
      tRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
        cell.font   = { name: 'Arial', bold: true, size: 10, color: { argb: C.totalText } };
        cell.border = borderAll(C.border);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    });

    // ── Téléchargement ────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href     = url;
    link.download = `affectations_${date}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }
}