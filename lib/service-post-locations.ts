export const SERVICE_POST_LOCATIONS = [
  "Main Church – FrontRow 1",
  "Main Church – FrontRow 2",
  "Main Church – FrontRow 3",
  "Main Church – FrontRow 4",
  "Main Church – BackRow 1",
  "Main Church – BackRow 2 & Front Media",
  "Main Church – BackRow 3",
  "Main Church – BackRow 4 & Back Media",
  "Overflow – Row 1",
  "Overflow – Row 2",
  "Overflow – Row 3",
  "Overflow – Row 4",
  "Outside – Vendors Gate",
  "Outside – Main Gate",
  "Outside – Emporium & Toilet",
  "Mighty Arrows - Entrance",
  "Mighty Arrows - Exit",
] as const;

export function normalizeServicePostLocation(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

const SERVICE_POST_LOCATION_KEYS = new Set(SERVICE_POST_LOCATIONS.map(normalizeServicePostLocation));

export function isServicePostLocation(value: string) {
  return SERVICE_POST_LOCATION_KEYS.has(normalizeServicePostLocation(value));
}
