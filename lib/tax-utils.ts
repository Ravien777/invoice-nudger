export function getTaxYearRange(fiscalYearStart: number, year: number) {
  const startMonth = fiscalYearStart - 1;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year + 1, startMonth, 1);
  return { start, end };
}

export function currentTaxYear(fiscalYearStart: number, now = new Date()) {
  const startMonth = fiscalYearStart - 1;
  return now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
}
