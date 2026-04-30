// src/app/planification1/planification1.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService, WeekInfo } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
// ✅ AJOUT : Importer votre AuthService (adaptez le chemin selon votre projet)
import { AuthService } from '../login/auth.service';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
  hasMissingOf?: boolean;
  missingOfCount?: number;
  missingOfRefs?: string[];
}

interface DayEntry {
  of: string;
  nbOperateurs: number;
  c: number;
  m: number;
  dp: number;
  dm: number;
  delta: number;
}

interface ReferenceRow {
  reference: string;
  ligne: string;
  note?: string;
  lundi?: DayEntry;
  mardi?: DayEntry;
  mercredi?: DayEntry;
  jeudi?: DayEntry;
  vendredi?: DayEntry;
  samedi?: DayEntry;
  [key: string]: string | DayEntry | undefined;
}

interface LigneData {
  ligne: string;
  references: ReferenceRow[];
}

interface TicketData {
  reference: string;
  ligne: string;
  qty: number;
  dateFab: string;
  dateImp: string;
  timeImp: string;
  order: string;
  nEtq: number;
  qrContent: string;
  lineName: string;
  ticketIndex: number;
  totalTickets: number;
  // ✅ NOUVEAUX CHAMPS
  refName: string;      // Nom depuis la base Excel
  operateur: string;    // Matricule de l'opérateur connecté
}

interface PrintRefRow {
  reference: string;
  of: string;
  qteJour: number;
  qtyParTicket: number;
}

interface PrintHistory {
  day: string;
  ligne: string;
  semaine: string;
  date: string;
  time: string;
  nbTickets: number;
  nEtqFrom: number;
  nEtqTo: number;
}

// ─── BASE DE DONNÉES RÉFÉRENCES (depuis BASE_DE_DONNER_SERAF.xlsx) ────────────
// Structure : référence → { name: "Nom complet", qty: quantité par défaut }
const REFERENCE_DATABASE: { [key: string]: { name: string; qty: number } } = {
  
  '162222801': { name: 'L10:RS3 V:L28226', qty: 1000 },
  '162218801': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218802': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218803': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218804': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218805': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218806': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218807': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218808': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218809': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218810': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218811': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218812': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218813': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218814': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218815': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218816': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218817': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218818': { name: 'L10:RS3 V:L0241', qty: 250 },
  '162218819': { name: 'L10:RS3 V:L0241', qty: 250 },
  'RA5230802': { name: 'L25:C.XT1 V:ECN000315767', qty: 210 },
  'RA5230802_2': { name: 'L25:C.XT1 V:ECN000315767', qty: 1700 },
  'RA5165801': { name: 'L07:Com A1 V:L3735', qty: 160 },
  'RA5165802': { name: 'L07:Com A1 V:L3735', qty: 180 },
  'RA5196801': { name: 'L07:Com A1 V:L6102', qty: 240 },
  'RA5196802': { name: 'L07:Com A1 V:L6102', qty: 260 },
  'RA1689801': { name: 'L19:Com T4/T5 V:L0707', qty: 45 },
  'RA1689803': { name: 'L19:Com T4/T5 V:L0707', qty: 45 },
  'RB6546801': { name: 'L19:Com T4/T5 V:L7662', qty: 45 },
  'RN0283801': { name: 'L19:Com T4/T5 V:L0707', qty: 42 },
  'RN0283802': { name: 'L19:Com T4/T5 V:L0707', qty: 24 },
  'RN0283804': { name: 'L19:Com T4/T5 V:L0707', qty: 16 },
  'RN0283809': { name: 'L19:Com T4/T5 V:L0707', qty: 30 },
  'RN0283811': { name: 'L19:Com T4/T5 V:L0707', qty: 16 },
  'RN0283812': { name: 'L19:Com T4/T5 V:L0707', qty: 16 },
  'RA3060801': { name: 'L21:Com X1-T7/N0 V:L4117', qty: 120 },
  'RA3060803': { name: 'L21:Com X1-T7/N0 V:L4117', qty: 120 },
  'RA3060804': { name: 'L21:Com X1-T7/N0 V:L4117', qty: 120 },
  'RB1180902': { name: 'L21:N0 V:ECN000266490', qty: 126 },
  'RB1180805': { name: 'L21:N0 V:ECN000266490', qty: 126 },
  'RB1180806': { name: 'L21:N0 V:ECN000266490', qty: 126 },
  'RB1180901': { name: 'L21:N0 V:ECN000266490', qty: 126 },
  'RB1180806_2': { name: 'L21:N0 US V:ECN000266490', qty: 144 },
  '1SDR009850A1801': { name: 'L21:N0 V:ECN000266490', qty: 126 },
  'RA5724801': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724802': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724803': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724804': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724805': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724806': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724807': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724808': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724809': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724810': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724811': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724821': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA5724830': { name: 'L24:RXT2 V:L8663', qty: 288 },
  'RA9202802': { name: 'L24:RXT2 V:L8663', qty: 1000 },
  'RA5658801': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658802': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658803': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658805': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658804': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658806': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658815': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA5658854': { name: 'L31:RXT4 V:L7513', qty: 280 },
  'RA6000805': { name: 'L09:Com XT2 V:L9084', qty: 96 },
  'RA6110805': { name: 'L26:Com XT4 V:L9084', qty: 78 },
  'RB9450801': { name: 'L35:C.ST7 V:ECN000153381', qty: 144 },
  'RB9450801_2': { name: 'L35:C.ST7 US V:ECN000153381', qty: 192 },
  'RB9450801_3': { name: 'L35:C.ST7 C V:ECN000153381', qty: 6 },
  'RA2473801': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473802': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473803': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473804': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473805': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473806': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473807': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473808': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473811': { name: 'L17:RT4 V:B1772', qty: 50 },
  'RA2473816': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473817': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473818': { name: 'L17:RT4 V:B1772', qty: 50 },
  'RA2473819': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473821': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473822': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473823': { name: 'L17:RT4 V:B1772', qty: 50 },
  'RA2473824': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2473825': { name: 'L17:RT4 V:B1772', qty: 100 },
  'RA2495801': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA2495803': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA2495805': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA2495806': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA2495807': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA2495808': { name: 'L18:RT5 V:L2314', qty: 100 },
  'RA9893802': { name: 'L14:CDXT1 V:L8985', qty: 224 },
  'RA7465802': { name: 'L23:CDT7 V:L5878', qty: 32 },
  'RA7465804': { name: 'L23:CDT7 V:L5878', qty: 32 },
  'RA7465203': { name: 'L23:CDT7 V:L5878', qty: 32 },
  'RN0505803': { name: 'L22:CBT3 V:', qty: 210 },
  'RN0505810': { name: 'L22:CBT3 V:', qty: 270 },
  'RA5587801': { name: 'L22:CBT3 V:L3740', qty: 270 },
  'RA5587802': { name: 'L22:CBT3 V:L3740', qty: 210 },
  'RA5587804': { name: 'L22:CBT3 V:L3740', qty: 270 },
  'RA5587808': { name: 'L22:CBT3 V:L3740', qty: 270 },
  'RA5587809': { name: 'L22:CBT3 V:L3740', qty: 210 },
  'RA5590803': { name: 'L22:CBT3 V:L3740', qty: 297 },
  'RA5587810': { name: 'L22:CBT3 V:L3740', qty: 270 },
  'RA5587811': { name: 'L22:CBT3 V:L3740', qty: 210 },
  'RA0470804': { name: 'L22:CBT3', qty: 60 },
  'RA5603801': { name: 'L22:CBT3 V:ECN000315767', qty: 300 },
  'RA4119801': { name: 'L22:CBT3 V:ECN000315767', qty: 500 },
  'RA5246801': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246802': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246803': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246804': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246805': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246806': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246807': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246811': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246814': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246815': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246822': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246823': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246827': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5246828': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA9341801': { name: 'L04:RXT1 V:L1639', qty: 2000 },
  'RA5398815': { name: 'L29:CBXT2 V:L1489', qty: 300 },
  'RA5398816': { name: 'L29:CBXT2 V:L1489', qty: 225 },
  'RA5398817': { name: 'L29:CBXT2 V:L1489', qty: 300 },
  'RA5398818': { name: 'L29:CBXT2 V:L1489', qty: 225 },
  'RC0618813': { name: 'L29:CBXT2 V:L1489', qty: 264 },
  'RC0618811': { name: 'L29:CBXT2 V:L1489', qty: 264 },
  'RA5414801': { name: 'L29:CBXT2 V:L1489', qty: 216 },
  'RA6063811': { name: 'L32:CBXT4 V:L1489', qty: 210 },
  'RA6063812': { name: 'L32:CBXT4 V:L1489', qty: 175 },
  'RC0628816': { name: 'L32:CBXT4 V:L1489', qty: 210 },
  'RA6063814': { name: 'L32:CBXT4 V:L1489', qty: 175 },
  'RA6063813': { name: 'L32:CBXT4 V:L1489', qty: 210 },
  'RA9969803': { name: 'L32:CBXT4 V:L1489', qty: 210 },
  'RA9969804': { name: 'L32:CBXT4 V:L1490', qty: 210 },
  'RA9969805': { name: 'L32:CBXT4 V:L1490', qty: 210 },
  'RA5510801': { name: 'L32:CD CBXT4', qty: 189 },
  '1SDR003508A1801': { name: 'L38:CDST7 V:ECN000115029', qty: 8 },
  'RB1250804': { name: 'L38:CDST7 V:B1382', qty: 30 },
  '1SDR002907A1801': { name: 'L36:GTXT5 V:ECN000145980', qty: 100 },
  '1SDR002907A1802': { name: 'L36:GTXT5 V:ECN000145980', qty: 100 },
  '1SDR002907A1803': { name: 'L36:GTXT5 V:ECN000145980', qty: 100 },
  '1SDR002883A1801': { name: 'L36:GTXT5 V:ECN000159709', qty: 100 },
  '1SDR002976A1801': { name: 'L36:GTXT5 V:ECN000145980', qty: 100 },
  '1SDN000070A1801': { name: 'L36:GTXT5 V:ECN000323838', qty: 216 },
  '1SDN000070A1803': { name: 'L36:GTXT5 V:ECN000323838', qty: 216 },
  '1SDN000070A1804': { name: 'L36:GTXT5 V:ECN000323838', qty: 216 },
  '1SDN000224A1801': { name: 'L36:GTXT5 V:ECN000339598', qty: 216 },
  '1SDN000223A1801': { name: 'L36:GTXT5 V:ECN000339598', qty: 216 },
  '1SDN000071A1801': { name: 'L37:GTXT6 V:ECN000323838', qty: 159 },
  '1SDN000071A1806': { name: 'L37:GTXT6 V:ECN000212968', qty: 159 },
  '1SDR000351A1809': { name: 'L33:C.XT5 V:ECN000176774', qty: 12 },
  '1SDR007454A1801': { name: 'L33:C.XT5 V:ECN000176774', qty: 9 },
  '1SDR001096A1804': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDN000144A1801': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDR001096A1805': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDR001095A1807': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDR001095A1808': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDR000352A1804': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDN000149A1801': { name: 'L34:P.XT5 V:ECN000122790', qty: 480 },
  '1SDR000318A1805': { name: 'L39:AC XT5 V:ECN000116905', qty: 150 },
  '1SDR002127A1801': { name: 'L39:AC XT5 V:ECN000116905', qty: 250 },
  '1SDR001076A1806': { name: 'L39:AC XT5 V:ECN000147594', qty: 100 },
  '1SDR001077A1805': { name: 'L39:AC XT5 V:ECN000147594', qty: 150 },
  '1SDR001076A1805': { name: 'L39:AC XT5 V:ECN000147594', qty: 100 },
  '1SDR001077A1804': { name: 'L39:AC XT5 V:ECN000147594', qty: 150 },
  '1SDR001086A1806': { name: 'L39:AC XT5 V:ECN000147594', qty: 100 },
  '1SDR001086A1807': { name: 'L39:AC XT5 V:ECN000147594', qty: 100 },
  '1SDR001087A1805': { name: 'L39:AC XT5 V:ECN000147594', qty: 150 },
  '1SDR001087A1806': { name: 'L39:AC XT5 V:ECN000147594', qty: 150 },
  'RB9838801': { name: 'L39:AC GBXT2', qty: 500 },
  'RB9846801': { name: 'L39:AC GBXT4', qty: 500 },
  'RB5605802': { name: 'L30:GR.SG V:ECN000093020', qty: 30 },
  'RN0632801': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0632802': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0632803': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0632805': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0632806': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0632807': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0633801': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633802': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633803': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633804': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0633805': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0633806': { name: 'L15:Module T5/A3', qty: 144 },
  'RN0633807': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633808': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633807_2': { name: 'L15:Module T5/A3', qty: 192 },
  'RN0633808_2': { name: 'L15:Module T5/A3', qty: 192 },
  'RA5263801': { name: 'L42:RELE A1', qty: 200 },
  'RA5263802': { name: 'L42:RELE A1', qty: 200 },
  'RA5263803': { name: 'L42:RELE A1', qty: 200 },
  'RA5263804': { name: 'L42:RELE A1', qty: 200 },
  'RA5263805': { name: 'L42:RELE A1', qty: 200 },
  'RA5263806': { name: 'L42:RELE A1', qty: 200 },
  'RA5263807': { name: 'L42:RELE A1', qty: 200 },
  'RA5263808': { name: 'L42:RELE A1', qty: 200 },
  'RA5263809': { name: 'L42:RELE A1', qty: 200 },
  'RA5263810': { name: 'L42:RELE A1', qty: 200 },
  'RA5263811': { name: 'L42:RELE A1', qty: 200 },
  'RA5263812': { name: 'L42:RELE A1', qty: 200 },
  'RA5263813': { name: 'L42:RELE A1', qty: 200 },
  'RA5263814': { name: 'L42:RELE A1', qty: 200 },
  'RA5263815': { name: 'L42:RELE A1', qty: 200 },
  'RA5263816': { name: 'L42:RELE A1', qty: 200 },
  'RA5263817': { name: 'L42:RELE A1', qty: 200 },
  'RA5263818': { name: 'L42:RELE A1', qty: 200 },
  'RA5263819': { name: 'L42:RELE A1', qty: 200 },
  'RA5263820': { name: 'L42:RELE A1', qty: 200 },
  'RA5263821': { name: 'L42:RELE A1', qty: 200 },
  'RA5263822': { name: 'L42:RELE A1', qty: 200 },
  'RA5263823': { name: 'L42:RELE A1', qty: 200 },
  'RA5263824': { name: 'L42:RELE A1', qty: 200 },
  'RA5263825': { name: 'L42:RELE A1', qty: 200 },
  'RA5263852': { name: 'L42:RELE A1', qty: 200 },
  'RA5263853': { name: 'L42:RELE A1', qty: 200 },
  'RA5263854': { name: 'L42:RELE A1', qty: 200 },
  'RA5263855': { name: 'L42:RELE A1', qty: 200 },
  '1SDN000280A1801': { name: 'L33:C.XT5 V:ECN000176774', qty: 12 },
  'RA5246824': { name: 'L04:RXT1 V:L1639', qty: 200 },
  'RA5595804': { name: 'L22:GBXT3', qty: 200 },
  'RB1180805_2': { name: 'L21:N0 V:ECN000266490', qty: 144 }
};

// ─── Méthode utilitaire pour lookup ──────────────────────────────────────────
function getRefInfo(reference: string): { name: string; qty: number } {
  const ref = reference.trim();
  return REFERENCE_DATABASE[ref] || { name: reference, qty: 100 };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-planification1',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planification1.component.html',
  styleUrls: ['./planification1.component.css']
})
export class Planification1Component implements OnInit {

  // ── État général ──
  selectedSemaine: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // ── Données semaines ──
  availableWeeks: WeekInfo[] = [];

  // ── Cartes lignes ──
  availableLines: ProductionLine[] = [];
  selectedLigneForView: ProductionLine | null = null;
  searchLineQuery: string = '';

  // ── Tableau ──
  lignesData: LigneData[] = [];
  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ── Inline editing C ──
  editingKey: string | null = null;
  editCValue: number | null = null;
  savingKey: string | null = null;

  // ── Inline editing OF ──
  editingOfKey: string | null = null;
  editOfValue: string = '';
  savingOfKey: string | null = null;

  // ── Ligne active (mise en surbrillance) ──
  activeRowRef: string | null = null;

  // ── Inline editing NOTE ──
  editingNoteKey: string | null = null;
  editNoteValue: string = '';
  savingNoteKey: string | null = null;

  // ✅ Matricule de l'opérateur connecté
  private operateurMatricule: string = '';

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    // ✅ AJOUT AuthService — adaptez le nom si différent dans votre projet
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // ✅ Récupérer le matricule de l'utilisateur connecté
    // Adaptez selon la structure de votre AuthService :
    // Option A : authService.currentUser?.matricule
    // Option B : authService.getUser()?.matricule
    // Option C : authService.user?.id
   const user = this.authService.getCurrentUser()
    this.operateurMatricule = user?.matricule || user?.username || user?.nom || 'N/A';

    this.loadAvailableWeeks();
    this.loadProductionLines();

    this.semaineService.getSemainesPublic().subscribe({
      next: () => {
        if (this.selectedSemaine) {
          setTimeout(() => this.checkMissingOfForAllLines(), 500);
        }
      }
    });
  }

  // ─── Chargement semaines ──────────────────────────────────────────────────

  private loadAvailableWeeks(): void {
    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        let semainesArray: any[] = [];
        if (response?.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        }

        const weeks: WeekInfo[] = semainesArray
          .map((s: any) => {
            const match = s.nom?.match(/semaine(\d+)/i);
            const num = match ? parseInt(match[1], 10) : 0;
            if (!num) return null;
            return {
              number: num,
              startDate: s.dateDebut ? new Date(s.dateDebut) : new Date(),
              endDate: s.dateFin ? new Date(s.dateFin) : new Date(),
              display: s.nom || `semaine${num}`,
              data: s
            } as WeekInfo;
          })
          .filter(Boolean) as WeekInfo[];

        weeks.sort((a, b) => b.number - a.number);
        this.availableWeeks = weeks;
        if (weeks.length > 0) {
          this.selectedSemaine = weeks[0].display;
        }
      },
      error: () => {
        this.availableWeeks = Array.from({ length: 52 }, (_, i) => ({
          number: i + 1,
          startDate: new Date(),
          endDate: new Date(),
          display: `semaine${i + 1}`,
          data: null
        }));
      }
    });
  }

  // ─── Chargement cartes lignes ─────────────────────────────────────────────

  private loadProductionLines(): void {
    this.productService.getAllLines().subscribe({
      next: (response) => {
        const lines: ProductionLine[] = (response?.lines || []).map((l: ProductLine) => ({
          ligne: l.ligne,
          referenceCount: l.referenceCount || l.references?.length || 0,
          imageUrl: l.imageUrl
            ? this.productService.getImageUrl(l.imageUrl)
            : this.getDefaultImageUrl(l.ligne),
          references: l.references || [],
          isActive: true,
          hasMissingOf: false,
          missingOfCount: 0,
          missingOfRefs: []
        }));

        this.availableLines = lines.sort(
          (a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne)
        );

        this.checkMissingOfForAllLines();
      },
      error: () => {}
    });
  }

  checkMissingOfForAllLines(): void {
    if (!this.selectedSemaine) return;
    this.availableLines.forEach(line => {
      this.checkMissingOfForLine(line.ligne);
    });
  }

  checkMissingOfForLine(ligneName: string): void {
    this.semaineService.getPlanificationsForWeek(this.selectedSemaine).subscribe({
      next: (planifResponse) => {
        const planifications: any[] = planifResponse?.planifications || [];
        const linePlanifs = planifications.filter(p => p.ligne === ligneName);
        const refMap = new Map<string, { hasC: boolean, hasOf: boolean }>();

        linePlanifs.forEach(p => {
          const key = p.reference;
          if (!refMap.has(key)) refMap.set(key, { hasC: false, hasOf: false });
          const current = refMap.get(key)!;
          if (p.qtePlanifiee && p.qtePlanifiee > 0) current.hasC = true;
          if (p.of && p.of.trim() !== '') current.hasOf = true;
          refMap.set(key, current);
        });

        const missingRefs: string[] = [];
        refMap.forEach((value, ref) => {
          if (value.hasC && !value.hasOf) missingRefs.push(ref);
        });

        const lineIndex = this.availableLines.findIndex(l => l.ligne === ligneName);
        if (lineIndex !== -1) {
          this.availableLines[lineIndex].hasMissingOf = missingRefs.length > 0;
          this.availableLines[lineIndex].missingOfCount = missingRefs.length;
          this.availableLines[lineIndex].missingOfRefs = missingRefs;
          this.missingOfStatus.set(ligneName, { count: missingRefs.length, references: missingRefs });
        }
      },
      error: () => {}
    });
  }

  private getDefaultImageUrl(ligne: string): string {
    const imageMap: { [key: string]: string } = {
      'L04:RXT1':   'assets/images/unnamed.jpg',
      'L07:COM A1': 'assets/images/unnamed (1).jpg',
      'L09:COMXT2': 'assets/images/unnamed (2).jpg',
      'L10:RS3':    'assets/images/unnamed (3).jpg',
      'L14:CD XT1': 'assets/images/unnamed (4).jpg',
      'L15:MTSA3':  'assets/images/unnamed (5).jpg'
    };
    return imageMap[ligne] || 'assets/images/default-line.jpg';
  }

  get filteredLines(): ProductionLine[] {
    if (!this.searchLineQuery.trim()) return this.availableLines;
    const q = this.searchLineQuery.toLowerCase();
    return this.availableLines.filter(l => l.ligne.toLowerCase().includes(q));
  }

  clearSearch(): void { this.searchLineQuery = ''; }

  // ─── Clic sur une carte ligne ─────────────────────────────────────────────

  onLineSelected(line: ProductionLine): void {
    this.selectedLigneForView = line;
    this.lignesData = [];
    this.errorMessage = '';
    this.editingKey = null;
    this.editingOfKey = null;
    if (this.selectedSemaine) this.loadDataForLigne(line.ligne);
  }

  // ─── Chargement planification ─────────────────────────────────────────────

  private loadDataForLigne(ligneName: string): void {
    this.isLoading = true;
    this.lignesData = [];
    this.editingKey = null;
    this.ofMissingWarnings.clear();

    this.productService.getAllLines().subscribe({
      next: (productResponse) => {
        const lines: ProductLine[] = (productResponse?.lines || [])
          .filter((l: ProductLine) => l.ligne === ligneName);

        this.semaineService.getPlanificationsForWeek(this.selectedSemaine).subscribe({
          next: (planifResponse) => {
            const planifications: any[] = planifResponse?.planifications || [];
            this.buildLignesData(lines, planifications);
            this.isLoading = false;
          },
          error: () => {
            this.buildLignesData(lines, []);
            this.isLoading = false;
          }
        });
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement';
        this.isLoading = false;
      }
    });
  }

  private buildLignesData(lines: ProductLine[], planifications: any[]): void {
    const planifIndex = new Map<string, any>();
    planifications.forEach(p => {
      const key = `${p.ligne}|${p.reference}|${p.jour?.toLowerCase()}`;
      planifIndex.set(key, p);
    });

    const ofByRef = new Map<string, string>();
    const noteByRef = new Map<string, string>();

    planifications.forEach(p => {
      if (p.of && p.of.trim() !== '' && !ofByRef.has(`${p.ligne}|${p.reference}`)) {
        ofByRef.set(`${p.ligne}|${p.reference}`, p.of);
      }
      const key = `${p.ligne}|${p.reference}`;
      if (p.note !== undefined && p.note !== null && p.note.trim() !== '') {
        if (!noteByRef.has(key) || noteByRef.get(key) === '') noteByRef.set(key, p.note);
      } else if (!noteByRef.has(key)) {
        noteByRef.set(key, '');
      }
    });

    const result: LigneData[] = lines
      .sort((a, b) => this.extractLineNumber(a.ligne) - this.extractLineNumber(b.ligne))
      .map(line => {
        const sortedRefs = this.sortReferencesByLast3(line.references || []);
        const refs: ReferenceRow[] = sortedRefs.map(reference => {
          const row: ReferenceRow = {
            reference,
            ligne: line.ligne,
            note: noteByRef.get(`${line.ligne}|${reference}`) || ''
          };
          this.weekDays.forEach(day => {
            const key = `${line.ligne}|${reference}|${day}`;
            const plan = planifIndex.get(key);
            const of = ofByRef.get(`${line.ligne}|${reference}`) || '';
            row[day] = {
              of: plan?.of || of,
              nbOperateurs: plan?.nbOperateurs || 0,
              c: plan?.qtePlanifiee || 0,
              m: plan?.qteModifiee || 0,
              dp: plan?.decProduction || 0,
              dm: plan?.decMagasin || 0,
              delta: plan?.pcsProd || 0
            };
          });
          return row;
        });
        return { ligne: line.ligne, references: refs };
      });

    this.lignesData = result;
  }

  private sortReferencesByLast3(refs: string[]): string[] {
    return [...refs].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '').slice(-3)) || 0;
      const numB = parseInt(b.replace(/\D/g, '').slice(-3)) || 0;
      return numA - numB;
    });
  }

  private extractLineNumber(ligne: string): number {
    const match = ligne.match(/^L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getDayEntry(ref: ReferenceRow, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

  getOfForRef(ref: ReferenceRow): string {
    for (const day of this.weekDays) {
      const e = ref[day] as DayEntry;
      if (e?.of) return e.of;
    }
    return '';
  }

  getTotalCForRef(ref: ReferenceRow): number {
    return this.weekDays.reduce((sum, day) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.c || 0);
    }, 0);
  }

  getTotalCForDay(ligneData: LigneData, day: string): number {
    return ligneData.references.reduce((sum, ref) => {
      const e = ref[day] as DayEntry;
      return sum + (e?.c || 0);
    }, 0);
  }

  getTotalCForLigne(ligneData: LigneData): number {
    return this.weekDays.reduce((sum, day) => sum + this.getTotalCForDay(ligneData, day), 0);
  }

  getFrenchDay(day: string): string {
    const map: { [k: string]: string } = {
      lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
      jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam'
    };
    return map[day] || day;
  }

  getWeeksList(): string[] {
    if (this.availableWeeks.length > 0) return this.availableWeeks.map(w => w.display);
    return Array.from({ length: 52 }, (_, i) => `semaine${i + 1}`);
  }

  // ─── Inline editing C ────────────────────────────────────────────────────

  cellKey(ref: ReferenceRow, day: string): string {
    return `${ref.reference}|${ref.ligne}|${day}`;
  }

  isEditing(ref: ReferenceRow, day: string): boolean {
    return this.editingKey === this.cellKey(ref, day);
  }

  startEdit(ref: ReferenceRow, day: string): void {
    this.editingOfKey = null;
    const entry = this.getDayEntry(ref, day);
    this.editingKey = this.cellKey(ref, day);
    this.editCValue = (entry?.c && entry.c > 0) ? entry.c : null;
    this.activeRowRef = ref.reference;
  }

  saveCell(ref: ReferenceRow, day: string): void {
    const key = this.cellKey(ref, day);
    if (this.editingKey !== key) return;
    const entry = this.getDayEntry(ref, day);
    if (!entry) { this.editingKey = null; return; }
    const newC = this.editCValue ?? 0;
    this.savingKey = key;
    this.editingKey = null;
    entry.c = newC;

    if (newC > 0 && (!entry.of || entry.of.trim() === '')) {
      this.ofMissingWarnings.add(this.ofRefKey(ref));
      this.showSuccess('⚠️ Quantité sauvegardée mais OF manquant !');
      setTimeout(() => this.scrollToOfCell(ref), 300);
    } else {
      this.ofMissingWarnings.delete(this.ofRefKey(ref));
    }

    const payload = this.semaineService.formatWeekForAPI({
      semaine: this.selectedSemaine, jour: day, ligne: ref.ligne, reference: ref.reference,
      nbOperateurs: entry.nbOperateurs, of: entry.of, qtePlanifiee: newC,
      qteModifiee: entry.m, decProduction: entry.dp, decMagasin: entry.dm
    });

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingKey = null;
        if (this.selectedLigneForView) this.checkMissingOfForLine(this.selectedLigneForView.ligne);
        this.checkMissingOfForAllLines();
        if (!this.ofMissingWarnings.has(this.ofRefKey(ref))) this.showSuccess('Sauvegardé ✓');
      },
      error: () => { this.errorMessage = 'Erreur lors de la sauvegarde'; this.savingKey = null; }
    });
  }

  getMissingOfInfo(line: ProductionLine): { count: number, references: string[] } {
    return this.missingOfStatus.get(line.ligne) || { count: 0, references: [] };
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editingOfKey = null;
    this.editingNoteKey = null;
    this.activeRowRef = null;
  }

  // ─── Inline editing OF ───────────────────────────────────────────────────

  ofRefKey(ref: ReferenceRow): string { return `${ref.reference}|${ref.ligne}`; }
  isEditingOf(ref: ReferenceRow): boolean { return this.editingOfKey === this.ofRefKey(ref); }

  startEditOf(ref: ReferenceRow): void {
    if (this.editingKey) this.editingKey = null;
    this.editingOfKey = this.ofRefKey(ref);
    this.editOfValue = this.getOfForRef(ref);
    this.activeRowRef = ref.reference;
  }

  saveOf(ref: ReferenceRow): void {
    if (this.editingOfKey !== this.ofRefKey(ref)) return;
    const newOf = (this.editOfValue || '').trim();
    this.savingOfKey = this.ofRefKey(ref);
    this.editingOfKey = null;
    this.weekDays.forEach(day => {
      const entry = ref[day] as DayEntry | undefined;
      if (entry) entry.of = newOf;
    });
    if (newOf !== '') this.ofMissingWarnings.delete(this.ofRefKey(ref));

    const dayToSave = this.weekDays.find(d => {
      const e = ref[d] as DayEntry | undefined;
      return e && e.c > 0;
    }) || 'lundi';

    const entry = ref[dayToSave] as DayEntry;
    const payload = this.semaineService.formatWeekForAPI({
      semaine: this.selectedSemaine, jour: dayToSave, ligne: ref.ligne, reference: ref.reference,
      nbOperateurs: entry?.nbOperateurs || 0, of: newOf, qtePlanifiee: entry?.c || 0,
      qteModifiee: entry?.m || 0, decProduction: entry?.dp || 0, decMagasin: entry?.dm || 0
    });

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingOfKey = null;
        this.showSuccess('OF sauvegardé ✓');
        if (this.selectedLigneForView) this.checkMissingOfForLine(this.selectedLigneForView.ligne);
        this.checkMissingOfForAllLines();
      },
      error: () => { this.errorMessage = 'Erreur lors de la sauvegarde de l\'OF'; this.savingOfKey = null; }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 2500);
  }

  // ─── Inline editing NOTE ─────────────────────────────────────────────────

  noteRefKey(ref: ReferenceRow): string { return `${ref.reference}|${ref.ligne}|note`; }
  isEditingNote(ref: ReferenceRow): boolean { return this.editingNoteKey === this.noteRefKey(ref); }

  startEditNote(ref: ReferenceRow): void {
    this.editingKey = null;
    this.editingOfKey = null;
    this.editingNoteKey = this.noteRefKey(ref);
    this.editNoteValue = ref.note || '';
    this.activeRowRef = ref.reference;
  }

  saveNote(ref: ReferenceRow): void {
    if (this.editingNoteKey !== this.noteRefKey(ref)) return;
    const newNote = (this.editNoteValue || '').trim();
    this.savingNoteKey = this.noteRefKey(ref);
    this.editingNoteKey = null;
    ref.note = newNote;

    let dayToSave = 'lundi';
    for (const day of this.weekDays) {
      const e = ref[day] as DayEntry | undefined;
      if (e && e.c > 0) { dayToSave = day; break; }
    }

    const entry = ref[dayToSave] as DayEntry;
    const payload = {
      semaine: this.selectedSemaine, jour: dayToSave, ligne: ref.ligne, reference: ref.reference,
      nbOperateurs: entry?.nbOperateurs || 0, of: entry?.of || '', qtePlanifiee: entry?.c || 0,
      qteModifiee: entry?.m || 0, decProduction: entry?.dp || 0, decMagasin: entry?.dm || 0,
      note: newNote
    };

    this.semaineService.updatePlanificationByCriteria(payload).subscribe({
      next: () => {
        this.savingNoteKey = null;
        this.showSuccess('Note sauvegardée ✓');
        if (this.selectedLigneForView && this.selectedSemaine) {
          setTimeout(() => this.loadDataForLigne(this.selectedLigneForView!.ligne), 500);
        }
      },
      error: () => { this.errorMessage = 'Erreur lors de la sauvegarde de la note'; this.savingNoteKey = null; }
    });
  }

  goBack(): void { this.router.navigate(['/prod']); }

  ofMissingError: string | null = null;

  scrollToOfCell(ref: ReferenceRow): void {
    setTimeout(() => {
      const ofCells = document.querySelectorAll('td.cursor-pointer');
      for (let i = 0; i < ofCells.length; i++) {
        const cell = ofCells[i];
        const parentRow = cell.closest('tr');
        if (parentRow) {
          const refCell = parentRow.querySelector('td:first-child');
          if (refCell && refCell.textContent?.trim() === ref.reference) {
            cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cell.classList.add('of-warning-blink');
            setTimeout(() => cell.classList.remove('of-warning-blink'), 2000);
            break;
          }
        }
      }
    }, 100);
  }

  clearOfMissingError(): void { this.ofMissingError = null; }

  ofMissingWarnings: Set<string> = new Set();
  hasOfWarning(ref: ReferenceRow): boolean { return this.ofMissingWarnings.has(this.ofRefKey(ref)); }
  clearOfWarning(ref: ReferenceRow): void { this.ofMissingWarnings.delete(this.ofRefKey(ref)); }

  backToLines(): void {
    this.selectedLigneForView = null;
    this.lignesData = [];
    this.ofMissingWarnings.clear();
    if (this.selectedSemaine) this.checkMissingOfForAllLines();
    this.errorMessage = '';
    this.editingKey = null;
    this.editingOfKey = null;
  }

  onSemaineChange(): void {
    this.errorMessage = '';
    this.lignesData = [];
    this.editingKey = null;
    this.ofMissingWarnings.clear();
    this.missingOfStatus.clear();
    this.checkMissingOfForAllLines();
    if (this.selectedLigneForView && this.selectedSemaine) {
      this.loadDataForLigne(this.selectedLigneForView.ligne);
    }
  }

  getMissingOfCount(): number { return this.ofMissingWarnings.size; }
  clearAllOfWarnings(): void { this.ofMissingWarnings.clear(); this.showSuccess('Alertes effacées'); }

  missingOfStatus: Map<string, { count: number, references: string[] }> = new Map();
  getTotalLinesWithMissingOf(): number { return this.availableLines.filter(line => line.hasMissingOf).length; }
  getLinesWithMissingOf(): ProductionLine[] { return this.availableLines.filter(line => line.hasMissingOf); }
  clearAllLineAlerts(): void { this.showSuccess('Cliquez sur les lignes avec le badge rouge pour compléter les OF manquants'); }

  // ─── IMPRESSION TICKETS ──────────────────────────────────────────────────

  showPrintModal: boolean = false;
  printSelectedDay: string = 'lundi';
  printLigneData: LigneData | null = null;
  printRefRows: PrintRefRow[] = [];

  showCounterPanel: boolean = false;
  currentCounterValue: number = 10000;
  counterEditValue: number = 10000;
  printHistory: PrintHistory[] = [];

  private readonly COUNTER_KEY = 'prodseraf_ticket_counter';
  private readonly HISTORY_KEY = 'prodseraf_print_history';

  initPrintState(): void {
    const stored = localStorage.getItem(this.COUNTER_KEY);
    this.currentCounterValue = stored ? parseInt(stored, 10) : 10000;
    this.counterEditValue = this.currentCounterValue;
    const hist = localStorage.getItem(this.HISTORY_KEY);
    this.printHistory = hist ? JSON.parse(hist) : [];
  }

  private getNextCounter(): number {
    const next = this.currentCounterValue + 1;
    this.currentCounterValue = next;
    localStorage.setItem(this.COUNTER_KEY, next.toString());
    return next;
  }

  updateCounter(): void {
    if (this.counterEditValue < 0) return;
    this.currentCounterValue = this.counterEditValue;
    localStorage.setItem(this.COUNTER_KEY, this.currentCounterValue.toString());
    this.showSuccess(`Compteur N.ETQ mis à jour : ${this.currentCounterValue}`);
  }

  resetCounter(): void {
    const confirmed = confirm(`⚠️ Remettre le compteur N.ETQ à 0 ?\n\nValeur actuelle : ${this.currentCounterValue}\n\nCette action est irréversible. Confirmer ?`);
    if (!confirmed) return;
    this.currentCounterValue = 0;
    this.counterEditValue = 0;
    localStorage.setItem(this.COUNTER_KEY, '0');
    this.showSuccess('Compteur N.ETQ remis à 0');
  }

  private saveHistory(nbTickets: number, nEtqFrom: number, nEtqTo: number): void {
    const today = new Date();
    const entry: PrintHistory = {
      day: this.printSelectedDay, ligne: this.printLigneData?.ligne || '',
      semaine: this.selectedSemaine,
      date: `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`,
      time: `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`,
      nbTickets, nEtqFrom, nEtqTo
    };
    this.printHistory.unshift(entry);
    if (this.printHistory.length > 100) this.printHistory = this.printHistory.slice(0, 100);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.printHistory));
  }

  isDayPrinted(day: string): boolean {
    if (!this.printLigneData) return false;
    return this.printHistory.some(
      h => h.day === day && h.ligne === this.printLigneData!.ligne && h.semaine === this.selectedSemaine
    );
  }

  getHistoryForDay(day: string): PrintHistory[] {
    if (!this.printLigneData) return [];
    return this.printHistory.filter(
      h => h.day === day && h.ligne === this.printLigneData!.ligne && h.semaine === this.selectedSemaine
    );
  }

  openPrintModal(ligneData: LigneData): void {
    this.initPrintState();
    this.printLigneData = ligneData;
    this.printSelectedDay = 'lundi';
    this.buildPrintRefRows();
    this.showPrintModal = true;
  }

  closePrintModal(): void {
    this.showPrintModal = false;
    this.printRefRows = [];
  }

  onPrintDayChange(day: string): void {
    this.printSelectedDay = day;
    this.buildPrintRefRows();
  }

  // ✅ MODIFIÉ : buildPrintRefRows utilise maintenant REFERENCE_DATABASE pour la QTY par défaut
  buildPrintRefRows(): void {
    if (!this.printLigneData) { this.printRefRows = []; return; }
    this.printRefRows = this.printLigneData.references
      .map(ref => {
        const entry = ref[this.printSelectedDay] as DayEntry | undefined;
        const qty = entry?.c || 0;
        // ✅ Récupérer la quantité par défaut depuis la base Excel
        const refInfo = getRefInfo(ref.reference);
        const defaultQty = refInfo.qty;
        return {
          reference: ref.reference,
          of: entry?.of || this.getOfForRef(ref),
          qteJour: qty,
          // ✅ Utiliser la QTY de l'Excel comme valeur par défaut (si <= qteJour)
          qtyParTicket: qty > 0 ? Math.min(defaultQty, qty) : 0
        } as PrintRefRow;
      })
      .filter(r => r.qteJour > 0);
  }

  getNbTicketsForRow(row: PrintRefRow): number {
    if (!row.qtyParTicket || row.qtyParTicket <= 0) return 0;
    return Math.ceil(row.qteJour / row.qtyParTicket);
  }

  getTotalTicketsFromRows(): number {
    return this.printRefRows.reduce((sum, r) => sum + this.getNbTicketsForRow(r), 0);
  }

  generateAndPrint(): void {
    if (!this.printLigneData || this.printRefRows.length === 0) return;

    const today = new Date();
    // Calculer la date du jour sélectionné selon la semaine
const dayOffsets: { [key: string]: number } = {
  lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5
};
const weekMatch = this.selectedSemaine.match(/semaine(\d+)/i);
const weekNum = weekMatch ? parseInt(weekMatch[1], 10) : null;

let dateFab = today.toISOString().split('T')[0]; // fallback

// NOUVEAU CODE (correct)
if (weekNum !== null) {
  // Trouver le jeudi de la semaine ISO weekNum
  // Formule fiable : Jan 4 est toujours dans la semaine 1
  const year = today.getFullYear();
  const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const dow = simple.getDay(); // 0=dim, 1=lun...
  const isoMonday = new Date(simple);
  isoMonday.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));

  const offset = dayOffsets[this.printSelectedDay] ?? 0;
  const targetDate = new Date(isoMonday);
  targetDate.setDate(isoMonday.getDate() + offset);

  // Forcer timezone locale pour éviter le décalage UTC
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  dateFab = `${y}-${m}-${d}`;
}
    const dateImp = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
    const timeImp = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}:${String(today.getSeconds()).padStart(2,'0')}`;
    const ligneName = this.printLigneData.ligne;

    const tickets: TicketData[] = [];
    const nEtqFrom = this.currentCounterValue + 1;

    for (const row of this.printRefRows) {
      if (!row.qtyParTicket || row.qtyParTicket <= 0) continue;
      const nb = Math.ceil(row.qteJour / row.qtyParTicket);
      // ✅ Récupérer le nom de la référence depuis la base Excel
      const refInfo = getRefInfo(row.reference);

      for (let i = 0; i < nb; i++) {
        const isLast = i === nb - 1;
        const qty = isLast ? row.qteJour - i * row.qtyParTicket : row.qtyParTicket;
        const counter = this.getNextCounter();
        tickets.push({
          reference: row.reference,
          ligne: row.of,
          qty,
          dateFab,
          dateImp,
          timeImp,
          order: row.of,
          nEtq: counter,
          qrContent: `${row.reference}/${qty}/${counter}`,
          lineName: ligneName,
          ticketIndex: i + 1,
          totalTickets: nb,
          // ✅ NOUVEAUX CHAMPS
          refName: refInfo.name,                        // Nom depuis Excel (ex: L04:RXT1 V:L1639)
          operateur: this.operateurMatricule             // Matricule opérateur connecté
        });
      }
    }

    if (tickets.length === 0) return;

    const nEtqTo = this.currentCounterValue;
    this.saveHistory(tickets.length, nEtqFrom, nEtqTo);
    this.openPrintWindow(tickets);
    this.closePrintModal();
  }

  // ✅ MODIFIÉ v3 : Matricule dans header, format exact 104×90mm TSC TE210, flex-grow pour remplir l'espace
  private openPrintWindow(tickets: TicketData[]): void {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Veuillez autoriser les popups pour imprimer.'); return; }

    const ticketsHtml = tickets.map(t => {
      // QR 110×110 pour remplir mieux l'espace disponible
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(t.qrContent)}`;
      return `
        <div class="ticket">

          <!-- ══ HEADER : IDENTIFICATION SHEET + MATRICULE à droite ══ -->
          <div class="t-header">
            <span class="t-header-title">IDENTIFICATION SHEET</span>
            <span class="t-header-op">${t.operateur}</span>
          </div>

          <!-- ══ PART.N + QTY ══ -->
          <div class="t-row" style="flex:0 0 auto;">
            <div class="t-cell" style="flex:1; border-right:1.5px solid #000;">
              <div class="t-label">PART.N:</div>
              <div class="t-partno">${t.reference}</div>
            </div>
            <div class="t-cell" style="flex:0 0 32%;">
              <div class="t-label">QTY:</div>
              <div class="t-big">${t.qty}</div>
            </div>
          </div>

          <!-- ══ LOG + QUALITY — flex-grow pour occuper l'espace disponible ══ -->
          <div class="t-row" style="flex:1 1 auto;">
            <div class="t-cell" style="flex:1; border-right:1px solid #000;">
              <div class="t-label">LOG</div>
            </div>
            <div class="t-cell" style="flex:1;">
              <div class="t-label">QUALITY</div>
            </div>
          </div>

          <!-- ══ D.FAB ══ -->
          <div class="t-row" style="flex:0 0 auto;">
            <div class="t-cell" style="flex:1;">
              <div class="t-label">D.FAB:</div>
              <div class="t-med">${t.dateFab}</div>
            </div>
          </div>

          <!-- ══ ORDER + OP | D.IMP + N.ETQ | QR CODE ══ -->
          <div class="t-row" style="flex:0 0 auto; min-height:68px;">

            <!-- ORDER + OP -->
            <div style="flex:0 0 28%; border-right:1px solid #000; display:flex; flex-direction:column;">
              <div style="padding:3px 5px; border-bottom:1px solid #000; flex:1; display:flex; flex-direction:column; justify-content:center;">
                <div class="t-label">ORDER</div>
                <div class="t-big" style="font-size:16pt;">${t.order || '—'}</div>
              </div>
              <!-- OP : agrandi, affiché sous ORDER -->
              <div style="padding:4px 5px; display:flex; flex-direction:column; justify-content:center; min-height:26px;">
                <div class="t-label">OP:</div>
              </div>
            </div>

            <!-- D.IMP + N.ETQ -->
            <div style="flex:1; display:flex; flex-direction:column; border-right:1px solid #000; padding:4px 6px; justify-content:center;">
              <div class="t-label">D.IMP:</div>
              <div class="t-small">${t.dateImp}</div>
              <div class="t-small">${t.timeImp}</div>
              <div class="t-small" style="font-weight:900; margin-top:2px;">N.ETQ: ${t.nEtq}</div>
            </div>

            <!-- QR CODE — agrandi pour remplir la cellule -->
           <div style="flex:0 0 90px; display:flex; align-items:center; justify-content:center; padding:3px;">
  <img src="${qrUrl}" width="84" height="84" alt="${t.qrContent}"
       style="display:block; max-width:100%; max-height:100%; transform:translateX(-18px);"/>
</div>

          </div>

          <!-- ══ FOOTER : NOM DEPUIS EXCEL ══ -->
          <div class="t-footer">${t.refName}</div>

        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="UTF-8"/>
  <title>Tickets — ${this.printLigneData?.ligne} — ${this.getFrenchDayFull(this.printSelectedDay)}</title>
  <style>
    /* ── Reset ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Corps : pas de marges, fond blanc ── */
    body {
      font-family: 'Courier New', monospace;
      background: #fff;
      margin: 0;
      padding: 0;
    }

    /* ══════════════════════════════════════════════
       TICKET : exactement 104mm × 90mm (TSC TE210)
       Orientation : Portrait
       ══════════════════════════════════════════════ */
    .ticket {
      width: 100mm;
      height: 90mm;
      border: 1.5px solid #000;
      margin: 0 auto;
      page-break-after: always;
      background: #fff;
      overflow: hidden;
      /* Flex colonne pour distribuer l'espace verticalement */
      display: flex;
      flex-direction: column;
    }
    .ticket:last-child { page-break-after: avoid; }

    /* ══ HEADER : fond noir, titre centré + matricule à droite ══ */
    .t-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px 3px 8px;
      border-bottom: 2px solid #000;
      background: #000 !important;
      color: #fff !important;
      flex-shrink: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .t-header-title {
      font-weight: 900;
      font-size: 10pt;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #fff;
      flex: 1;
      text-align: center;
    }
    /* ✅ Matricule dans le header : petite taille, blanc, à droite */
    .t-header-op {
      font-size: 7pt;
      font-weight: 700;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.5px;
      white-space: nowrap;
      margin-left: 8px;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    /* ══ Lignes du tableau ══ */
    .t-row {
      display: flex;
      border-bottom: 1.5px solid #000;
    }
    .t-row:last-of-type { border-bottom: none; }

    .t-cell { padding: 2px 5px; }

    /* ══ Typographie ══ */
    .t-label  { font-size: 6.5pt; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 0.8px; line-height: 1.3; }
    .t-partno { font-size: 22pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1.15; }
    .t-big    { font-size: 20pt; font-weight: 900; line-height: 1.05; }
    .t-med    { font-size: 12pt; font-weight: 700; line-height: 1.2; }
    .t-small  { font-size: 7.5pt; font-weight: 600; line-height: 1.45; }
    /* ✅ Zone OP agrandie sous ORDER */
    .t-op     { font-size: 10pt; font-weight: 900; color: #000; letter-spacing: 0.5px; line-height: 1.2; }

    /* ══ FOOTER : fond noir, nom depuis Excel ══ */
    .t-footer {
      background: #000 !important;
      color: #fff !important;
      padding: 4px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-top: 2px solid #000;
      flex-shrink: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ══ IMPRESSION ══ */
    @media print {
      /* Format exact TSC TE210 : 104mm × 90mm, portrait, 0 marge */
      @page {
        size: 104mm 90mm;
        margin: 0mm;
      }
      html, body { margin: 0 !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .ticket {
        width: 104mm !important;
        height: 90mm !important;
        border: none !important;
        margin: 0 !important;
        page-break-after: always;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head><body>

  <!-- Barre d'info écran (cachée à l'impression) -->
  <div class="no-print" style="padding:10px 16px; background:#1e3a8a; color:#fff;
       font-family:sans-serif; font-size:13px; display:flex; align-items:center;
       gap:10px; flex-wrap:wrap; margin-bottom:8px;">
    <span style="font-weight:700;">${tickets.length} ticket(s)</span>
    <span style="opacity:0.6;">·</span>
    <span>${this.printLigneData?.ligne}</span>
    <span style="opacity:0.6;">·</span>
    <span>${this.getFrenchDayFull(this.printSelectedDay)}</span>
    <span style="opacity:0.6;">·</span>
    <span>N.ETQ ${tickets[0].nEtq} → ${tickets[tickets.length - 1].nEtq}</span>
    <span style="opacity:0.6;">·</span>
    <span style="font-weight:700;">OP: ${this.operateurMatricule}</span>
    <div style="margin-left:auto; display:flex; gap:8px;">
      <button onclick="window.print()"
        style="background:#16a34a;color:#fff;border:none;padding:7px 18px;
               border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;">
        🖨️ Imprimer
      </button>
      <button onclick="window.close()"
        style="background:#4b5563;color:#fff;border:none;padding:7px 14px;
               border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;">
        ✕ Fermer
      </button>
    </div>
  </div>

  ${ticketsHtml}

</body></html>`);
    win.document.close();
  }

  getRefsWithQty(ligneData: LigneData, day: string): { ref: ReferenceRow, qty: number }[] {
    return ligneData.references
      .map(ref => ({ ref, qty: (ref[day] as DayEntry)?.c || 0 }))
      .filter(r => r.qty > 0);
  }

  getFrenchDayFull(day: string): string {
    const map: { [k: string]: string } = {
      lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
      jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi'
    };
    return map[day] || day;
  }
}