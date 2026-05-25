import { addDays, addMonths, addYears, setDate } from "date-fns";

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
    case "monthly":
      return setDate(addMonths(from, 1), Math.min(dayOfMonth ?? 1, 28));
    case "quarterly":
      return addDays(from, 90);
    case "annually":
      return addYears(from, 1);
    default:
      return addDays(from, 7);
  }
}
