// src/app/plann-mag-search/plann-mag-search.component.ts
import { Component }              from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule }            from '@angular/forms';
import {
  PlannMagSearchService,
  SearchByDateResponse,
  RefDetail,
  LigneGroupItem,
  OfsByDateResponse,
  OfsDetail,
} from './plann-mag-search.service';
import { jsPDF } from 'jspdf';

// ─── Interface interne d'affichage ───────────────────────────────────────────
interface RefGroupDisplay extends RefDetail {
  dateFormatee: string;
  jour:         string;
  semaine:      string;
}

interface LigneGroupDisplay {
  ligne: string;
  refs:  RefGroupDisplay[];
}

// ─────────────────────────────────────────────────────────────────────────────

/** Nombre max de lignes MP sur une page avant de devoir couper (calculé sur A4) */
const PDF_MAX_ROWS_PER_PAGE = 13;

@Component({
  selector:    'app-plann-mag-search',
  standalone:  true,
  imports:     [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './plann-mag-search.component.html',
  styleUrls:   ['./plann-mag-search.component.css'],
})
export class PlannMagSearchComponent {

  // ─── Formulaire ──────────────────────────────────────────────────────────
  annee: string = new Date().getFullYear().toString();
  date:  string = '';
  of:    string = '';   // '' = tous les OFs

  // ─── Liste des OF disponibles ────────────────────────────────────────────
  availableOfs:    string[]                  = [];
  ofsDateInfo:     OfsByDateResponse | null  = null;
  isLoadingOfs:    boolean                   = false;
  ofsErrorMessage: string                    = '';

  // ─── Résultats ───────────────────────────────────────────────────────────
  isLoading:    boolean                      = false;
  errorMessage: string                       = '';
  searchResult: SearchByDateResponse | null  = null;
  ligneGroups:  LigneGroupDisplay[]          = [];
  flatRefGroups: RefGroupDisplay[]           = [];   // pour le PDF

  constructor(private searchService: PlannMagSearchService) {}

  // ─── Années disponibles ──────────────────────────────────────────────────
  getYears(): string[] {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1].map(n => n.toString());
  }

  /** Nombre de pages PDF estimé */
  get estimatedPdfPages(): number {
    return this.flatRefGroups.reduce((sum, ref) => {
      const pages = Math.ceil(ref.mpRows.length / PDF_MAX_ROWS_PER_PAGE);
      return sum + Math.max(pages, 1);
    }, 0);
  }

  // ─── Changement de date ──────────────────────────────────────────────────
  onDateChange(): void {
    this.resetResults();
    this.availableOfs    = [];
    this.ofsDateInfo     = null;
    this.ofsErrorMessage = '';
    this.of              = '';

    if (/^\d{4}$/.test(this.date) && this.annee) {
      this.loadOfsByDate();
    }
  }

  // ─── Changement d'année ──────────────────────────────────────────────────
  onAnneeChange(): void {
    this.resetResults();
    this.availableOfs    = [];
    this.ofsDateInfo     = null;
    this.ofsErrorMessage = '';
    this.of              = '';

    if (/^\d{4}$/.test(this.date)) {
      this.loadOfsByDate();
    }
  }

  // ─── Charger les OF disponibles ──────────────────────────────────────────
  private loadOfsByDate(): void {
    this.isLoadingOfs    = true;
    this.ofsErrorMessage = '';

    this.searchService.getOfsByDate(this.annee, this.date).subscribe({
      next: (res: OfsByDateResponse) => {
        this.isLoadingOfs = false;
        this.ofsDateInfo  = res;
        this.availableOfs = res.ofs;
      },
      error: (err: any) => {
        this.isLoadingOfs    = false;
        this.availableOfs    = [];
        this.ofsErrorMessage = err.error?.message || 'Aucun OF trouvé pour cette date';
      },
    });
  }

  // ─── Recherche principale ─────────────────────────────────────────────────
  search(): void {
    if (!this.annee || !this.date) {
      this.errorMessage = 'Veuillez remplir l\'année et la date';
      return;
    }
    if (!/^\d{4}$/.test(this.date)) {
      this.errorMessage = 'La date doit être au format JJMM (ex: 0204 pour le 02 avril)';
      return;
    }

    this.isLoading    = true;
    this.errorMessage = '';
    this.resetResults();

    // of facultatif : '' → undefined (tous les OFs)
    const ofFilter = this.of || undefined;

    this.searchService.searchByDate(this.annee, this.date, ofFilter).subscribe({
      next: (res: SearchByDateResponse) => {
        this.isLoading    = false;
        this.searchResult = res;
        this.buildDisplayGroups(res);
      },
      error: (err: any) => {
        this.isLoading    = false;
        this.errorMessage = err.error?.message || 'Aucune planification trouvée';
      },
    });
  }

  // ─── Construire les groupes d'affichage ──────────────────────────────────
  private buildDisplayGroups(res: SearchByDateResponse): void {
    this.ligneGroups  = [];
    this.flatRefGroups = [];

    for (const ligneGroup of res.ligneGroups) {
      const refs: RefGroupDisplay[] = ligneGroup.refs.map(ref => ({
        ...ref,
        dateFormatee: res.dateFormatee,
        jour:         res.jour,
        semaine:      res.semaine,
      }));

      this.ligneGroups.push({ ligne: ligneGroup.ligne, refs });
      this.flatRefGroups.push(...refs);
    }
  }

  private resetResults(): void {
    this.searchResult  = null;
    this.ligneGroups   = [];
    this.flatRefGroups = [];
    this.errorMessage  = '';
  }

  // ─── Export PDF ───────────────────────────────────────────────────────────
  downloadPDF(): void {
    if (!this.flatRefGroups.length) {
      this.errorMessage = 'Aucune donnée à exporter';
      return;
    }

    try {
      const doc   = new jsPDF('portrait', 'mm', 'a4');
      const pw    = doc.internal.pageSize.getWidth();
      const ph    = doc.internal.pageSize.getHeight();
      const mg    = 15;
      let   first = true;

      for (const ref of this.flatRefGroups) {
        const rows    = ref.mpRows;
        const nbPages = Math.ceil(rows.length / PDF_MAX_ROWS_PER_PAGE);

        for (let p = 0; p < nbPages; p++) {
          const chunk = rows.slice(p * PDF_MAX_ROWS_PER_PAGE, (p + 1) * PDF_MAX_ROWS_PER_PAGE);
          const part: 'single' | 'first' | 'second' =
            nbPages === 1  ? 'single' :
            p === 0        ? 'first'  :
            p < nbPages - 1 ? 'middle' as any : 'second';

          const partPage = { ...ref, mpRows: chunk };

          if (!first) doc.addPage();
          first = false;
          this.renderRefPage(doc, partPage, pw, ph, mg, part);
        }
      }

      // Numérotation des pages
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} / ${total}`, pw / 2, ph - 8, { align: 'center' });
      }

      const res = this.searchResult!;
      const filename = res.ofFilter
        ? `PlannMag-G${res.ofFilter}${res.date}.pdf`
        : `PlannMag-${res.date}-${res.annee}.pdf`;

      doc.save(filename);
    } catch (err) {
      console.error(err);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }

  // ─── Rendu d'une page de référence ───────────────────────────────────────
  /**
   * @param part 'single' = page normale
   *             'first'  = 1ère moitié (pas de signature, note "suite")
   *             'second' = 2ème moitié (suite, signature en bas)
   */
  private renderRefPage(
    doc:  any,
    ref:  RefGroupDisplay,
    pw:   number,
    ph:   number,
    mg:   number,
    part: 'single' | 'first' | 'second' | 'middle',
  ): void {
    const cw = pw - 2 * mg;

    // ── En-tête noir ──────────────────────────────────────────────────────
    doc.setFillColor(0, 0, 0);
    doc.rect(mg, 10, cw, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const headerTitle = (part === 'second' || part === 'middle')
      ? 'PLANNING MAGASIN – MATIÈRES PREMIÈRES (suite)'
      : 'PLANNING MAGASIN – MATIÈRES PREMIÈRES';
    doc.text(headerTitle, pw / 2, 18, { align: 'center' });

    // ── Infos date / OF / ligne ───────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text(`Semaine : ${ref.semaine}`, mg, 28);
    doc.text(`Date : ${ref.dateFormatee}  (${this.capitalizeFirst(ref.jour)})`, mg, 34);

    // Affichage OF(s) à droite — robuste même si plusieurs OFs
    let ofsLabel = 'OF : —';
    if (ref.ofs && ref.ofs.length === 1) {
      ofsLabel = `OF : ${ref.ofs[0].of || '—'}`;
    } else if (ref.ofs && ref.ofs.length > 1) {
      const ofNums = ref.ofs.map(o => o.of).filter(v => v).slice(0, 4).join(', ');
      const extra  = ref.ofs.length > 4 ? ` +${ref.ofs.length - 4}` : '';
      ofsLabel = `OFs : ${ofNums}${extra}`;
    }

    doc.text(ofsLabel,             pw - mg, 28, { align: 'right' });
    doc.text(`Ligne : ${ref.ligne}`, pw - mg, 34, { align: 'right' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(mg, 37, pw - mg, 37);

    // ── Numéro de planification (centré dans l'en-tête) ───────────────────
    const numeroPlan = this.buildNumeroPlanification(ref);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(`N° Planning : ${numeroPlan}`, pw / 2, 45, { align: 'center' });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(mg, 49, pw - mg, 49);

    // ── Référence produit ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(38);
    doc.setTextColor(0, 0, 0);
    doc.text(ref.reference, pw / 2, 67, { align: 'center' });

    // Quantité : totalQte (somme de tous les OFs)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    const qteLabel = ref.ofs.length > 1
      ? `Quantité totale planifiée : ${ref.totalQte}  (${ref.ofs.map(o => `OF ${o.of} : ${o.qtePlanifiee}`).join(' / ')})`
      : `Quantité planifiée : ${ref.totalQte}`;
    doc.text(qteLabel, pw / 2, 76, { align: 'center' });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(mg, 80, pw - mg, 80);

    // ── Tableau MP ────────────────────────────────────────────────────────
    let y = 86;
    const rowH    = 10;
    const colRef  = 40;
    const colDes  = 65;
    const colQte  = 22;
    const colCoef = 20;
    const colEtat = cw - colRef - colDes - colQte - colCoef;

    const headers: [number, string][] = [
      [colRef,  'REF'],
      [colDes,  'DES'],
      [colQte,  'QTE'],
      [colCoef, 'COEFF'],
      [colEtat, 'ETAT'],
    ];

    let x = mg;
    headers.forEach(([w, label]) => {
      doc.setFillColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(x, y, w, rowH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(label, x + w / 2, y + 7, { align: 'center' });
      x += w;
    });
    y += rowH;

    ref.mpRows.forEach((mp, idx) => {
      const bg = idx % 2 === 0 ? 245 : 255;
      doc.setFillColor(bg, bg, bg);
      doc.setDrawColor(bg, bg, bg);
      doc.rect(mg, y, cw, rowH, 'F');

      x = mg;
      const cells: [number, string, boolean][] = [
        [colRef,  mp.refMp, true],
        [colDes,  mp.descriptionMp.length > 28 ? mp.descriptionMp.substring(0, 25) + '…' : mp.descriptionMp, false],
        [colQte,  mp.qteNecessaire.toString(), true],
        [colCoef, mp.coeffImpiego.toString(), false],
        [colEtat, '', false],
      ];

      cells.forEach(([w, text, bold]) => {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, rowH, 'D');
        doc.setFillColor(bg, bg, bg);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(bold ? 11 : 10);
        if (text) doc.text(text, x + w / 2, y + 7, { align: 'center' });
        x += w;
      });
      y += rowH;
    });

    // ── Note "suite page suivante" (pages non-finales) ───────────────
    if (part === 'first' || part === 'middle') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('→ Suite page suivante', pw - mg, y + 6, { align: 'right' });
      return; // pas de code-barres ni de signature sur les pages intermédiaires
    }

    // ── Code-barres (page unique ou 2ème moitié) ──────────────────────────
    // Toujours utiliser le codeDocument du 1er OF disponible
    const barcodeCode = (ref.ofs && ref.ofs.length > 0)
      ? ref.ofs[0].codeDocument
      : ref.codeDocument;
    const barcodeImg = this.generateBarcodeBase64(barcodeCode);
    if (barcodeImg) {
      const barcodeW = 55;
      const barcodeH = 18;
      doc.addImage(barcodeImg, 'PNG', pw / 2 - barcodeW / 2, y + 10, barcodeW, barcodeH);
    }

    // ── Cadre signatures ─────────────────────────────────────────────────
    const signY = ph - 48;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(mg, signY, cw, 32, 'D');
    doc.line(mg + cw / 2, signY, mg + cw / 2, signY + 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Préparé par :', mg + 5,          signY + 7);
    doc.text('Vérifié par :', mg + cw / 2 + 5, signY + 7);

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(mg + 5,          signY + 22, mg + cw / 2 - 5, signY + 22);
    doc.line(mg + cw / 2 + 5, signY + 22, mg + cw - 5,     signY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('Signature', mg + cw / 4,     signY + 28, { align: 'center' });
    doc.text('Signature', mg + 3 * cw / 4, signY + 28, { align: 'center' });
  }

  // ─── Code 128B ───────────────────────────────────────────────────────────
  private generateBarcodeBase64(code: string): string {
    try {
      const C128: string[] = [
        '11011001100','11001101100','11001100110','10010011000','10010001100',
        '10001001100','10011001000','10011000100','10001100100','11001001000',
        '11001000100','11000100100','10110011100','10011011100','10011001110',
        '10111001100','10011101100','10011100110','11001110010','11001011100',
        '11001001110','11011100100','11001110100','11101101110','11101001100',
        '11100101100','11100100110','11101100100','11100110100','11100110010',
        '11011011000','11011000110','11000110110','10100011000','10001011000',
        '10001000110','10110001000','10001101000','10001100010','11010001000',
        '11000101000','11000100010','10110111000','10110001110','10001101110',
        '10111011000','10111000110','10001110110','11101110110','11010001110',
        '11000101110','11011101000','11011100010','11011101110','11101011000',
        '11101000110','11100010110','11101101000','11101100010','11100011010',
        '11101111010','11001000010','11110001010','10100110000','10100001100',
        '10010110000','10010000110','10000101100','10000100110','10110010000',
        '10110000100','10011010000','10011000010','10000110100','10000110010',
        '11000010010','11001010000','11110111010','11000010100','10001111010',
        '10100111100','10010111100','10010011110','10111100100','10011110100',
        '10011110010','11110100100','11110010100','11110010010','11011011110',
        '11011110110','11110110110','10101111000','10100011110','10001011110',
        '10111101000','10111100010','11110101000','11110100010','10111011110',
        '10111101110','11101011110','11110101110',
        '11010000100','11010010000','11010011100',
        '1100011101011',
      ];

      const START_B = 104;
      let checksum  = START_B;
      const values  = [START_B];

      for (let i = 0; i < code.length; i++) {
        const v = code.charCodeAt(i) - 32;
        values.push(v);
        checksum += v * (i + 1);
      }
      values.push(checksum % 103);
      values.push(106);

      let binary = '';
      for (const v of values) binary += C128[v];

      const mod  = 2;
      const qz   = 8;
      const barH = 50;
      const txtH = 16;

      const canvas  = document.createElement('canvas');
      canvas.width  = binary.length * mod + qz * 2;
      canvas.height = barH + txtH;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';

      for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') ctx.fillRect(qz + i * mod, 0, mod, barH);
      }

      ctx.font         = '11px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(code, canvas.width / 2, barH + 3);

      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  private capitalizeFirst(str: string): string {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ─── Numéro de planification ──────────────────────────────────────────────
  /**
   * Construit le numéro de planification :
   *   [LetAnnée][NumSemaine][NumJour][Ligne]
   *   Exemple : G151L04
   *     G   → 2026  (A=2020, B=2021 … G=2026)
   *     15  → numéro de semaine ("semaine15" → "15")
   *     1   → jour sans zéro (lundi=1 … dimanche=7)
   *     L04 → ligne avec préfixe L ("L04:RXT1" → "L04")
   */
  buildNumeroPlanification(ref: RefGroupDisplay): string {
    const yearLetter = this.getYearLetter(this.annee);
    const semaineNum = this.getSemaineNum(ref.semaine);
    const jourNum    = this.getJourNum(ref.jour);
    const ligneCode  = this.getLigneCode(ref.ligne);
    return `${yearLetter}${semaineNum}${jourNum}${ligneCode}`;
  }

  private getYearLetter(annee: string): string {
    const base = 2020; // A = 2020
    const diff = parseInt(annee, 10) - base;
    return String.fromCharCode(65 + Math.max(0, diff));
  }

  private getSemaineNum(semaine: string): string {
    // "semaine15" ou "semaine 15" → "15"
    const m = semaine.match(/\d+/);
    return m ? m[0] : '';
  }

  private getJourNum(jour: string): string {
    // Sans zéro devant : lundi=1 … dimanche=7
    const map: Record<string, string> = {
      'lundi':    '1',
      'mardi':    '2',
      'mercredi': '3',
      'jeudi':    '4',
      'vendredi': '5',
      'samedi':   '6',
      'dimanche': '7',
    };
    return map[jour.toLowerCase()] || '';
  }

  private getLigneCode(ligne: string): string {
    // "L04:RXT1" → "L04" / "L36:RXT2" → "L36"
    const m = ligne.match(/(L\d{2,})/i);
    return m ? m[1].toUpperCase() : ligne;
  }

  /** Helper appelé depuis le template — évite les arrow functions interdites dans Angular */
  getOfsLabel(ofs: OfsDetail[]): string {
    const visible = ofs
      .slice(0, 4)
      .map(o => o.of ? o.of : '⚠ sans OF')
      .join(', ');
    return ofs.length > 4 ? `${visible} +${ofs.length - 4}` : visible;
  }
}