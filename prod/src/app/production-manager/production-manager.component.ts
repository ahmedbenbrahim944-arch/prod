import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductionService, ProductLine, MCategory, ProductionSession, SessionStats,RealTimeProduction } from './Production.service';
import { interval, Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';

//  Interface étendue pour inclure le temps de production
interface ProductLineWithTime extends ProductLine {
  seconde?: number;
}

// Interface étendue pour lignes avec statut
interface ProductLineWithStatus extends ProductLine {
  seconde?: number;
  status?: 'active' | 'paused' | 'inactive';
  sessionId?: number;
  startedBy?: string;
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
  lines = signal<ProductLineWithStatus[]>([]);
  mCategories = signal<MCategory[]>([]);
  selectedLine = signal<string | null>(null);
  activeSession = signal<ProductionSession | null>(null);
  sessionStats = signal<SessionStats | null>(null);
  
  //  Info de la ligne active (avec temps de production)
  activeLineInfo = signal<ProductLineWithTime | null>(null);
  
  // ✅ NOUVEAU - Rôle de l'utilisateur connecté
  isAdmin = signal<boolean>(false);
  
  // ✅ NOUVEAU - Sessions actives pour l'admin (toutes les sessions)
  allActiveSessions = signal<ProductionSession[]>([]);

  // États UI
  loading = signal(false);
  alertMessage = signal<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // Formulaire pause
  showPauseForm = signal(false);
  selectedMCategory = signal<string | null>(null);
  selectedSubCategory = signal<string | null>(null);
  pauseReason = signal<string>('');
  
  //  Références pour M1, M4, M5
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
  
  //  Compteur de pièces en temps réel
  piecesProduced = signal<number>(0);
  realTimeData = signal<RealTimeProduction | null>(null);
  totalLostPieces = signal<number>(0);

  // ✅ MODIFIÉ - Filtre uniquement les lignes actives et en pause
  filteredLines = computed(() => {
    return this.lines().filter(line => 
      line.status === 'active' || line.status === 'paused'
    );
  });

  // Computed
  availableSubCategories = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return [];
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.subCategories || [];
  });

  currentCategoryRequiresReferences = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return false;
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.requiresReferences || false;
  });

  currentReferenceType = computed(() => {
    const selectedCat = this.selectedMCategory();
    if (!selectedCat) return '';
    const category = this.mCategories().find(c => c.code === selectedCat);
    return category?.referenceType || '';
  });

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
    // ✅ Admin ne peut pas démarrer une session depuis ici (il observe seulement)
    if (this.isAdmin()) return false;
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
    this.detectUserRole();
    this.loadLines(); // loadActiveSessions() est appelé en fin de loadLines()
    this.loadMCategories();
    this.startTimers();
    this.startPiecesCounter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DÉTECTION DU RÔLE ====================

  /**
   * ✅ NOUVEAU - Détecter si l'utilisateur est admin
   */
  detectUserRole(): void {
    try {
      const currentUserStr = localStorage.getItem('current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        // Le type 'admin' indique un administrateur
        this.isAdmin.set(currentUser?.type === 'admin');
      }
    } catch (e) {
      this.isAdmin.set(false);
    }
  }

  // ==================== CHARGEMENT DES DONNÉES ====================

  loadLines(): void {
    this.loading.set(true);
    this.productionService.getAllLines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // ✅ Marquer le statut initial comme 'inactive', sera mis à jour après loadActiveSessions
          const linesWithStatus = response.lines.map(line => ({
            ...line,
            status: 'inactive' as 'active' | 'paused' | 'inactive'
          }));
          this.lines.set(linesWithStatus);
          this.loading.set(false);
          // ✅ Recharger les sessions après avoir les lignes pour mettre à jour les statuts
          this.loadActiveSessions();
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
        error: () => {}
      });
  }

  /**
   * ✅ MODIFIÉ - Gestion différente pour admin vs utilisateur normal
   * - Admin : voit toutes les sessions, peut accéder à n'importe quelle ligne active
   * - Utilisateur : voit seulement sa propre session
   */
  loadActiveSessions(): void {
    this.productionService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          // Stocker toutes les sessions (utile pour admin)
          this.allActiveSessions.set(sessions);
          // Mettre à jour les statuts des lignes
          this.updateLinesStatus(sessions);

          // 🔍 DEBUG TEMPORAIRE - à supprimer après correction
          console.log('=== DEBUG Sessions actives ===');
          console.log('Sessions reçues:', sessions);
          console.log('current_user localStorage:', localStorage.getItem('current_user'));
          sessions.forEach(s => console.log(`  Session #${s.id} | ligne: ${s.ligne} | startedBy:`, (s as any).startedBy));
          console.log('==============================');

          if (this.isAdmin()) {
            // Admin : pas de session auto-sélectionnée
            return;
          }

          // ✅ OUVRIER : chercher SA session
          const userSession = this.findUserSession(sessions);

          if (userSession) {
            // Session trouvée → charger automatiquement
            this.activeSession.set(userSession);
            this.selectedLine.set(userSession.ligne);
            this.loadSessionStats(userSession.id);
            this.loadLineInfo(userSession.ligne);
          } else {
            // Aucune session → formulaire démarrage
            this.activeSession.set(null);
            this.sessionStats.set(null);
            this.piecesProduced.set(0);
          }
        },
        error: () => {}
      });
  }

  /**
   * ✅ Cherche la session appartenant à l'ouvrier connecté
   * Gère tous les formats possibles de startedBy :
   *   - string  : "si ahmed 8989"  ou  "undefined 8989"
   *   - objet   : { nom: "8989", prenom: "si ahmed" }
   *   - objet   : { name: "si ahmed 8989" }
   */
  private findUserSession(sessions: ProductionSession[]): ProductionSession | undefined {
    let currentUser: any = null;
    try {
      const str = localStorage.getItem('current_user');
      if (str) currentUser = JSON.parse(str);
    } catch (e) {}

    if (!currentUser) return undefined;

    const matricule  = (currentUser.nom    || '').toString().trim().toLowerCase();
    const prenom     = (currentUser.prenom || '').toString().trim().toLowerCase();
    const userId     = currentUser.id;

    return sessions.find(s => {
      const sb = (s as any).startedBy;
      if (!sb) return false;

      // --- cas 1 : startedBy est une STRING ---
      if (typeof sb === 'string') {
        const sbLow = sb.toLowerCase();
        // ex: "si ahmed 8989" → dernier mot = matricule
        const lastWord = sbLow.split(' ').pop() || '';
        return (
          lastWord === matricule ||
          sbLow.includes(matricule) ||
          (prenom && sbLow.includes(prenom))
        );
      }

      // --- cas 2 : startedBy est un OBJET { nom, prenom, id } ---
      if (typeof sb === 'object') {
        const sbNom    = (sb.nom    || '').toString().trim().toLowerCase();
        const sbPrenom = (sb.prenom || '').toString().trim().toLowerCase();
        const sbId     = sb.id;
        const sbName   = (sb.name   || '').toString().toLowerCase();

        return (
          sbNom === matricule ||
          sbId  === userId    ||
          sbName.includes(matricule) ||
          (prenom && sbPrenom === prenom)
        );
      }

      return false;
    });
  }

  /**
   * ✅ NOUVEAU - Mettre à jour le statut des lignes selon les sessions actives
   */
  private updateLinesStatus(sessions: ProductionSession[]): void {
    const updatedLines = this.lines().map(line => {
      const session = sessions.find(s => s.ligne === line.ligne);
      if (session) {
        return {
          ...line,
          status: session.status as 'active' | 'paused' | 'inactive',
          sessionId: session.id,
          startedBy: (session as any).startedBy
        };
      }
      return { ...line, status: 'inactive' as 'active' | 'paused' | 'inactive' };
    });
    this.lines.set(updatedLines);
  }

  /**
   * ✅ NOUVEAU - Admin accède à une ligne active
   * Permet à l'admin d'observer/gérer n'importe quelle session
   */
  adminAccessLine(ligne: string): void {
    if (!this.isAdmin()) return;

    const session = this.allActiveSessions().find(s => s.ligne === ligne);
    if (session) {
      this.activeSession.set(session);
      this.selectedLine.set(ligne);
      this.loadSessionStats(session.id);
      this.loadLineInfo(ligne);
      this.showAlert('info', `Accès admin à la ligne ${ligne}`);
    }
  }

  /**
   * ✅ NOUVEAU - Extraire le matricule de l'utilisateur connecté depuis le token JWT
   */
  private getCurrentUserMatricule(): string | null {
    try {
      const currentUserStr = localStorage.getItem('current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser?.nom) return currentUser.nom;
      }
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const payload = token.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload));
      return decoded.nom || null;
    } catch (e) {
      return null;
    }
  }

  loadSessionStats(sessionId: number): void {
    this.productionService.getSessionStats(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.sessionStats.set(stats);
        },
        error: () => {}
      });
  }

  loadLineInfo(ligne: string): void {
    this.productionService.getLine(ligne)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lineData: any) => {
          this.activeLineInfo.set({
            ligne: lineData.ligne,
            referenceCount: lineData.referenceCount || 0,
            lastCreated: lineData.lastCreated || '',
            references: lineData.references || [],
            seconde: lineData.seconde
          });
        },
        error: () => {
          this.activeLineInfo.set({
            ligne: ligne,
            referenceCount: 0,
            lastCreated: '',
            references: [],
            seconde: 200
          });
        }
      });
  }

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
        error: () => {
          this.showAlert('error', 'Impossible de charger les références');
          this.loadingReferences.set(false);
        }
      });
  }

  onMCategoryChange(): void {
    this.availableReferences.set([]);
    this.selectedReferences.set([]);
    this.loadAvailableReferences();
  }

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
                
                const stats = this.sessionStats();
                if (stats) {
                  let totalLost = 0;
                  
                  if (stats.pauses && stats.pauses.byCategory) {
                    Object.values(stats.pauses.byCategory).forEach((category: any) => {
                      if (category.pauses && Array.isArray(category.pauses)) {
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
              error: () => {
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

  private getProductionTimeInSeconds(session: ProductionSession): number {
    const sessionStart = new Date(session.startTime).getTime();
    const now = new Date().getTime();
    const totalElapsed = Math.floor((now - sessionStart) / 1000);
    
    let pauseTime = 0;
    if (session.currentPause && session.currentPause.startTime) {
      const pauseStart = new Date(session.currentPause.startTime).getTime();
      pauseTime = Math.floor((now - pauseStart) / 1000);
    }
    
    const stats = this.sessionStats();
    if (stats && stats.session.pauseTime) {
      pauseTime += this.parseTimeToSeconds(stats.session.pauseTime);
    }
    
    return Math.max(0, totalElapsed - pauseTime);
  }

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

    this.activeSession.set(null);
    this.sessionStats.set(null);
    this.piecesProduced.set(0);
    this.totalLostPieces.set(0);

    this.loading.set(true);
    this.productionService.startProduction(ligne)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activeSession.set(response.session);
          this.piecesProduced.set(0);
          this.showAlert('success', 'Production démarrée avec succès');
          this.loading.set(false);
          if (response.session?.id) {
            this.loadSessionStats(response.session.id);
            this.loadLineInfo(ligne);
          }
          // ✅ Mettre à jour le statut de la ligne dans la liste
          this.updateLineStatus(ligne, 'active');
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

  pauseSession(): void {
    const session = this.activeSession();
    const mCategory = this.selectedMCategory();
    
    if (!session || !mCategory) {
      this.showAlert('error', 'Veuillez sélectionner une catégorie M');
      return;
    }

    if (this.currentCategoryRequiresReferences() && this.selectedReferences().length === 0) {
      this.showAlert('error', `Veuillez sélectionner au moins une référence pour ${mCategory}`);
      return;
    }

    this.loading.set(true);

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
          // ✅ Mettre à jour le statut de la ligne
          this.updateLineStatus(session.ligne, 'paused');
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
          // ✅ Mettre à jour le statut de la ligne
          this.updateLineStatus(session.ligne, 'active');
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
          const ligne = session.ligne;
          this.activeSession.set(null);
          this.sessionStats.set(null);
          this.selectedLine.set(null);
          this.piecesProduced.set(0);
          this.showAlert('success', 'Production terminée avec succès');
          this.showEndForm.set(false);
          this.loading.set(false);
          // ✅ Mettre à jour le statut de la ligne → inactive
          this.updateLineStatus(ligne, 'inactive');
          // ✅ Recharger toutes les lignes pour mettre à jour les statuts
          this.loadLines();
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
          const ligne = session.ligne;
          this.activeSession.set(null);
          this.sessionStats.set(null);
          this.selectedLine.set(null);
          this.piecesProduced.set(0);
          this.showAlert('info', 'Session annulée');
          this.loading.set(false);
          // ✅ Mettre à jour le statut de la ligne → inactive
          this.updateLineStatus(ligne, 'inactive');
        },
        error: (error) => {
          this.showAlert('error', error.error?.message || 'Erreur lors de l\'annulation');
          this.loading.set(false);
        }
      });
  }

  /**
   * ✅ NOUVEAU - Mettre à jour le statut d'une ligne spécifique dans la liste
   */
  private updateLineStatus(ligne: string, status: 'active' | 'paused' | 'inactive'): void {
    const updatedLines = this.lines().map(line => {
      if (line.ligne === ligne) {
        return { ...line, status };
      }
      return line;
    });
    this.lines.set(updatedLines);
  }

  viewPauseHistory(): void {
    const stats = this.sessionStats();
    
    if (stats && stats.pauses && stats.pauses.byCategory) {
      let allPauses: any[] = [];
      
      Object.keys(stats.pauses.byCategory).forEach(categoryKey => {
        const category = stats.pauses.byCategory[categoryKey];
        
        if (category.pauses && Array.isArray(category.pauses)) {
          allPauses = [...allPauses, ...category.pauses];
        }
      });
      
      allPauses.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      this.router.navigate(['/pause-history'], {
        state: { 
          allPauses: allPauses,
          sessionInfo: stats.session,
          totalLostPieces: this.totalLostPieces()
        }
      });
    } else {
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
      'M5': '✅',
      'M6': '🌿'
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

  /**
   * ✅ NOUVEAU - Obtenir la session d'une ligne (pour l'affichage admin)
   */
  getSessionForLine(ligne: string): ProductionSession | undefined {
    return this.allActiveSessions().find(s => s.ligne === ligne);
  }

  /**
   * ✅ NOUVEAU - Sélectionner une ligne (différent selon admin ou user)
   */
  selectLine(ligne: string, status: string): void {
    if (status === 'inactive') {
      if (!this.isAdmin()) {
        // Utilisateur normal : sélectionner pour démarrer
        this.selectedLine.set(ligne);
      }
      return;
    }

    if (status === 'active' || status === 'paused') {
      if (this.isAdmin()) {
        // ✅ Admin : accéder à la session active
        this.adminAccessLine(ligne);
      } else {
        // Utilisateur normal : vérifier si c'est sa session
        const currentMatricule = this.getCurrentUserMatricule();
        const session = this.getSessionForLine(ligne);
        if (session && (session as any).startedBy?.includes(currentMatricule)) {
          this.activeSession.set(session);
          this.selectedLine.set(ligne);
          this.loadSessionStats(session.id);
          this.loadLineInfo(ligne);
        } else {
          this.showAlert('error', 'Cette ligne est déjà prise en charge par un autre opérateur');
        }
      }
    }
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin-dashboard']);
  }
}