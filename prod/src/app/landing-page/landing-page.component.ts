import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {

  productionLines = [
    {
      name: 'COM XT5',
      employees: [
        { matricule: 424,  nom: 'DEROUICHE',   prenom: 'Houda'       },
        { matricule: 426,  nom: 'JALLOULI',    prenom: 'Seifeddine'  },
        { matricule: 504,  nom: 'DHIBI',       prenom: 'Nawel'       },
        { matricule: 539,  nom: 'BOUALLEGUE',  prenom: 'Aymen'       },
        { matricule: 561,  nom: 'MHADHBI',     prenom: 'Amel'        },
        { matricule: 664,  nom: 'BEN GHRIB',   prenom: 'Aida'        },
        { matricule: 733,  nom: 'MEFTEH',      prenom: 'Rafika'      },
        { matricule: 772,  nom: 'AICH',        prenom: 'Faiza'       },
        { matricule: 790,  nom: 'ZARROUK',     prenom: 'Jihed'       },
        { matricule: 796,  nom: 'DHAOUI',      prenom: 'Yasmine'     },
        { matricule: 808,  nom: 'BOUZID',      prenom: 'Wissal'      },
        { matricule: 832,  nom: 'LAABIDI',     prenom: 'Aymen'       },
        { matricule: 887,  nom: 'GUEDIRI',     prenom: 'Fadwa'       },
        { matricule: 913,  nom: 'ESSGHAIER',   prenom: 'Mouna'       },
        { matricule: 915,  nom: 'AMARA',       prenom: 'Romdhana'    },
        { matricule: 946,  nom: 'NASR',        prenom: 'Dorsaf'      },
        { matricule: 975,  nom: 'KHLIFA',      prenom: 'Chaima'      },
        { matricule: 976,  nom: 'LTAIEF',      prenom: 'Meriem'      },
        { matricule: 978,  nom: 'JARRAY',      prenom: 'Marwa'       },
      ]
    },
    {
      name: 'RXT2',
      employees: [
        { matricule: 993,  nom: 'MHADHBI',     prenom: 'Haythem'     },
        { matricule: 1006, nom: 'ACHOURI',     prenom: 'Manel'       },
        { matricule: 1008, nom: 'JROUDI',      prenom: 'Motaz'       },
        { matricule: 1034, nom: 'SAIDANE',     prenom: 'Omayma'      },
        { matricule: 1037, nom: 'TAYARI',      prenom: 'Nessrine'    },
        { matricule: 1040, nom: 'KRAEIM',      prenom: 'Hanen'       },
        { matricule: 1054, nom: 'SAIDANE',     prenom: 'Sabrine'     },
        { matricule: 1062, nom: 'NAFFETI',     prenom: 'Marwa'       },
        { matricule: 1069, nom: 'BEN HSSINE',  prenom: 'Ahlem'       },
        { matricule: 1071, nom: 'RJAB',        prenom: 'Amal'        },
        { matricule: 1072, nom: 'HMIDA',       prenom: 'Naziha'      },
        { matricule: 1073, nom: 'CHIHI',       prenom: 'Houda'       },
        { matricule: 1078, nom: 'LOUATI',      prenom: 'Khawla'      },
        { matricule: 1083, nom: 'ABDELMOULA',  prenom: 'Sameh'       },
        { matricule: 1087, nom: 'KALBOUSSI',   prenom: 'Selma'       },
        { matricule: 1102, nom: 'TAYECH',      prenom: 'Afef'        },
        { matricule: 1110, nom: 'DHIB',        prenom: 'Ajmia'       },
        { matricule: 1114, nom: 'FEZAA',       prenom: 'Sabrine'     },
      ]
    },
    {
      name: 'GB XT2',
      employees: [
        { matricule: 1115, nom: 'BELGACEM',    prenom: 'Yossra'      },
        { matricule: 1116, nom: 'GHODBEN',     prenom: 'Ines'        },
        { matricule: 1142, nom: 'BECHIR',      prenom: 'Sana'        },
        { matricule: 1145, nom: 'BEN HFAIEDH', prenom: 'Rabeb'       },
        { matricule: 1146, nom: 'TOUMIA',      prenom: 'Assma'       },
        { matricule: 1152, nom: 'SAIDI',       prenom: 'Ichrak'      },
        { matricule: 1157, nom: 'ELFEZAA',     prenom: 'Nourelhouda' },
        { matricule: 1163, nom: 'HAJ HSSINE',  prenom: 'Sawssen'     },
        { matricule: 1206, nom: 'OTHMEN',      prenom: 'Amen Allah'  },
        { matricule: 1211, nom: 'HAMMEMI',     prenom: 'Wassim'      },
        { matricule: 1239, nom: 'MHADHBI',     prenom: 'Ala'         },
        { matricule: 1249, nom: 'DAHECH',      prenom: 'Fatma'       },
        { matricule: 1250, nom: 'FARHAT',      prenom: 'Rania'       },
        { matricule: 1256, nom: 'BRAIEK',      prenom: 'Amal'        },
        { matricule: 1275, nom: 'DAHECH',      prenom: 'Yassine'     },
        { matricule: 1284, nom: 'YAZIDI',      prenom: 'Amal'        },
        { matricule: 1300, nom: 'NAFFETI',     prenom: 'Sirine'      },
        { matricule: 1324, nom: 'LTAIEF',      prenom: 'Chaima'      },
        { matricule: 1326, nom: 'TOUMI',       prenom: 'Rihab'       },
      ]
    },
    {
      name: 'POLO XT5',
      employees: [
        { matricule: 1330, nom: 'TRABELSI',    prenom: 'Feiza'       },
        { matricule: 1336, nom: 'BEN HSSINE',  prenom: 'Omayma'      },
        { matricule: 1343, nom: 'SLOUM',       prenom: 'Malek'       },
        { matricule: 1356, nom: 'EZZINE',      prenom: 'Anissa'      },
        { matricule: 1358, nom: 'JABALLAH',    prenom: 'Jihen'       },
        { matricule: 1360, nom: 'NASR',        prenom: 'Amel'        },
        { matricule: 1371, nom: 'MIRA',        prenom: 'Marwa'       },
        { matricule: 1372, nom: 'BELLIL',      prenom: 'Sondos'      },
        { matricule: 1373, nom: 'JMII',        prenom: 'Aicha'       },
        { matricule: 1375, nom: 'MAAOUIA',     prenom: 'Ameni'       },
        { matricule: 1382, nom: 'ZID',         prenom: 'Sawssen'     },
        { matricule: 1387, nom: 'KOCHBATI',    prenom: 'Aicha'       },
        { matricule: 1393, nom: 'BOUDHEROUA',  prenom: 'Soulaima'    },
        { matricule: 1396, nom: 'ZRELLI',      prenom: 'Naaim'       },
        { matricule: 1424, nom: 'BEMRI',       prenom: 'Fatma'       },
        { matricule: 1432, nom: 'ABID',        prenom: 'Hana'        },
        { matricule: 1433, nom: 'NOUAJAA',     prenom: 'Wissal'      },
        { matricule: 1437, nom: 'MIRA',        prenom: 'Rawdha'      },
      ]
    },
    {
      name: 'COM ST7',
      employees: [
        { matricule: 1438, nom: 'BENSAID',     prenom: 'Rabeb'       },
        { matricule: 1442, nom: 'AMEUR',       prenom: 'Ghada'       },
        { matricule: 1444, nom: 'DABBAGHI',    prenom: 'Chaima'      },
        { matricule: 1450, nom: 'KEFI',        prenom: 'Wejdene'     },
        { matricule: 1461, nom: 'SLIMENE',     prenom: 'Rabeb'       },
        { matricule: 1478, nom: 'AMMAR',       prenom: 'Oumaima'     },
        { matricule: 1491, nom: 'ABID',        prenom: 'Nihed'       },
        { matricule: 1506, nom: 'RIAHI',       prenom: 'Arwa'        },
        { matricule: 1542, nom: 'ABDELJALIL',  prenom: 'Mawadda'     },
        { matricule: 1570, nom: 'AGUERBI',     prenom: 'Ibtissem'    },
        { matricule: 1573, nom: 'LAAROUSI',    prenom: 'Jawaher'     },
        { matricule: 1574, nom: 'BOUAZIZ',     prenom: 'Yassmine'    },
        { matricule: 1576, nom: 'BENBELGACEM', prenom: 'Samah'       },
        { matricule: 1578, nom: 'HAMOUDA',     prenom: 'Chedia'      },
        { matricule: 1589, nom: 'BEN JEBRIL',  prenom: 'Ahlem'       },
        { matricule: 1591, nom: 'NAFFETI',     prenom: 'Nada'        },
        { matricule: 1592, nom: 'AMMAR',       prenom: 'Asma'        },
        { matricule: 1595, nom: 'HAOUARI',     prenom: 'Amina'       },
        { matricule: 1603, nom: 'DRIDI',       prenom: 'Imen'        },
      ]
    }
  ];

  // Calcule automatiquement 3 colonnes d'~31 opérateurs chacune
  get tableColumns(): { isHeader: boolean; label?: string; matricule?: number; nom?: string; prenom?: string }[][] {
    const rows: { isHeader: boolean; label?: string; matricule?: number; nom?: string; prenom?: string }[] = [];

    for (const line of this.productionLines) {
      rows.push({ isHeader: true, label: line.name });
      for (const emp of line.employees) {
        rows.push({ isHeader: false, ...emp });
      }
    }

    const employees  = rows.filter(r => !r.isHeader);
    const perCol     = Math.ceil(employees.length / 3);
    const columns: typeof rows[]  = [[], [], []];
    let col = 0, count = 0;

    for (const row of rows) {
      if (col > 2) break;
      // Si on change de colonne, répéter le header de section si le précédent était un header
      columns[col].push(row);
      if (!row.isHeader) {
        count++;
        if (count >= perCol && col < 2) { col++; count = 0; }
      }
    }
    return columns;
  }

  qualiteMaintenanceEmployees = [
    
    { matricule: 1407, nom: 'BEN ZAIED',prenom: 'Samar',  service: 'Qualité'      },
    { matricule: 1415, nom: 'BOUSAIDA', prenom: 'Nedia',  service: 'Qualité'      },
    { matricule: 1427, nom: 'BOUSSIF',  prenom: 'Chaima', service: 'Qualité'      },
    { matricule: 1580, nom: 'MOULA',    prenom: 'Wiem',   service: 'Qualité'      },
    { matricule: 277,  nom: 'JAOUADI',  prenom: 'Lotfi',  service: 'Maintenance'  },
    { matricule: 1599, nom: 'DAHMENI',  prenom: 'Mounir', service: 'Maintenance'  },
  ];
}