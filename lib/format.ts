export const CURRENCY = 'AED';

export const fmt = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-US');

export const money = (n: number | string | null | undefined) =>
  `${CURRENCY} ${Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const today = () => new Date().toISOString().slice(0, 10);

export const monthBounds = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}` };
};

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
