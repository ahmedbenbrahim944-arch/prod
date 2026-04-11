// src/app/affichage/affichage.component.ts
import { Component, OnInit, OnDestroy, LOCALE_ID } from '@angular/core';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../login/auth.service';

registerLocaleData(localeFr, 'fr');

interface AffichageData {
  date: string;
  jour: string;
  semaine: { nom: string; dateDebut: string; dateFin: string };
  ligne: string;
  kpis: {
    productivite: string;
    productiviteValeur: number;
    nbOuvriers: number;
    totalQtePlanifiee: number;
    totalQteProduite: number;
    delta: number;
  };
  planification: {
    nbReferences: number;
    references: Array<{
      reference: string;
      of: string;
      qteSource: number;
      emballage: string;
      nbOperateurs: number;
    }>;
  };
  ouvriers: {
    total: number;
    capitaine: { matricule: number; nomPrenom: string } | null;
    liste: Array<{ matricule: number; nomPrenom: string; estCapitaine: boolean }>;
  };
  production: {
    nbScans: number;
    enregistrements: Array<{ id: number; reference: string; quantite: number; dateScan: string }>;
  };
}

// Interface pour la réponse de l'API des lignes
interface LinesResponse {
  lines?: string[];
  data?: string[];
  [key: string]: any;
}

@Component({
  selector: 'app-affichage',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, DatePipe],
  providers: [{ provide: LOCALE_ID, useValue: 'fr' }],
  templateUrl: './affichage.component.html',
  styleUrls: ['./affichage.component.css']
})
export class AffichageComponent implements OnInit, OnDestroy {
  data: AffichageData | null = null;
  loading = false;
  error: string | null = null;
  lastUpdate: Date | null = null;
  today = new Date();
  private dataRefreshInterval: any;
  lignes: string[] = [];
  selectedLigne = '';
  private refreshInterval: any;
  private apiUrl = 'http://102.207.250.53:3000';

  constructor(private http: HttpClient , private authService: AuthService ) {}
  

 ngOnInit(): void {
  this.refreshInterval = setInterval(() => { this.today = new Date(); }, 1000);

  // ✅ Auto-refresh des données toutes les 10 secondes
  this.dataRefreshInterval = setInterval(() => {
    if (this.selectedLigne && !this.loading) {
      this.loadData();
    }
  }, 10000);

  this.loadLignes();
}

ngOnDestroy(): void {
  if (this.refreshInterval) clearInterval(this.refreshInterval);
  if (this.dataRefreshInterval) clearInterval(this.dataRefreshInterval); // ✅ nettoyer
}

  // Formater une ligne au format L01, L02, etc.
  

loadLignes(): void {
  const token = localStorage.getItem('access_token') || '';
  const matricule = this.authService.getUserMatricule(); // ✅ récupérer matricule

  this.http.get<string[]>(`${this.apiUrl}/affichage/lignes`, {
    headers: { Authorization: `Bearer ${token}` }
  }).subscribe({
    next: (lines: string[]) => {
      this.lignes = lines.filter(l => l && l.length > 0);

      if (this.lignes.length === 0) {
        this.lignes = ['L04:RXT1', 'L04:RXT2', 'L09:XXX'];
      }

      // ✅ Si matricule 1212 → forcer L24:RXT2
      if (matricule === '1212') {
        this.selectedLigne = 'L24:RXT2';
      } else if (this.lignes.length > 0 && !this.selectedLigne) {
        this.selectedLigne = this.lignes[0];
      }

      this.loadData();
    },
    error: (err) => {
      console.error('Erreur chargement lignes:', err);
      this.lignes = ['L04:RXT1', 'L04:RXT2', 'L09:XXX'];

      // ✅ Même logique en cas d'erreur
      if (matricule === '1212') {
        this.selectedLigne = 'L24:RXT2';
      } else if (!this.selectedLigne && this.lignes.length) {
        this.selectedLigne = this.lignes[0];
      }

      this.loadData();
    }
  });
}


 loadData(): void {
  if (!this.selectedLigne) {
    this.error = 'Veuillez sélectionner une ligne';
    return;
  }

  this.loading = true;
  this.error = null;

  const dateStr = this.formatDate(new Date());
  const token = localStorage.getItem('access_token') || '';

  // Envoyer la ligne telle quelle (sans aucune validation)
  this.http.post<AffichageData>(
    `${this.apiUrl}/affichage`,
    { date: dateStr, ligne: this.selectedLigne },
    { 
      headers: { 
        Authorization: `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      } 
    }
  ).subscribe({
    next: (res) => {
      this.data = res;
      this.lastUpdate = new Date();
      this.loading = false;
    },
    error: (err) => {
      console.error('Erreur chargement données:', err);
      
      if (err.status === 400) {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join(', ') : (msg || 'Données invalides');
      } else if (err.status === 401) {
        this.error = 'Session expirée. Veuillez vous reconnecter.';
        localStorage.removeItem('access_token');
      } else if (err.status === 404) {
        this.error = 'Service non disponible. Vérifiez que le backend est démarré.';
      } else {
        this.error = err?.error?.message || 'Erreur lors du chargement.';
      }
      this.loading = false;
    }
  });
}

  clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}