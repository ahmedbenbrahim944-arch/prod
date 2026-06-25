import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { Affectation } from './affectation.service';

export interface ExportRow {
  matricule:      number;
  nomPrenom:      string;
  affectation:    Affectation | null;
  pointageStatut?: 'present' | 'absent' | 'unknown';
}

@Injectable({ providedIn: 'root' })
export class ExportExcelService {

  private sanitizeSheetName(name: string): string {
    let sanitized = name
      .replace(/\*/g, '_').replace(/\?/g, '_').replace(/:/g, '_')
      .replace(/\\/g, '_').replace(/\//g, '_')
      .replace(/\[/g, '_').replace(/\]/g, '_');
    if (sanitized.length > 31) sanitized = sanitized.substring(0, 31);
    if (sanitized.length === 0) sanitized = 'Feuille';
    return sanitized;
  }

  private sortLignes(entries: [string, ExportRow[]][]): [string, ExportRow[]][] {
    return entries.sort(([a], [b]) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }

  async exportAffectations(allRows: ExportRow[]): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Système Affectations';
    wb.created = new Date();

    const C = {
      headerBg:   '1E3A5F',
      ligneBg:    '2563EB',
      ligneText:  'FFFFFF',
      phaseBg:    'EFF6FF',
      totalBg:    'FEF3C7',
      totalText:  '92400E',
      border:     'CBD5E1',
      white:      'FFFFFF',
      greenBg:    'DCFCE7',
      greenText:  '166534',
      redBg:      'FEE2E2',
      redText:    '991B1B',
      grayBg:     'F1F5F9',
      grayText:   '475569',
    };

    const borderAll = (color: string): Partial<ExcelJS.Borders> => ({
      top:    { style: 'thin', color: { argb: color } },
      bottom: { style: 'thin', color: { argb: color } },
      left:   { style: 'thin', color: { argb: color } },
      right:  { style: 'thin', color: { argb: color } },
    });

    const totalOuvriers = allRows.length;
    const affectes      = allRows.filter(r => r.affectation !== null);
    const nonAffectes   = allRows.filter(r => r.affectation === null);
    const affectations  = affectes.map(r => r.affectation!);

    // ── Regrouper par ligne ──────────────────────────────────────────────────
    const grouped = new Map<string, ExportRow[]>();
    affectes.forEach((r) => {
      const ligne = r.affectation!.ligne;
      if (!grouped.has(ligne)) grouped.set(ligne, []);
      grouped.get(ligne)!.push(r);
    });

    // ════════════════════════════════════════════════════════════════════════
    // FEUILLE 1 : RÉCAPITULATIF
    // ════════════════════════════════════════════════════════════════════════
    const wsRecap = wb.addWorksheet('📊 Récapitulatif', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    });

    wsRecap.columns = [
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // Titre principal
    const recapTitle = wsRecap.addRow(['RÉCAPITULATIF DES AFFECTATIONS', '', '', '', '']);
    recapTitle.height = 36;
    wsRecap.mergeCells('A1:E1');
    const recapTitleCell = recapTitle.getCell(1);
    recapTitleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
    recapTitleCell.font      = { name: 'Arial', bold: true, size: 14, color: { argb: C.white } };
    recapTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Date export
    const dateRow = wsRecap.addRow([
      `Exporté le : ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} — Présences du jour`,
      '', '', '', ''
    ]);
    dateRow.height = 20;
    wsRecap.mergeCells('A2:E2');
    dateRow.getCell(1).font      = { name: 'Arial', italic: true, size: 10, color: { argb: C.grayText } };
    dateRow.getCell(1).alignment = { horizontal: 'center' };

    wsRecap.addRow([]);

    // ── Statistiques globales ────────────────────────────────────────────────
    const statsHeader = wsRecap.addRow(['STATISTIQUES GLOBALES', '', '', '', '']);
    statsHeader.height = 24;
    wsRecap.mergeCells(`A4:E4`);
    const statsHeaderCell = statsHeader.getCell(1);
    statsHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
    statsHeaderCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
    statsHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const statsColHeader = wsRecap.addRow(['Indicateur', 'Nombre', 'Pourcentage', '', '']);
    statsColHeader.height = 22;
    wsRecap.mergeCells(`D5:E5`);
    statsColHeader.eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.grayText } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = borderAll(C.border);
    });

    const rowTotal = wsRecap.addRow(['👥 Total ouvriers', totalOuvriers, '100%', '', '']);
    rowTotal.height = 20;
    wsRecap.mergeCells(`D${rowTotal.number}:E${rowTotal.number}`);
    rowTotal.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.border    = borderAll(C.border);
    });

    const pctAff = totalOuvriers > 0 ? Math.round((affectes.length / totalOuvriers) * 100) : 0;
    const rowAff = wsRecap.addRow(['✅ Ouvriers affectés', affectes.length, `${pctAff}%`, '', '']);
    rowAff.height = 20;
    wsRecap.mergeCells(`D${rowAff.number}:E${rowAff.number}`);
    rowAff.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.greenText } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.border    = borderAll(C.border);
    });

    const pctNonAff = totalOuvriers > 0 ? Math.round((nonAffectes.length / totalOuvriers) * 100) : 0;
    const rowNonAff = wsRecap.addRow(['❌ Ouvriers non affectés', nonAffectes.length, `${pctNonAff}%`, '', '']);
    rowNonAff.height = 20;
    wsRecap.mergeCells(`D${rowNonAff.number}:E${rowNonAff.number}`);
    rowNonAff.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.redText } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.border    = borderAll(C.border);
    });

    wsRecap.addRow([]);

    // ── Présence globale du jour ─────────────────────────────────────────────
    const totalPresents = allRows.filter(r => r.pointageStatut === 'present').length;
    const totalAbsents  = affectes.length - totalPresents;

    const presenceHeader = wsRecap.addRow(['PRÉSENCE DU JOUR', '', '', '', '']);
    presenceHeader.height = 24;
    wsRecap.mergeCells(`A${presenceHeader.number}:E${presenceHeader.number}`);
    const presenceHeaderCell = presenceHeader.getCell(1);
    presenceHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } };
    presenceHeaderCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
    presenceHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const presenceColHeader = wsRecap.addRow(['Indicateur', 'Nombre', 'Pourcentage', '', '']);
    presenceColHeader.height = 22;
    wsRecap.mergeCells(`D${presenceColHeader.number}:E${presenceColHeader.number}`);
    presenceColHeader.eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.grayText } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = borderAll(C.border);
    });

    const pctPresents = affectes.length > 0 ? Math.round((totalPresents / affectes.length) * 100) : 0;
    const rowPresents = wsRecap.addRow(['🟢 Présents aujourd\'hui', totalPresents, `${pctPresents}%`, '', '']);
    rowPresents.height = 20;
    wsRecap.mergeCells(`D${rowPresents.number}:E${rowPresents.number}`);
    rowPresents.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.greenText } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.border    = borderAll(C.border);
    });

    const pctAbsents  = affectes.length > 0 ? Math.round((totalAbsents / affectes.length) * 100) : 0;
    const rowAbsents  = wsRecap.addRow(['🔴 Absents aujourd\'hui', totalAbsents, `${pctAbsents}%`, '', '']);
    rowAbsents.height = 20;
    wsRecap.mergeCells(`D${rowAbsents.number}:E${rowAbsents.number}`);
    rowAbsents.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.redText } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.border    = borderAll(C.border);
    });

    wsRecap.addRow([]);

    // ── Détail par ligne ─────────────────────────────────────────────────────
    const lignesHeader = wsRecap.addRow(['DÉTAIL PAR LIGNE', '', '', '', '']);
    lignesHeader.height = 24;
    wsRecap.mergeCells(`A${lignesHeader.number}:E${lignesHeader.number}`);
    const lignesHeaderCell = lignesHeader.getCell(1);
    lignesHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
    lignesHeaderCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
    lignesHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const lignesColHeader = wsRecap.addRow(['Ligne', 'Nb ouvriers', 'Total heures', 'Présents', 'Absents']);
    lignesColHeader.height = 22;
    lignesColHeader.eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
      cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.grayText } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = borderAll(C.border);
    });

    this.sortLignes(Array.from(grouped.entries())).forEach(([ligneName, ligneRows]) => {
      const totalH   = ligneRows.reduce((s, r) => s + (r.affectation!.totalHeures || 0), 0);
      const presents = ligneRows.filter(r => r.pointageStatut === 'present').length;
      const absents  = ligneRows.length - presents;

      const lr = wsRecap.addRow([ligneName, ligneRows.length, `${totalH}h`, presents, absents]);
      lr.height = 20;
      lr.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border    = borderAll(C.border);
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };

        if (col === 4) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.greenBg } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.greenText } };
        } else if (col === 5) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.redText } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
          cell.font = { name: 'Arial', size: 10 };
        }
      });
    });

    // ── Liste des non affectés ───────────────────────────────────────────────
    if (nonAffectes.length > 0) {
      wsRecap.addRow([]);

      const nonAffHeader = wsRecap.addRow(['OUVRIERS NON AFFECTÉS', '', '', '', '']);
      nonAffHeader.height = 24;
      wsRecap.mergeCells(`A${nonAffHeader.number}:E${nonAffHeader.number}`);
      const nonAffHeaderCell = nonAffHeader.getCell(1);
      nonAffHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DC2626' } };
      nonAffHeaderCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
      nonAffHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const nonAffColHeader = wsRecap.addRow(['Matricule', 'Nom & Prénom', '', '', '']);
      nonAffColHeader.height = 22;
      wsRecap.mergeCells(`C${nonAffColHeader.number}:E${nonAffColHeader.number}`);
      nonAffColHeader.eachCell((cell) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
        cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.grayText } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border    = borderAll(C.border);
      });

      nonAffectes.forEach((r) => {
        const nr = wsRecap.addRow([r.matricule, r.nomPrenom, '', '', '']);
        nr.height = 20;
        wsRecap.mergeCells(`C${nr.number}:E${nr.number}`);
        nr.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
          cell.font      = { name: 'Arial', size: 10, color: { argb: C.redText } };
          cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
          cell.border    = borderAll(C.border);
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // FEUILLE 2 : TOUTES LES AFFECTATIONS
    // ════════════════════════════════════════════════════════════════════════
    const ws = wb.addWorksheet('Affectations', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { key: 'ligne',     width: 20 },
      { key: 'matricule', width: 12 },
      { key: 'nomPrenom', width: 28 },
      { key: 'presence',  width: 14 },
      { key: 'phase',     width: 14 },
      { key: 'heures',    width: 12 },
      { key: 'totalH',    width: 14 },
    ];

    const headers = ['Ligne', 'Matricule', 'Nom & Prénom', 'Présence', 'Phase', 'Heures (h)', 'Total Heures (h)'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
      cell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = borderAll(C.border);
    });

    this.sortLignes(Array.from(grouped.entries())).forEach(([ligneName, ligneRows]) => {
      // Ligne de groupe
      const groupRow = ws.addRow([ligneName, '', '', '', '', '', '']);
      groupRow.height = 24;
      ws.mergeCells(`A${groupRow.number}:G${groupRow.number}`);
      const groupCell = groupRow.getCell(1);
      const presentsLigne = ligneRows.filter(r => r.pointageStatut === 'present').length;
      const absentsLigne  = ligneRows.length - presentsLigne;
      groupCell.value     = `  ⬛  Ligne : ${ligneName}   (${ligneRows.length} ouvrier${ligneRows.length > 1 ? 's' : ''})   🟢 ${presentsLigne} présents   🔴 ${absentsLigne} absents`;
      groupCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
      groupCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.ligneText } };
      groupCell.alignment = { vertical: 'middle', horizontal: 'left' };
      groupCell.border    = borderAll(C.border);

      ligneRows.forEach((r) => {
        const aff      = r.affectation!;
        const nbPhases = aff.phases.length;
        const isPresent = r.pointageStatut === 'present';

        aff.phases.forEach((ph, idx) => {
          const dataRow = ws.addRow({
            ligne:     idx === 0 ? aff.ligne : '',
            matricule: idx === 0 ? aff.matricule : '',
            nomPrenom: idx === 0 ? aff.nomPrenom : '',
            presence:  idx === 0 ? (isPresent ? '🟢 Présent' : '🔴 Absent') : '',
            phase:     ph.phase,
            heures:    ph.heures,
            totalH:    idx === 0 ? aff.totalHeures : '',
          });
          dataRow.height = 20;
          dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.font      = { name: 'Arial', size: 10, color: { argb: '1E293B' } };
            cell.border    = borderAll(C.border);
            cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'left' : 'center' };

            // colorer la colonne présence
            if (colNum === 4 && idx === 0) {
              cell.fill = {
                type: 'pattern', pattern: 'solid',
                fgColor: { argb: isPresent ? C.greenBg : C.redBg }
              };
              cell.font = {
                name: 'Arial', size: 10, bold: true,
                color: { argb: isPresent ? C.greenText : C.redText }
              };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
            }
          });

          if (nbPhases > 1 && idx === 0) {
            const r2   = dataRow.number;
            const rEnd = r2 + nbPhases - 1;
            ws.mergeCells(`A${r2}:A${rEnd}`);
            ws.mergeCells(`B${r2}:B${rEnd}`);
            ws.mergeCells(`C${r2}:C${rEnd}`);
            ws.mergeCells(`D${r2}:D${rEnd}`);
            ws.mergeCells(`G${r2}:G${rEnd}`);
          }
        });
      });

      // Sous-total ligne
      const totalH      = ligneRows.reduce((s, r) => s + (r.affectation!.totalHeures || 0), 0);
      const subTotal    = ws.addRow(['', '', `Sous-total ${ligneName}`, '', '', ligneRows.length + ' ouv.', totalH]);
      subTotal.height   = 22;
      subTotal.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
        cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.totalText } };
        cell.border    = borderAll(C.border);
        cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'right' : 'center' };
      });

      ws.addRow([]).height = 6;
    });

    // Grand total
    const grandTotalH = affectations.reduce((s, a) => s + a.totalHeures, 0);
    const grandRow    = ws.addRow(['', '', 'TOTAL GÉNÉRAL', '', '', affectes.length + ' ouv.', grandTotalH]);
    grandRow.height   = 26;
    grandRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
      cell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
      cell.border    = borderAll(C.border);
      cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'right' : 'center' };
    });

    // ════════════════════════════════════════════════════════════════════════
    // FEUILLES PAR LIGNE
    // ════════════════════════════════════════════════════════════════════════
    this.sortLignes(Array.from(grouped.entries())).forEach(([ligneName, ligneRows]) => {
      const sheetName = this.sanitizeSheetName(`Ligne ${ligneName}`);
      const wsL = wb.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 2 }],
      });

      wsL.columns = [
        { key: 'matricule', width: 12 },
        { key: 'nomPrenom', width: 28 },
        { key: 'presence',  width: 14 },
        { key: 'phase',     width: 14 },
        { key: 'heures',    width: 12 },
        { key: 'totalH',    width: 16 },
      ];

      // Titre
      const presentsL = ligneRows.filter(r => r.pointageStatut === 'present').length;
      const absentsL  = ligneRows.length - presentsL;
      const titleRow  = wsL.addRow([`Ligne : ${ligneName}   —   🟢 ${presentsL} présents   🔴 ${absentsL} absents`]);
      titleRow.height = 30;
      wsL.mergeCells('A1:F1');
      const titleCell = titleRow.getCell(1);
      titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ligneBg } };
      titleCell.font      = { name: 'Arial', bold: true, size: 13, color: { argb: C.white } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // En-tête
      const hRow = wsL.addRow(['Matricule', 'Nom & Prénom', 'Présence', 'Phase', 'Heures (h)', 'Total Heures (h)']);
      hRow.height = 24;
      hRow.eachCell((cell) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
        cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.white } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border    = borderAll(C.border);
      });

      // Données
      ligneRows.forEach((r) => {
        const aff       = r.affectation!;
        const nbPhases  = aff.phases.length;
        const isPresent = r.pointageStatut === 'present';

        aff.phases.forEach((ph, idx) => {
          const dr = wsL.addRow({
            matricule: idx === 0 ? aff.matricule : '',
            nomPrenom: idx === 0 ? aff.nomPrenom : '',
            presence:  idx === 0 ? (isPresent ? '🟢 Présent' : '🔴 Absent') : '',
            phase:     ph.phase,
            heures:    ph.heures,
            totalH:    idx === 0 ? aff.totalHeures : '',
          });
          dr.height = 20;
          dr.eachCell({ includeEmpty: true }, (cell, colNum) => {
            cell.font      = { name: 'Arial', size: 10 };
            cell.border    = borderAll(C.border);
            cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };

            if (colNum === 3 && idx === 0) {
              cell.fill = {
                type: 'pattern', pattern: 'solid',
                fgColor: { argb: isPresent ? C.greenBg : C.redBg }
              };
              cell.font = {
                name: 'Arial', size: 10, bold: true,
                color: { argb: isPresent ? C.greenText : C.redText }
              };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.phaseBg } };
            }
          });

          if (nbPhases > 1 && idx === 0) {
            const rn   = dr.number;
            const rEnd = rn + nbPhases - 1;
            wsL.mergeCells(`A${rn}:A${rEnd}`);
            wsL.mergeCells(`B${rn}:B${rEnd}`);
            wsL.mergeCells(`C${rn}:C${rEnd}`);
            wsL.mergeCells(`F${rn}:F${rEnd}`);
          }
        });
      });

      // Total feuille
      const ligneTotal = ligneRows.reduce((s, r) => s + (r.affectation!.totalHeures || 0), 0);
      const tRow = wsL.addRow(['', 'TOTAL', '', '', ligneRows.length + ' ouvriers', ligneTotal]);
      tRow.height = 22;
      tRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
        cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.totalText } };
        cell.border    = borderAll(C.border);
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