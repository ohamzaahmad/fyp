import { ClassSession, ConflictDetail, Teacher } from '../types.ts';

/**
 * Converts HH:mm string to total minutes from 00:00
 */
export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Multi-Dimensional Interval Collision Detection
 * Logic: A.start < B.end AND B.start < A.end
 *
 * Merge Rule: If two sessions in the same room/time share the SAME teacher AND same course,
 * they are merge candidates (Warning), not a hard conflict.
 * All other same-room overlaps are Critical conflicts.
 */
import { normalizeTeacherId, normalizeDay } from '../lib/utils.ts';

export const checkConflicts = (
  target: ClassSession,
  others: ClassSession[],
  teacherList?: Teacher[]
): ConflictDetail[] => {
  const conflicts: ConflictDetail[] = [];
  const teacherPool: Teacher[] = teacherList ?? [];
  const targetStart = timeToMinutes(target.startTime);
  const targetEnd = targetStart + target.durationMinutes;

  // Fixed Boundary: the Break slot (12:10 - 13:10)
  const breakStart = 12 * 60 + 10;
  const breakEnd   = 13 * 60 + 10;
  if (targetStart < breakEnd && breakStart < targetEnd) {
    conflicts.push({
      type: 'Boundary',
      severity: 'Critical',
      conflictingWithName: 'Reserved Break Period (12:10 – 1:10)'
    });
  }

  others.filter(s => s.id !== target.id).forEach(other => {
    // A conflict can only happen if they are on the same day
    const targetDay = normalizeDay(target.day_of_week ?? (target as any).dayOfWeek);
    const otherDay = normalizeDay(other.day_of_week ?? (other as any).dayOfWeek);

    // Require both `day` fields to be present and equal before evaluating conflicts.
    if (!(targetDay && otherDay && targetDay === otherDay)) return;

    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = otherStart + other.durationMinutes;
    const isOverlap = targetStart < otherEnd && otherStart < targetEnd;
    if (!isOverlap) return;

    const targetTeacher = normalizeTeacherId(target.teacherId ?? target.facultyId ?? '');
    const otherTeacher = normalizeTeacherId(other.teacherId ?? other.facultyId ?? '');
    const sameTeacher = targetTeacher && otherTeacher && targetTeacher === otherTeacher;
    const sameCourse = target.subjectCode === other.subjectCode;

    // Room conflict
    if (target.roomId === other.roomId && !target.isMerged && !other.isMerged) {
      if (sameTeacher && sameCourse) {
        if (target.batchId !== other.batchId) {
          // Merge candidate — same teacher, same course, DIFFERENT batch
          conflicts.push({
            type: 'Room',
            severity: 'Warning',
            conflictingWithId: other.id,
            conflictingWithName: `Merge Candidate: ${other.batchId} (same ${other.subjectCode})`
          });
        } else {
          // Duplicate entry — same teacher, same course, SAME batch
          conflicts.push({
            type: 'Room',
            severity: 'Critical',
            conflictingWithId: other.id,
            conflictingWithName: `Duplicate Entry: ${other.subjectCode} already scheduled for ${other.batchId}`
          });
        }
      } else {
        // Hard room conflict — different teacher or different course
        conflicts.push({
          type: 'Room',
          severity: 'Critical',
          conflictingWithId: other.id,
          conflictingWithName: `Room Overlap: ${other.subjectCode} (${other.batchId})`
        });
      }
    }

    // Teacher double-booked — only flag if it's a DIFFERENT course
    if (sameTeacher && !sameCourse) {
      const teacher = teacherPool.find(f => String(f.id) === String(targetTeacher));
      conflicts.push({
        type: 'Teacher',
        severity: 'Critical',
        conflictingWithId: other.id,
        conflictingWithName: `${teacher?.name || 'Teacher'} has another class: ${other.subjectCode}`
      });
    }

    // Batch clash — same batch, different class at the same time
    if (target.batchId === other.batchId) {
      conflicts.push({
        type: 'Batch',
        severity: 'Critical',
        conflictingWithId: other.id,
        conflictingWithName: `Batch ${target.batchId} clash: ${other.subjectCode}`
      });
    }
  });

  return conflicts;
};

/**
 * Gap Heatmap Calculation for Batch View
 */
export const calculateGaps = (sessions: ClassSession[]) => {
  const sorted = [...sessions].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const gaps: { start: number; end: number; duration: number; severity: 'low' | 'high' }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = timeToMinutes(sorted[i].startTime) + sorted[i].durationMinutes;
    const nextStart = timeToMinutes(sorted[i + 1].startTime);
    if (nextStart > currentEnd) {
      const duration = nextStart - currentEnd;
      if (duration > 30) {
        gaps.push({ start: currentEnd, end: nextStart, duration, severity: duration > 120 ? 'high' : 'low' });
      }
    }
  }

  return gaps;
};

/**
 * Find sessions that are merge candidates (same teacher + same course at same time slot)
 */
export const findMergeCandidates = (sessions: ClassSession[]) => {
  // Merge candidates: same teacher, same course, same day — time may differ.
  return sessions.filter((s, i) =>
    sessions.some((other, j) => {
      if (i === j) return false;
      const sTeacher = normalizeTeacherId(s.teacherId ?? s.facultyId ?? '');
      const oTeacher = normalizeTeacherId(other.teacherId ?? other.facultyId ?? '');
      const sameTeacher = sTeacher && oTeacher && sTeacher === oTeacher;
      const sameCourse = s.subjectCode === other.subjectCode;
      const sDay = normalizeDay(s.day_of_week ?? (s as any).dayOfWeek);
      const oDay = normalizeDay(other.day_of_week ?? (other as any).dayOfWeek);
      const sameDay = sDay && oDay && sDay === oDay;
      return sameTeacher && sameCourse && sameDay;
    })
  );
};
