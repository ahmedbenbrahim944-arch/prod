// src/app/services/chart.service.ts
import { Injectable, inject } from '@angular/core';
import Chart from 'chart.js/auto';
import { StatsService, GetStatsDto } from './stats.service';


@Injectable({
  providedIn: 'root'
})
export class ChartService {
  private statsService = inject(StatsService);

  // Créer un histogramme pour les quantités
  createQuantityChart(ctx: CanvasRenderingContext2D, stats: any): Chart {
    const labels = stats.details?.map((d: any) => d.jour) || [];
    const qtePlanifiee = stats.details?.map((d: any) => d.qtePlanifiee) || [];
    const qteModifiee = stats.details?.map((d: any) => d.qteModifiee) || [];
    const decProduction = stats.details?.map((d: any) => d.decProduction) || [];

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Qté Planifiée',
            data: qtePlanifiee,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Qté Modifiée',
            data: qteModifiee,
            backgroundColor: 'rgba(255, 206, 86, 0.7)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1
          },
          {
            label: 'Déc. Production',
            data: decProduction,
            backgroundColor: 'rgba(255, 99, 132, 0.7)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Quantités par Jour',
            color: '#cbd5e1',
            font: {
              size: 16
            }
          },
          legend: {
            labels: {
              color: '#cbd5e1'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          x: {
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          }
        }
      }
    });
  }

  // Créer un graphique en courbe pour le PCS Prod
  createPcsChart(ctx: CanvasRenderingContext2D, stats: any): Chart {
    const labels = stats.details?.map((d: any) => d.jour) || [];
    const pcsData = stats.details?.map((d: any) => {
      const pcsStr = d.pcsProd || '0%';
      return parseFloat(pcsStr.replace('%', ''));
    }) || [];

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'PCS Prod (%)',
            data: pcsData,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Évolution du PCS Prod par Jour',
            color: '#cbd5e1',
            font: {
              size: 16
            }
          },
          legend: {
            labels: {
              color: '#cbd5e1'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'PCS Prod (%)',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Jour',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          }
        }
      }
    });
  }

  // Créer un graphique en camembert pour la répartition des écarts
  createEcartPieChart(ctx: CanvasRenderingContext2D, stats: any): Chart {
    const repartition = stats.repartitionEcartParCause;
    if (!repartition) {
      return new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Aucune donnée'],
          datasets: [{
            data: [1],
            backgroundColor: ['rgba(100, 116, 139, 0.7)']
          }]
        }
      });
    }

    const causes = ['matierePremiere', 'absence', 'rendement', 'maintenance', 'qualite'];
    const labels = causes.map(cause => 
      cause === 'matierePremiere' ? 'Matière Première' :
      cause === 'absence' ? 'Absence' :
      cause === 'rendement' ? 'Rendement' :
      cause === 'maintenance' ? 'Maintenance' : 'Qualité'
    );
    
    const data = causes.map(cause => repartition[cause]?.pourcentage || 0);
    const backgroundColors = [
      'rgba(255, 99, 132, 0.7)',    // Rouge - Matière première
      'rgba(54, 162, 235, 0.7)',    // Bleu - Absence
      'rgba(255, 206, 86, 0.7)',    // Jaune - Rendement
      'rgba(75, 192, 192, 0.7)',    // Cyan - Maintenance
      'rgba(153, 102, 255, 0.7)'    // Violet - Qualité
    ];

    return new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Répartition des Écarts par Cause (%)',
            color: '#cbd5e1',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'right',
            labels: {
              color: '#cbd5e1',
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw}%`;
              }
            }
          }
        }
      }
    });
  }

  // Créer un graphique en barre pour les écarts par jour
  createEcartBarChart(ctx: CanvasRenderingContext2D, stats: any): Chart {
    // Grouper les écarts par jour
    const ecartsParJour: { [key: string]: number } = {};
    
    if (stats.statsParReference) {
      stats.statsParReference.forEach((ref: any) => {
        if (ref.detailsParJour) {
          ref.detailsParJour.forEach((jour: any) => {
            if (!ecartsParJour[jour.jour]) {
              ecartsParJour[jour.jour] = 0;
            }
            ecartsParJour[jour.jour] += jour.ecart || 0;
          });
        }
      });
    }

    const labels = Object.keys(ecartsParJour).sort();
    const data = labels.map(label => ecartsParJour[label]);

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Écarts Totaux (unités)',
          data: data,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Écarts Totaux par Jour',
            color: '#cbd5e1',
            font: {
              size: 16
            }
          },
          legend: {
            labels: {
              color: '#cbd5e1'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Quantité d\'écarts',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Jour',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          }
        }
      }
    });
  }

  // Créer un graphique comparatif entre PCS Prod et Écarts
  createComparisonChart(ctx: CanvasRenderingContext2D, stats: any): Chart {
    const labels = stats.details?.map((d: any) => d.jour) || [];
    
    // Calculer PCS Prod par jour
    const pcsByDay: { [key: string]: number } = {};
    const ecartByDay: { [key: string]: number } = {};
    
    stats.details?.forEach((detail: any) => {
      if (!pcsByDay[detail.jour]) pcsByDay[detail.jour] = 0;
      if (!ecartByDay[detail.jour]) ecartByDay[detail.jour] = 0;
      
      const pcsValue = parseFloat((detail.pcsProd || '0%').replace('%', ''));
      pcsByDay[detail.jour] += pcsValue;
      // Pour l'écart, on pourrait utiliser les données des non-conformités
    });

    // Compter les références par jour pour faire la moyenne
    const refCountByDay: { [key: string]: number } = {};
    stats.details?.forEach((detail: any) => {
      if (!refCountByDay[detail.jour]) refCountByDay[detail.jour] = 0;
      refCountByDay[detail.jour]++;
    });

    const pcsData: number[] = labels.map((label: string) => 
      refCountByDay[label] ? pcsByDay[label] / refCountByDay[label] : 0
    );

    // Pour les écarts, utiliser les données groupées si disponibles
    let ecartData = new Array(labels.length).fill(0);
    if (stats.statsParReference) {
    labels.forEach((label: string, index: number) => {
      let totalEcart: number = 0;
      let count: number = 0;
      
      stats.statsParReference.forEach((ref: any) => {
        const jourDetail: any = ref.detailsParJour?.find((j: any) => j.jour === label);
        if (jourDetail && jourDetail.ecart) {
        totalEcart += jourDetail.ecart;
        count++;
        }
      });
      
      ecartData[index] = count > 0 ? totalEcart : 0;
    });
    }

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'PCS Prod Moyen (%)',
            data: pcsData,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y'
          },
          {
            label: 'Écarts Totaux',
            data: ecartData,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Comparaison PCS Prod vs Écarts',
            color: '#cbd5e1',
            font: {
              size: 16
            }
          },
          legend: {
            labels: {
              color: '#cbd5e1'
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'PCS Prod (%)',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Écarts (unités)',
              color: '#cbd5e1'
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Jour',
              color: '#cbd5e1'
            },
            grid: {
              color: 'rgba(100, 116, 139, 0.2)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          }
        }
      }
    });
  }

  // Nettoyer tous les graphiques
  destroyCharts(charts: Chart[]): void {
    charts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
  }
}