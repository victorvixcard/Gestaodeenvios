// Feriados: Serra-ES — nacionais + estaduais (ES) + municipais (Serra)

// Fixos: [mês, dia]
const FIXED_NATIONAL: [number, number][] = [
  [1,  1],  // Confraternização Universal
  [4,  21], // Tiradentes
  [5,  1],  // Dia do Trabalho
  [9,  7],  // Independência do Brasil
  [10, 12], // Nossa Senhora Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra (lei 14.759/2023)
  [12, 25], // Natal
];

const FIXED_STATE_ES: [number, number][] = [
  [5, 23], // Colonização do Espírito Santo
];

const FIXED_MUNICIPAL_SERRA: [number, number][] = [
  [6, 29], // São Pedro e São Paulo — Padroeiro de Serra
];

// Variáveis: calculadas ano a ano
const VARIABLE: Record<number, string[]> = {
  2024: [
    "2024-02-12", // Carnaval (seg)
    "2024-02-13", // Carnaval (ter)
    "2024-03-29", // Sexta-feira Santa
    "2024-05-30", // Corpus Christi
  ],
  2025: [
    "2025-03-03", // Carnaval (seg)
    "2025-03-04", // Carnaval (ter)
    "2025-04-18", // Sexta-feira Santa
    "2025-06-19", // Corpus Christi
  ],
  2026: [
    "2026-02-16", // Carnaval (seg)
    "2026-02-17", // Carnaval (ter)
    "2026-04-03", // Sexta-feira Santa
    "2026-06-04", // Corpus Christi
  ],
  2027: [
    "2027-02-08", // Carnaval (seg)
    "2027-02-09", // Carnaval (ter)
    "2027-03-26", // Sexta-feira Santa
    "2027-05-27", // Corpus Christi
  ],
};

const HOLIDAY_NAMES: Record<string, string> = {
  "1-1":   "Confraternização Universal",
  "4-21":  "Tiradentes",
  "5-1":   "Dia do Trabalho",
  "5-23":  "Colonização do ES",
  "6-29":  "São Pedro e São Paulo",
  "9-7":   "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-2":  "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal",
};

const VARIABLE_NAMES: Record<string, string> = {
  "2024-02-12": "Carnaval",
  "2024-02-13": "Carnaval",
  "2024-03-29": "Sexta-feira Santa",
  "2024-05-30": "Corpus Christi",
  "2025-03-03": "Carnaval",
  "2025-03-04": "Carnaval",
  "2025-04-18": "Sexta-feira Santa",
  "2025-06-19": "Corpus Christi",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Sexta-feira Santa",
  "2026-06-04": "Corpus Christi",
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Sexta-feira Santa",
  "2027-05-27": "Corpus Christi",
};

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isHoliday(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const iso = toISO(date);
  const year = date.getFullYear();

  const allFixed = [...FIXED_NATIONAL, ...FIXED_STATE_ES, ...FIXED_MUNICIPAL_SERRA];
  if (allFixed.some(([m, d]) => m === month && d === day)) return true;

  const variable = VARIABLE[year] ?? [];
  return variable.includes(iso);
}

export function getHolidayName(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const iso = toISO(date);
  return HOLIDAY_NAMES[`${month}-${day}`] ?? VARIABLE_NAMES[iso] ?? null;
}

export function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (isBusinessDay(date)) added++;
  }
  return date;
}

export function getOrderDeadline(createdAt: string): Date {
  return addBusinessDays(new Date(createdAt), 7);
}

export type DeadlineStatus = "ok" | "warning" | "danger" | "overdue" | "done";

export function getDeadlineStatus(deadline: Date, orderStatus: string): DeadlineStatus {
  if (orderStatus === "done") return "done";
  if (orderStatus === "cancelled") return "done";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dl.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "danger";
  if (diffDays <= 2) return "warning";
  return "ok";
}

export function getBusinessDaysUntil(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);

  if (dl <= now) return 0;
  let count = 0;
  const cursor = new Date(now);
  while (cursor < dl) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) count++;
  }
  return count;
}

// Retorna lista de feriados de um mês
export function getHolidaysInMonth(year: number, month: number): { date: Date; name: string }[] {
  const result: { date: Date; name: string }[] = [];
  const allFixed = [...FIXED_NATIONAL, ...FIXED_STATE_ES, ...FIXED_MUNICIPAL_SERRA];

  for (const [m, d] of allFixed) {
    if (m === month) {
      const date = new Date(year, month - 1, d);
      const name = HOLIDAY_NAMES[`${m}-${d}`] ?? "Feriado";
      result.push({ date, name });
    }
  }

  const variable = VARIABLE[year] ?? [];
  for (const iso of variable) {
    const date = new Date(iso);
    if (date.getMonth() + 1 === month) {
      result.push({ date, name: VARIABLE_NAMES[iso] ?? "Feriado" });
    }
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
