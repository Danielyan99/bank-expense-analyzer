/**
 * A synthetic three-month checking-account export, so nobody has to upload real bank data
 * to try the demo. It is deterministic (seeded), shaped like a real export (account preamble,
 * MM/DD/YYYY dates, noisy POS descriptions, a running balance), and it deliberately includes
 * merchants the rules cannot know, so the AI step has real work to do.
 */

const START = Date.UTC(2026, 5, 1); // 1 June 2026
const DAYS = 92; // June, July, August

interface Row {
  day: number;
  description: string;
  amount: number;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSampleRows(seed = 20260601): Row[] {
  const rand = mulberry32(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const price = (min: number, max: number) => -Math.round((min + rand() * (max - min)) * 100) / 100;
  const store = () => String(1000 + Math.floor(rand() * 8999));
  const rows: Row[] = [];
  const add = (day: number, description: string, amount: number) => {
    if (day >= 0 && day < DAYS) rows.push({ day, description, amount });
  };

  // Monthly fixed items. Month starts are day 0, 30 and 61.
  for (const m of [0, 30, 61]) {
    add(m + 0, 'GREENLEAF PROPERTY MGMT RENT', -2150);
    add(m + 14, 'ACME ANALYTICS INC PAYROLL DIRECT DEP', 3420.55);
    add(m + 28, 'ACME ANALYTICS INC PAYROLL DIRECT DEP', 3420.55);
    add(m + 2, 'CON EDISON ONLINE PMT', price(78, 124));
    add(m + 4, 'VERIZON WIRELESS AUTOPAY', -85);
    add(m + 5, 'NETFLIX.COM', -15.49);
    add(m + 7, 'SPOTIFY USA', -11.99);
    add(m + 9, 'PLANET FITNESS CLUB FEES', -24.99);
    add(m + 11, 'APPLE.COM/BILL ICLOUD 200GB', -2.99);
    add(m + 12, 'HEADWAY APP 22019', -12.99); // unknown merchant, caught by the recurring-charge signal
    add(m + 15, 'TRANSFER TO SAVINGS ACCT XXXX7710', -500);
    add(m + 18, 'GEICO AUTO INSURANCE', -132.4);
    add(m + 20, 'NORDVPN* SUBSCRIPTION', -12.99);
    if (m !== 30) add(m + 21, 'CHEWY.COM AUTOSHIP', price(41, 44)); // unknown: pet supplies
  }

  // Weekly and frequent spending.
  for (let day = 0; day < DAYS; day++) {
    const weekday = (day + 1) % 7; // 1 June 2026 is a Monday
    if (weekday === 6) add(day, pick(['TRADER JOE S #552 QPS', 'WHOLE FOODS MKT #10281']), price(58, 142));
    if (weekday === 3 && rand() < 0.6) add(day, `POS ${store()} SAFEWAY #${store()}`, price(18, 64));
    if (weekday >= 1 && weekday <= 5 && rand() < 0.55) {
      add(day, pick([`STARBUCKS STORE ${store()}`, 'BLUE BOTTLE COFFEE', `SQ *OAK & ASH COFFEE`]), price(4.5, 7.8));
    }
    if (weekday >= 1 && weekday <= 5 && rand() < 0.3) {
      add(day, pick(['SWEETGREEN SOHO', 'CHIPOTLE 2291', 'PRET A MANGER NY', 'SQ *SAKURA GARDEN']), price(11, 19));
    }
    if (rand() < 0.22) add(day, pick(['UBER *TRIP HELP.UBER.COM', 'LYFT *RIDE SUN 8PM']), price(9, 34));
    if (rand() < 0.1) add(day, pick(['DOORDASH*THAI VILLA', 'UBER EATS PENDING']), price(22, 48));
    if (rand() < 0.12) add(day, pick(['AMAZON.COM*2K4LP0', 'AMZN MKTP US*7Y1RT', 'TARGET 00012345']), price(12, 96));
    if (rand() < 0.05) add(day, 'SHELL OIL 57442', price(38, 61));
    if (rand() < 0.04) add(day, pick(['CVS/PHARMACY #0421', 'WALGREENS #7719']), price(8, 36));
  }

  // One-off and irregular items, many of them outside any rule list.
  add(3, 'TST* EL FAROLITO', -23.75);
  add(6, 'SP * NORTHWIND APOTHECARY', -38.2);
  add(8, 'DR PRIYA PATEL DDS', -180);
  add(10, 'MAPLE & MOSS', -64);
  add(13, 'ATM WITHDRAWAL 0042 BROADWAY', -100);
  add(16, 'HOLLOWAY BARBERS', -35);
  add(19, 'STRIPE PAYOUT ACH CREDIT', 640);
  add(22, 'AMAZON.COM REFUND', 34.99);
  add(24, 'WM SUPERCENTER #2231', -71.4);
  add(27, 'KUMON LEARNING CTR', -165);
  add(33, 'RIVERSIDE ANIMAL HOSP', -212.5);
  add(36, 'PAYPAL *STEAMGAMES', -29.99);
  add(38, 'ZELLE TO MARIA LOPEZ', -60);
  add(40, 'DELTA AIR 0062371234', -412.6);
  add(44, 'MARRIOTT CHICAGO DOWNTOWN', -538.14);
  add(45, 'SQ *THE LOCAL PRESS', -18.5);
  add(46, 'LOU MALNATIS PIZZERIA', -41.3);
  add(47, 'CTA VENTRA', -20);
  add(52, 'BLUE APRON', -69.99);
  add(55, 'AMC THEATRES 1128', -32);
  add(58, '7-ELEVEN 33410', -9.87);
  add(63, 'XYZ*QPAY 88213 LLC', -45);
  add(66, 'ZELLE FROM JAMES KIM', 85);
  add(69, 'IKEA BROOKLYN', -249);
  add(72, 'THE ROSE & CROWN', -46.2);
  add(75, 'CITY OF NY PARKING TICKET', -65);
  add(78, 'MONTHLY MAINTENANCE FEE', -12);
  add(80, 'STRIPE PAYOUT ACH CREDIT', 410);
  add(83, 'TICKETMASTER *CONCERT', -118);
  add(86, 'GUSTO PAY 881092', 250);
  add(88, 'ETSY.COM*HANDMADEBYLI', -36.5);

  return rows.sort((a, b) => a.day - b.day);
}

export function generateSampleCsv(seed?: number): string {
  const rows = generateSampleRows(seed);
  let balance = 4812.37;
  const lines = [
    'Everyday Checking - Account XXXX4821',
    'Statement period,06/01/2026 - 08/31/2026',
    'SYNTHETIC SAMPLE DATA - not a real account',
    '',
    'Transaction Date,Description,Amount,Balance',
  ];
  for (const row of rows) {
    balance = Math.round((balance + row.amount) * 100) / 100;
    const date = new Date(START + row.day * 86_400_000);
    const mmddyyyy = `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
    lines.push([mmddyyyy, csvCell(row.description), row.amount.toFixed(2), balance.toFixed(2)].join(','));
  }
  return lines.join('\n') + '\n';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function csvCell(text: string): string {
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
