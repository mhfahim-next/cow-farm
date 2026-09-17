import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function displayDate(value?: string | null, time = false) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(time ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
      }).format(d);
}
export const taka = (value: string | number | undefined | null) =>
  value == null
    ? 'Not recorded'
    : new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 2,
      }).format(Number(value));
export function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function localNow() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return parts.replace(' ', 'T');
}
