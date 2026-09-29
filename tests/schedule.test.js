import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextAssignment,
  getScheduleEntry,
  getSaturdaysInMonth,
  isFourthSaturday,
  parseDate,
} from "../src/schedule.js";

test("anchors October 2026 with JP and skips the fourth Saturday", () => {
  assert.equal(getScheduleEntry("2026-10-03").person, "JP");
  assert.equal(getScheduleEntry("2026-10-10").person, "Isaac");
  assert.equal(getScheduleEntry("2026-10-17").person, "James");
  assert.deepEqual(getScheduleEntry("2026-10-24"), {
    date: "2026-10-24",
    kind: "skip",
    reason: "kingdom_hall",
    label: "Kingdom Hall",
    note: "",
    source: "rule",
  });
  assert.equal(getScheduleEntry("2026-10-31").person, "Les");
  assert.equal(getScheduleEntry("2026-11-07").person, "Harlan");
});

test("recognizes fourth Saturdays in four- and five-Saturday months", () => {
  assert.equal(isFourthSaturday(parseDate("2026-10-24")), true);
  assert.equal(isFourthSaturday(parseDate("2026-11-28")), true);
  assert.equal(isFourthSaturday(parseDate("2026-10-31")), false);
});

test("manual event skips pause the rotation", () => {
  const overrides = [
    {
      date: "2026-10-10",
      kind: "skip",
      reason: "assembly",
      note: "Circuit assembly",
    },
  ];

  assert.equal(getScheduleEntry("2026-10-10", overrides).label, "Assembly");
  assert.equal(getScheduleEntry("2026-10-17", overrides).person, "Isaac");
  assert.equal(getScheduleEntry("2026-10-31", overrides).person, "James");
});

test("assignment overrides do not alter later rotation positions", () => {
  const overrides = [
    {
      date: "2026-10-10",
      kind: "assignment",
      person: "Les",
      note: "Swap",
    },
  ];

  assert.equal(getScheduleEntry("2026-10-10", overrides).person, "Les");
  assert.equal(getScheduleEntry("2026-10-17", overrides).person, "James");
});

test("an assignment on a fourth Saturday consumes a rotation turn", () => {
  const overrides = [
    {
      date: "2026-10-24",
      kind: "assignment",
      person: "James",
      note: "Kingdom Hall schedule changed",
    },
  ];

  const fourthSaturday = getScheduleEntry("2026-10-24", overrides);
  assert.equal(fourthSaturday.kind, "assignment");
  assert.equal(fourthSaturday.person, "James");
  assert.equal(fourthSaturday.calculatedPerson, "Les");
  assert.equal(getScheduleEntry("2026-10-31", overrides).person, "Harlan");
});

test("a fourth Saturday can use another no-conducting reason", () => {
  const overrides = [
    {
      date: "2026-10-24",
      kind: "skip",
      reason: "assembly",
      note: "Circuit assembly",
    },
  ];

  const fourthSaturday = getScheduleEntry("2026-10-24", overrides);
  assert.equal(fourthSaturday.kind, "skip");
  assert.equal(fourthSaturday.label, "Assembly");
  assert.equal(getScheduleEntry("2026-10-31", overrides).person, "Les");
});

test("removing a manual skip restores the default downstream rotation", () => {
  const overrides = [
    { date: "2026-10-10", kind: "skip", reason: "co_visit", note: "" },
  ];

  assert.equal(getScheduleEntry("2026-10-17", overrides).person, "Isaac");
  assert.equal(getScheduleEntry("2026-10-17", []).person, "James");
});

test("finds the next conducting assignment around skipped dates", () => {
  assert.equal(getNextAssignment("2026-10-24").date, "2026-10-31");
  assert.equal(getNextAssignment("2026-10-24").person, "Les");
});

test("lists every Saturday in a month", () => {
  assert.deepEqual(getSaturdaysInMonth(2026, 9), [
    "2026-10-03",
    "2026-10-10",
    "2026-10-17",
    "2026-10-24",
    "2026-10-31",
  ]);
});
