import { buildSchedule, parseDate } from "./schedule.js?v=2";

function addMonths(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function formatIcsDate(dateString) {
  return dateString.replaceAll("-", "");
}

function escapeIcsText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let remainder = line;
  while (remainder.length > 75) {
    parts.push(remainder.slice(0, 75));
    remainder = ` ${remainder.slice(75)}`;
  }
  parts.push(remainder);
  return parts.join("\r\n");
}

export function createCalendarIcs(
  fromDateString,
  overrides = [],
  generatedAt = new Date(),
) {
  const fromDate = parseDate(fromDateString);
  const endDate = addMonths(fromDate, 12);
  const entries = buildSchedule(
    fromDateString,
    endDate.toISOString().slice(0, 10),
    overrides,
  );
  const stamp = generatedAt
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FSG #1 & #2//Conducting Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:FSG #1 & #2 Conducting Schedule",
  ];

  for (const entry of entries) {
    const summary =
      entry.kind === "assignment"
        ? `FSG Conducting — ${entry.person}`
        : `No conducting — ${entry.label}`;
    const description =
      entry.kind === "assignment"
        ? entry.note || `${entry.person} is scheduled to conduct field service.`
        : entry.note || `No field service conducting: ${entry.label}.`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.date}-${entry.kind}@fsg-conducting-schedule`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(entry.date)}`,
      foldLine(`SUMMARY:${escapeIcsText(summary)}`),
      foldLine(`DESCRIPTION:${escapeIcsText(description)}`),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
