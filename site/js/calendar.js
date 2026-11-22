import { validate, eventKey } from "./utils.js";

export function escapeText(value) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/[,;]/g, (c) => "\\" + c);
}
// RFC 5545 limits physical lines to 75 octets, including the continuation space.
export function foldLine(line) {
  const encoder = new TextEncoder();
  let result = "",
    bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
}

export function calendar(events, now = new Date()) {
  if (!events.length) throw Error("Select at least one event.");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DeadlineDrop//Calendar EN",
    "CALSCALE:GREGORIAN",
  ];
  const keys = new Set(),
    ids = new Set();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  for (const e of events) {
    const error = validate(e);
    if (error) throw Error(error);
    if (
      typeof e.id !== "string" ||
      !/^[a-z0-9-]+$/i.test(e.id) ||
      ids.has(e.id)
    )
      throw Error("Invalid or repeated event ID.");
    if (keys.has(eventKey(e)))
      throw Error("Two selected events match. Edit or deselect one.");
    keys.add(eventKey(e));
    ids.add(e.id);
    const day = e.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + e.id + "@deadlinedrop",
      "DTSTAMP:" + stamp,
      e.allDay
        ? "DTSTART;VALUE=DATE:" + day
        : "DTSTART:" + day + "T" + e.time.replace(":", "") + "00",
      "SUMMARY:" + escapeText(e.title.trim()),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
