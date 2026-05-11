import { Building, Faculty, Department, ClassSession } from './types.ts';

const _RUNTIME = (globalThis as any).__NEXUS_DATA__ || {};

export let DEPARTMENTS: Department[] = _RUNTIME.DEPARTMENTS || [
  'Computer Science',
  'Physics',
  'Mathematics',
  'Arts',
  'Engineering',
];

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

export let FACULTY: Faculty[] = _RUNTIME.FACULTY || [
  { id: 'f1', name: 'Dr. Sarah Connor', department: 'Computer Science', tier: 1, requestedSlots: ['08:00', '09:00'] },
  { id: 'f2', name: 'Prof. Albus D.', department: 'Physics', tier: 1, requestedSlots: ['14:00'] },
  { id: 'f3', name: 'Dr. Jane Foster', department: 'Engineering', tier: 2, requestedSlots: [] },
  { id: 'f4', name: 'Prof. Charles X.', department: 'Mathematics', tier: 1, requestedSlots: ['10:00'] },
  { id: 'f5', name: 'Dr. Elias Thorne', department: 'Computer Science', tier: 1, requestedSlots: [] },
  { id: 'f6', name: 'Prof. Sarah Miller', department: 'Mathematics', tier: 2, requestedSlots: [] },
];

export let INITIAL_CLASSES: ClassSession[] = _RUNTIME.INITIAL_CLASSES || [
  { id: 'c1', subjectCode: 'CS101', batchId: 'B2023-A', facultyId: 'f1', roomId: 'r101', startTime: '08:00', durationMinutes: 90, isLocked: true },
  { id: 'c2', subjectCode: 'PH202', batchId: 'B2023-B', facultyId: 'f2', roomId: 'r102', startTime: '10:00', durationMinutes: 60 },
  { id: 'c3', subjectCode: 'MA303', batchId: 'B2022-C', facultyId: 'f4', roomId: 'r201', startTime: '11:00', durationMinutes: 120 },
  { id: 'c4', subjectCode: 'CS102', batchId: 'B2023-A', facultyId: 'f1', roomId: 'r103', startTime: '14:00', durationMinutes: 60 },
  { id: 'c5', subjectCode: 'AR101', batchId: 'B2024-D', facultyId: 'f3', roomId: 'r101_b2', startTime: '09:00', durationMinutes: 90 },
  { id: 'c6', subjectCode: 'CS301', batchId: 'B2021-E', facultyId: 'f5', roomId: 'r201', startTime: '08:30', durationMinutes: 90 },
  { id: 'c7', subjectCode: 'MA101', batchId: 'B2024-F', facultyId: 'f6', roomId: 'r102_b2', startTime: '10:00', durationMinutes: 120 },
];

export function setRuntimeData(data: Partial<{ DEPARTMENTS: Department[]; BUILDINGS: Building[]; FACULTY: Faculty[]; INITIAL_CLASSES: ClassSession[] }>) {
  if (data.DEPARTMENTS) DEPARTMENTS = data.DEPARTMENTS;
  if (data.BUILDINGS) BUILDINGS = data.BUILDINGS;
  if (data.FACULTY) FACULTY = data.FACULTY;
  if (data.INITIAL_CLASSES) INITIAL_CLASSES = data.INITIAL_CLASSES;
  // Also expose on global for external scripts
  (globalThis as any).__NEXUS_DATA__ = {
    DEPARTMENTS,
    BUILDINGS,
    FACULTY,
    INITIAL_CLASSES,
  };
}
