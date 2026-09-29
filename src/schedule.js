export const PARTICIPANTS = ["James", "Les", "Harlan", "JP", "Isaac"];
export const ANCHOR_DATE = "2026-10-03";
export const ANCHOR_PERSON = "JP";

export const SKIP_REASONS = {
  kingdom_hall: "Kingdom Hall",
  convention: "Convention",
  assembly: "Assembly",
  co_visit: "CO Visit",
  other: "Other",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ANCHOR_INDEX = PARTICIPANTS.indexOf(ANCHOR_PERSON);

export function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function isSaturday(date) {
  return date.getUTCDay() === 6;
}

export function isFourthSaturday(date) {
  return isSaturday(date) && Math.floor((date.getUTCDate() - 1) / 7) + 1 === 4;
}

export function assertSaturday(dateString) {
  const date = parseDate(dateString);
  if (!isSaturday(date)) {
    throw new TypeError(`${dateString} is not a Saturday`);
  }
  return date;
}

function normalizeOverrides(overrides = []) {
  return new Map(overrides.map((override) => [override.date, override]));
}

function isManualSkip(override) {
  return override?.kind === "skip";
}

function isConductingSaturday(date, override) {
  if (isManualSkip(override)) return false;
  return !isFourthSaturday(date) || override?.kind === "assignment";
}

function countConductingSaturdays(startDate, endDate, overrideMap) {
  let count = 0;
  for (
    let cursor = new Date(startDate);
    cursor < endDate;
    cursor = new Date(cursor.getTime() + 7 * DAY_MS)
  ) {
    const key = formatDateKey(cursor);
    if (isConductingSaturday(cursor, overrideMap.get(key))) {
      count += 1;
    }
  }
  return count;
}

export function getScheduleEntry(dateString, overrides = []) {
  const date = assertSaturday(dateString);
  const overrideMap = normalizeOverrides(overrides);
  const override = overrideMap.get(dateString);

  if (isManualSkip(override)) {
    const reason = override.reason ?? "other";
    return {
      date: dateString,
      kind: "skip",
      reason,
      label: reason === "other" && override.note ? override.note : SKIP_REASONS[reason],
      note: override.note ?? "",
      source: "override",
      updatedAt: override.updatedAt,
    };
  }

  const anchor = parseDate(ANCHOR_DATE);
  const direction = date >= anchor ? 1 : -1;
  const conductingOffset =
    direction === 1
      ? countConductingSaturdays(anchor, date, overrideMap)
      : -countConductingSaturdays(date, anchor, overrideMap);
  const calculatedPerson =
    PARTICIPANTS[
      (ANCHOR_INDEX + conductingOffset + PARTICIPANTS.length * 10000) %
        PARTICIPANTS.length
    ];

  if (override?.kind !== "assignment" && isFourthSaturday(date)) {
    return {
      date: dateString,
      kind: "skip",
      reason: "kingdom_hall",
      label: SKIP_REASONS.kingdom_hall,
      note: "",
      source: "rule",
    };
  }

  return {
    date: dateString,
    kind: "assignment",
    person: override?.kind === "assignment" ? override.person : calculatedPerson,
    calculatedPerson,
    note: override?.note ?? "",
    source: override?.kind === "assignment" ? "override" : "rule",
    updatedAt: override?.updatedAt,
  };
}

export function getSaturdaysInMonth(year, monthIndex) {
  const dates = [];
  const cursor = new Date(Date.UTC(year, monthIndex, 1));
  while (cursor.getUTCMonth() === monthIndex) {
    if (isSaturday(cursor)) {
      dates.push(formatDateKey(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function getNextAssignment(fromDateString, overrides = []) {
  const fromDate = parseDate(fromDateString);
  const cursor = new Date(fromDate);
  while (!isSaturday(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (let attempts = 0; attempts < 60; attempts += 1) {
    const entry = getScheduleEntry(formatDateKey(cursor), overrides);
    if (entry.kind === "assignment") {
      return entry;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  throw new Error("Unable to find an upcoming conducting assignment");
}

export function buildSchedule(startDateString, endDateString, overrides = []) {
  const start = parseDate(startDateString);
  const end = parseDate(endDateString);
  const cursor = new Date(start);
  while (!isSaturday(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const entries = [];
  while (cursor <= end) {
    entries.push(getScheduleEntry(formatDateKey(cursor), overrides));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return entries;
}
