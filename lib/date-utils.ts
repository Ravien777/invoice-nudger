import { addDays, addMonths, addYears, setDate, lastDayOfMonth } from "date-fns";

export function computeNextRunDate(
  frequency: string,
  dayOfMonth?: number,
  from: Date = new Date(),
): Date {
  switch (frequency) {
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly": {
      const target = addMonths(from, 1);
      const lastDay = lastDayOfMonth(target).getDate();
      return setDate(target, Math.min(dayOfMonth ?? 1, lastDay));
    }
    case "quarterly": {
      const nextQuarterFirstMonth = (Math.floor(from.getMonth() / 3) + 1) * 3;
      const year = from.getFullYear() + (nextQuarterFirstMonth >= 12 ? 1 : 0);
      const month = nextQuarterFirstMonth % 12;
      const target = new Date(year, month, 1);
      const lastDay = lastDayOfMonth(target).getDate();
      return setDate(target, Math.min(dayOfMonth ?? 1, lastDay));
    }
    case "annually":
      return addYears(from, 1);
    default:
      return addDays(from, 7);
  }
}
