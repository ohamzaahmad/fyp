import { Building, Teacher, Department, ClassSession, Faculty } from './types.ts';

const _RUNTIME = (globalThis as any).__NEXUS_DATA__ || {};

export let DEPARTMENTS: Department[] = _RUNTIME.DEPARTMENTS || [];

export let BUILDINGS: Building[] = _RUNTIME.BUILDINGS || [
  {
    id: 'b1',
    name: 'Tech Hall',
    floors: [
      {
        id: 'f1',
        number: 1,
        rooms: [
          { id: 'r101', buildingId: 'b1', floorId: 'f1', name: 'L-101', capacity: 60 },
          { id: 'r102', buildingId: 'b1', floorId: 'f1', name: 'L-102', capacity: 45 },
          { id: 'r103', buildingId: 'b1', floorId: 'f1', name: 'Lab-A', capacity: 30 },
        ],
      },
      {
        id: 'f2',
        number: 2,
        rooms: [
          { id: 'r201', buildingId: 'b1', floorId: 'f2', name: 'C-201', capacity: 120 },
          { id: 'r202', buildingId: 'b1', floorId: 'f2', name: 'C-202', capacity: 120 },
          { id: 'r203', buildingId: 'b1', floorId: 'f2', name: 'C-203', capacity: 120 },
        ],
      },
    ],
  },
  {
    id: 'b2',
    name: 'Main Block',
    floors: [
      {
        id: 'f1_b2',
        number: 1,
        rooms: [
          { id: 'r101_b2', buildingId: 'b2', floorId: 'f1_b2', name: 'MB-101', capacity: 80 },
          { id: 'r102_b2', buildingId: 'b2', floorId: 'f1_b2', name: 'MB-102', capacity: 80 },
        ],
      },
      {
        id: 'f2_b2',
        number: 2,
        rooms: [
          { id: 'r201_b2', buildingId: 'b2', floorId: 'f2_b2', name: 'MB-201', capacity: 150 },
        ],
      },
    ],
  },
  {
    id: 'b3',
    name: 'Arts Center',
    floors: [
      {
        id: 'f1_b3',
        number: 1,
        rooms: [
          { id: 'r101_b3', buildingId: 'b3', floorId: 'f1_b3', name: 'Studio-1', capacity: 40 },
          { id: 'r102_b3', buildingId: 'b3', floorId: 'f1_b3', name: 'Studio-2', capacity: 40 },
        ],
      },
    ],
  },
];

export let FACULTY: Teacher[] = _RUNTIME.FACULTY || [
  { id: 1, name: 'Dr. Sarah Connor', department: 1, tier: 1, requested_slots: ['08:00', '09:00'], email: 'sarah@example.com', can_teach: [] },
  { id: 2, name: 'Prof. Albus D.', department: 2, tier: 1, requested_slots: ['14:00'], email: 'albus@example.com', can_teach: [] },
  { id: 3, name: 'Dr. Jane Foster', department: 5, tier: 2, requested_slots: [], email: 'jane@example.com', can_teach: [] },
  { id: 4, name: 'Prof. Charles X.', department: 3, tier: 1, requested_slots: ['10:00'], email: 'charles@example.com', can_teach: [] },
  { id: 5, name: 'Dr. Elias Thorne', department: 1, tier: 1, requested_slots: [], email: 'elias@example.com', can_teach: [] },
  { id: 6, name: 'Prof. Sarah Miller', department: 3, tier: 2, requested_slots: [], email: 'miller@example.com', can_teach: [] },
];

// Alias for clarity: prefer `TEACHERS` but keep `FACULTY` for runtime compatibility
export let TEACHERS: Teacher[] = FACULTY;

export let INITIAL_CLASSES: ClassSession[] = _RUNTIME.INITIAL_CLASSES || [
  { id: 'c1', subjectCode: 'CS101', batchId: 'B2023-A', facultyId: '1', teacherId: '1', roomId: 'r101', startTime: '08:00', durationMinutes: 90, isLocked: true },
  { id: 'c2', subjectCode: 'PH202', batchId: 'B2023-B', facultyId: '2', teacherId: '2', roomId: 'r102', startTime: '10:00', durationMinutes: 60 },
  { id: 'c3', subjectCode: 'MA303', batchId: 'B2022-C', facultyId: '4', teacherId: '4', roomId: 'r201', startTime: '11:00', durationMinutes: 120 },
  { id: 'c4', subjectCode: 'CS102', batchId: 'B2023-A', facultyId: '1', teacherId: '1', roomId: 'r103', startTime: '14:00', durationMinutes: 60 },
  { id: 'c5', subjectCode: 'AR101', batchId: 'B2024-D', facultyId: '3', teacherId: '3', roomId: 'r101_b2', startTime: '09:00', durationMinutes: 90 },
  { id: 'c6', subjectCode: 'CS301', batchId: 'B2021-E', facultyId: '5', teacherId: '5', roomId: 'r201', startTime: '08:30', durationMinutes: 90 },
  { id: 'c7', subjectCode: 'MA101', batchId: 'B2024-F', facultyId: '6', teacherId: '6', roomId: 'r102_b2', startTime: '10:00', durationMinutes: 120 },
];

export function setRuntimeData(data: Partial<{ DEPARTMENTS: Department[]; BUILDINGS: Building[]; FACULTY: Faculty[]; INITIAL_CLASSES: ClassSession[] }>) {
  if (data.DEPARTMENTS) DEPARTMENTS = data.DEPARTMENTS;
  if (data.BUILDINGS) BUILDINGS = data.BUILDINGS;
  if (data.FACULTY) FACULTY = data.FACULTY;
  if (data.FACULTY) TEACHERS = data.FACULTY;
  if (data.INITIAL_CLASSES) INITIAL_CLASSES = data.INITIAL_CLASSES;
  // Also expose on global for external scripts
  (globalThis as any).__NEXUS_DATA__ = {
    DEPARTMENTS,
    BUILDINGS,
    FACULTY,
    TEACHERS,
    INITIAL_CLASSES,
  };
}

export const TIME_SLOTS = [
  '8:00 - 8:50', '8:50 - 9:40', '9:40 - 10:30', '10:30 - 11:20', '11:20 - 12:10', '12:10 - 1:00',
  'Break',
  '1:10 - 2:00', '2:00 - 2:50', '2:50 - 3:40', '3:40 - 4:30', '4:30 - 5:20', '5:20 - 6:10'
];

export const parseTime = (t: string) => {
  const [hStr, mStr] = t.split(':').map(s => s.trim());
  let h = Number(hStr);
  const m = Number(mStr || '0');
  // Simple heuristic: hours 1-7 are PM
  if (h >= 1 && h <= 7) h += 12;
  return h * 60 + m;
};

export const getSlotRanges = () => {
  return TIME_SLOTS.map((slot, idx) => {
    if (slot === 'Break') return null;
    const parts = slot.split('-').map(p => p.trim());
    return { 
      start: parseTime(parts[0]), 
      end: parseTime(parts[1]),
      label: slot,
      index: idx
    };
  });
};
