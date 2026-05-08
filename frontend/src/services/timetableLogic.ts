import { ClassSession, ConflictDetail, Faculty } from '../types.ts';
import { FACULTY } from '../constants.ts';

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
 */
export const checkConflicts = (
  target: ClassSession,
  others: ClassSession[]
): ConflictDetail[] => {
  const conflicts: ConflictDetail[] = [];
  const targetStart = timeToMinutes(target.startTime);
  const targetEnd = targetStart + target.durationMinutes;

  // Fixed Boundaries (Lunch/Prayer: 13:00 - 14:00)
  const lunStart = 13 * 60;
  const lunEnd = 14 * 60;
  if (targetStart < lunEnd && lunStart < targetEnd) {
    conflicts.push({
      type: 'Boundary',
      severity: 'Critical',
      conflictingWithName: 'Reserved Break'
    });
  }

  others.filter(s => s.id !== target.id).forEach(other => {
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = otherStart + other.durationMinutes;

    const isOverlap = targetStart < otherEnd && otherStart < targetEnd;

    if (isOverlap) {
      // Room Pool Check
      if (target.roomId === other.roomId && !target.isMerged) {
        conflicts.push({
          type: 'Room',
          severity: 'Critical',
          conflictingWithId: other.id,
          conflictingWithName: `Room Overlap: ${other.subjectCode}`
        });
      }

      // Teacher Pool Check
      if (target.facultyId === other.facultyId) {
        const faculty = FACULTY.find(f => f.id === target.facultyId);
        conflicts.push({
          type: 'Teacher',
          severity: 'Critical',
          conflictingWithId: other.id,
          conflictingWithName: `${faculty?.name} is already booked`
        });
      }

      // Batch Pool Check
      if (target.batchId === other.batchId) {
        conflicts.push({
          type: 'Batch',
          severity: 'Warning',
          conflictingWithId: other.id,
          conflictingWithName: `Batch clash: ${other.subjectCode}`
        });
      }
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
        gaps.push({
          start: currentEnd,
          end: nextStart,
          duration,
          severity: duration > 120 ? 'high' : 'low'
        });
      }
    }
  }

  return gaps;
};

/**
 * Merging Candidates Finder
 */
export const findMergeCandidates = (sessions: ClassSession[]) => {
  return sessions.filter((s, i) => {
    return sessions.some((other, j) => 
      i !== j && 
      s.facultyId === other.facultyId && 
      s.subjectCode === other.subjectCode && 
      s.startTime === other.startTime
    );
  });
};
