/**
 * Eight spending categories (one colour each), plus neutral buckets that are not "spending".
 * Eight is deliberate: it is the most categorical colours a chart can use and still be told
 * apart, including by colour-blind readers. Anything else folds into "Other".
 */
export const SPENDING_CATEGORIES = [
  'housing',
  'groceries',
  'dining',
  'transport',
  'subscriptions',
  'shopping',
  'health',
  'leisure',
] as const;

export const NEUTRAL_CATEGORIES = ['income', 'transfers', 'other', 'uncategorized'] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];
export type CategoryId = SpendingCategory | (typeof NEUTRAL_CATEGORIES)[number];

export const ALL_CATEGORIES: readonly CategoryId[] = [...SPENDING_CATEGORIES, ...NEUTRAL_CATEGORIES];

/** Categories a user (or Claude) may assign. "uncategorized" is a state, not a choice. */
export const ASSIGNABLE_CATEGORIES: readonly CategoryId[] = ALL_CATEGORIES.filter((c) => c !== 'uncategorized');

export interface CategoryInfo {
  label: string;
  /** One line that tells Claude (and the reader) what belongs here. */
  hint: string;
}

export const CATEGORY_INFO: Record<CategoryId, CategoryInfo> = {
  housing: { label: 'Housing & bills', hint: 'rent, mortgage, electricity, water, gas, internet, phone, insurance' },
  groceries: { label: 'Groceries', hint: 'supermarkets, grocery stores, markets, bakeries (take-home food)' },
  dining: { label: 'Eating out', hint: 'restaurants, cafes, coffee shops, bars, fast food, food delivery' },
  transport: { label: 'Transport', hint: 'fuel, public transit, taxis, ride-hailing, parking, tolls, car service' },
  subscriptions: { label: 'Subscriptions', hint: 'streaming, software, cloud storage, memberships billed monthly' },
  shopping: { label: 'Shopping', hint: 'online and retail stores, clothing, electronics, home goods, gifts' },
  health: { label: 'Health & fitness', hint: 'pharmacy, doctor, dentist, gym, sports' },
  leisure: { label: 'Leisure & travel', hint: 'flights, hotels, cinema, concerts, events, hobbies, games' },
  income: { label: 'Income', hint: 'salary, payroll, refunds, interest, money received' },
  transfers: { label: 'Transfers', hint: 'moving money between own accounts, savings, card repayments, ATM cash' },
  other: { label: 'Other', hint: 'fees, charity, government, anything that fits nowhere else' },
  uncategorized: { label: 'Uncategorized', hint: 'not classified yet' },
};

export function isSpendingCategory(id: CategoryId): id is SpendingCategory {
  return (SPENDING_CATEGORIES as readonly string[]).includes(id);
}
