import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductionService, ProductLine, MCategory, ProductionSession, SessionStats,RealTimeProduction } from './Production.service';
import { interval, Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';

// ✅ Interface étendue pour inclure le temps de production
interface ProductLineWithTime extends ProductLine {
  seconde?: number; // Temps en secondes pour produire 1 pièce
}

@Component({
  selector: 'app-production-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './production-manager.component.html',
  styleUrls: ['./production-manager.component.css']
})
export class ProductionManagerComponent implements OnInit, OnDestroy {
  private productionService = inject(ProductionService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // Signals
  lines = signal<ProductLine[]>([]);
  mCategories = signal<MCategory[]>([]);
  selectedLine = signal<string | null>(null);
  activeSession = signal<ProductionSession | null>(null);
  sessionStats = signal<SessionStats | null>(null);
  
  // ✅ NOUVEAU - Info de la ligne active (avec temps de production)
  activeLineInfo = signal<ProductLineWithTime | null>(null);
  
  // États UI
  loading = signal(false);
  alertMessage = signal<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // Formulaire pause
  showPauseForm = signal(false);
  selectedMCategory = signal<string | null>(null);
  selectedSubCategory = signal<string | null>(null);
  pauseReason = signal<string>('');
  
  // ✅ NOUVEAUX - Références pour M1, M4, M5
  availableReferences = signal<string[]>([]);
  selectedReferences = signal<string[]>([]);
  loadingReferences = signal(false);
  
  // Formulaire reprise
  showResumeForm = signal(false);
  resumeActionTaken = signal<string>('');
  
  // Formulaire fin
  showEndForm = signal(false);
  endNotes = signal<string>('');
  quantityProduced = signal<number | null>(null);
  qualityStatus = signal<string>('good');
  
  // Chronos
  sessionElapsedTime = signal<string>('00:00:00');
  pauseElapsedTime = signal<string>('00:00:00');
  
  // ✅ NOUVEAU - Compteur de pièces en temps réel
  piecesProduced = signal<number>(0);
  // ⚠️ NE PLUS UTILISER de taux fixe - on charge depuis la BDD

  // Computed
  availableSubCategories = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return [];
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.subCategories || [];
  });

  // ✅ NOUVEAU - Vérifie si la catégorie nécessite des références
  currentCategoryRequiresReferences = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return false;
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.requiresReferences || false;
  });

  // ✅ NOUVEAU - Type de référence pour la catégorie
  currentReferenceType = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return '';
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.referenceType || '';
  });

  // ✅ NOUVEAU - Label pour le type de référence
  referenceTypeLabel = computed(() => {
    const type = this.currentReferenceType();
    switch (type) {
      case 'matierePremiere': return 'Matières Premières';
      case 'phases': return 'Phases';
      case 'products': return 'Produits';
      default: return 'Références';
    }
  });

  canStartSession = computed(() => {
    return this.selectedLine() && !this.activeSession();
  });

  canPauseSession = computed(() => {
    return this.activeSession()?.status === 'active';
  });

  canResumeSession = computed(() => {
    return this.activeSession()?.status === 'paused';
  });

  canEndSession = computed(() => {
    const status = this.activeSession()?.status;
    return status === 'active' || status === 'paused';
  });

  ngOnInit(): void {
    this.loadLines();
    this.loadMCategories();
    this.loadActiveSessions();
    this.startTimers();
    this.startPiecesCounter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CHARGEMENT DES DONNÉES ====================

  loadLines(): void {
    this.loading.set(true);
    this.productionService.getAllLines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.lines.set(response.lines);
          this.loading.set(false);
        },
        error: () => {
          this.showAlert('error', 'Erreur lors du chargement des lignes');
          this.loading.set(false);
        }
      });
  }

  loadMCategories(): void {
    this.productionService.getMCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.mCategories.set(response.categories);
        },
        error: (error) => {
          console.error('Erreur chargement catégories M:', error);
        }
      });
  }

  loadActiveSessions(): void {
    this.productionService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          const userSession = sessions[0];
          if (userSession) {
            this.activeSession.set(userSession);
            this.selectedLine.set(userSession.ligne);
            this.loadSessionStats(userSession.id);
            // ✅ NOUVEAU - Charger les infos de la ligne (temps de production)
            this.loadLineInfo(userSession.ligne);
          }
        },
        error: (error) => {
          console.error('Erreur chargement sessions:', error);
        }
      });
  }

  loadSessionStats(sessionId: number): void {
    this.productionService.getSessionStats(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.sessionStats.set(stats);
        },
        error: (error) => {
          console.error('Erreur chargement stats:', error);
        }
      });
  }

  // ✅ NOUVEAU - Charger les infos de la ligne (avec temps de production)
  loadLineInfo(ligne: string): void {
    this.productionService.getLine(ligne)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lineData: any) => {
          // lineData contient { ligne, reference, seconde, ... }
          this.activeLineInfo.set({
            ligne: lineData.ligne,
            referenceCount: lineData.referenceCount || 0,
            lastCreated: lineData.lastCreated || '',
            references: lineData.references || [],
            seconde: lineData.seconde // ✅ Temps en secondes par pièce
          });
        },
        error: (error) => {
          console.error('Erreur chargement info ligne:', error);
          // Valeur par défaut si erreur
          this.activeLineInfo.set({
            ligne: ligne,
            referenceCount: 0,
            lastCreated: '',
            references: [],
            seconde: 200 // Valeur par défaut
          });
        }
      });
  }

  // ✅ NOUVEAU - Charger les références disponibles selon la catégorie M
  loadAvailableReferences(): void {
    const ligne = this.activeSession()?.ligne;
    const mCategory = this.selectedMCategory();
    
    if (!ligne || !mCategory) return;
    if (!this.currentCategoryRequiresReferences()) {
      this.availableReferences.set([]);
      this.selectedReferences.set([]);
      return;
    }

    this.loadingReferences.set(true);
    this.productionService.getAvailableReferences(ligne, mCategory)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.availableReferences.set(response.references || []);
          this.selectedReferences.set([]);
          this.loadingReferences.set(false);
          
          if (response.references.length === 0) {
            this.showAlert('info', `Aucune référence disponible pour ${mCategory}`);
          }
        },
        error: (error) => {
          console.error('Erreur chargement références:', error);
          this.showAlert('error', 'Impossible de charger les références');
          this.loadingReferences.set(false);
        }
      });
  }

  // ✅ NOUVEAU - Gérer le changement de catégorie M
  onMCategoryChange(): void {
    this.availableReferences.set([]);
    this.selectedReferences.set([]);
    this.loadAvailableReferences();
  }

  // ✅ NOUVEAU - Toggle référence
  toggleReference(ref: string): void {
    const current = this.selectedReferences();
    if (current.includes(ref)) {
      this.selectedReferences.set(current.filter(r => r !== ref));
    } else {
      this.selectedReferences.set([...current, ref]);
    }
  }

  // ==================== TIMERS ====================

  startTimers(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const session = this.activeSession();
        if (session && session.startTime) {
          const elapsed = this.calculateElapsedTime(session.startTime);
          this.sessionElapsedTime.set(elapsed);
        } else {
          this.sessionElapsedTime.set('00:00:00');
        }

        if (session?.currentPause && session.currentPause.startTime) {
          const pauseElapsed = this.calculateElapsedTime(session.currentPause.startTime);
          this.pauseElapsedTime.set(pauseElapsed);
        } else {
          this.pauseElapsedTime.set('00:00:00');
        }
      });
  }

  // ✅ NOUVEAU - Compteur de pièces en temps réel (CORRIGÉ)
startPiecesCounter(): void {
  interval(2000)
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      const session = this.activeSession();
      
      if (session && session.id) {
        this.productionService.getRealTimeProduction(session.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (data) => {
              this.realTimeData.set(data);
              this.piecesProduced.set(data.piecesProduites);
              
              // ✅ CORRIGÉ - Récupérer les pauses depuis byCategory
              const stats = this.sessionStats();
              if (stats) {
                let totalLost = 0;
                
                // Parcourir toutes les catégories
                if (stats.pauses && stats.pauses.byCategory) {
                  Object.values(stats.pauses.byCategory).forEach((category: any) => {
                    if (category.pauses && Array.isArray(category.pauses)) {
                      // Filtrer les pauses terminées
                      const lostFromCategory = category.pauses
                        .filter((p: any) => p.endTime)
                        .reduce((sum: number, p: any) => sum + (p.lostPieces || 0), 0);
                      totalLost += lostFromCategory;
                    }
                  });
                }
                
                const currentLost = data.pauseEnCours?.piecesPerdues || 0;
                this.totalLostPieces.set(totalLost + currentLost);
              }
            },
            error: (err) => {
              console.error('Erreur temps réel:', err);
              this.calculateLocalPieces();
            }
          });
      } else {
        this.piecesProduced.set(0);
        this.totalLostPieces.set(0);
      }
    });
}
private calculateLocalPieces(): void {
  const session = this.activeSession();
  const lineInfo = this.activeLineInfo();
  
  if (session && session.status === 'active' && session.startTime && lineInfo?.seconde) {
    const productionTimeSeconds = this.getProductionTimeInSeconds(session);
    const pieces = Math.floor(productionTimeSeconds / lineInfo.seconde);
    this.piecesProduced.set(pieces);
  }
}

  // ✅ NOUVEAU - Calculer le temps de production réel (sans les pauses)
  private getProductionTimeInSeconds(session: ProductionSession): number {
    const sessionStart = new Date(session.startTime).getTime();
    const now = new Date().getTime();
    const totalElapsed = Math.floor((now - sessionStart) / 1000);
    
    // Soustraire le temps de pause actuel si en pause
    let pauseTime = 0;
    if (session.currentPause && session.currentPause.startTime) {
      const pauseStart = new Date(session.currentPause.startTime).getTime();
      pauseTime = Math.floor((now - pauseStart) / 1000);
    }
    
    // Ajouter le temps des pauses précédentes depuis sessionStats
    const stats = this.sessionStats();
    if (stats && stats.session.pauseTime) {
      pauseTime += this.parseTimeToSeconds(stats.session.pauseTime);
    }
    
    return Math.max(0, totalElapsed - pauseTime);
  }

  // ✅ NOUVEAU - Parser un string de temps (HH:MM:SS) en secondes
  private parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  calculateElapsedTime(startTime: string): string {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 1000);

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ==================== ACTIONS PRODUCTION ====================

  startSession(): void {
    const ligne = this.selectedLine();
    if (!ligne) {
      this.showAlert('error', 'Veuillez sélectionner une ligne');
      return;
    }

    this.loading.set(true);
    this.productionService.startProduction(ligne)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activeSession.set(response.session);
          this.piecesProduced.set(0); // Reset compteur
          this.showAlert('success', 'Production démarrée avec succès');
          this.loading.set(false);
          if (response.session?.id) {
            this.loadSessionStats(response.session.id);
            // ✅ NOUVEAU - Charger les infos de la ligne
            this.loadLineInfo(ligne);
          }
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors du démarrage');
          this.loading.set(false);
        }
      });
  }

  openPauseForm(): void {
    this.showPauseForm.set(true);
    this.selectedMCategory.set(null);
    this.selectedSubCategory.set(null);
    this.pauseReason.set('');
    this.availableReferences.set([]);
    this.selectedReferences.set([]);
  }

  // ✅ MODIFIÉ - Pause avec références
  pauseSession(): void {
    const session = this.activeSession();
    const mCategory = this.selectedMCategory();
    
    if (!session || !mCategory) {
      this.showAlert('error', 'Veuillez sélectionner une catégorie M');
      return;
    }

    // ✅ Validation des références obligatoires
    if (this.currentCategoryRequiresReferences() && this.selectedReferences().length === 0) {
      this.showAlert('error', `Veuillez sélectionner au moins une référence pour ${mCategory}`);
      return;
    }

    this.loading.set(true);

    // ✅ Préparer les références selon la catégorie
    let matierePremierRefs: string[] | undefined;
    let phasesEnPanne: string[] | undefined;
    let productRefs: string[] | undefined;

    if (mCategory === 'M1') {
      matierePremierRefs = this.selectedReferences();
    } else if (mCategory === 'M4') {
      phasesEnPanne = this.selectedReferences();
    } else if (mCategory === 'M5') {
      productRefs = this.selectedReferences();
    }

    this.productionService.pauseProduction(
      session.id,
      mCategory,
      this.selectedSubCategory() || undefined,
      this.pauseReason() || undefined,
      matierePremierRefs,
      phasesEnPanne,
      productRefs
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activeSession.set(response.session);
          this.showAlert('success', `Production en pause (${mCategory})`);
          this.showPauseForm.set(false);
          this.loading.set(false);
          if (session.id) {
            this.loadSessionStats(session.id);
          }
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors de la pause');
          this.loading.set(false);
        }
      });
  }

  openResumeForm(): void {
    this.showResumeForm.set(true);
    this.resumeActionTaken.set('');
  }

  resumeSession(): void {
    const session = this.activeSession();
    if (!session) return;

    this.loading.set(true);
    this.productionService.resumeProduction(
      session.id,
      this.resumeActionTaken() || undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activeSession.set(response.session);
          this.showAlert('success', 'Production reprise avec succès');
          this.showResumeForm.set(false);
          this.loading.set(false);
          if (session.id) {
            this.loadSessionStats(session.id);
          }
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors de la reprise');
          this.loading.set(false);
        }
      });
  }

  openEndForm(): void {
    this.showEndForm.set(true);
    this.endNotes.set('');
    this.quantityProduced.set(null);
    this.qualityStatus.set('good');
  }

  endSession(): void {
    const session = this.activeSession();
    if (!session) return;

    this.loading.set(true);
    this.productionService.endProduction(
      session.id,
      this.endNotes() || undefined,
      this.quantityProduced() || undefined,
      this.qualityStatus()
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.activeSession.set(null);
          this.sessionStats.set(null);
          this.selectedLine.set(null);
          this.piecesProduced.set(0);
          this.showAlert('success', 'Production terminée avec succès');
          this.showEndForm.set(false);
          this.loading.set(false);
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors de la fin');
          this.loading.set(false);
        }
      });
  }

  cancelSession(): void {
    const session = this.activeSession();
    if (!session) return;

    if (!confirm('Êtes-vous sûr de vouloir annuler cette session ?')) {
      return;
    }

    this.loading.set(true);
    this.productionService.cancelSession(session.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.activeSession.set(null);
          this.sessionStats.set(null);
          this.selectedLine.set(null);
          this.piecesProduced.set(0);
          this.showAlert('info', 'Session annulée');
          this.loading.set(false);
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors de l\'annulation');
          this.loading.set(false);
        }
      });
  }

  // ✅ NOUVEAU - Navigation vers l'historique des pauses
viewPauseHistory(): void {
  const stats = this.sessionStats();
  const realTime = this.realTimeData();
  
  console.log('========== DEBUG PAUSE HISTORY ==========');
  console.log('SessionStats:', stats);
  console.log('Structure de stats.pauses:', stats?.pauses);
  console.log('Type de stats.pauses:', typeof stats?.pauses);
  console.log('stats.pauses.byCategory:', stats?.pauses?.byCategory);
  
  if (stats && stats.pauses && stats.pauses.byCategory) {
    // Extraire toutes les pauses
    let allPauses: any[] = [];
    
    // Parcourir chaque catégorie (M1, M2, etc.)
    Object.keys(stats.pauses.byCategory).forEach(categoryKey => {
      const category = stats.pauses.byCategory[categoryKey];
      console.log(`Catégorie ${categoryKey}:`, category);
      
      if (category.pauses && Array.isArray(category.pauses)) {
        console.log(`Pauses trouvées dans ${categoryKey}:`, category.pauses.length);
        allPauses = [...allPauses, ...category.pauses];
      }
    });
    
    console.log('Toutes les pauses extraites:', allPauses);
    console.log('Nombre total de pauses:', allPauses.length);
    
    // Trier par date (plus récent d'abord)
    allPauses.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    
    console.log('Pauses à envoyer:', allPauses);
    
    // Naviguer avec les données
    this.router.navigate(['/pause-history'], {
      state: { 
        allPauses: allPauses,
        sessionInfo: stats.session,
        totalLostPieces: this.totalLostPieces()
      }
    });
  } else {
    console.log('Aucune pause trouvée dans les stats');
    this.router.navigate(['/pause-history'], {
      state: { 
        allPauses: [],
        sessionInfo: stats?.session || null,
        totalLostPieces: this.totalLostPieces()
      }
    });
  }
}

  // ==================== HELPERS ====================

  showAlert(type: 'success' | 'error' | 'info', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => {
      this.alertMessage.set(null);
    }, 5000);
  }

  closeAlert(): void {
    this.alertMessage.set(null);
  }

  closePauseForm(): void {
    this.showPauseForm.set(false);
  }

  closeResumeForm(): void {
    this.showResumeForm.set(false);
  }

  closeEndForm(): void {
    this.showEndForm.set(false);
  }

  getMCategoryIcon(code: string): string {
    const icons: { [key: string]: string } = {
      'M1': '📦',
      'M2': '👷',
      'M3': '📋',
      'M4': '🔧',
      'M5': '✔',
      'M6': '🌡️'
    };
    return icons[code] || '⚙️';
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'active': 'bg-green-500 text-white',
      'paused': 'bg-orange-500 text-white',
      'completed': 'bg-blue-500 text-white',
      'cancelled': 'bg-gray-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'active': 'En cours',
      'paused': 'En pause',
      'completed': 'Terminée',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }
  realTimeData = signal<RealTimeProduction | null>(null);
totalLostPieces = signal<number>(0);
}