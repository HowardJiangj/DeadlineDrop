import {
  pad,
  localDay,
  validDate,
  newEvent,
  eventKey,
  validate,
} from "./utils.js";

const months =
  "january february march april may june july august september october november december".split(
    " ",
  );
const monthPattern = months.map((m) => m + "|" + m.slice(0, 3)).join("|");
const dateSource = String.raw`\b(?:(?:${monthPattern})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)\b`;
const deadlineWord =
  /\b(due|deadline|submit|test|exam|quiz|assignment|meeting|by|tomorrow|next week)\b/i;

function resolveDate(raw, today) {
  let year, month, day;
  if (raw.includes("-")) [year, month, day] = raw.split("-").map(Number);
  else if (raw.includes("/")) {
    const parts = raw.split("/");
    [month, day, year] = parts.map(Number);
    if (
      (month <= 12 && day <= 12 && month !== day) ||
      month > 12 ||
      (parts[2] && parts[2].length !== 4)
    )
      return {
        date: "",
        note: "Numeric date needs review. Choose the intended date.",
      };
  } else {
    const parts = raw.match(/[a-z]+|\d+/gi);
    month = months.findIndex((m) => m.startsWith(parts[0].toLowerCase())) + 1;
    [day, year] = raw.match(/\d+/g).map(Number);
  }
  const inferred = year === undefined;
  if (inferred) year = Number(today.slice(0, 4));
  const format = () =>
    [String(year).padStart(4, "0"), pad(month), pad(day)].join("-");
  if (inferred && format() < today) year++;
  if (inferred && month === 2 && day === 29)
    while (!validDate(format()) && year < 9999) year++;
  const date = format();
  if (!validDate(date))
    return { date: "", note: "Invalid calendar date. Choose a correction." };
  return {
    date,
    note: inferred
      ? "Inferred year " + year + ". Please confirm."
      : date < today
        ? "This date is in the past. Please confirm."
        : "",
  };
}

function parseClause(clause, today) {
  const dates = [...clause.matchAll(new RegExp(dateSource, "gi"))];
  if (!dates.length && !deadlineWord.test(clause)) return null;
  const event = newEvent();
  const match = dates[0];
  const prefix = match ? clause.slice(0, match.index) : clause;
  const tail = match ? clause.slice(match.index + match[0].length).trim() : "";
  event.title = prefix
    .replace(/^\s*[-•*]\s*/, "")
    .replace(/^submit\s+/i, "")
    .replace(
      /\s*\b(?:(?:is\s+)?due(?:\s+(?:on|by))?|deadline(?:\s+is)?|submit\s+by|on|by|at)\s*[:,-]?\s*$/i,
      "",
    )
    .trim()
    .replace(/[:,-]\s*$/, "")
    .trim();
  if (!match || dates.length !== 1) {
    event.note = "Review the source and choose a date: " + clause;
    return event;
  }
  Object.assign(event, resolveDate(match[0], today));
  const clock = tail.match(
    /^(?:,\s*)?(?:at\s+|by\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (
    !tail &&
    /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)|noon|midnight)\b/i.test(prefix)
  ) {
    event.allDay = false;
    event.note += " Review the time before the date: " + prefix;
  }
  if (tail) {
    event.allDay = false;
    if (clock && (clock[2] || clock[3])) {
      let hour = Number(clock[1]);
      const minute = Number(clock[2] || 0);
      if (minute < 60 && (clock[3] ? hour >= 1 && hour <= 12 : hour < 24)) {
        if (clock[3])
          hour = (hour % 12) + (clock[3].toLowerCase() === "pm" ? 12 : 0);
        event.time = pad(hour) + ":" + pad(minute);
      }
    }
    if (!event.time) event.note += " Review text after the date: " + tail;
  }
  if (!event.date) event.note += " Source: " + match[0];
  return event;
}

export function extract(text, now = new Date()) {
  const events = [],
    seen = new Set();
  let duplicates = 0,
    unrecognized = 0;
  // Protect abbreviated month periods before tokenizing sentences.
  const clean = text.replace(
    new RegExp("\\b(" + monthPattern + ")\\.(?=\\s+\\d)", "gi"),
    "$1",
  );
  for (const sentence of clean.split(/[;\n!?]+|\.(?=\s|$)/)) {
    // Split conjunctions only after a date and before another dated clause.
    let pending = "";
    for (const piece of sentence.split(/\s+(and|then)\s+/i)) {
      if (/^(and|then)$/i.test(piece)) {
        pending += " " + piece + " ";
        continue;
      }
      const head = pending.replace(/,?\s+(and|then)\s+$/i, "");
      if (
        new RegExp(dateSource, "i").test(head) &&
        (new RegExp(dateSource, "i").test(piece) || deadlineWord.test(piece))
      ) {
        add(head);
        pending = piece;
      } else pending += piece;
    }
    add(pending);
  }
  function add(value) {
    const event = parseClause(value.trim(), localDay(now));
    if (!event) {
      if (value.trim()) unrecognized++;
      return;
    }
    const key = validate(event) ? value.trim().toLowerCase() : eventKey(event);
    if (seen.has(key)) duplicates++;
    else {
      events.push(event);
      seen.add(key);
    }
  }
  return { events, duplicates, unrecognized };
}
