const SHEET_NAME = "Schedule Overrides";
const HEADERS = ["Date", "Kind", "Person", "Reason", "Note", "UpdatedAt"];
const CHANGE_LOG_SHEET_NAME = "Change Log";
const CHANGE_LOG_HEADERS = [
  "ChangeId",
  "Timestamp",
  "ScheduleDate",
  "Description",
  "Explanation",
  "Action",
];
const PARTICIPANTS = new Set(["James", "Les", "Harlan", "JP", "Isaac"]);
const REASONS = new Set([
  "kingdom_hall",
  "convention",
  "assembly",
  "co_visit",
  "other",
]);

function doGet(event) {
  try {
    const result = {
      ok: true,
      overrides: readOverrides(),
      changes: readChanges(),
    };
    return jsonResponse(
      result,
      event && event.parameter && event.parameter.callback,
    );
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error.message },
      event && event.parameter && event.parameter.callback,
    );
  }
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    validateEditorToken(payload.editorToken);
    validateDate(payload.date);
    validateChangeLogPayload(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (payload.action === "delete") {
        deleteOverride(payload.date);
      } else if (payload.action === "save") {
        saveOverride(payload);
      } else {
        throw new Error("Unsupported action");
      }
      appendChangeLog(payload);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function readOverrides() {
  const sheet = getScheduleSheet();
  const rowCount = sheet.getLastRow();
  if (rowCount < 2) return [];

  return sheet
    .getRange(2, 1, rowCount - 1, HEADERS.length)
    .getDisplayValues()
    .filter((row) => row[0])
    .map(([date, kind, person, reason, note, updatedAt]) => ({
      date,
      kind,
      person: person || null,
      reason: reason || null,
      note,
      updatedAt,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function readChanges() {
  const sheet = getChangeLogSheet();
  const rowCount = sheet.getLastRow();
  if (rowCount < 2) return [];
  const startRow = Math.max(2, rowCount - 19);
  return sheet
    .getRange(startRow, 1, rowCount - startRow + 1, CHANGE_LOG_HEADERS.length)
    .getDisplayValues()
    .filter((row) => row[0])
    .map(([id, timestamp, date, description, explanation, action]) => ({
      id,
      timestamp,
      date,
      description,
      explanation,
      action,
    }))
    .reverse();
}

function saveOverride(payload) {
  const kind = String(payload.kind || "");
  const note = String(payload.note || "").trim();
  if (!["assignment", "skip"].includes(kind)) {
    throw new Error("Change type is invalid");
  }
  if (note.length > 160) {
    throw new Error("Note must be 160 characters or fewer");
  }

  const person = kind === "assignment" ? String(payload.person || "") : "";
  const reason = kind === "skip" ? String(payload.reason || "") : "";
  if (kind === "assignment" && !PARTICIPANTS.has(person)) {
    throw new Error("Select a valid conductor");
  }
  if (kind === "skip" && !REASONS.has(reason)) {
    throw new Error("Select a valid no-conducting reason");
  }

  const sheet = getScheduleSheet();
  const row = findDateRow(sheet, payload.date);
  const values = [[
    payload.date,
    kind,
    person,
    reason,
    note,
    new Date().toISOString(),
  ]];

  if (row) {
    sheet.getRange(row, 1, 1, HEADERS.length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function deleteOverride(date) {
  const sheet = getScheduleSheet();
  const row = findDateRow(sheet, date);
  if (row) sheet.deleteRow(row);
}

function appendChangeLog(payload) {
  getChangeLogSheet().appendRow([
    payload.changeId,
    new Date().toISOString(),
    payload.date,
    payload.description.trim(),
    payload.explanation.trim(),
    payload.action,
  ]);
}

function validateChangeLogPayload(payload) {
  const changeId = String(payload.changeId || "");
  const description = String(payload.description || "").trim();
  const explanation = String(payload.explanation || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(changeId)) {
    throw new Error("Change ID is invalid");
  }
  if (!description || description.length > 240 || explanation.length > 160) {
    throw new Error("Change description or explanation is invalid");
  }
}

function findDateRow(sheet, date) {
  const rowCount = sheet.getLastRow();
  if (rowCount < 2) return null;
  const dates = sheet.getRange(2, 1, rowCount - 1, 1).getDisplayValues();
  const index = dates.findIndex(([value]) => value === date);
  return index === -1 ? null : index + 2;
}

function getScheduleSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  function getChangeLogSheet() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(CHANGE_LOG_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(CHANGE_LOG_SHEET_NAME);
      sheet
        .getRange(1, 1, 1, CHANGE_LOG_HEADERS.length)
        .setValues([CHANGE_LOG_HEADERS]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }
  return sheet;
}

function validateEditorToken(suppliedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty("EDIT_TOKEN");
  if (!expectedToken || suppliedToken !== expectedToken) {
    throw new Error("Editor link is invalid or expired");
  }
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDay() !== 6) {
    throw new Error("Date must be a Saturday");
  }
}

function jsonResponse(body, callback) {
  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService
        .createTextOutput("Invalid callback")
        .setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(body)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
