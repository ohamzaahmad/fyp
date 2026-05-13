export type Department = 'Computer Science' | 'Physics' | 'Mathematics' | 'Arts' | 'Engineering';

export interface Teacher {
  id: string;
  name: string;
  department: Department;
  tier: 1 | 2 | 3;
  requestedSlots: string[]; // e.g., ['08:00', '10:00']
}

export interface Batch {
  id: number;
  subject_code: string;
  subject_name?: string;
  batch_id: string;
  // Prefer `teacher` but accept legacy `faculty` field for compatibility.
  teacher?: number | null;
  faculty?: number | null;
  weekly_hours: number;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

export interface Floor {
  id: string;
  number: number;
  rooms: Room[];
}

export interface Room {
  id: string;
  buildingId: string;
  floorId: string;
  name: string;
  capacity: number;
}

export interface ConflictDetail {
  type: 'Room' | 'Teacher' | 'Batch' | 'Boundary';
  conflictingWithId?: string;
  conflictingWithName?: string;
  severity: 'Critical' | 'Warning';
}

export interface ClassSession {
  isConflict?: import("react/jsx-runtime").JSX.Element | null;
  id: string;
  subjectCode: string;
  subjectName?: string;
  batchId: string;
  // Prefer `teacherId`; keep `facultyId` for backwards compatibility.
  teacherId?: string;
  facultyId?: string;
  roomId: string;
  startTime: string; // HH:mm
  durationMinutes: number;
  conflicts?: ConflictDetail[];
  isMerged?: boolean;
  isLocked?: boolean;
}

export interface AppState {
  view: 'dashboard' | 'timetable' | 'teachers' | 'rooms' | 'student' | 'settings' | 'export' | 'teacher' | 'mastermap-debug' | 'admin';
  zoomLevel: number; // 0.5 to 2
  selectedDepartments: Department[];
  classes: ClassSession[];
  masterMap?: MasterMap;
}

export interface RoomData {
  id: string;
  name: string;
  capacity: number;
  sessions: ClassSession[];
}

export interface FloorData {
  id: string;
  number: number;
  rooms: { [roomId: string]: RoomData };
}

export interface BuildingData {
  id: string;
  name: string;
  floors: { [floorId: string]: FloorData };
}

export interface MasterMap {
  [buildingId: string]: BuildingData;
}

// Backwards compatibility: `Faculty` historically named in older UI
// mappings. Keep a type alias so incremental renames don't break imports.
export type Faculty = Teacher;
