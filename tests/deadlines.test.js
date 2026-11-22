import test from "node:test";
import assert from "node:assert/strict";
import { extract } from "../site/js/parser.js";
import { calendar } from "../site/js/calendar.js";
const now = new Date(2026, 10, 22, 12);
const parse = (text) => extract(text, now).events;
const first = (text) => parse(text)[0];
for (const raw of [
  "December 15, 2026",
  "Dec 15, 2026",
  "Dec. 15th, 2026",
  "12/15/2026",
  "2026-12-15",
]) {
  test("Reads " + raw, () =>
    assert.equal(first("Math due " + raw).date, "2026-12-15"),
  );
}
test("Extracts titles and separate clauses", () => {
  const result = parse(
    "Submit art and design by December 1 and Biology exam on November 27. Essay deadline is December 3.",
  );
  assert.deepEqual(
    result.map((e) => e.title),
    ["art and design", "Biology exam", "Essay"],
  );
});
test("Infers the next valid occurrence including today", () => {
  for (const [raw, date] of [
    ["Dec 1", "2026-12-01"],
    ["Nov 22", "2026-11-22"],
    ["Nov 21", "2027-11-21"],
    ["Feb 29", "2028-02-29"],
  ]) {
    const e = first("Essay due " + raw);
    assert.equal(e.date, date);
    assert.match(e.note, /Inferred year/);
  }
});
test("Surfaces unresolved dates, missing names, and past dates", () => {
  for (const date of [
    "12/01/2026",
    "13/02/2026",
    "02/15/26",
    "2026-02-29",
    "April 31",
    "tomorrow",
  ]) {
    const e = first("Test on " + date);
    assert.equal(e.date, "");
    assert.ok(e.note);
  }
  assert.equal(first("Due Dec 1").title, "");
  assert.match(first("Test on 2020-01-01").note, /past/);
});
test("Handles time, all-day, empty and duplicate announcements", () => {
  assert.equal(first("Exam on Dec 1").allDay, true);
  for (const [raw, time] of [
    ["11:59 PM", "23:59"],
    ["12 AM", "00:00"],
    ["12 PM", "12:00"],
    ["17:00", "17:00"],
  ])
    assert.equal(first("Essay due December 1 at " + raw).time, time);
  assert.equal(first("Meeting on Dec 1 at 25:00").allDay, false);
  assert.deepEqual(parse("Hello world."), []);
  assert.equal(extract("Essay due Dec 1. Essay due Dec 1.", now).duplicates, 1);
});
test("Generates interoperable floating times and one-day date events", () => {
  const events = parse(
    "Exam on 2026-03-08 at 9:30 AM. Essay due 2026-11-01 at 1:30 AM. Project due Dec 1.",
  );
  const result = calendar(events, new Date("2026-01-01T12:00:00Z"));
  assert.ok(result.endsWith("END:VCALENDAR\r\n"));
  for (const line of [
    "DTSTAMP:20260101T120000Z",
    "DTSTART:20260308T093000",
    "DTSTART:20261101T013000",
    "DTSTART;VALUE=DATE:20261201",
  ])
    assert.ok(result.includes(line + "\r\n"));
  assert.equal(new Set(result.match(/^UID:.+/gm)).size, 3);
});
test("Escapes text and folds UTF-8 without splitting characters", () => {
  const e = first("Exam on Dec 1");
  e.title = "Math, Art; Path\\A\r\n" + "🌱".repeat(60);
  const result = calendar([e]);
  assert.ok(
    result.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
  );
  assert.ok(
    result
      .replaceAll("\r\n ", "")
      .includes("SUMMARY:Math\\, Art\\; Path\\\\A\\n" + "🌱".repeat(60)),
  );
});
test("Rejects invalid or duplicate export rows", () => {
  const e = first("Exam on Dec 1");
  for (const list of [
    [],
    [e, { ...e, id: crypto.randomUUID() }],
    [{ ...e, date: "" }],
    [{ ...e, time: "24:01", allDay: false }],
    [{ ...e, title: " " }],
    [{ ...e, id: "x\r\n" }],
  ])
    assert.throws(() => calendar(list));
});
test("Surfaces partial matches and unsupported time order", () => {
  const result = extract("Exam at 9 AM on Dec 1. See you Friday.", now);
  assert.equal(result.unrecognized, 1);
  assert.equal(result.events[0].allDay, false);
  assert.throws(() => calendar(result.events));
});
