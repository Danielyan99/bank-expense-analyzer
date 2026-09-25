export const SERVER_URL = (import.meta.env.VITE_SERVER_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

export const LINKS = {
  github: import.meta.env.VITE_GITHUB_URL?.trim() || 'https://github.com/Danielyan99/bank-expense-analyzer',
  portfolio: import.meta.env.VITE_PORTFOLIO_URL?.trim() || 'https://danielyan99.github.io/cv-website/',
};

/** Link to a file in the repo on GitHub. */
export function sourceUrl(path: string): string {
  return `${LINKS.github}/blob/main/${path}`;
}
