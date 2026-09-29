import test from "node:test";
import assert from "node:assert/strict";

import { createCalendarIcs } from "../src/ics.js";

test("exports a valid 12-month calendar with assignments and skip reasons", () => {
  const ics = createCalendarIcs(
    "2026-10-01",
    [
      {
        date: "2026-11-07",
        kind: "skip",
        reason: "convention",
        note: "Regional convention",
      },
    ],
    new Date("2026-09-28T00:00:00Z"),
  );

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:FSG Conducting — JP/);
  assert.match(ics, /SUMMARY:No conducting — Kingdom Hall/);
  assert.match(ics, /SUMMARY:No conducting — Convention/);
  assert.match(ics, /DESCRIPTION:Regional convention/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261003/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
});

