import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { RapportPhaseService } from '../prod/rapport-phase.service';

interface DownloadPhaseForm {
  semaine: string;
  errors: {
    semaine?: string;
  };
}

@Component({
  selector: 'app-phase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './phase.component.html',
  styleUrls: ['./phase.component.css']
})
export class PhaseComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private rapportPhaseService = inject(RapportPhaseService);

  // Variables d'état
  loading = false;
  loadingStats = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  weekStats: any = null;

  // Formulaire
  downloadPhaseForm: DownloadPhaseForm = {
    semaine: '',
    errors: {}
  };

  ngOnInit() {
    // Optionnel : charger des données initiales si nécessaire
  }

  // Retour vers choix1
  retourChoix1() {
    this.router.navigate(['/choix1']);
  }

  // Méthode pour générer la liste des semaines
  getWeeksList(): string[] {
    const weeks = [];
    for (let i = 1; i <= 52; i++) {
      weeks.push(`semaine${i}`);
    }
    return weeks;
  }

  // Changement de semaine
  onSemaineChange(value: string) {
    this.errorMessage = null;
    this.downloadPhaseForm.errors = {};
    
    if (value && value.trim()) {
      this.loadWeekStats(value.trim());
    } else {
      this.weekStats = null;
    }
  }

  // Charger les statistiques de la semaine
  loadWeekStats(semaine: string) {
    if (!semaine.trim()) {
      this.weekStats = null;
      return;
    }

    this.loadingStats = true;
    
    this.rapportPhaseService.getStatsSemaine(semaine)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.log('Aucune statistique disponible pour cette semaine:', error);
          
          if (error.status === 404) {
            this.weekStats = {
              message: `La semaine "${semaine}" n'existe pas`,
              totalRapports: 0,
              totalOuvriers: 0,
              totalLignes: 0
            };
          } else {
            this.weekStats = null;
          }
          
          return of(null);
        }),
        finalize(() => {
          this.loadingStats = false;
        })
      )
      .subscribe({
        next: (stats) => {
          this.weekStats = stats;
        }
      });
  }

  // Télécharger les rapports
  async onDownloadPhaseReports() {
    // Validation
    this.downloadPhaseForm.errors = {};
    let hasErrors = false;

    if (!this.downloadPhaseForm.semaine.trim()) {
      this.downloadPhaseForm.errors.semaine = 'Le nom de la semaine est requis';
      hasErrors = true;
    }

    if (hasErrors) return;

    this.loading = true;
    this.errorMessage = null;

    try {
      // 1. Récupérer les données depuis le backend
      const rapports = await this.getPhaseReportsForWeek(this.downloadPhaseForm.semaine.trim());
      
      if (!rapports) {
        this.errorMessage = `Erreur lors de la récupération des données pour la semaine "${this.downloadPhaseForm.semaine}"`;
        this.loading = false;
        return;
      }
      
      if (rapports.length === 0) {
        this.errorMessage = `⚠️ Aucun rapport trouvé pour la semaine "${this.downloadPhaseForm.semaine}"`;
        this.loading = false;
        return;
      }

      // 2. Générer le fichier Excel
      await this.generateExcelFile(rapports, this.downloadPhaseForm.semaine.trim());
      
      this.showSuccessMessage(`✅ Rapports de la semaine "${this.downloadPhaseForm.semaine}" téléchargés avec succès !`);
      
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      
      if (error.status === 404) {
        this.errorMessage = `❌ La semaine "${this.downloadPhaseForm.semaine}" n'existe pas dans la base de données`;
      } else if (error.status === 500) {
        this.errorMessage = '❌ Erreur serveur. Veuillez réessayer plus tard';
      } else if (error.message && error.message.includes('semaine')) {
        this.errorMessage = `❌ Semaine "${this.downloadPhaseForm.semaine}" introuvable`;
      } else {
        this.errorMessage = error.message || '❌ Erreur lors du téléchargement des rapports';
      }
    } finally {
      this.loading = false;
    }
  }

  // Méthode pour récupérer les rapports depuis le backend
  private getPhaseReportsForWeek(semaine: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rapportPhaseService.getRapportsBySemaine(semaine)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: (response) => {
            if (response && response.rapports) {
              resolve(response.rapports);
            } else if (response && response.message) {
              reject(new Error(response.message));
            } else {
              resolve([]);
            }
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  // Méthode pour générer le fichier Excel
  private async generateExcelFile(rapports: any[], semaine: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Rapports ${semaine}`);
    
    // En-têtes
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Semaine', key: 'semaine', width: 15 },
      { header: 'Jour', key: 'jour', width: 15 },
      { header: 'Ligne', key: 'ligne', width: 20 },
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom Prénom', key: 'nomPrenom', width: 25 },
      { header: 'Date Création', key: 'createdAt', width: 25 },
      { header: 'Date Modification', key: 'updatedAt', width: 25 },
      { header: 'Phases', key: 'phases', width: 40 },
      { header: 'Total Heures/Jour', key: 'totalHeuresJour', width: 20 },
      { header: 'Heures Restantes', key: 'heuresRestantes', width: 20 },
      { header: 'Nb Phases/Jour', key: 'nbPhasesJour', width: 20 },
      { header: 'PCS Prod Ligne', key: 'pcsProdLigne', width: 20 },
      { header: 'Pourcentage Total Écart', key: 'pourcentageTotalEcart', width: 25 }
    ];
    
    // Données
    rapports.forEach((rapport, index) => {
      let phasesDisplay = this.formatPhasesForDisplay(rapport.phases);
      
      const row = worksheet.addRow({
        id: rapport.id || index + 1,
        semaine: rapport.semaine || 'N/A',
        jour: rapport.jour || 'N/A',
        ligne: rapport.ligne || 'N/A',
        matricule: rapport.matricule || 'N/A',
        nomPrenom: rapport.nomPrenom || 'N/A',
        createdAt: rapport.createdAt 
          ? this.formatDateTime(rapport.createdAt) 
          : 'N/A',
        updatedAt: rapport.updatedAt 
          ? this.formatDateTime(rapport.updatedAt) 
          : 'N/A',
        phases: phasesDisplay,
        totalHeuresJour: rapport.totalHeuresJour || 0,
        heuresRestantes: rapport.heuresRestantes || 0,
        nbPhasesJour: rapport.nbPhasesJour || 0,
        pcsProdLigne: rapport.pcsProdLigne || 0,
        pourcentageTotalEcart: rapport.pourcentageTotalEcart || 0 
      });
      
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    });
    
    // Style des en-têtes
    const headerRow = worksheet.getRow(1);
    headerRow.font = { 
      bold: true, 
      color: { argb: 'FFFFFF' },
      size: 12
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2E7D32' }
    };
    headerRow.alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true
    };
    headerRow.height = 30;
    
    // Style des bordures
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Ajuster automatiquement la largeur des colonnes
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell!({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        maxLength = Math.max(maxLength, cellLength);
      });
      column.width = Math.min(Math.max(maxLength + 2, column.width || 0), 50);
    });
    
    // Titre
    const titleRow = worksheet.insertRow(1, [`RAPPORTS DE PRODUCTION - ${semaine.toUpperCase()}`]);
    titleRow.height = 40;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { 
      bold: true, 
      size: 16,
      color: { argb: 'FFFFFF' }
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1565C0' }
    };
    titleCell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };
    worksheet.mergeCells(1, 1, 1, worksheet.columnCount);
    
    // Pied de page
    const statsRow = worksheet.addRow([]);
    const statsCell = statsRow.getCell(1);
    statsCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | Total: ${rapports.length} rapports`;
    statsCell.font = { italic: true, size: 10, color: { argb: '666666' } };
    statsCell.alignment = { horizontal: 'right' };
    worksheet.mergeCells(statsRow.number, 1, statsRow.number, worksheet.columnCount);
    
    // Générer le fichier
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const dateStr = new Date().toISOString().split('T')[0];
    saveAs(blob, `rapports-production-${semaine}-${dateStr}.xlsx`);
  }

  // Méthodes utilitaires
  private formatPhasesForDisplay(phasesData: any): string {
    // Copier la même méthode que dans ProdComponent
    if (!phasesData) {
      return 'Aucune phase';
    }
    
    try {
      let phasesArray: any[] = [];
      
      if (Array.isArray(phasesData)) {
        phasesArray = phasesData;
      } else if (typeof phasesData === 'string') {
        let cleanString = phasesData.trim().replace(/'/g, '"').replace(/\\/g, '');
        
        if (cleanString.startsWith('[') && cleanString.endsWith(']')) {
          try {
            phasesArray = JSON.parse(cleanString);
          } catch (parseError) {
            cleanString = cleanString.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
            
            try {
              phasesArray = JSON.parse(cleanString);
            } catch (e) {
              return `Format invalide: ${phasesData.substring(0, 100)}...`;
            }
          }
        }
      }
      
      const formattedPhases: string[] = [];
      
      phasesArray.forEach((phaseObj, index) => {
        if (phaseObj && typeof phaseObj === 'object') {
          const keys = Object.keys(phaseObj);
          
          if (keys.length > 0) {
            keys.forEach(key => {
              const value = phaseObj[key];
              
              if (typeof value === 'object') {
                const hourValue = value.heure || value.Heure || value.hours || 
                                 value.temps || value.duree || '?';
                formattedPhases.push(`Phase ${key}: ${hourValue}`);
              } else {
                const displayValue = value || '?';
                formattedPhases.push(`Phase ${key}: ${displayValue}`);
              }
            });
          } else {
            const phaseNumber = phaseObj.phase || phaseObj.Phase || 
                              phaseObj.numero || phaseObj.Numero || 
                              phaseObj.id || `Phase ${index + 1}`;
            
            const heureValue = phaseObj.heure || phaseObj.Heure || 
                             phaseObj.hours || phaseObj.Hours || 
                             phaseObj.temps || phaseObj.duree || 
                             phaseObj.value || '?';
            
            formattedPhases.push(`Phase ${phaseNumber}: ${heureValue}`);
          }
        }
      });
      
      return formattedPhases.length > 0 
        ? formattedPhases.join(', ') 
        : 'Aucune phase valide';
      
    } catch (error) {
      console.error('Erreur lors du formatage:', error);
      return typeof phasesData === 'string' 
        ? `Erreur: ${phasesData.substring(0, 50)}...` 
        : 'Format inconnu';
    }
  }

  private formatDateTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }

  // Annuler
  onCancelDownloadPhase() {
    this.resetDownloadPhaseForm();
  }

  // Réinitialiser le formulaire
  private resetDownloadPhaseForm() {
    this.downloadPhaseForm = {
      semaine: '',
      errors: {}
    };
    this.weekStats = null;
    this.errorMessage = null;
    this.successMessage = null;
  }

  // Afficher un message de succès
  private showSuccessMessage(message: string) {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }
}