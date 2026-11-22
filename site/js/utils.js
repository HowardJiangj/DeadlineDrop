export const pad = (n) => String(n).padStart(2, "0");
export function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const day = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(day.valueOf()) && day.toISOString().slice(0, 10) === value
  );
}
export function validate(event) {
  if (!event.title.trim()) return "Enter an event title.";
  if (!validDate(event.date)) return "Choose a valid date.";
  if (!event.allDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time))
    return "Choose a valid time or select All day.";
  return "";
}
export const eventKey = (e) =>
  JSON.stringify([
    e.title.trim().toLowerCase().replace(/\s+/g, " "),
    e.date,
    e.allDay ? "all-day" : e.time,
  ]);
export const newEvent = () => ({
  id: crypto.randomUUID(),
  title: "",
  date: "",
  time: "",
  allDay: true,
  selected: true,
  note: "",
});
