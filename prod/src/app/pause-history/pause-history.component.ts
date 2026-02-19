// pause-history.component.ts - VERSION CORRIGÉE

import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface PauseDisplay {
  id: number;
  mCategory: string;
  subCategory?: string;
  reason?: string;
  startTime: string;
  endTime?: string;
  duration: string;
  durationSeconds?: number;
  actionTaken?: string;
  recordedBy?: string;
  matierePremierRefs?: string[];
  phasesEnPanne?: string[];
  productRefs?: string[];
  lostPieces?: number;
}

@Component({
  selector: 'app-pause-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pause-history.component.html',
  styleUrls: ['./pause-history.component.css']
})
export class PauseHistoryComponent implements OnInit {
  private router = inject(Router);

  pauses = signal<PauseDisplay[]>([]);
  sessionInfo = signal<any>(null);
  totalLostPieces = signal<number>(0);
  loading = signal(false);

  constructor() {
    // ✅ Effet pour déboguer les changements
    effect(() => {
      console.log('📊 Pauses signal updated:', this.pauses());
      console.log('📊 Total pauses:', this.pauses().length);
    });
  }

  ngOnInit(): void {
    // ✅ SOLUTION 1: Récupérer depuis l'état de l'historique
    const state = history.state;
    
    console.log('🔍 DEBUG - État complet:', state);
    console.log('🔍 DEBUG - allPauses:', state.allPauses);
    console.log('🔍 DEBUG - sessionInfo:', state.sessionInfo);
    
    if (state && state.allPauses) {
      console.log('✅ Données trouvées dans history.state');
      console.log('📦 Nombre de pauses:', state.allPauses.length);
      console.log('📦 Première pause:', state.allPauses[0]);
      
      this.pauses.set(state.allPauses);
      this.sessionInfo.set(state.sessionInfo || null);
      this.totalLostPieces.set(state.totalLostPieces || 0);
      
      // Forcer la détection des changements
      setTimeout(() => {
        console.log('🔄 Après timeout - pauses():', this.pauses());
      }, 100);
    } else {
      console.warn('⚠️ Aucune donnée trouvée dans history.state');
      console.log('📍 État actuel:', state);
    }
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  goBack(): void {
    this.router.navigate(['/production']);
  }
}