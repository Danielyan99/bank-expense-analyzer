import type { CategoryId } from '@expense/shared';

export interface Rule {
  /** Stable id shown in the UI, e.g. "merchant:NETFLIX" or "pattern:salary". */
  id: string;
  category: CategoryId;
  pattern: RegExp;
  confidence: number;
  /** Only apply to money in or money out. */
  direction?: 'in' | 'out';
  /** Human-readable explanation for the UI. */
  label: string;
}

/**
 * Known merchants. A match here is near-certain, so it scores 0.95.
 * Multi-word names are fine; the longest matching name wins, so "AMAZON PRIME" beats "AMAZON".
 */
const MERCHANTS: Record<string, string[]> = {
  housing: [
    'CON EDISON', 'PG&E', 'DUKE ENERGY', 'NATIONAL GRID', 'COMCAST', 'XFINITY', 'VERIZON', 'AT&T', 'T-MOBILE',
    'SPECTRUM', 'GEICO', 'STATE FARM', 'ALLSTATE', 'LEMONADE', 'BRITISH GAS', 'OCTOPUS ENERGY', 'THAMES WATER',
    'EDF ENERGY', 'VODAFONE', 'BT GROUP', 'SKY BROADBAND', 'ZILLOW RENT', 'AVAIL RENT', 'APPFOLIO',
  ],
  groceries: [
    'WHOLE FOODS', 'TRADER JOE', 'KROGER', 'SAFEWAY', 'ALDI', 'LIDL', 'PUBLIX', 'WEGMANS', 'HEB', 'H-E-B',
    'COSTCO', 'SAMS CLUB', 'FOOD LION', 'STOP & SHOP', 'GIANT EAGLE', 'SPROUTS', 'TESCO', 'SAINSBURY', 'ASDA',
    'WAITROSE', 'MORRISONS', 'CARREFOUR', 'INSTACART', 'FRESH MARKET', 'ALBERTSONS', 'MEIJER',
  ],
  dining: [
    'STARBUCKS', 'DUNKIN', 'MCDONALD', 'BURGER KING', 'CHIPOTLE', 'SUBWAY', 'TACO BELL', 'WENDY', 'KFC',
    'DOMINO', 'PIZZA HUT', 'PANERA', 'SHAKE SHACK', 'SWEETGREEN', 'CHICK-FIL-A', 'FIVE GUYS', 'BLUE BOTTLE',
    'PRET A MANGER', 'COSTA COFFEE', 'NANDO', 'DOORDASH', 'UBER EATS', 'UBEREATS', 'GRUBHUB', 'DELIVEROO',
    'JUST EAT', 'POSTMATES', 'SEAMLESS', 'PEETS COFFEE', 'TIM HORTONS', 'OLIVE GARDEN', 'CHEESECAKE FACTORY',
  ],
  transport: [
    'UBER', 'LYFT', 'BOLT', 'SHELL', 'CHEVRON', 'EXXON', 'MOBIL', 'BP GAS', 'TEXACO', 'ARCO', 'SUNOCO',
    'CITGO', 'VALERO', 'MTA', 'BART', 'CLIPPER', 'VENTRA', 'TFL', 'AMTRAK', 'GREYHOUND', 'EZPASS', 'E-ZPASS',
    'FASTRAK', 'PARKMOBILE', 'SPOTHERO', 'LIME', 'CITI BIKE', 'JIFFY LUBE', 'ZIPCAR', 'TRAINLINE',
  ],
  subscriptions: [
    'NETFLIX', 'SPOTIFY', 'HULU', 'DISNEY PLUS', 'DISNEYPLUS', 'DISNEY+', 'HBO MAX', 'MAX.COM', 'YOUTUBE PREMIUM',
    'YOUTUBE TV', 'APPLE.COM/BILL', 'APPLE MUSIC', 'ICLOUD', 'GOOGLE STORAGE', 'GOOGLE ONE', 'AMAZON PRIME',
    'PRIME VIDEO', 'AUDIBLE', 'DROPBOX', 'ADOBE', 'MICROSOFT 365', 'MSFT', 'GITHUB', 'NOTION', 'OPENAI',
    'ANTHROPIC', 'CLAUDE.AI', 'CHATGPT', 'PARAMOUNT', 'PEACOCK', 'CRUNCHYROLL', 'DUOLINGO', 'NYTIMES',
    'THE ATLANTIC', 'MEDIUM.COM', 'PATREON', 'SLACK', 'ZOOM.US', 'CANVA', 'LINKEDIN PREMIUM', '1PASSWORD',
  ],
  shopping: [
    'AMAZON', 'AMZN', 'TARGET', 'WALMART', 'BEST BUY', 'IKEA', 'HOME DEPOT', 'LOWES', "LOWE'S", 'EBAY', 'ETSY',
    'APPLE STORE', 'ZARA', 'H&M', 'UNIQLO', 'NIKE', 'ADIDAS', 'GAP', 'OLD NAVY', 'NORDSTROM', 'MACYS', "MACY'S",
    'TJ MAXX', 'TJMAXX', 'MARSHALLS', 'SEPHORA', 'ULTA', 'WAYFAIR', 'SHEIN', 'TEMU', 'ALIEXPRESS', 'ARGOS',
    'JOHN LEWIS', 'PRIMARK', 'BED BATH', 'WILLIAMS SONOMA', 'CRATE & BARREL', 'DICKS SPORTING',
  ],
  health: [
    'CVS', 'WALGREENS', 'RITE AID', 'BOOTS', 'PLANET FITNESS', 'EQUINOX', 'LA FITNESS', '24 HOUR FITNESS',
    'ANYTIME FITNESS', 'CLASSPASS', 'PELOTON', 'ORANGETHEORY', 'SOULCYCLE', 'KAISER', 'ONE MEDICAL',
    'QUEST DIAGNOSTICS', 'LABCORP', 'ZOCDOC', 'PUREGYM', 'HEADSPACE', 'CALM.COM',
  ],
  leisure: [
    'AIRBNB', 'BOOKING.COM', 'EXPEDIA', 'HOTELS.COM', 'MARRIOTT', 'HILTON', 'HYATT', 'DELTA AIR', 'UNITED AIR',
    'AMERICAN AIR', 'SOUTHWEST', 'JETBLUE', 'RYANAIR', 'EASYJET', 'BRITISH AIRWAYS', 'LUFTHANSA', 'TICKETMASTER',
    'STUBHUB', 'EVENTBRITE', 'AMC THEATRES', 'AMC THEATERS', 'REGAL', 'CINEWORLD', 'STEAM', 'STEAMPOWERED',
    'PLAYSTATION', 'XBOX', 'NINTENDO', 'BOWLERO', 'TOPGOLF', 'DAVE & BUSTER',
  ],
};

/** Generic words: likely right, but less certain than a known merchant name. */
const KEYWORDS: Record<string, string[]> = {
  housing: [
    'RENT', 'MORTGAGE', 'LANDLORD', 'PROPERTY MGMT', 'PROPERTY MANAGEMENT', 'HOA', 'ELECTRIC', 'ENERGY', 'WATER',
    'UTILITY', 'UTILITIES', 'GAS & ELECTRIC', 'BROADBAND', 'INTERNET', 'WIRELESS', 'MOBILE', 'INSURANCE',
    'COUNCIL TAX',
  ],
  groceries: ['GROCERY', 'GROCERIES', 'SUPERMARKET', 'MARKET', 'FOODS', 'BUTCHER', 'BAKERY', 'GREENGROCER'],
  dining: [
    'CAFE', 'COFFEE', 'RESTAURANT', 'BISTRO', 'GRILL', 'PIZZA', 'PIZZERIA', 'SUSHI', 'RAMEN', 'TAQUERIA', 'BAR',
    'PUB', 'TAVERN', 'DINER', 'BURGER', 'KITCHEN', 'EATERY', 'BRASSERIE', 'NOODLE', 'BBQ', 'DELI',
  ],
  transport: [
    'TAXI', 'CAB', 'PARKING', 'TOLL', 'FUEL', 'PETROL', 'GAS STATION', 'TRANSIT', 'METRO', 'RAILWAY', 'RAIL',
    'BUS', 'AUTO REPAIR', 'CAR WASH', 'TIRE',
  ],
  subscriptions: ['SUBSCRIPTION', 'MEMBERSHIP FEE', 'MONTHLY PLAN', 'PREMIUM PLAN'],
  shopping: ['STORE', 'SHOP', 'BOUTIQUE', 'OUTLET', 'MALL', 'ELECTRONICS', 'FLORIST', 'BOOKSTORE', 'HARDWARE'],
  health: [
    'PHARMACY', 'CHEMIST', 'DRUGSTORE', 'DENTAL', 'DENTIST', 'CLINIC', 'HOSPITAL', 'MEDICAL', 'DOCTOR', 'OPTICIAN',
    'GYM', 'FITNESS', 'YOGA', 'PILATES', 'PHYSIO', 'THERAPY',
  ],
  leisure: [
    'HOTEL', 'HOSTEL', 'AIRLINE', 'AIRWAYS', 'AIRPORT', 'CINEMA', 'THEATRE', 'THEATER', 'MUSEUM', 'CONCERT',
    'TICKETS', 'BOWLING', 'GOLF', 'TRAVEL', 'RESORT', 'ZOO',
  ],
  other: ['CHARITY', 'DONATION', 'IRS', 'HMRC', 'TAX PAYMENT', 'DMV', 'POST OFFICE', 'USPS', 'LAUNDRY'],
};

/** Direction-aware patterns for money movement. Checked before merchants. */
const PATTERN_RULES: Rule[] = [
  rule('pattern:salary', 'income', /\b(SALARY|PAYROLL|WAGES|DIRECT DEP(OSIT)?|DIR DEP|PAYCHECK)\b/, 0.97, 'in', 'Salary / payroll'),
  rule('pattern:interest', 'income', /\bINTEREST (PAID|EARNED|PAYMENT)|\bINT(EREST)? CREDIT\b/, 0.95, 'in', 'Interest'),
  rule('pattern:tax-refund', 'income', /\b(TAX REFUND|IRS TREAS|HMRC REFUND)\b/, 0.95, 'in', 'Tax refund'),
  rule('pattern:atm', 'transfers', /\bATM\b|CASH WITHDRAWAL|CASH WDL/, 0.95, 'out', 'Cash withdrawal'),
  rule('pattern:own-transfer', 'transfers', /\b(TRANSFER (TO|FROM)|TFR (TO|FROM)|INTERNAL TRANSFER|TO SAVINGS|FROM SAVINGS|SAVINGS ACCOUNT)\b/, 0.93, undefined, 'Transfer between accounts'),
  rule('pattern:card-repayment', 'transfers', /\b(CREDIT CARD PAYMENT|CARD REPAYMENT|PAYMENT THANK YOU|AMEX EPAYMENT|CHASE CREDIT CRD)\b/, 0.93, undefined, 'Credit card repayment'),
  rule('pattern:p2p', 'transfers', /\b(ZELLE|VENMO|CASH APP|CASHAPP|WISE|REVOLUT)\b/, 0.75, undefined, 'Peer-to-peer payment'),
  rule('pattern:bank-fee', 'other', /\b(OVERDRAFT|SERVICE CHARGE|MONTHLY FEE|MAINTENANCE FEE|FOREIGN TRANSACTION FEE|WIRE FEE|NSF FEE)\b/, 0.95, 'out', 'Bank fee'),
];

function rule(
  id: string,
  category: CategoryId,
  pattern: RegExp,
  confidence: number,
  direction: 'in' | 'out' | undefined,
  label: string,
): Rule {
  return { id, category, pattern, confidence, direction, label };
}

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every name becomes its own rule so the UI can say exactly which one matched.
 * Sorted longest-first, so the most specific name wins ("AMAZON PRIME" before "AMAZON").
 */
function wordRules(source: Record<string, string[]>, kind: 'merchant' | 'keyword', confidence: number): Rule[] {
  const rules: Rule[] = [];
  for (const [category, words] of Object.entries(source)) {
    for (const word of words) {
      // \b does not work next to "&", "+" or ".", so use explicit non-letter lookarounds.
      const pattern = new RegExp(`(?<![A-Z0-9])${escape(word)}(?![A-Z0-9])`);
      const label = kind === 'merchant' ? `Known merchant "${word}"` : `Keyword "${word}"`;
      rules.push(rule(`${kind}:${word}`, category as CategoryId, pattern, confidence, undefined, label));
    }
  }
  return rules.sort((a, b) => b.id.length - a.id.length);
}

export const MERCHANT_RULES = wordRules(MERCHANTS, 'merchant', 0.95);
export const KEYWORD_RULES = wordRules(KEYWORDS, 'keyword', 0.8);

/** Order matters: money-movement patterns, then known merchants, then generic keywords. */
export const RULES: Rule[] = [...PATTERN_RULES, ...MERCHANT_RULES, ...KEYWORD_RULES];

export const RULE_LABELS: Record<string, string> = Object.fromEntries(RULES.map((r) => [r.id, r.label]));
