/**
 * Format a Date in Abuja's West Africa Time (WAT, UTC+1).
 * Avoids relying on Intl timezone support which may not work
 * on all server environments (e.g. Vercel Lambda).
 */

const ABUJA_OFFSET_MS = 60 * 60 * 1000; // WAT, UTC+1

function toAbujaDate(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + ABUJA_OFFSET_MS);
}

export function formatAbujaTime(date: Date): string {
  const d = toAbujaDate(date);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function formatAbujaTimeWithSeconds(date: Date): string {
  const d = toAbujaDate(date);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const seconds = d.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes}:${seconds} ${ampm}`;
}

export function formatAbujaDate(date: Date): string {
  const d = toAbujaDate(date);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatAbujaDateLong(date: Date): string {
  const d = toAbujaDate(date);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
