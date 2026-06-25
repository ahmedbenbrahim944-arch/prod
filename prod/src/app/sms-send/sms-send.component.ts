// src/app/sms-send/sms-send.component.ts
import {
  Component,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// ── Types ────────────────────────────────────────────────────
interface Line {
  ligne: string;
  referenceCount: number;
  references: string[];
  imageUrl?: string;
}

interface Category {
  value: string;
  label: string;
}

interface SendResult {
  success: boolean;
  recipientCount: number;
  recipients: string[];
  category: string;
  ligne: string;
  message: string;
}

// ── Component ────────────────────────────────────────────────
@Component({
  selector: 'app-sms-send',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sms-send.component.html',
  styleUrls: ['./sms-send.component.css'],
})
export class SmsSendComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API = 'http://102.207.250.53:3000'; // adapte l'URL

  // ── State signals ──────────────────────────────────────────
  lines        = signal<Line[]>([]);
  categories   = signal<Category[]>([]);
  loading      = signal(false);
  loadingLines = signal(false);
  showSuccess  = signal(false);
  showError    = signal(false);
  successMessage = signal('');
  errorMessage   = signal('');
  showConfirmModal = signal(false);

  // ── Form ──────────────────────────────────────────────────
  form = {
    ligne:     '',
    mCategory: '',
    comment:   '',
  };

  errors: Record<string, string> = {};

  // ── Computed helpers ──────────────────────────────────────
  get selectedCategoryLabel(): string {
    return this.categories().find(c => c.value === this.form.mCategory)?.label ?? '';
  }

  get categoryColor(): string {
    const colors: Record<string, string> = {
      M1: '#dc2626', M2: '#d97706', M3: '#7c3aed',
      M4: '#0369a1', M5: '#047857', M6: '#64748b',
    };
    return colors[this.form.mCategory] ?? '#04219e';
  }

  // ── Lifecycle ────────────────────────────────────────────
  ngOnInit(): void {
    this.loadLines();
    this.loadCategories();
  }

  // ── Data loading ─────────────────────────────────────────
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadLines(): void {
    this.loadingLines.set(true);
    this.http
      .get<{ lines: Line[] }>(`${this.API}/products/lines`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (res) => {
          this.lines.set(res.lines);
          this.loadingLines.set(false);
        },
        error: () => {
          this.loadingLines.set(false);
          this.showErrorMsg('Impossible de charger les lignes');
        },
      });
  }

  loadCategories(): void {
    this.http
      .get<{ categories: Category[] }>(`${this.API}/sms/categories`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (res) => this.categories.set(res.categories),
        error: () => {
          // Fallback si l'API n'est pas joignable
          this.categories.set([
            { value: 'M1', label: "M1 – Manque Matière Première" },
            { value: 'M2', label: "M2 – Main d'œuvre" },
            { value: 'M3', label: "M3 – Méthode" },
            { value: 'M4', label: "M4 – Panne Machine" },
            { value: 'M5', label: "M5 – Qualité" },
            { value: 'M6', label: "M6 – Environnement" },
          ]);
        },
      });
  }

  // ── Validation ───────────────────────────────────────────
  validate(): boolean {
    this.errors = {};
    if (!this.form.ligne)     this.errors['ligne']     = 'Veuillez sélectionner une ligne';
    if (!this.form.mCategory) this.errors['mCategory'] = 'Veuillez sélectionner une catégorie';
    if (this.form.comment.length > 200)
      this.errors['comment'] = 'Le commentaire ne peut pas dépasser 200 caractères';
    return Object.keys(this.errors).length === 0;
  }

  // ── Actions ──────────────────────────────────────────────
  openConfirm(): void {
    if (!this.validate()) return;
    this.showConfirmModal.set(true);
  }

  closeConfirm(): void {
    this.showConfirmModal.set(false);
  }

  confirmSend(): void {
    this.closeConfirm();
    this.send();
  }

  private send(): void {
    this.loading.set(true);
    this.showSuccess.set(false);
    this.showError.set(false);

    const payload = {
      ligne:     this.form.ligne,
      mCategory: this.form.mCategory,
      ...(this.form.comment ? { comment: this.form.comment } : {}),
    };

    this.http
      .post<SendResult>(`${this.API}/sms/send-manual`, payload, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.successMessage.set(
            `✅ SMS envoyé à ${res.recipientCount} destinataire(s) pour ${res.ligne} — ${res.category}`
          );
          this.showSuccess.set(true);
          this.resetForm();
          setTimeout(() => this.showSuccess.set(false), 5000);
        },
        error: (err) => {
          this.loading.set(false);
          const msg = err?.error?.message ?? 'Erreur lors de l\'envoi du SMS';
          this.showErrorMsg(msg);
        },
      });
  }

  resetForm(): void {
    this.form  = { ligne: '', mCategory: '', comment: '' };
    this.errors = {};
  }

  // ── Helpers ──────────────────────────────────────────────
  private showErrorMsg(msg: string): void {
    this.errorMessage.set(msg);
    this.showError.set(true);
    setTimeout(() => this.showError.set(false), 5000);
  }

  /** Nombre de caractères restants pour le commentaire */
  get commentRemaining(): number {
    return 200 - (this.form.comment?.length ?? 0);
  }

  /** Heure actuelle formatée pour l'aperçu */
  getTime(): string {
    return new Date().toLocaleTimeString('fr-TN');
  }

  /** Vérifie si le formulaire est prêt à être soumis */
  get isFormReady(): boolean {
    return !!this.form.ligne && !!this.form.mCategory && !this.loading();
  }

  /** Badge couleur pour chaque M */
  getCategoryBadgeStyle(value: string): Record<string, string> {
    const map: Record<string, string> = {
      M1: '#fef2f2', M2: '#fffbeb', M3: '#f5f3ff',
      M4: '#eff6ff', M5: '#f0fdf4', M6: '#f8fafc',
    };
    const textMap: Record<string, string> = {
      M1: '#dc2626', M2: '#d97706', M3: '#7c3aed',
      M4: '#0369a1', M5: '#047857', M6: '#475569',
    };
    return {
      background: map[value] ?? '#eef3ff',
      color:      textMap[value] ?? '#04219e',
      border:     `1px solid ${textMap[value] ?? '#04219e'}33`,
    };
  }
}