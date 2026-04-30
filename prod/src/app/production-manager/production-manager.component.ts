import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductionService, ProductLine, MCategory, ProductionSession, SessionStats, RealTimeProduction, PlannedReference } from './Production.service';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../login/auth.service';

interface ProductLineWithTime extends ProductLine { seconde?: number; }
interface ProductLineWithStatus extends ProductLine {
  seconde?: number;
  status?: 'active' | 'paused' | 'inactive';
  sessionId?: number;
  startedBy?: string;
}

export interface RefSession {
  planificationId: number;
  reference: string;
  of: string;
  jour: string;
  semaine: string;
  qtePlanifiee: number;
  sessionId: number | null;
  status: 'idle' | 'active' | 'paused' | 'completed' | 'cancelled';
  elapsedSeconds: number;
  productionSeconds: number;
  pauseSeconds: number;
  piecesProduites: number;
  piecesPerdues: number;
  secondesParPiece: number;
  pauseMCategory: string | null;
  pauseReason: string | null;
  showPauseForm: boolean;
  selectedMCategory: string | null;
  pauseReasonInput: string;
  loading: boolean;
  startTime: Date | null;
  // Références métier M1/M4/M5
  availableRefs: string[];
  selectedRefs: string[];
  loadingRefs: boolean;
}
export interface SavedSessionData {
  ligne: string | null;
  refSessions: any[]; // Vous pouvez utiliser RefSession[] mais attention à la sérialisation
  selectedStartRefIds: number[];
  startRefs: PlannedReference[];
  savedAt: string;
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
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);

  Math = Math;

  // ── Signals ───────────────────────────────────────────────────────────────
  lines = signal<ProductLineWithStatus[]>([]);
  mCategories = signal<MCategory[]>([]);
  isAdmin = signal<boolean>(false);
  allActiveSessions = signal<ProductionSession[]>([]);
  loading = signal(false);
  alertMessage = signal<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Vue courante : liste des lignes | sélection refs | production multi-refs
  view = signal<'lines' | 'start-refs' | 'production'>('lines');
  selectedLine = signal<string | null>(null);

  // Sélection refs pour démarrage
  startRefs = signal<PlannedReference[]>([]);
  selectedStartRefIds = signal<number[]>([]);
  loadingStartRefs = signal(false);

  // Sessions par référence
  refSessions = signal<RefSession[]>([]);

  // Admin
  adminSession = signal<ProductionSession | null>(null);
  sessionStats = signal<SessionStats | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  filteredLines = computed(() =>
    this.lines().filter(l => l.status === 'active' || l.status === 'paused')
  );

  canStartSelected = computed(() => this.selectedStartRefIds().length > 0);

  allRefsDone = computed(() =>
    this.refSessions().length > 0 &&
    this.refSessions().every(s => s.status === 'completed' || s.status === 'cancelled')
  );

  totalLostPieces = computed(() =>
    this.refSessions().reduce((sum, s) => sum + s.piecesPerdues, 0)
  );

  totalPieces = computed(() =>
    this.refSessions().reduce((sum, s) => sum + s.piecesProduites, 0)
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
ngOnInit(): void {
  this.detectUserRole();
  this.loadMCategories();
  this.startTick();
  
  // ✅ Vérifier si une session existe et afficher la bannière
  this.checkForExistingSession();
  
  // ✅ Redirection automatique intelligente
  this.autoRedirectToActiveSession();
  
  // Sauvegarder périodiquement
  interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => {
    this.saveCurrentSession();
  });
}
 ngOnDestroy(): void {
  this.saveCurrentSession(); // Sauvegarder avant de détruire
  this.destroy$.next();
  this.destroy$.complete();
}

 restoreFromLocalStorage(savedSession: SavedSessionData): void {
  const { ligne, refSessions, selectedStartRefIds, startRefs } = savedSession;
  
  if (!ligne) return;
  
  // Restaurer les données
  this.selectedLine.set(ligne);
  this.selectedStartRefIds.set(selectedStartRefIds || []);
  this.startRefs.set(startRefs || []);
  
  // Restaurer les sessions par référence
  if (refSessions && refSessions.length > 0) {
    // Convertir les dates string en objets Date
    const restoredSessions: RefSession[] = refSessions.map((s: any) => ({
      ...s,
      startTime: s.startTime ? new Date(s.startTime) : null,
      loading: false,
      showPauseForm: false,
      availableRefs: [],
      selectedRefs: [],
      loadingRefs: false,
      pauseReasonInput: '',
      selectedMCategory: null
    }));
    
    this.refSessions.set(restoredSessions);
    this.view.set('production');
    
    // Recharger les données temps réel pour chaque session
    restoredSessions.forEach((session: RefSession, index: number) => {
      if (session.sessionId && session.status !== 'completed' && session.status !== 'cancelled') {
        this.loadTempsParPiece(index, session.sessionId);
      }
    });
    
    this.showAlert('info', `Reprise de votre session sur ${ligne}`);
  } else {
    // Pas de sessions, retour à la sélection
    this.view.set('start-refs');
  }
}

  // ── Rôle ──────────────────────────────────────────────────────────────────
  detectUserRole(): void {
    try {
      const u = localStorage.getItem('current_user');
      if (u) this.isAdmin.set(JSON.parse(u)?.type === 'admin');
    } catch { this.isAdmin.set(false); }
  }

  // ── Lignes ────────────────────────────────────────────────────────────────
  loadLines(callback?: () => void): void {
    this.productionService.getAllLines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.lines.set(res.lines.map(l => ({ ...l, status: 'inactive' as const })));
          this.loadActiveSessions(callback);
        },
        error: () => { if (callback) callback(); }
      });
  }

  loadActiveSessions(callback?: () => void): void {
    this.productionService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.allActiveSessions.set(sessions);
          this.lines.update(list => list.map(line => {
            const session = sessions.find(s => s.ligne === line.ligne);
            return session
              ? { ...line, status: session.status as any, sessionId: session.id, startedBy: (session as any)?.startedBy }
              : { ...line, status: 'inactive' as const };
          }));
          if (callback) callback();
        },
        error: () => { if (callback) callback(); }
      });
  }

  loadMCategories(): void {
    this.productionService.getMCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (res) => this.mCategories.set(res.categories), error: () => {} });
  }

  // ── Sélection ligne → ouverture sélection refs ────────────────────────────
  selectLine(ligne: string, status: string): void {
    if (this.isAdmin()) { this.adminAccessLine(ligne); return; }
    this.selectedLine.set(ligne);
    this.openStartRefModal();
  }

  openStartRefModal(): void {
    const ligne = this.selectedLine();
    if (!ligne) { this.showAlert('error', 'Sélectionnez une ligne'); return; }
    this.view.set('start-refs');
    this.loadingStartRefs.set(true);
    this.startRefs.set([]);
    this.selectedStartRefIds.set([]);
    this.productionService.getPlannedReferences(ligne)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.startRefs.set(res.planifications || []); this.loadingStartRefs.set(false); },
        error: () => { this.startRefs.set([]); this.loadingStartRefs.set(false); }
      });
  }

  toggleStartRef(id: number): void {
    const cur = this.selectedStartRefIds();
    this.selectedStartRefIds.set(cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id]);
  }

  cancelStartRefs(): void {
    this.view.set('lines');
    this.selectedLine.set(null);
  }

  // ── Démarrage toutes sessions ─────────────────────────────────────────────
startAllSessions(): void {
  const ligne = this.selectedLine()!;
  const refs = this.startRefs().filter(r => this.selectedStartRefIds().includes(r.id));

  if (refs.length === 0) {
    this.showAlert('error', 'Sélectionnez au moins une référence');
    return;
  }

  // Initialiser les sessions
  const initialSessions = refs.map(r => ({
    planificationId: r.id,
    reference: r.reference,
    of: r.of,
    jour: r.jour,
    semaine: r.semaine,
    qtePlanifiee: r.qtePlanifiee,
    sessionId: null,
    status: 'idle' as const,
    elapsedSeconds: 0,
    productionSeconds: 0,
    pauseSeconds: 0,
    piecesProduites: 0,
    piecesPerdues: 0,
    secondesParPiece: 0,
    pauseMCategory: null,
    pauseReason: null,
    showPauseForm: false,
    selectedMCategory: null,
    pauseReasonInput: '',
    loading: true,
    startTime: null,
    availableRefs: [],
    selectedRefs: [],
    loadingRefs: false,
  }));

  this.refSessions.set(initialSessions);
  this.view.set('production');

  let successCount = 0;
  let failCount = 0;
  const totalRefs = refs.length;

  const startNext = (index: number) => {
    if (index >= totalRefs) {
      if (failCount === 0) {
        this.showAlert('success', `${successCount} session(s) démarrée(s)`);
        
        // ✅ Sauvegarder après le démarrage réussi
        this.saveCurrentSession();
      }
      return;
    }

    const ref = refs[index];
    
    this.productionService.startProduction(ligne, ref.reference, undefined, [ref.id])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.refSessions.update(list => {
            list[index] = { 
              ...list[index], 
              sessionId: res.session.id, 
              status: 'active', 
              startTime: new Date(), 
              loading: false 
            };
            return [...list];
          });
          
          this.loadTempsParPiece(index, res.session.id);
          successCount++;
          
          // ✅ Sauvegarder après chaque session réussie
          setTimeout(() => {
            this.saveCurrentSession();
          }, 500);
          
          setTimeout(() => startNext(index + 1), 300);
        },
        error: (err) => {
          console.error(`Échec démarrage ${ref.reference}:`, err);
          
          this.refSessions.update(list => {
            list[index] = { 
              ...list[index], 
              status: 'cancelled', 
              loading: false 
            };
            return [...list];
          });
          
          failCount++;
          setTimeout(() => startNext(index + 1), 300);
        }
      });
  };

  startNext(0);
}

saveCurrentSession(): void {
  if (this.isAdmin()) return;
  
  const currentRefSessions: RefSession[] = this.refSessions();
  const hasActive: boolean = currentRefSessions.some((s: RefSession) => 
    s.status === 'active' || s.status === 'paused'
  );
  
  if (!hasActive) return;
  
  const sessionData: SavedSessionData = {
    ligne: this.selectedLine(),
    refSessions: currentRefSessions.map((s: RefSession) => ({
      planificationId: s.planificationId,
      reference: s.reference,
      of: s.of,
      jour: s.jour,
      semaine: s.semaine,
      qtePlanifiee: s.qtePlanifiee,
      sessionId: s.sessionId,
      status: s.status,
      elapsedSeconds: s.elapsedSeconds,
      productionSeconds: s.productionSeconds,
      pauseSeconds: s.pauseSeconds,
      piecesProduites: s.piecesProduites,
      piecesPerdues: s.piecesPerdues,
      secondesParPiece: s.secondesParPiece,
      pauseMCategory: s.pauseMCategory,
      pauseReason: s.pauseReason,
      startTime: s.startTime ? s.startTime.toISOString() : null,
      showPauseForm: false,
      availableRefs: [],
      selectedRefs: [],
      loadingRefs: false,
      pauseReasonInput: '',
      selectedMCategory: null,
      loading: false
    })),
    selectedStartRefIds: this.selectedStartRefIds(),
    startRefs: this.startRefs(),
    savedAt: new Date().toISOString()
  };
  
  // Sauvegarder dans localStorage
  this.productionService.saveLastSession(sessionData);
  
  // ✅ NOUVEAU : Sauvegarder aussi le contexte dans AuthService
  const sessionId = currentRefSessions.find(s => s.sessionId)?.sessionId;
  if (this.selectedLine()) {
    this.authService.saveProductionContext({
      ligne: this.selectedLine()!,
      sessionId: sessionId || 0
    });
  }
}

 // REMPLACER dans production-manager.component.ts

private loadTempsParPiece(idx: number, sessionId: number): void {
  this.productionService.getRealTimeProduction(sessionId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (data) => {
        this.refSessions.update(list => {
          if (idx >= list.length) return list;
          const s = list[idx];

          // ✅ Utiliser directement les secondes du backend (pas de parsing string)
          const productionSec: number = data.productionSeconds ?? this.parseDurationToSeconds(data.tempsProduction);
          const pauseSec: number = this.parseDurationToSeconds(data.tempsPause);
          const totalSec: number = productionSec + pauseSec;

          // ✅ Sync status depuis backend (critique pour l'admin)
          const backendStatus = data.status as RefSession['status'];
          const status = (backendStatus === 'active' || backendStatus === 'paused' || 
                          backendStatus === 'completed' || backendStatus === 'cancelled')
            ? backendStatus : s.status;

          // ✅ piecesPerdues depuis la pause en cours
          const piecesPerdues = data.pauseEnCours?.piecesPerdues ?? s.piecesPerdues;

          list[idx] = {
            ...s,
            status,
            secondesParPiece: data.tempsParPiece || 0,
            elapsedSeconds: totalSec,
            productionSeconds: productionSec,
            pauseSeconds: pauseSec,
            piecesProduites: data.piecesProduites || 0,
            piecesPerdues,
            pauseMCategory: data.pauseEnCours?.mCategory ?? s.pauseMCategory,
          };
          return [...list];
        });
      },
      error: () => {}
    });
}

  // Parse "25m 21s" ou "1h 5m 3s" ou "0s" or "HH:MM:SS" → secondes
  parseDurationToSeconds(duration: string): number {
    if (!duration || duration === '0s') return 0;
    // Check if it's HH:MM:SS format
    const timeMatch = duration.match(/^(\d+):(\d+):(\d+)$/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1]);
      const m = parseInt(timeMatch[2]);
      const s = parseInt(timeMatch[3]);
      return h * 3600 + m * 60 + s;
    }
    // Original parsing for "25m 21s" etc.
    let total = 0;
    const h = duration.match(/(\d+)h/);
    const m = duration.match(/(\d+)m/);
    const s = duration.match(/(\d+)s/);
    if (h) total += parseInt(h[1]) * 3600;
    if (m) total += parseInt(m[1]) * 60;
    if (s) total += parseInt(s[1]);
    return total;
  }

  // ── Chrono local ──────────────────────────────────────────────────────────
  private startTick(): void {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refSessions.update(list =>
        list.map(s => {
          if (s.status === 'active') {
            const u = { ...s, elapsedSeconds: s.elapsedSeconds + 1, productionSeconds: s.productionSeconds + 1 };
            if (u.secondesParPiece > 0) u.piecesProduites = Math.floor(u.productionSeconds / u.secondesParPiece);
            return u;
          }
          if (s.status === 'paused') {
            const u = { ...s, elapsedSeconds: s.elapsedSeconds + 1, pauseSeconds: s.pauseSeconds + 1 };
            if (u.secondesParPiece > 0) u.piecesPerdues = Math.floor(u.pauseSeconds / u.secondesParPiece);
            return u;
          }
          return s;
        })
      );
    });
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  openPauseForm(idx: number): void {
    // ✅ RÈGLE 2 : Une seule ref peut être en pause à la fois
    const sessions = this.refSessions();
    const currentRef = sessions[idx];
    const alreadyPaused = sessions.find(
      (s, i) => i !== idx && s.status === 'paused' && s.sessionId === currentRef.sessionId
    );
    if (alreadyPaused) {
      this.showAlert('error', `"${alreadyPaused.reference}" est déjà en pause — reprenez-la d'abord`);
      return;
    }
    this.refSessions.update(list => {
      list[idx] = { ...list[idx], showPauseForm: true, selectedMCategory: null, pauseReasonInput: '', availableRefs: [], selectedRefs: [], loadingRefs: false };
      return [...list];
    });
  }

  cancelPauseForm(idx: number): void {
    this.refSessions.update(list => {
      list[idx] = { ...list[idx], showPauseForm: false };
      return [...list];
    });
  }

  setMCategory(idx: number, code: string): void {
    this.refSessions.update(list => {
      list[idx] = { ...list[idx], selectedMCategory: code, selectedRefs: [], availableRefs: [], loadingRefs: false };
      return [...list];
    });
    // Charger les refs disponibles pour M1/M4/M5
    if (['M1', 'M4', 'M5'].includes(code)) {
      const ligne = this.selectedLine()!;
      this.refSessions.update(list => {
        list[idx] = { ...list[idx], loadingRefs: true };
        return [...list];
      });
      this.productionService.getAvailableReferences(ligne, code)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.refSessions.update(list => {
              list[idx] = { ...list[idx], availableRefs: res.references || [], loadingRefs: false };
              return [...list];
            });
          },
          error: () => {
            this.refSessions.update(list => {
              list[idx] = { ...list[idx], availableRefs: [], loadingRefs: false };
              return [...list];
            });
          }
        });
    }
  }

  toggleRef(idx: number, ref: string): void {
    this.refSessions.update(list => {
      const cur = list[idx].selectedRefs;
      list[idx] = { ...list[idx], selectedRefs: cur.includes(ref) ? cur.filter(r => r !== ref) : [...cur, ref] };
      return [...list];
    });
  }

  updatePauseReason(idx: number, val: string): void {
    this.refSessions.update(list => {
      list[idx] = { ...list[idx], pauseReasonInput: val };
      return [...list];
    });
  }

  confirmPause(idx: number): void {
    const s = this.refSessions()[idx];
    if (!s.sessionId || !s.selectedMCategory) return;
    // Validation : M1/M4/M5 nécessitent au moins une référence
    if (['M1', 'M4', 'M5'].includes(s.selectedMCategory) && s.selectedRefs.length === 0) {
      const labels: Record<string, string> = { M1: 'matières premières', M4: 'phases en panne', M5: 'produits' };
      this.showAlert('error', `Les références ${labels[s.selectedMCategory]} sont obligatoires pour ${s.selectedMCategory}`);
      return;
    }
    this.refSessions.update(list => { list[idx] = { ...list[idx], loading: true }; return [...list]; });

    const matierePremierRefs = s.selectedMCategory === 'M1' ? s.selectedRefs : undefined;
    const phasesEnPanne      = s.selectedMCategory === 'M4' ? s.selectedRefs : undefined;
    const productRefs        = s.selectedMCategory === 'M5' ? s.selectedRefs : undefined;

    this.productionService.pauseProduction(s.sessionId, s.selectedMCategory, undefined, s.pauseReasonInput || undefined, matierePremierRefs, phasesEnPanne, productRefs)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refSessions.update(list => {
            list[idx] = { ...list[idx], status: 'paused', pauseMCategory: s.selectedMCategory, pauseReason: s.pauseReasonInput || null, pauseSeconds: 0, piecesPerdues: 0, showPauseForm: false, loading: false };
            return [...list];
          });
        },
        error: (err) => {
          this.refSessions.update(list => { list[idx] = { ...list[idx], loading: false }; return [...list]; });
          this.showAlert('error', err.error?.message || 'Erreur pause');
        }
      });
  }

  // ── Reprise ───────────────────────────────────────────────────────────────
  resumeSession(idx: number): void {
    const s = this.refSessions()[idx];
    if (!s.sessionId) return;
    this.refSessions.update(list => { list[idx] = { ...list[idx], loading: true }; return [...list]; });

    this.productionService.resumeProduction(s.sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refSessions.update(list => {
            list[idx] = { ...list[idx], status: 'active', pauseMCategory: null, pauseReason: null, loading: false };
            return [...list];
          });
        },
        error: (err) => {
          this.refSessions.update(list => { list[idx] = { ...list[idx], loading: false }; return [...list]; });
          this.showAlert('error', err.error?.message || 'Erreur reprise');
        }
      });
  }

  // ── Fin session ───────────────────────────────────────────────────────────
 endSession(idx: number): void {
  const s = this.refSessions()[idx];
  if (!s.sessionId) return;

  this.refSessions.update(list =>
    list.map(r => r.sessionId === s.sessionId ? { ...r, loading: true } : r)
  );

  this.productionService.endProduction(s.sessionId, undefined, s.piecesProduites)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.refSessions.update(list =>
          list.map(r =>
            r.sessionId === s.sessionId
              ? { ...r, status: 'completed' as const, loading: false }
              : r
          )
        );
        
        // ✅ Si toutes les sessions sont terminées, nettoyer localStorage
        if (this.allRefsDone()) {
          this.productionService.clearLastSession();
          setTimeout(() => this.loadLines(), 1500);
        } else {
          // Sinon, sauvegarder l'état mis à jour
          this.saveCurrentSession();
        }
        
        this.showAlert('success', 'Session terminée');
      },
      error: (err) => {
        this.refSessions.update(list =>
          list.map(r => r.sessionId === s.sessionId ? { ...r, loading: false } : r)
        );
        this.showAlert('error', err.error?.message || 'Erreur fin');
      }
    });
}

  // ── Retour à la liste ─────────────────────────────────────────────────────
  returnToLines(): void {
    this.view.set('lines');
    this.selectedLine.set(null);
    this.refSessions.set([]);
    this.loadLines();
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  // REMPLACER adminAccessLine dans production-manager.component.ts

adminAccessLine(ligne: string): void {
  const lineSessions = this.allActiveSessions().filter(s => s.ligne === ligne);
  if (lineSessions.length === 0) {
    this.showAlert('error', `Aucune session active sur ${ligne}`);
    return;
  }

  // Reconstituer les RefSessions depuis les sessions actives
  const refSessions: RefSession[] = lineSessions.map(sess => {
    // ✅ Récupérer la PREMIÈRE planification de cette session (1 session = 1 ref)
    const planif = (sess as any).planifications?.[0];
    return {
      planificationId: planif?.id ?? 0,
      reference: planif?.reference ?? sess.productType ?? sess.ligne,
      of: planif?.of ?? '—',
      jour: planif?.jour ?? '',
      semaine: planif?.semaine ?? '',
      qtePlanifiee: planif?.qtePlanifiee ?? 0,
      sessionId: sess.id,
      status: sess.status as any,
      // ✅ Initialiser avec le temps réel calculé depuis startTime
      // Le backend va corriger avec les vraies valeurs dans loadTempsParPiece
      elapsedSeconds: Math.floor((Date.now() - new Date(sess.startTime).getTime()) / 1000),
      productionSeconds: 0, // sera corrigé par loadTempsParPiece
      pauseSeconds: 0,      // sera corrigé par loadTempsParPiece
      piecesProduites: 0,
      piecesPerdues: 0,
      secondesParPiece: 0,
      pauseMCategory: (sess as any).currentPause?.mCategory || null,
      pauseReason: (sess as any).currentPause?.reason || null,
      showPauseForm: false,
      selectedMCategory: null,
      pauseReasonInput: '',
      loading: false,
      startTime: sess.startTime ? new Date(sess.startTime) : null,
      availableRefs: [],
      selectedRefs: [],
      loadingRefs: false,
    };
  });

  this.refSessions.set(refSessions);
  this.selectedLine.set(ligne);
  this.view.set('production');

  // ✅ Charger le temps réel pour CHAQUE session — corrige productionSeconds/pauseSeconds
  lineSessions.forEach((sess, i) => {
    this.loadTempsParPiece(i, sess.id);
    this.loadSessionStats(sess.id);
  });

  this.showAlert('info', `Vue admin — ${ligne} (${lineSessions.length} session(s))`);
}

  loadSessionStats(sessionId: number): void {
    this.productionService.getSessionStats(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (s) => this.sessionStats.set(s), error: () => {} });
  }

  viewPauseHistory(): void {
    const stats = this.sessionStats();
    let allPauses: any[] = [];
    if (stats?.pauses?.byCategory) {
      Object.values(stats.pauses.byCategory).forEach((cat: any) => {
        if (Array.isArray(cat.pauses)) allPauses = [...allPauses, ...cat.pauses];
      });
      allPauses.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
    this.router.navigate(['/pause-history'], { state: { allPauses, sessionInfo: stats?.session || null, totalLostPieces: this.totalLostPieces() } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  getMCategoryIcon(code: string): string {
    const icons: Record<string, string> = { M1: '📦', M2: '👷', M3: '📋', M4: '🔧', M5: '✅', M6: '🌿' };
    return icons[code] || '⚙️';
  }

  getSessionForLine(ligne: string): ProductionSession | undefined {
    return this.allActiveSessions().find(s => s.ligne === ligne);
  }

  /** ✅ Retourne true si une autre ref de la même session est déjà en pause */
  hasOtherPausedRef(idx: number): boolean {
    const sessions = this.refSessions();
    const current = sessions[idx];
    return sessions.some(
      (s, i) => i !== idx && s.status === 'paused' && s.sessionId === current.sessionId
    );
  }

  showAlert(type: 'success' | 'error' | 'info', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => this.alertMessage.set(null), 5000);
  }

  navigateToAdmin(): void { this.router.navigate(['/admin-dashboard']); }
  // ── Nouveaux signals pour l'ajout de ref en cours ──────────────────────────
showReconnectBannerSignal = signal<boolean>(false);
showAddRefPanel = signal<boolean>(false);
availableRefsToAdd = signal<PlannedReference[]>([]);
loadingAddRefs = signal<boolean>(false);
private reconnectBannerVisibleSignal = signal<boolean>(false);
private reconnectLineNameValue = signal<string>('');
// ── Computed : refs déjà démarrées (planificationIds actifs) ────────────────
startedPlanificationIds = computed(() =>
  this.refSessions()
    .filter(s => s.status !== 'cancelled')
    .map(s => s.planificationId)
);

// ── Refs disponibles à ajouter (planifiées aujourd'hui mais pas encore démarrées) ──
availableToAddComputed = computed(() =>
  this.availableRefsToAdd().filter(
    r => !this.startedPlanificationIds().includes(r.id)
  )
);
// ── Ouvrir/Fermer le panneau d'ajout de référence ──────────────────────────
openAddRefPanel(): void {
  const ligne = this.selectedLine();
  if (!ligne) return;

  this.showAddRefPanel.set(true);
  this.loadingAddRefs.set(true);
  this.availableRefsToAdd.set([]);

  this.productionService.getPlannedReferences(ligne)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        this.availableRefsToAdd.set(res.planifications || []);
        this.loadingAddRefs.set(false);
      },
      error: () => {
        this.availableRefsToAdd.set([]);
        this.loadingAddRefs.set(false);
      }
    });
}

closeAddRefPanel(): void {
  this.showAddRefPanel.set(false);
  this.availableRefsToAdd.set([]);
}

// ── Démarrer une référence supplémentaire en cours de production ────────────
addRefToSession(ref: PlannedReference): void {
  const ligne = this.selectedLine()!;

  // Vérifier que cette ref n'est pas déjà en cours
  const alreadyRunning = this.refSessions().find(
    s => s.planificationId === ref.id && s.status !== 'cancelled'
  );
  if (alreadyRunning) {
    this.showAlert('error', `"${ref.reference}" est déjà en cours`);
    return;
  }

  // Créer la session locale en état "idle"
  const newSession: RefSession = {
    planificationId: ref.id,
    reference: ref.reference,
    of: ref.of,
    jour: ref.jour,
    semaine: ref.semaine,
    qtePlanifiee: ref.qtePlanifiee,
    sessionId: null,
    status: 'idle',
    elapsedSeconds: 0,
    productionSeconds: 0,
    pauseSeconds: 0,
    piecesProduites: 0,
    piecesPerdues: 0,
    secondesParPiece: 0,
    pauseMCategory: null,
    pauseReason: null,
    showPauseForm: false,
    selectedMCategory: null,
    pauseReasonInput: '',
    loading: true,
    startTime: null,
    availableRefs: [],
    selectedRefs: [],
    loadingRefs: false,
  };

  // Ajouter à la liste existante
  this.refSessions.update(list => [...list, newSession]);
  const newIndex = this.refSessions().length - 1;

  // Fermer le panneau
  this.closeAddRefPanel();

  // Appel API pour démarrer
  this.productionService.startProduction(ligne, ref.reference, undefined, [ref.id])
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        this.refSessions.update(list => {
          const idx = list.findIndex(s => s.planificationId === ref.id && s.status === 'idle');
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              sessionId: res.session.id,
              status: 'active',
              startTime: new Date(),
              loading: false
            };
          }
          return [...list];
        });

        // Charger le temps par pièce
        const idx = this.refSessions().findIndex(s => s.planificationId === ref.id);
        if (idx !== -1) {
          this.loadTempsParPiece(idx, res.session.id);
        }

        this.saveCurrentSession();
        this.showAlert('success', `"${ref.reference}" ajoutée et démarrée ✅`);
      },
      error: (err) => {
        // Marquer comme annulée en cas d'erreur
        this.refSessions.update(list => {
          const idx = list.findIndex(s => s.planificationId === ref.id && s.status === 'idle');
          if (idx !== -1) {
            list[idx] = { ...list[idx], status: 'cancelled', loading: false };
          }
          return [...list];
        });
        this.showAlert('error', err.error?.message || `Erreur lors du démarrage de "${ref.reference}"`);
      }
    });
}
autoRedirectToActiveSession(): void {
  const queryLigne = this.route.snapshot.queryParamMap.get('ligne');
  const adminAccess = this.route.snapshot.queryParamMap.get('adminAccess');

  // ✅ Admin avec queryParams → charger les lignes puis accès direct
  if (this.isAdmin()) {
    if (queryLigne && adminAccess === 'true') {
      this.loadLines(() => {
        this.selectedLine.set(queryLigne);
        this.adminAccessLine(queryLigne);
      });
    }
    return; // Pas de restauration localStorage pour les admins
  }

  // 1. Vérifier d'abord le localStorage (rapide)
  const savedSession = this.productionService.loadLastSession();
  if (savedSession?.ligne) {
    console.log('🔄 Session trouvée dans localStorage, restauration...');
    this.restoreFromLocalStorage(savedSession);
    return;
  }

  // 2. Vérifier le contexte utilisateur (2ème chance)
  const context = this.authService.getProductionContext();
  if (context?.ligne) {
    console.log('🔄 Contexte utilisateur trouvé:', context);
    this.selectedLine.set(context.ligne);

    // Charger les planifications pour reconstruire l'état
    this.loadingStartRefs.set(true);
    this.productionService.getPlannedReferences(context.ligne)
      .subscribe({
        next: (refs) => {
          this.startRefs.set(refs.planifications || []);

          // Vérifier si la session existe toujours côté serveur
          this.productionService.getMyActiveSession()
            .subscribe({
              next: (response) => {
                this.loadingStartRefs.set(false);

                if (response.hasActiveSession && response.session) {
                  console.log('✅ Session active trouvée côté serveur');

                  // Construire les RefSessions depuis les données serveur
                  const serverSession = response.session;
                  const refSessions: RefSession[] = [];

                  if (serverSession.planifications) {
                    serverSession.planifications.forEach((planif: PlannedReference) => {
                      const refCompteur = serverSession.realtime?.refsCompteurs?.find(
                        (rc: any) => rc.id === planif.id
                      );

                      refSessions.push({
                        planificationId: planif.id,
                        reference: planif.reference,
                        of: planif.of,
                        jour: planif.jour,
                        semaine: planif.semaine,
                        qtePlanifiee: planif.qtePlanifiee,
                        sessionId: serverSession.id,
                        status: serverSession.status as any,
                        elapsedSeconds: refCompteur?.tempsProductionSeconds || 0,
                        productionSeconds: refCompteur?.tempsProductionSeconds || 0,
                        pauseSeconds: refCompteur?.estEnPause ? (refCompteur?.piecesPerdues * refCompteur?.secondesParPiece) || 0 : 0,
                        piecesProduites: refCompteur?.piecesProduites || 0,
                        piecesPerdues: refCompteur?.piecesPerdues || 0,
                        secondesParPiece: refCompteur?.secondesParPiece || 0,
                        pauseMCategory: null,
                        pauseReason: null,
                        showPauseForm: false,
                        selectedMCategory: null,
                        pauseReasonInput: '',
                        loading: false,
                        startTime: serverSession.startTime ? new Date(serverSession.startTime) : null,
                        availableRefs: [],
                        selectedRefs: [],
                        loadingRefs: false,
                      });
                    });
                  }

                  this.refSessions.set(refSessions);
                  this.view.set('production');
                  this.showAlert('success', `Reconnexion automatique sur ${context.ligne}`);
                } else {
                  // Session terminée côté serveur, nettoyer
                  console.log('⚠️ Session terminée, nettoyage du contexte');
                  this.authService.clearProductionContext();
                  this.loadLines();
                }
              },
              error: () => {
                this.loadingStartRefs.set(false);
                this.loadLines();
              }
            });
        },
        error: () => {
          this.loadingStartRefs.set(false);
          this.loadLines();
        }
      });
  } else {
    // 3. Rien trouvé, chargement normal
    this.loadLines();
  }
}
@HostListener('window:beforeunload', ['$event'])
handleBrowserClose(event: BeforeUnloadEvent): void {
  // Sauvegarder l'état actuel avant fermeture
  this.saveCurrentSession();
  // Pas de message de confirmation, juste sauvegarde
}

showReconnectBanner(): boolean {
  return this.showReconnectBannerSignal();
}

getReconnectLine(): string {
  return this.authService.getProductionContext()?.ligne || '';
}

reconnectToSession(): void {
  const context = this.authService.getProductionContext();
  if (context?.ligne) {
    this.selectedLine.set(context.ligne);
    this.autoRedirectToActiveSession();
  }
  this.showReconnectBannerSignal.set(false);
}
readonly reconnectBannerVisible = computed(() => this.reconnectBannerVisibleSignal());
readonly reconnectLineName = computed(() => this.reconnectLineNameValue());

/**
 * ✅ Vérifie si une session précédente existe et affiche la bannière
 */
private checkForExistingSession(): void {
  if (this.isAdmin()) return; // Pas pour les admins
  
  const context = this.authService.getProductionContext();
  if (context?.ligne) {
    this.reconnectLineNameValue.set(context.ligne);
    this.reconnectBannerVisibleSignal.set(true);
  }
}

/**
 * ✅ Action : Reconnecter à la session existante
 */
reconnectToExistingSession(): void {
  this.reconnectBannerVisibleSignal.set(false);
  this.autoRedirectToActiveSession();
}

/**
 * ✅ Action : Ignorer la reconnexion
 */
dismissReconnectBanner(): void {
  this.reconnectBannerVisibleSignal.set(false);
  this.authService.clearProductionContext();
}
}