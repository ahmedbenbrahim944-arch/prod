import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

type CategorieAbsence = 'conge' | 'maladie' | 'injustifiee' | 'autre' | 'sans_motif';

interface AbsentItem {
  matricule: number;
  nomPrenom: string;
  statut: string;
  commentaire?: string | null;
  categorie: CategorieAbsence;
}

interface PresentItem {
  matricule: number;
  nomPrenom: string;
  heureEntree?: string | null;
  timbratrice?: string | null;
}

interface LigneEffectif {
  ligne: string;
  poste: string;
  totalAffectes: number;
  presents: number;
  tauxCouverture: number;
  seuilAlerte: number;
  enAlerte: boolean;
  absencesParCategorie: Record<CategorieAbsence, number>;
  presentsListe: PresentItem[];
  absentsListe: AbsentItem[];
}

@Component({
  selector: 'app-effectif-ligne',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './effectif-ligne.component.html',
  styleUrls: ['./effectif-ligne.component.scss'],
})
export class EffectifLigneComponent implements OnInit {
  // ── IP du backend NestJS ──
  private readonly apiUrl = 'http://102.207.250.53:3000';

  lignes = signal<LigneEffectif[]>([]);
  chargement = signal<boolean>(true);
  erreur = signal<string | null>(null);
  filtrePoste = signal<'tous' | 'jour' | 'nuit'>('tous');
  ligneOuverte = signal<string | null>(null); // `${ligne}__${poste}` de la carte dépliée

  lignesFiltrees = computed(() => {
    const f = this.filtrePoste();
    const data = this.lignes();
    if (f === 'tous') return data;
    return data.filter((l) => l.poste === f);
  });

  totaux = computed(() => {
    const data = this.lignesFiltrees();
    return data.reduce(
      (acc, l) => {
        acc.effectif += l.totalAffectes;
        acc.presents += l.presents;
        acc.conge += l.absencesParCategorie.conge;
        acc.maladie += l.absencesParCategorie.maladie;
        acc.injustifiee += l.absencesParCategorie.injustifiee;
        return acc;
      },
      { effectif: 0, presents: 0, conge: 0, maladie: 0, injustifiee: 0 },
    );
  });

  readonly labelsCategorie: Record<CategorieAbsence, string> = {
    conge: 'Congé',
    maladie: 'Maladie',
    injustifiee: 'Injustifiée',
    autre: 'Autre',
    sans_motif: 'Sans motif',
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.http.get<LigneEffectif[]>(`${this.apiUrl}/pointage/poste/today/detaille`).subscribe({
      next: (data) => {
        this.lignes.set(data);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set("Impossible de charger l'effectif du jour.");
        this.chargement.set(false);
      },
    });
  }

  toggleDetail(l: LigneEffectif): void {
    const cle = `${l.ligne}__${l.poste}`;
    this.ligneOuverte.set(this.ligneOuverte() === cle ? null : cle);
  }

  estOuverte(l: LigneEffectif): boolean {
    return this.ligneOuverte() === `${l.ligne}__${l.poste}`;
  }

  categoriesAffichees(l: LigneEffectif): { cat: CategorieAbsence; nb: number }[] {
    return (Object.entries(l.absencesParCategorie) as [CategorieAbsence, number][])
      .filter(([, nb]) => nb > 0)
      .map(([cat, nb]) => ({ cat, nb }));
  }
}