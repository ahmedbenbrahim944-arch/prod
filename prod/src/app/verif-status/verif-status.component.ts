// src/app/features/verif-status/verif-status.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  VerifStatusService,
  StatutOuvrierResponse,
  StatutCode,
} from './verif-status.service';

interface StatutConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  icon: string;
}

@Component({
  selector: 'app-verif-status',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verif-status.component.html',
  styleUrls: ['./verif-status.component.css'],
})
export class VerifStatusComponent implements OnInit, OnDestroy {
  searchForm!: FormGroup;
  result: StatutOuvrierResponse | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  hasSearched = false;

  private destroy$ = new Subject<void>();

  /** Config visuelle par code statut */
  readonly statutConfig: Record<string, StatutConfig> = {
    P: {
      label: 'Présent',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      dotClass: 'bg-emerald-500',
      icon: '✓',
    },
    AB: {
      label: 'Absent',
      bgClass: 'bg-red-50',
      textClass: 'text-red-700',
      borderClass: 'border-red-200',
      dotClass: 'bg-red-500',
      icon: '✕',
    },
    S: {
      label: 'Sélection',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      dotClass: 'bg-blue-500',
      icon: '◆',
    },
    C: {
      label: 'Congé',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      dotClass: 'bg-amber-500',
      icon: '⏸',
    },
  };

  constructor(
    private fb: FormBuilder,
    private verifStatusService: VerifStatusService,
  ) {}

  ngOnInit(): void {
    this.searchForm = this.fb.group({
      matricule: [
        null,
        [Validators.required, Validators.min(1), Validators.pattern('^[0-9]+$')],
      ],
      date: [
        this.getTodayDate(),
        [
          Validators.required,
          Validators.pattern(/^\d{4}-\d{2}-\d{2}$/),
        ],
      ],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const { matricule, date } = this.searchForm.value;
    this.isLoading = true;
    this.errorMessage = null;
    this.result = null;
    this.hasSearched = true;

    this.verifStatusService
      .getStatutOuvrier(Number(matricule), date)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: (data) => (this.result = data),
        error: (err) => {
          if (err.status === 404) {
            this.errorMessage = `Aucun ouvrier trouvé avec le matricule ${matricule}.`;
          } else if (err.status === 400) {
            this.errorMessage = err.error?.message || 'Données invalides.';
          } else {
            this.errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
          }
        },
      });
  }

  onReset(): void {
    this.searchForm.reset({ matricule: null, date: this.getTodayDate() });
    this.result = null;
    this.errorMessage = null;
    this.hasSearched = false;
  }

  getStatutConfig(code: StatutCode): StatutConfig | null {
    if (!code) return null;
    return this.statutConfig[code] ?? null;
  }

  isFieldInvalid(field: string): boolean {
    const control = this.searchForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}