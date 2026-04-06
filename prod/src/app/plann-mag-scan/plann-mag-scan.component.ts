// src/app/plann-mag-scan/plann-mag-scan.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlannMagScanService,
  ScanResult,
  ScanError,
} from './plann-mag-scan.service';

// ─── Statuts possibles d'un scan ─────────────────────────────────
type ScanStatus = 'success' | 'already_served' | 'not_found' | 'error';

interface ScanHistoryItem {
  codeDocument:  string;
  status:        ScanStatus;
  message:       string;
  ligne:         string;
  semaine:       string;
  dateFormatee:  string;
  scannedAt:     Date;
  serviLe?:      string;   // si déjà servi
  serviPar?:     string | null;
}

@Component({
  selector: 'app-plann-mag-scan',
  standalone: true,
  styleUrls: ['./plann-mag-scan.component.css'],
  imports: [CommonModule, FormsModule, TitleCasePipe, DatePipe],
  templateUrl: './plann-mag-scan.component.html',
})
export class PlannMagScanComponent implements OnInit, AfterViewInit {

  @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

  // ─── Formulaire ──────────────────────────────────────────────────
  scanValue: string = '';

  // ─── État courant ────────────────────────────────────────────────
  isLoading:     boolean              = false;
  lastResult:    ScanResult | null    = null;
  lastError:     ScanError | null     = null;
  lastStatus:    ScanStatus | null    = null;

  // ─── Historique de la session ─────────────────────────────────────
  history: ScanHistoryItem[] = [];

  constructor(private scanService: PlannMagScanService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Auto-focus dès le chargement de la page
    this.focusInput();
  }

  // ─── Focus automatique sur l'input ───────────────────────────────
  focusInput(): void {
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 100);
  }

  // ─── Déclenché par la douchette (Enter) ou le bouton ─────────────
  onScan(): void {
    const code = this.scanValue.trim().toUpperCase();

    if (!code) return;

    // Validation basique du format
    if (!/^G\d{5,}$/.test(code)) {
      this.lastStatus = 'error';
      this.lastResult = null;
      this.lastError  = {
        alreadyServed: false,
        message: `Format invalide : "${code}". Attendu : G suivi de chiffres (ex: G89651603)`,
        codeDocument: code,
      };
      this.scanValue = '';
      this.focusInput();
      return;
    }

    this.isLoading  = true;
    this.lastResult = null;
    this.lastError  = null;
    this.lastStatus = null;
    this.scanValue  = '';  // vider immédiatement pour le prochain scan

    this.scanService.scan(code).subscribe({

      // ── Succès : document servi pour la première fois ─────────────
      next: (res: ScanResult) => {
        this.isLoading  = false;
        this.lastResult = res;
        this.lastStatus = 'success';
        this.lastError  = null;

        this.history.unshift({
          codeDocument: res.codeDocument,
          status:       'success',
          message:      res.message,
          ligne:        res.planning[0]?.ligne || '',
          semaine:      res.semaine,
          dateFormatee: res.dateFormatee,
          scannedAt:    new Date(),
        });

        this.focusInput();
      },

      // ── Erreur HTTP ───────────────────────────────────────────────
      error: (err: any) => {
        this.isLoading  = false;
        this.lastResult = null;
        const body      = err.error || {};

        // 409 Conflict → déjà servi
        if (err.status === 409 && body.alreadyServed) {
          this.lastStatus = 'already_served';
          this.lastError  = body as ScanError;

          this.history.unshift({
            codeDocument: body.codeDocument || code,
            status:       'already_served',
            message:      body.message,
            ligne:        body.ligne || '',
            semaine:      body.semaine || '',
            dateFormatee: body.dateFormatee || '',
            scannedAt:    new Date(),
            serviLe:      body.serviLe,
            serviPar:     body.serviPar,
          });

        // 404 Not Found → code inconnu
        } else if (err.status === 404) {
          this.lastStatus = 'not_found';
          this.lastError  = {
            alreadyServed: false,
            message: body.message || `Aucun planning trouvé pour le code ${code}`,
            codeDocument: code,
          };

          this.history.unshift({
            codeDocument: code,
            status:       'not_found',
            message:      this.lastError.message,
            ligne:        '',
            semaine:      '',
            dateFormatee: '',
            scannedAt:    new Date(),
          });

        // Autre erreur
        } else {
          this.lastStatus = 'error';
          this.lastError  = {
            alreadyServed: false,
            message: body.message || 'Erreur serveur',
            codeDocument: code,
          };
        }

        this.focusInput();
      },
    });
  }

  // ─── Vider le résultat courant ────────────────────────────────────
  clearResult(): void {
    this.lastResult = null;
    this.lastError  = null;
    this.lastStatus = null;
    this.focusInput();
  }

  // ─── Vider l'historique ───────────────────────────────────────────
  clearHistory(): void {
    this.history = [];
  }

  // ─── Helpers template ─────────────────────────────────────────────
  getStatusLabel(status: ScanStatus): string {
    switch (status) {
      case 'success':        return '✅ SERVI';
      case 'already_served': return '⚠️ DÉJÀ SERVI';
      case 'not_found':      return '❌ INTROUVABLE';
      case 'error':          return '🔴 ERREUR';
    }
  }

  getStatusClass(status: ScanStatus): string {
    switch (status) {
      case 'success':        return 'bg-green-100 border-green-400 text-green-800';
      case 'already_served': return 'bg-orange-100 border-orange-400 text-orange-800';
      case 'not_found':      return 'bg-red-100 border-red-400 text-red-800';
      case 'error':          return 'bg-red-100 border-red-400 text-red-800';
    }
  }

  getBadgeClass(status: ScanStatus): string {
    switch (status) {
      case 'success':        return 'bg-green-500 text-white';
      case 'already_served': return 'bg-orange-500 text-white';
      case 'not_found':      return 'bg-red-500 text-white';
      case 'error':          return 'bg-red-500 text-white';
    }
  }

  // Groupe les MP du résultat par référence produit
  get refGroupsFromResult(): any[] {
    if (!this.lastResult?.planning) return [];
    const map = new Map<string, any>();
    this.lastResult.planning.forEach(item => {
      if (!map.has(item.reference)) {
        map.set(item.reference, {
          reference:    item.reference,
          ligne:        item.ligne,
          qtePlanifiee: item.qtePlanifiee,
          mpRows:       [],
        });
      }
      map.get(item.reference).mpRows.push(item);
    });
    return Array.from(map.values());
  }
}