export type Department = 'Computer Science' | 'Physics' | 'Mathematics' | 'Arts' | 'Engineering';

export interface Faculty {
  id: string;
  name: string;
  department: Department;
  tier: 1 | 2 | 3;
  requestedSlots: string[]; // e.g., ['08:00', '10:00']
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
  facultyId: string;
  roomId: string;
  startTime: string; // HH:mm
  durationMinutes: number;
  conflicts?: ConflictDetail[];
  isMerged?: boolean;
  isLocked?: boolean;
}

export interface AppState {
  view: 'dashboard' | 'timetable' | 'faculty' | 'rooms' | 'student' | 'settings' | 'export' | 'teacher';
  zoomLevel: number; // 0.5 to 2
  selectedDepartments: Department[];
  classes: ClassSession[];
  masterMap?: NexusMasterMap;
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

export interface NexusMasterMap {
  [buildingId: string]: BuildingData;
}
