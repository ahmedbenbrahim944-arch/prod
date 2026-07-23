import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Operateur {
  matricule: string;
  nom: string;
}

interface LigneProduction {
  nom: string;
  postes: string;
}

interface AssignationTQ {
  fonction: string;
  poste1: string;
  poste2: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit {

  readonly titre = 'Bonjour,';
  readonly heuresSup = 'Des heures supplémentaires sont prévues ce samedi : 5 heures pour le 1er poste et 5 heures pour le 2e poste';
  readonly periodeContext = 'Vous trouverez ci-dessous la liste des opérateurs du 1er poste pour ce samedi de 06H00 jusqu\'à 11H00.';
  readonly periodeAffichage = '1er Poste : 6h00 à 11H00';

  readonly lignes: LigneProduction[] = [
    { nom: 'COM ST7', postes: '(1er poste)' },
    { nom: 'COM XT5', postes: '(1er et 2e poste)' },
    { nom: 'SOUDURE POLO XT5', postes: '(1er et 2e poste)' },
    { nom: 'EQUIPPAGIO POLO XT5', postes: '(1er et 2e poste)' },
    { nom: 'ASSIEME NUCLEO MAGNETICO POLO XT5', postes: '(1er et 2e poste)' }
  ];

  readonly operateurs: Operateur[] = [
    { matricule: '344', nom: 'SASSI Imen' },
    { matricule: '424', nom: 'DEROUICHE Houda' },
    { matricule: '426', nom: 'JALLOULI Seifeddine' },
    { matricule: '506', nom: 'DAHMANI Wided' },
    { matricule: '507', nom: 'ABID Samira' },
    { matricule: '615', nom: 'CHIHI Nawel' },
    { matricule: '664', nom: 'BEN GHRIB Aida' },
    { matricule: '733', nom: 'MEFTEH Rafika' },
    { matricule: '783', nom: 'HARRATH Yossra' },
    { matricule: '790', nom: 'ZARROUK Jihed' },
    { matricule: '808', nom: 'BOUZID Wissal' },
    { matricule: '832', nom: 'LAABIDI Aymen' },
    { matricule: '915', nom: 'AMARA Romdhana' },
    { matricule: '928', nom: 'FEZAA Bassma' },
    { matricule: '958', nom: 'HAMMOUDA Yakouta' },
    { matricule: '978', nom: 'JARRAY Marwa' },
    { matricule: '981', nom: 'AZOUZI Ichrak' },
    { matricule: '993', nom: 'MHADHBI Haythem' },
    { matricule: '1006', nom: 'ACHOURI Manel' },
    { matricule: '1008', nom: 'JROUDI Motaz' },
    { matricule: '1034', nom: 'SAID Omayma' },
    { matricule: '1040', nom: 'KRAEIM Hanen' },
    { matricule: '1055', nom: 'SALAH Amal' },
    { matricule: '1072', nom: 'HMIDA Naziha' },
    { matricule: '1078', nom: 'LOUATI Khawla' },
    { matricule: '1083', nom: 'ABDELMOULA Sameh' },
    { matricule: '1087', nom: 'KALBOUSSI Selma' },
    { matricule: '1099', nom: 'DARDOUR Ameni' },
    { matricule: '1102', nom: 'TAYECH Afef' },
    { matricule: '1114', nom: 'FEZAA Sabrine' },
    { matricule: '1123', nom: 'TOUMI Rim' },
    { matricule: '1131', nom: 'SAAFI Amel' },
    { matricule: '1134', nom: 'CHBIL Hayet' },
    { matricule: '1142', nom: 'BECHIR Sana' },
    { matricule: '1145', nom: 'BEN HFAIEDH Rabeb' },
    { matricule: '1150', nom: 'BOUARADA Khawla' },
    { matricule: '1163', nom: 'HAJ HSSINE Sawssen' },
    { matricule: '1177', nom: 'BEN SALEM Rania' },
    { matricule: '1206', nom: 'OTHMEN Amen Allah' },
    { matricule: '1211', nom: 'Wassim Hammemi' },
    { matricule: '1214', nom: 'JADI Sondos' },
    { matricule: '1239', nom: 'MHADHBI Ala' },
    { matricule: '1245', nom: 'AMARA Wafa' },
    { matricule: '1246', nom: 'SLIMENE Onsa' },
    { matricule: '1254', nom: 'AFLI Houda' },
    { matricule: '1256', nom: 'BRAIEK Amal' },
    { matricule: '1257', nom: 'AYACHI Hanen' },
    { matricule: '1258', nom: 'FARES Hamida' },
    { matricule: '1259', nom: 'KHALFALLAH Hadhemi' },
    { matricule: '1275', nom: 'DAHECH Yassine' },
    { matricule: '1284', nom: 'YAZIDI Amal' },
    { matricule: '1309', nom: 'ATTIA Ahlem' },
    { matricule: '1324', nom: 'LTAIEF Chaima' },
    { matricule: '1330', nom: 'TRABELSI Feiza' },
    { matricule: '1343', nom: 'SLOUM Malek' },
    { matricule: '1360', nom: 'AMEL NASR' },
    { matricule: '1377', nom: 'SGHAIER Hiba' },
    { matricule: '1382', nom: 'ZID Saoussen' },
    { matricule: '1395', nom: 'HAMMEMI Rihab' },
    { matricule: '1396', nom: 'ZRELLI NAAIM' },
    { matricule: '1424', nom: 'BEMRI Fatma' },
    { matricule: '1438', nom: 'Rabeb BENSAID' },
    { matricule: '1442', nom: 'AMEUR Ghada' },
    { matricule: '1444', nom: 'DABBAGHI Chaima' },
    { matricule: '1461', nom: 'SLIMENE Rabeb' },
    { matricule: '1475', nom: 'ABID Zouhour' },
    { matricule: '1506', nom: 'RIAHI Arwa' },
    { matricule: '1568', nom: 'BEN AHMED Hajer' },
    { matricule: '1576', nom: 'BENBELGACE Samah' },
    { matricule: '1603', nom: 'DRIDI Imen' },
    { matricule: '1606', nom: 'ISSAOUI Hounaida' },
    { matricule: '1607', nom: 'NAFFETI Maha' },
    { matricule: '1608', nom: 'SALEM Imen' },
    { matricule: '1609', nom: 'RIAHI Rabeb' },
    { matricule: '1615', nom: 'ABD ELMOULA Mohamed ALI' },
    { matricule: '1640', nom: 'AMEUR Oumaima' },
    { matricule: '1651', nom: 'NASR Isra' },
    { matricule: '561', nom: 'MHADHBI Amel' },
    { matricule: '1671', nom: 'Jarray Sarra' },
    { matricule: '1670', nom: 'Abidi Ibtissem' },
    { matricule: '1668', nom: 'Mansour Hayet' },
    { matricule: '1669', nom: 'Dridi Oumaima' },
    { matricule: '1672', nom: 'Jbili Chadia' },
    { matricule: '1673', nom: 'Naffeti Asma' },
    { matricule: '1676', nom: 'Tayari Yomna' },
    { matricule: '-', nom: 'Mariem KHEDHER' },
    { matricule: '-', nom: 'Mariem KNANI' },
    { matricule: '-', nom: 'Nesrine JDAY' }
  ];

  readonly assignations: AssignationTQ[] = [
    { fonction: 'TQ', poste1: 'Amal - Eya - Wafa Ayari', poste2: 'Wiem - Mayar - Mouna' },
    { fonction: 'TM', poste1: 'Noureddine - Lotfi Jawedi', poste2: 'Houssem - Chokri' }
  ];

  constructor() {}

  ngOnInit(): void {}
}