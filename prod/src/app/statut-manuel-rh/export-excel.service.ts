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

// Récapitulatif calculé par personne sur toute la période
interface RecapPersonne {
  matricule: string | number;
  nomPrenom: string;
  service: string;
  totalJours: number;
  joursPresent: number;
  joursAbsent: number;
  joursConge: number;
  joursMaladie: number;
  joursMission: number;
  joursAutre: number;
  tauxPresence: number; // en %
}

@Injectable({ providedIn: 'root' })
export class ExportExcelService {

  // Couleurs PROD SERAF (ARGB — sans #, avec FF en préfixe pour l'opacité)
  private readonly COLOR_BLUE       = 'FF04219E';
  private readonly COLOR_BLUE_DARK  = 'FF0A35C4';
  private readonly COLOR_GREEN      = 'FF16A34A';
  private readonly COLOR_GREEN_LIGHT = 'FFDCFCE7';
  private readonly COLOR_RED        = 'FFDC2626';
  private readonly COLOR_RED_LIGHT  = 'FFFEE2E2';
  private readonly COLOR_ORANGE     = 'FFEA580C';
  private readonly COLOR_ORANGE_LIGHT = 'FFFFF7ED';
  private readonly COLOR_PURPLE     = 'FF7C3AED';
  private readonly COLOR_PURPLE_LIGHT = 'FFF5F3FF';
  private readonly COLOR_YELLOW_LIGHT = 'FFFEFCE8';
  private readonly COLOR_YELLOW     = 'FFCA8A04';
  private readonly COLOR_GRAY_BG    = 'FFF1F5F9';
  private readonly COLOR_GRAY_ALT   = 'FFF8FAFC';
  private readonly COLOR_WHITE      = 'FFFFFFFF';
  private readonly COLOR_TEXT_DARK  = 'FF1E293B';
  private readonly COLOR_TEXT_MUTED = 'FF64748B';

  private readonly statutLabels: Record<string, string> = {
    present:  'Présent',
    conge:    'Congé',
    maladie:  'Maladie',
    mission:  'Mission',
    autre:    'Autre',
    absent:   'Absent',
  };

  /**
   * Génère le fichier Excel de pointage :
   *  - Onglet "Récapitulatif" : une ligne par personne avec compteurs sur toute la période
   *  - Onglet "Tous"
   *  - Un onglet par service
   *
   * @param dataParService  map service -> { presents, absents } (présence brute de l'API)
   * @param statutsManuels  liste des statuts manuels enregistrés (congé, maladie, mission...)
   * @param dateDebut       date début période (format yyyy-MM-dd)
   * @param dateFin         date fin période (format yyyy-MM-dd)
   * @param services        liste des noms de service à inclure
   */
  async exportPointagePeriode(
    dataParService: Record<string, ExportPeriodeData>,
    statutsManuels: StatutManuel[],
    dateDebut: string,
    dateFin: string,
    services: string[],
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PROD SERAF';
    workbook.created = new Date();

    // ── Consolider toutes les personnes ─────────────────────────
    const allRows: ExportPersonneRow[] = [];
    services.forEach(s => {
      const d = dataParService[s];
      if (d) {
        allRows.push(...d.presents.map(p => ({ ...p, service: s })));
        allRows.push(...d.absents.map(a => ({ ...a, service: s })));
      }
    });

    // ── Onglet Récapitulatif (en premier) ───────────────────────
    const recaps = this.buildRecap(allRows, statutsManuels, dateDebut, dateFin);
    this.buildRecapSheet(workbook, recaps, dateDebut, dateFin);

    // ── Onglet "Tous" ────────────────────────────────────────────
    this.buildSheet(workbook, 'Tous', allRows, statutsManuels, dateDebut, dateFin, true);

    // ── Un onglet par service ────────────────────────────────────
    services.forEach(service => {
      const d = dataParService[service];
      if (!d) return;
      const rows: ExportPersonneRow[] = [
        ...d.presents.map(p => ({ ...p, service })),
        ...d.absents.map(a => ({ ...a, service })),
      ];
      this.buildSheet(workbook, service, rows, statutsManuels, dateDebut, dateFin, false);
    });

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
  // Calcul du récapitulatif par personne sur toute la période
  // ════════════════════════════════════════════════════════════

  /**
   * Pour chaque personne unique dans allRows, itère sur chaque jour de la période
   * et détermine son statut final (présent API ou statut manuel).
   * Retourne un tableau trié par service puis par nom.
   */
  private buildRecap(
    allRows: ExportPersonneRow[],
    statutsManuels: StatutManuel[],
    dateDebut: string,
    dateFin: string,
  ): RecapPersonne[] {

    // Dédupliquer les personnes (une personne peut apparaître présente un jour, absente un autre)
    const personnesMap = new Map<string, { nomPrenom: string; service: string }>();
    allRows.forEach(r => {
      const key = String(r.matricule);
      if (!personnesMap.has(key)) {
        personnesMap.set(key, {
          nomPrenom: r.nomPrenom,
          service: r.service || '',
        });
      }
    });

    // Générer la liste de tous les jours ouvrables de la période
    // (on inclut tous les jours calendaires — samedi/dimanche inclus —
    //  car la logique métier dépend du client ; il suffit de changer le filtre)
    const jours = this.getJoursPeriode(dateDebut, dateFin);
    const totalJours = jours.length;

    // Pour chaque jour on regroupe les matricules présents (API)
    // La clé est la date ISO yyyy-MM-dd
    // Comme l'API renvoie uniquement la présence agrégée sur la période entière
    // (pas jour par jour), on utilise une heuristique :
    //   • Si statut API = 'present' → présent sur TOUS les jours de la période
    //   • Si statut API = 'absent'  → on regarde les statuts manuels jour par jour
    //
    // Cette approche est cohérente avec les données disponibles côté frontend.

    const recaps: RecapPersonne[] = [];

    personnesMap.forEach((info, matricule) => {
      let joursPresent = 0;
      let joursAbsent  = 0;
      let joursConge   = 0;
      let joursMaladie = 0;
      let joursMission = 0;
      let joursAutre   = 0;

      // Statut API de cette personne (présent ou absent sur la période)
      const rowAPI = allRows.find(r => String(r.matricule) === matricule);
      const presentAPI = rowAPI?.statut === 'present';

      jours.forEach(jour => {
        if (presentAPI) {
          // Présent selon l'API : on vérifie quand même s'il y a un statut manuel
          // (ex: congé ponctuel qui override la présence)
          const sm = this.findStatutManuelPourJour(matricule, jour, statutsManuels);
          if (sm && sm !== 'present') {
            this.incrementStatut(sm, { joursConge, joursMaladie, joursMission, joursAutre },
              v => { joursConge = v.joursConge; joursMaladie = v.joursMaladie; joursMission = v.joursMission; joursAutre = v.joursAutre; });
          } else {
            joursPresent++;
          }
        } else {
          // Absent selon l'API : on cherche un statut manuel pour qualifier l'absence
          const sm = this.findStatutManuelPourJour(matricule, jour, statutsManuels);
          if (!sm || sm === 'absent') {
            joursAbsent++;
          } else if (sm === 'present') {
            joursPresent++; // statut manuel "présent" (badge oublié)
          } else if (sm === 'conge') {
            joursConge++;
          } else if (sm === 'maladie') {
            joursMaladie++;
          } else if (sm === 'mission') {
            joursMission++;
          } else {
            joursAutre++;
          }
        }
      });

      const tauxPresence = totalJours > 0
        ? Math.round((joursPresent / totalJours) * 100)
        : 0;

      recaps.push({
        matricule,
        nomPrenom: info.nomPrenom,
        service: info.service,
        totalJours,
        joursPresent,
        joursAbsent,
        joursConge,
        joursMaladie,
        joursMission,
        joursAutre,
        tauxPresence,
      });
    });

    // Tri : par service, puis par nom
    recaps.sort((a, b) => {
      if (a.service !== b.service) return a.service.localeCompare(b.service);
      return a.nomPrenom.localeCompare(b.nomPrenom);
    });

    return recaps;
  }

  /** Retourne le statut manuel pour un matricule à une date précise (yyyy-MM-dd), ou null */
  private findStatutManuelPourJour(
    matricule: string,
    jour: string,
    statutsManuels: StatutManuel[],
  ): string | null {
    const found = statutsManuels.find(s =>
      String(s.matricule) === matricule &&
      s.dateDebut <= jour &&
      s.dateFin >= jour
    );
    return found ? found.statut : null;
  }

  /** Incrémente le bon compteur selon le statut */
  private incrementStatut(
    statut: string,
    counters: { joursConge: number; joursMaladie: number; joursMission: number; joursAutre: number },
    setter: (v: typeof counters) => void,
  ): void {
    if (statut === 'conge')    counters.joursConge++;
    else if (statut === 'maladie') counters.joursMaladie++;
    else if (statut === 'mission') counters.joursMission++;
    else counters.joursAutre++;
    setter(counters);
  }

  /** Génère la liste de tous les jours calendaires de la période */
  private getJoursPeriode(dateDebut: string, dateFin: string): string[] {
    const jours: string[] = [];
    const current = new Date(dateDebut);
    const end = new Date(dateFin);
    // Normaliser à minuit UTC pour éviter les décalages de timezone
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      jours.push(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return jours;
  }

  // ════════════════════════════════════════════════════════════
  // Onglet Récapitulatif
  // ════════════════════════════════════════════════════════════
  private buildRecapSheet(
    workbook: ExcelJS.Workbook,
    recaps: RecapPersonne[],
    dateDebut: string,
    dateFin: string,
  ): void {
    const sheet = workbook.addWorksheet('📊 Récapitulatif', {
      properties: { defaultRowHeight: 20 },
      views: [{ state: 'frozen', ySplit: 3 }],
    });

    // Largeurs de colonnes
    sheet.columns = [
      { width: 12 }, // Matricule
      { width: 28 }, // Nom & Prénom
      { width: 16 }, // Service
      { width: 12 }, // Total jours
      { width: 12 }, // Présents
      { width: 12 }, // Absents
      { width: 12 }, // Congés
      { width: 12 }, // Maladie
      { width: 12 }, // Mission
      { width: 12 }, // Autre
      { width: 14 }, // Taux présence
    ];

    const nbCols = 11;

    // ── Titre ────────────────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, nbCols);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'RÉCAPITULATIF DE POINTAGE — PAR EMPLOYÉ';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: this.COLOR_WHITE } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE } };
    sheet.getRow(1).height = 30;

    // ── Sous-titre période ────────────────────────────────────────
    sheet.mergeCells(2, 1, 2, nbCols);
    const subCell = sheet.getCell(2, 1);
    subCell.value = `Période du ${this.formatDateDisplay(dateDebut)} au ${this.formatDateDisplay(dateFin)}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: this.COLOR_TEXT_DARK } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_BG } };
    sheet.getRow(2).height = 20;

    // ── En-têtes ──────────────────────────────────────────────────
    const headerLabels = [
      'Matricule', 'Nom & Prénom', 'Service',
      '📅 Jrs total', '✅ Présents', '❌ Absents',
      '🏖️ Congés', '🏥 Maladie', '✈️ Mission', '📝 Autre',
      '📊 Taux %',
    ];

    const headerRow = sheet.addRow(headerLabels);
    headerRow.height = 24;
    headerRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE_DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.thinBorder();
    });

    // ── Lignes de données ─────────────────────────────────────────
    let lastService = '';
    let serviceRowStart = 4; // première ligne de données (après titre + sous-titre + header)
    let dataRowIndex = 4;

    recaps.forEach((r, idx) => {
      const isEven = idx % 2 === 0;
      const rowValues = [
        r.matricule,
        r.nomPrenom,
        r.service,
        r.totalJours,
        r.joursPresent,
        r.joursAbsent,
        r.joursConge,
        r.joursMaladie,
        r.joursMission,
        r.joursAutre,
        `${r.tauxPresence}%`,
      ];

      const row = sheet.addRow(rowValues);
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.border = this.thinBorder();
        cell.font = { name: 'Arial', size: 10, color: { argb: this.COLOR_TEXT_DARK } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 2 ? 'left' : 'center',
        };

        // Fond alterné léger pour lisibilité
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_ALT } };
        }

        // Colonne "Présents" → vert
        if (colNumber === 5 && r.joursPresent > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GREEN_LIGHT } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_GREEN } };
        }

        // Colonne "Absents" → rouge
        if (colNumber === 6 && r.joursAbsent > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_RED_LIGHT } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_RED } };
        }

        // Colonne "Congés" → orange
        if (colNumber === 7 && r.joursConge > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_ORANGE_LIGHT } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_ORANGE } };
        }

        // Colonne "Maladie" → violet
        if (colNumber === 8 && r.joursMaladie > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_PURPLE_LIGHT } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_PURPLE } };
        }

        // Colonne "Mission" → jaune
        if (colNumber === 9 && r.joursMission > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_YELLOW_LIGHT } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_YELLOW } };
        }

        // Colonne "Taux %" → couleur selon seuil
        if (colNumber === 11) {
          const color = r.tauxPresence >= 80
            ? this.COLOR_GREEN
            : r.tauxPresence >= 50
              ? this.COLOR_YELLOW
              : this.COLOR_RED;
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: color } };
        }
      });

      dataRowIndex++;
    });

    // ── Ligne de totaux globaux ───────────────────────────────────
    sheet.addRow([]);

    const totalRow = sheet.addRow([
      `Total : ${recaps.length} employé(s)`,
      '',
      '',
      '', // total jours (variable par personne, pas de somme)
      recaps.reduce((sum, r) => sum + r.joursPresent,  0),
      recaps.reduce((sum, r) => sum + r.joursAbsent,   0),
      recaps.reduce((sum, r) => sum + r.joursConge,    0),
      recaps.reduce((sum, r) => sum + r.joursMaladie,  0),
      recaps.reduce((sum, r) => sum + r.joursMission,  0),
      recaps.reduce((sum, r) => sum + r.joursAutre,    0),
      recaps.length > 0
        ? `${Math.round(recaps.reduce((sum, r) => sum + r.tauxPresence, 0) / recaps.length)}%`
        : '—',
    ]);

    totalRow.height = 22;
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: this.COLOR_BLUE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_BG } };
      cell.border = this.thinBorder();
      cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center', vertical: 'middle' };
    });
  }

  // ════════════════════════════════════════════════════════════
  // Construction d'un onglet de pointage brut (Tous / par service)
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

    // Largeurs de colonnes
    const cols: Partial<ExcelJS.Column>[] = [
      { width: 12 }, // Matricule
      { width: 28 }, // Nom & Prénom
    ];
    if (avecColonneService) cols.push({ width: 16 });
    cols.push({ width: 16 }); // Statut
    cols.push({ width: 14 }); // Heure entrée
    cols.push({ width: 30 }); // Commentaire
    sheet.columns = cols;

    const nbCols = cols.length;

    // ── Titre fusionné ────────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, nbCols);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `POINTAGE — ${sheetName.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: this.COLOR_WHITE } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_BLUE } };
    sheet.getRow(1).height = 28;

    // ── Sous-titre période fusionné ───────────────────────────────
    sheet.mergeCells(2, 1, 2, nbCols);
    const subCell = sheet.getCell(2, 1);
    subCell.value = `Période du ${this.formatDateDisplay(dateDebut)} au ${this.formatDateDisplay(dateFin)}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: this.COLOR_TEXT_DARK } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.COLOR_GRAY_BG } };
    sheet.getRow(2).height = 20;

    // ── En-têtes colonnes ─────────────────────────────────────────
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

    // ── Lignes de données ─────────────────────────────────────────
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

        const statutColIndex = avecColonneService ? 4 : 3;
        if (colNumber === statutColIndex) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: fontColor } };
        }
      });
    });

    // ── Ligne de total ────────────────────────────────────────────
    const totalPresents = rows.filter(r => r.statut === 'present').length;
    const totalAbsents  = rows.length - totalPresents;

    sheet.addRow([]);
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

    // ── Figer les volets ──────────────────────────────────────────
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
  }

  // ════════════════════════════════════════════════════════════
  // Helpers partagés
  // ════════════════════════════════════════════════════════════

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