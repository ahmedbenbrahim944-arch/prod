// src/app/plaquettes/plaquettes-stats.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaquettesService, StatsResult, TypeStat } from '../plaquettes/plaquettes.service';

type Page = 'filtre' | 'resultats';

@Component({
  selector: 'app-plaquettes-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plaquettes-stats.component.html',
  styleUrls: ['./plaquettes-stats.component.css'],
})
export class PlaquettesStatsComponent {
  // ── Navigation 2 pages ───────────────────────────────────────
  currentPage: Page = 'filtre';

  // ── Filtre ───────────────────────────────────────────────────
  dateDebut = '';
  dateFin   = '';
  loading   = false;
  error     = '';

  // ── Résultats ────────────────────────────────────────────────
  result: StatsResult | null = null;
  gridLines = Array(10).fill(0);

  constructor(private plaquettesService: PlaquettesService) {}

  get isFormValid(): boolean {
    return !!this.dateDebut && !!this.dateFin && this.dateDebut <= this.dateFin;
  }

  // ── Analyser → passer à la page résultats ───────────────────
  chargerStats(): void {
    if (!this.isFormValid) return;
    this.loading = true;
    this.error   = '';
    this.result  = null;

    this.plaquettesService.getStats(this.dateDebut, this.dateFin).subscribe({
      next: (res) => {
        this.result      = res;
        this.loading     = false;
        this.currentPage = 'resultats';
      },
      error: (err) => {
        this.error   = err?.error?.message || 'Erreur lors du chargement';
        this.loading = false;
      },
    });
  }

  // ── Retour au filtre ─────────────────────────────────────────
  retourFiltre(): void {
    this.currentPage = 'filtre';
  }

  // ── Couleurs ─────────────────────────────────────────────────
  getBarColor(pct: number): string {
    if (pct >= 80) return '#22c55e';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  getRestBarColor(pct: number): string {
    if (pct <= 10) return '#22c55e';
    if (pct <= 30) return '#f59e0b';
    return '#ef4444';
  }

  getRebutColor(pct: number): string {
    if (pct === 0)  return '#22c55e';
    if (pct <= 5)   return '#f59e0b';
    return '#ef4444';
  }

  // ── SVG donut ────────────────────────────────────────────────
  getCircleDash(pct: number): string {
    const circumference = 2 * Math.PI * 38;
    const filled = (pct / 100) * circumference;
    const empty  = circumference - filled;
    return `${filled.toFixed(2)} ${empty.toFixed(2)}`;
  }

  trackByType(_: number, item: TypeStat): number { return item.typeId; }
}