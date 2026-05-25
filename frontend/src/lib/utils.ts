import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalize teacher/faculty id strings used across the frontend.
export function normalizeTeacherId(id?: string | number | null): string {
  if (id == null) return '';
  const s = String(id).trim();
  return s.replace(/^faculty-/i, '');
}

// Normalize day strings (Mon, Tue...) or return empty string if missing
export function normalizeDay(day?: string | null): string {
  if (!day) return '';
  return String(day).trim();
}

// Ensure a session object has normalized teacher id and day fields.
export function normalizeSession<T extends { teacherId?: any; facultyId?: any; day_of_week?: any; dayOfWeek?: any }>(session: T) {
  const teacherId = normalizeTeacherId(session.teacherId ?? session.facultyId ?? '');
  const day = normalizeDay(session.day_of_week ?? session.dayOfWeek ?? '');
  return {
    ...session,
    teacherId,
    facultyId: teacherId,
    day_of_week: day,
  } as T & { teacherId: string; facultyId: string; day_of_week: string };
}
