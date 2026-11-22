import { extract } from "./parser.js";
import { calendar } from "./calendar.js";
import { newEvent, validate, eventKey, localDay } from "./utils.js";

const $ = (selector) => document.querySelector(selector);
const events = new Map();
const source = $("#source");
const status = $("#status");
const paths = {
  moon: "M20 15A8.5 8.5 0 0 1 9 4a8.5 8.5 0 1 0 11 11Z",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20",
  text: "M5 5h14v14H5z M8 9h8m-8 4h6",
  sample: "M8 3h9l3 3v13H8z M5 7H3v15h13v-1 M11 10h6m-6 4h5",
  wand: "m4 20 12-12 3 3L7 23z M12 12l3 3 M5 2v6M2 5h6m11-4v5m-2.5-2.5h5",
  calendar: "M4 5h16v16H4z M4 10h16M8 3v4m8-4v4m-8 7h3m2 0h3",
  shield: "M12 2 4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5z m-4 10 3 3 5-6",
  plus: "M12 4v16M4 12h16",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  book: "M3 4q5-2 9 2 4-4 9-2v15q-5-2-9 2-4-4-9-2z M12 6v15",
  trash: "M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
};
function icons(root) {
  root.querySelectorAll("[data-i]").forEach((el) => {
    el.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
      paths[el.dataset.i] +
      '"/></svg>';
  });
}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("#theme").setAttribute("aria-pressed", String(dark));
  $("#theme i").dataset.i = dark ? "sun" : "moon";
  icons($("#theme"));
}
let preference;
try {
  preference = localStorage.getItem("deadlinedrop-theme");
} catch {}
setTheme(
  preference
    ? preference === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches,
);
$("#theme").onclick = () => {
  setTheme(document.documentElement.dataset.theme !== "dark");
  try {
    localStorage.setItem(
      "deadlinedrop-theme",
      document.documentElement.dataset.theme,
    );
  } catch {}
};
icons(document);
const repositoryUrl = document.querySelector(
  'meta[name="repository-url"]',
).content;
document.querySelectorAll(".repo").forEach((button) => {
  if (!repositoryUrl) {
    button.onclick = () => $("#repository").showModal();
    return;
  }
  const link = document.createElement("a");
  link.href = repositoryUrl;
  link.className = button.className;
  link.append(...button.childNodes);
  button.replaceWith(link);
});
function counts() {
  const count = [...events.values()].filter((e) => e.selected).length;
  $("#total").textContent = events.size;
  $("#selected").textContent =
    count + " event" + (count === 1 ? "" : "s") + " selected";
  $("#empty").hidden = events.size > 0;
  $("#export").disabled = !count;
}
function addCard(event) {
  events.set(event.id, event);
  const card = $("#card").content.firstElementChild.cloneNode(true);
  card.dataset.id = event.id;
  icons(card);
  const field = (name) => card.querySelector('[data-field="' + name + '"]');
  function feedback() {
    const error = validate(event);
    card.querySelector(".error").textContent = error;
    const past =
      event.date &&
      event.date < localDay() &&
      !event.note.includes("in the past");
    card.querySelector(".note").textContent = [
      event.note,
      past ? "This date is in the past. Please confirm." : "",
    ]
      .filter(Boolean)
      .join(" ");
    field("time").disabled = event.allDay;
    for (const name of ["title", "date", "time"]) {
      const invalid =
        error &&
        (name === "title"
          ? !event.title.trim()
          : error.toLowerCase().includes(name));
      field(name).setAttribute("aria-invalid", String(Boolean(invalid)));
      field(name).setAttribute("aria-describedby", "feedback-" + event.id);
    }
  }
  card.querySelector(".error").id = "feedback-" + event.id;
  for (const input of card.querySelectorAll("[data-field]")) {
    const name = input.dataset.field;
    const property = input.type === "checkbox" ? "checked" : "value";
    input[property] = event[name];
    input.oninput = () => {
      event[name] = input[property];
      feedback();
      counts();
    };
  }
  card.querySelector(".delete").onclick = () => {
    const next = card.nextElementSibling || card.previousElementSibling;
    events.delete(event.id);
    card.remove();
    counts();
    (next?.querySelector(".delete") || $("#add")).focus();
    status.textContent = "Event removed.";
  };
  $("#events").append(card);
  feedback();
  counts();
  return field("title");
}
function updateCount() {
  $("#count").textContent =
    source.value.length.toLocaleString() + " characters";
}
source.oninput = updateCount;
$("#example").onclick = () => {
  source.value =
    "Math homework is due December 1, 2026 at 11:59 PM. Biology test on November 27, 2026. English essay deadline is December 3, 2026.";
  updateCount();
  source.focus();
};
$("#clear").onclick = () => {
  source.value = "";
  updateCount();
  source.focus();
  status.textContent = "";
};
$("#add").onclick = () => {
  addCard(newEvent()).focus();
  status.textContent = "";
};
$("#extract").onclick = () => {
  if (!source.value.trim()) {
    status.textContent = "Paste an announcement first.";
    source.focus();
    return;
  }
  const result = extract(source.value);
  const keys = new Set([...events.values()].map(eventKey));
  let added = 0,
    skipped = result.duplicates;
  for (const event of result.events) {
    if (keys.has(eventKey(event)) && !validate(event)) {
      skipped++;
      continue;
    }
    keys.add(eventKey(event));
    addCard(event);
    added++;
  }
  status.textContent = result.events.length
    ? added +
      " event" +
      (added === 1 ? "" : "s") +
      " added." +
      (skipped
        ? " Skipped " +
          skipped +
          " duplicate" +
          (skipped === 1 ? "" : "s") +
          "."
        : "")
    : "No deadlines found. Try a supported date or add an event manually.";
  if (added && result.unrecognized)
    status.textContent +=
      " Some text had no recognized date. Check the announcement for missing events.";
};
$("#export").onclick = () => {
  const selected = [...events.values()].filter((e) => e.selected);
  try {
    const data = calendar(selected);
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "deadlinedrop.ics";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = "Calendar file prepared for download.";
  } catch (error) {
    status.textContent = error.message;
    const invalid = selected.find((e) => validate(e));
    if (invalid)
      document
        .querySelector('[data-id="' + invalid.id + '"] [aria-invalid="true"]')
        ?.focus();
  }
};
