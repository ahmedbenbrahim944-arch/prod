import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { StatutManuel } from './statut-manuel.service';

export interface ExportPersonneRow {
  matricule: string | number;
  nomPrenom: string;
  service?: string;
  heureEntree?: string | null;
  statut: string; // 'present' | 'absent' brut venant de l'API
  commentaire?: string | null;
}

export interface ExportPeriodeData {
  presents: ExportPersonneRow[];
  absents: ExportPersonneRow[];
}

// ✅ NOUVEAU — ligne du récapitulatif par personne (jours sur la période)
export interface ExportRecapRow {
  matricule: string | number;
  nomPrenom: string;
  service?: string; // 'Ouvrier' pour les ouvriers, nom du service sinon
  joursPresent: number;
  joursAbsent: number;
  joursConge: number;
}

@Injectable({ providedIn: 'root' })
export class ExportExcelService {

  // Couleurs PROD SERAF (ARGB — sans #, avec FF en préfixe pour l'opacité)
  private readonly COLOR_BLUE = 'FF04219E';
  private readonly COLOR_BLUE_DARK = 'FF0A35C4';
  private readonly COLOR_GREEN = 'FF16A34A';
  private readonly COLOR_GREEN_LIGHT = 'FFDCFCE7';
  private readonly COLOR_RED = 'FFDC2626';
  private readonly COLOR_RED_LIGHT = 'FFFEE2E2';
  private readonly COLOR_ORANGE = 'FFF59E0B'; // ✅ NOUVEAU — pour "Congé" dans le récap
  private readonly COLOR_GRAY_BG = 'FFF1F5F9';
  private readonly COLOR_WHITE = 'FFFFFFFF';
  private readonly COLOR_TEXT_DARK = 'FF1E293B';

  private readonly statutLabels: Record<string, string> = {
    present: 'Présent',
    conge: 'Congé',
    maladie: 'Maladie',
    mission: 'Mission',
    autre: 'Autre',
    absent: 'Absent',
  };

  /**
   * Génère le fichier Excel de pointage :
   * - Onglet "Récapitulatif" (jours Présent/Absent/Congé par personne sur la période)
   * - Onglet "Tous" (les 4 services regroupés)
   * - Un onglet par service
   * - Onglet "Ouvriers"
   * @param dataParService map service -> { presents, absents } (présence brute de l'API, Employees)
   * @param dataOuvriers { presents, absents } (présence brute de l'API, Ouvriers)
   * @param recapRows récap jours Présent/Absent/Congé par personne (Employees + Ouvriers)
   * @param statutsManuels liste des statuts manuels enregistrés (congé, maladie, mission...)
   * @param dateDebut date début période (format yyyy-MM-dd)
   * @param dateFin date fin période (format yyyy-MM-dd)
   * @param services liste des noms de service à inclure
   */
  async exportPointagePeriode(
    dataParService: Record<string, ExportPeriodeData>,
    dataOuvriers: ExportPeriodeData,
    recapRows: ExportRecapRow[],
    statutsManuels: StatutManuel[],
    dateDebut: string,
    dateFin: string,
    services: string[],
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PROD SERAF';
    workbook.created = new Date();

    // ── Onglet "Récapitulatif" (en premier) ───────────────────────
    this.buildRecapSheet(workbook, recapRows, dateDebut, dateFin, services);

    // ── Onglet récapitulatif "Tous" (services uniquement) ─────────
    const allRows: ExportPersonneRow[] = [];
    services.forEach(s => {
      const d = dataParService[s];
      if (d) {
        allRows.push(...d.presents.map(p => ({ ...p, service: s })));
        allRows.push(...d.absents.map(a => ({ ...a, service: s })));
      }
    });
    this.buildSheet(workbook, 'Tous', allRows, statutsManuels, dateDebut, dateFin, true);

    // ── Un onglet par service ─────────────────────────────────────
    services.forEach(service => {
      const d = dataParService[service];
      if (!d) return;
      const rows: ExportPersonneRow[] = [
        ...d.presents.map(p => ({ ...p, service })),
        ...d.absents.map(a => ({ ...a, service })),
      ];
      this.buildSheet(workbook, service, rows, statutsManuels, dateDebut, dateFin, false);
    });

    // ── Onglet "Ouvriers" ──────────────────────────────────────────
    const ouvrierRows: ExportPersonneRow[] = [
      ...dataOuvriers.presents,
      ...dataOuvriers.absents,
    ];
    this.buildSheet(workbook, 'Ouvriers', ouvrierRows, statutsManuels, dateDebut, dateFin, false);

    // ── Génération et téléchargement ─────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pointage_${this.formatDateFile(dateDebut)}_au_${this.formatDateFile(dateFin)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Construction de l'onglet "Récapitulatif"
  // ════════════════════════════════════════════════════════════
  private buildRecapSheet(
    workbook: ExcelJS.Workbook,
    rows: ExportRecapRow[],
    dateDebut: string,
    dateFin: string,
    services: string[],
  ): void {
    const sheet = workbook.addWorksheet('Récapitulatif', {
      properties: { defaultRowHeight: 20 },
    });

    sheet.columns = [
      { width: 12 }, // Matricule
      { width: 28 }, // Nom & Prénom
      { width: 16 }, // Service / Catégorie
      { width: 14 }, // Jours Présent
      { width: 14 }, // Jours Absent
      { width: 14 }, // Jours Congé
      { width: 14 }, // Total jours
    ];
    const nbCols = 7;

    // ── Titre fusionné ─────────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, nbCols);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'RÉCAPITULATIF — PRÉSENCE / ABSENCE / CONGÉ';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: this.COLOR_WHITE } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE } };
    sheet.getRow(1).height = 28;

    // ── Sous-titre période ──────────────────────────────────────────
    sheet.mergeCells(2, 1, 2, nbCols);
    const subCell = sheet.getCell(2, 1);
    subCell.value = `Période du ${this.formatDateDisplay(dateDebut)} au ${this.formatDateDisplay(dateFin)}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: this.COLOR_TEXT_DARK } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_BG } };
    sheet.getRow(2).height = 20;

    // ── En-têtes colonnes ───────────────────────────────────────────
    const headerRow = sheet.addRow([
      'Matricule', 'Nom & Prénom', 'Service', 'Jours Présent', 'Jours Absent', 'Jours Congé', 'Total jours',
    ]);
    headerRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: this.COLOR_WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE_DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });
    headerRow.height = 22;

    // ── Tri : ordre des services fourni, puis "Ouvrier" en dernier, puis par nom ──
    const ordreGroupe = [...services, 'Ouvrier'];
    const sorted = [...rows].sort((a, b) => {
      const aIdx = ordreGroupe.indexOf(a.service || 'Ouvrier');
      const bIdx = ordreGroupe.indexOf(b.service || 'Ouvrier');
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.nomPrenom.localeCompare(b.nomPrenom);
    });

    sorted.forEach(r => {
      const total = r.joursPresent + r.joursAbsent + r.joursConge;
      const row = sheet.addRow([
        r.matricule, r.nomPrenom, r.service || 'Ouvrier',
        r.joursPresent, r.joursAbsent, r.joursConge, total,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = this.thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };
        cell.font = { name: 'Arial', size: 10, color: { argb: this.COLOR_TEXT_DARK } };
      });

      // Colonne "Jours Présent" → vert
      row.getCell(4).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };

      // Colonne "Jours Absent" → rouge si > 0
      if (r.joursAbsent > 0) {
        row.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_RED } };
      }

      // Colonne "Jours Congé" → orange si > 0
      if (r.joursConge > 0) {
        row.getCell(6).font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_ORANGE } };
      }
    });

    // ── Ligne de totaux ────────────────────────────────────────────
    const totalPresent = rows.reduce((s, r) => s + r.joursPresent, 0);
    const totalAbsent = rows.reduce((s, r) => s + r.joursAbsent, 0);
    const totalConge = rows.reduce((s, r) => s + r.joursConge, 0);

    sheet.addRow([]);
    const totalRow = sheet.addRow([
      `Total : ${rows.length} personne(s)`, '', '',
      totalPresent, totalAbsent, totalConge, totalPresent + totalAbsent + totalConge,
    ]);
    totalRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_BLUE } };
    });

    sheet.views = [{ state: 'frozen', ySplit: 3 }];
  }

  // ════════════════════════════════════════════════════════════
  // Construction d'un onglet présence (Tous / service / Ouvriers)
  // ════════════════════════════════════════════════════════════
  private buildSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    rows: ExportPersonneRow[],
    statutsManuels: StatutManuel[],
    dateDebut: string,
    dateFin: string,
    avecColonneService: boolean,
  ): void {
    const sheet = workbook.addWorksheet(sheetName.substring(0, 31), {
      properties: { defaultRowHeight: 20 },
    });

    // ── Largeurs de colonnes ──────────────────────────────────────
    const cols: Partial<ExcelJS.Column>[] = [
      { width: 12 }, // Matricule
      { width: 28 }, // Nom & Prénom
    ];
    if (avecColonneService) cols.push({ width: 16 }); // Service
    cols.push({ width: 16 }); // Statut
    cols.push({ width: 14 }); // Heure entrée
    cols.push({ width: 30 }); // Commentaire
    sheet.columns = cols;

    const nbCols = cols.length;

    // ── Titre fusionné ─────────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, nbCols);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `POINTAGE — ${sheetName.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: this.COLOR_WHITE } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE } };
    sheet.getRow(1).height = 28;

    // ── Sous-titre période fusionné ────────────────────────────────
    sheet.mergeCells(2, 1, 2, nbCols);
    const subCell = sheet.getCell(2, 1);
    subCell.value = `Période du ${this.formatDateDisplay(dateDebut)} au ${this.formatDateDisplay(dateFin)}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: this.COLOR_TEXT_DARK } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_BG } };
    sheet.getRow(2).height = 20;

    // ── En-têtes colonnes ───────────────────────────────────────────
    const headerLabels = ['Matricule', 'Nom & Prénom'];
    if (avecColonneService) headerLabels.push('Service');
    headerLabels.push('Statut', 'Heure entrée', 'Commentaire');

    const headerRow = sheet.addRow(headerLabels);
    headerRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: this.COLOR_WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE_DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });
    headerRow.height = 22;

    // ── Lignes de données ───────────────────────────────────────────
    // Tri : présents d'abord (par nom), puis absents (par nom)
    const sorted = [...rows].sort((a, b) => {
      const aPresent = a.statut === 'present' ? 0 : 1;
      const bPresent = b.statut === 'present' ? 0 : 1;
      if (aPresent !== bPresent) return aPresent - bPresent;
      return a.nomPrenom.localeCompare(b.nomPrenom);
    });

    sorted.forEach(o => {
      const isPresent = o.statut === 'present';
      const statutFinal = isPresent
        ? 'present'
        : this.resolveStatutManuel(o.matricule, dateDebut, dateFin, statutsManuels);

      const rowValues: any[] = [o.matricule, o.nomPrenom];
      if (avecColonneService) rowValues.push(o.service || '');
      rowValues.push(
        this.statutLabels[statutFinal] || statutFinal,
        isPresent ? this.formatHeure(o.heureEntree) : '',
        o.commentaire || '',
      );

      const row = sheet.addRow(rowValues);

      const fillColor = isPresent ? this.COLOR_GREEN_LIGHT : this.COLOR_RED_LIGHT;
      const fontColor = isPresent ? 'FF15803D' : this.COLOR_RED;

      row.eachCell((cell, colNumber) => {
        cell.border = this.thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };
        cell.font = { name: 'Arial', size: 10, color: { argb: this.COLOR_TEXT_DARK } };

        // Colonne "Statut" colorée
        const statutColIndex = avecColonneService ? 4 : 3;
        if (colNumber === statutColIndex) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: fontColor } };
        }
      });
    });

    // ── Ligne de total ────────────────────────────────────────────
    const totalPresents = rows.filter(r => r.statut === 'present').length;
    const totalAbsents = rows.length - totalPresents;

    sheet.addRow([]); // ligne vide
    const totalRow = sheet.addRow([
      `Total : ${rows.length} employé(s)`,
      '', ...(avecColonneService ? [''] : []),
      `Présents : ${totalPresents}`,
      `Absents : ${totalAbsents}`,
      '',
    ]);
    totalRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_BLUE } };
    });

    // ── Figer les volets (header toujours visible) ──────────────
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
  }

  // ════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════

  /** Cherche un statut manuel (congé/maladie/mission/autre) actif pour ce matricule sur la période */
  private resolveStatutManuel(
    matricule: string | number,
    dateDebut: string,
    dateFin: string,
    statutsManuels: StatutManuel[],
  ): string {
    const found = statutsManuels.find(s =>
      String(s.matricule) === String(matricule) &&
      s.dateDebut <= dateFin &&
      s.dateFin >= dateDebut &&
      s.statut !== 'present'
    );
    return found ? found.statut : 'absent';
  }

  private thinBorder(): Partial<ExcelJS.Borders> {
    const border: ExcelJS.Border = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    return { top: border, left: border, bottom: border, right: border };
  }

  private formatHeure(date: string | null | undefined): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private formatDateDisplay(date: string): string {
    try {
      return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return date;
    }
  }

  private formatDateFile(date: string): string {
    return this.formatDateDisplay(date).split('/').join('-');
  }
}