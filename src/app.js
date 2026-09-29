import { SCHEDULE_API_URL } from "./config.js?v=2";
import { createCalendarIcs } from "./ics.js?v=2";
import {
  PARTICIPANTS,
  SKIP_REASONS,
  formatDateKey,
  getNextAssignment,
  getSaturdaysInMonth,
  getScheduleEntry,
  parseDate,
} from "./schedule.js?v=2";

const elements = {
  calendarGrid: document.querySelector("#calendar-grid"),
  monthHeading: document.querySelector("#month-heading"),
  nextPerson: document.querySelector("#next-person"),
  nextDate: document.querySelector("#next-date"),
  status: document.querySelector("#status"),
  editorBadge: document.querySelector("#editor-badge"),
  dialog: document.querySelector("#edit-dialog"),
  editForm: document.querySelector("#edit-form"),
  editDate: document.querySelector("#edit-date"),
  editDateHeading: document.querySelector("#edit-date-heading"),
  editPerson: document.querySelector("#edit-person"),
  editReason: document.querySelector("#edit-reason"),
  editNote: document.querySelector("#edit-note"),
  editError: document.querySelector("#edit-error"),
  personField: document.querySelector("#person-field"),
  reasonField: document.querySelector("#reason-field"),
  resetDate: document.querySelector("#reset-date"),
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

let visibleMonth = new Date();
visibleMonth = new Date(Date.UTC(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
let overrides = [];
let editorToken = "";

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function isBackendConfigured() {
  return Boolean(SCHEDULE_API_URL);
}

function setStatus(message = "", warning = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("warning", warning);
}

function getEditorToken() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const tokenFromUrl = fragment.get("edit");
  if (tokenFromUrl) {
    sessionStorage.setItem("fsg-editor-token", tokenFromUrl);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  return tokenFromUrl || sessionStorage.getItem("fsg-editor-token") || "";
}

async function loadOverrides() {
  if (!isBackendConfigured()) {
    setStatus("Showing the base rotation. Shared updates are not configured yet.", true);
    return;
  }

  const response = await fetch(
    `${SCHEDULE_API_URL}?action=list`,
  );
  if (!response.ok) {
    throw new Error(`Shared schedule returned ${response.status}`);
  }
  const result = await response.json();
  if (!result.ok || !Array.isArray(result.overrides)) {
    throw new Error(result.error || "Shared schedule response is invalid");
  }
  overrides = result.overrides.map((item) => ({
    date: item.date,
    kind: item.kind,
    person: item.person,
    reason: item.reason,
    note: item.note ?? "",
    updatedAt: item.updatedAt,
  }));
  setStatus(
    overrides.length
      ? `Shared schedule loaded with ${overrides.length} update${overrides.length === 1 ? "" : "s"}.`
      : "Shared schedule is up to date.",
  );
}

function assignmentClass(person) {
  return `person-${person.toLowerCase().replaceAll(" ", "-")}`;
}

function entryMarkup(entry) {
  const label = entry.kind === "assignment" ? entry.person : `No conducting · ${entry.label}`;
  const className =
    entry.kind === "assignment" ? assignmentClass(entry.person) : "is-skip";
  const note = entry.note ? `<span class="note">${escapeHtml(entry.note)}</span>` : "";
  const override = entry.source === "override"
    ? '<span class="override-flag" title="Shared schedule update">●</span>'
    : "";
  return `${override}<span class="assignment ${className}">${escapeHtml(label)}</span>${note}`;
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function renderCalendar() {
  const year = visibleMonth.getUTCFullYear();
  const month = visibleMonth.getUTCMonth();
  elements.monthHeading.textContent = monthFormatter.format(visibleMonth);
  elements.calendarGrid.replaceChildren();

  for (const dateKey of getSaturdaysInMonth(year, month)) {
    const entry = getScheduleEntry(dateKey, overrides);
    const date = parseDate(dateKey);
    const canEdit = Boolean(editorToken);
    const item = document.createElement("li");
    item.className = "saturday-item";
    if (dateKey === todayKey()) item.classList.add("today");
    item.innerHTML = `
      <time class="saturday-date" datetime="${dateKey}">
        <span>${shortMonthFormatter.format(date)}</span>
        <strong>${date.getUTCDate()}</strong>
      </time>
      <button class="saturday-details" type="button" ${canEdit ? "" : "disabled"}>
        ${entryMarkup(entry)}
      </button>
    `;
    const button = item.querySelector("button");
    if (canEdit) {
      button.addEventListener("click", () => openEditor(dateKey));
    } else {
      button.removeAttribute("tabindex");
    }
    elements.calendarGrid.append(item);
  }

  const next = getNextAssignment(todayKey(), overrides);
  elements.nextPerson.textContent = next.person;
  elements.nextDate.textContent = longDateFormatter.format(parseDate(next.date));
}

function openEditor(dateKey) {
  const entry = getScheduleEntry(dateKey, overrides);
  const override = overrides.find((item) => item.date === dateKey);
  elements.editDate.value = dateKey;
  elements.editDateHeading.textContent = longDateFormatter.format(parseDate(dateKey));
  elements.editError.textContent = "";
  elements.editNote.value = override?.note ?? "";

  const kind = override?.kind ?? (entry.kind === "skip" ? "skip" : "assignment");
  elements.editForm.elements.kind.value = kind;
  elements.editPerson.value =
    override?.person ?? (entry.kind === "assignment" ? entry.person : PARTICIPANTS[0]);
  elements.editReason.value =
    override?.reason ?? (entry.kind === "skip" ? entry.reason : "convention");
  elements.resetDate.hidden = !override;
  updateEditorFields();
  elements.dialog.showModal();
}

function updateEditorFields() {
  const isSkip = elements.editForm.elements.kind.value === "skip";
  elements.personField.hidden = isSkip;
  elements.reasonField.hidden = !isSkip;
}

async function saveOverride(payload, action = "save") {
  if (!isBackendConfigured()) {
    throw new Error("Shared editing is not configured yet.");
  }
  const response = await fetch(SCHEDULE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ ...payload, action, editorToken }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Unable to save change (${response.status})`);
  }
}

async function handleSave(event) {
  event.preventDefault();
  elements.editError.textContent = "";
  const formData = new FormData(elements.editForm);
  const payload = {
    date: formData.get("date"),
    kind: formData.get("kind"),
    person: formData.get("kind") === "assignment" ? formData.get("person") : null,
    reason: formData.get("kind") === "skip" ? formData.get("reason") : null,
    note: String(formData.get("note") || "").trim(),
  };

  try {
    await saveOverride(payload);
    await loadOverrides();
    renderCalendar();
    elements.dialog.close();
  } catch (error) {
    elements.editError.textContent = error.message;
  }
}

async function handleReset() {
  elements.editError.textContent = "";
  try {
    await saveOverride({ date: elements.editDate.value }, "delete");
    await loadOverrides();
    renderCalendar();
    elements.dialog.close();
  } catch (error) {
    elements.editError.textContent = error.message;
  }
}

function downloadCalendar() {
  const contents = createCalendarIcs(todayKey(), overrides);
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fsg-conducting-schedule.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}

function changeMonth(offset) {
  visibleMonth = new Date(
    Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + offset, 1),
  );
  renderCalendar();
}

async function init() {
  editorToken = getEditorToken();
  elements.editorBadge.hidden = !editorToken;
  for (const participant of PARTICIPANTS) {
    const option = document.createElement("option");
    option.value = participant;
    option.textContent = participant;
    elements.editPerson.append(option);
  }

  document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
  document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
  document.querySelector("#today").addEventListener("click", () => {
    const today = new Date();
    visibleMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    renderCalendar();
  });
  document.querySelector("#download-calendar").addEventListener("click", downloadCalendar);
  elements.editForm.addEventListener("change", updateEditorFields);
  elements.editForm.addEventListener("submit", handleSave);
  elements.resetDate.addEventListener("click", handleReset);

  try {
    await loadOverrides();
  } catch (error) {
    setStatus(
      `Shared updates are temporarily unavailable. Showing the base rotation. ${error.message}`,
      true,
    );
  }
  renderCalendar();
}

init();
