export interface Department {
  id: number;
  code: string;
  name: string;
}

export type Building = Department;

export interface Course {
  id: number;
  course_id: string;
  name: string;
  department: number;
}

export interface Batch {
  id: number;
  name: string;
  department: number;
  semester: number;
  shift: 'M' | 'E';
  courses: number[];
}

export interface Teacher {
  id: number;
  name: string;
  department: number;
  tier: number;
  email: string;
  requested_slots: string[];
  can_teach: number[];
}

export type Faculty = Teacher;

export interface CourseAssignment {
  id: number;
  course: number;
  batch: number;
  teacher: number;
  weekly_hours: number;
  type: 'T' | 'P';
}

export interface Floor {
  id: string;
  number: number;
  rooms: Room[];
}

export interface Room {
  id: string;
  departmentId: string;
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
  id: string;
  subjectCode: string;
  subjectName?: string;
  batchId: string;
  teacherId?: string;
  facultyId?: string;
  roomId: string;
  startTime: string; // HH:mm
  durationMinutes: number;
  conflicts?: ConflictDetail[];
  isLocked?: boolean;
  isMerged?: boolean;
  isConflict?: boolean;
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

export interface DepartmentData {
  id: string;
  name: string;
  floors: { [floorId: string]: FloorData };
}

export type BuildingData = DepartmentData;

export interface MasterMap {
  [deptId: string]: DepartmentData;
}

export type NexusMasterMap = MasterMap;

export interface AppState {
  view: 'dashboard' | 'timetable' | 'teachers' | 'settings' | 'export' | 'teacher' | 'admin';
  zoomLevel: number;
  selectedDepartments: number[];
  classes: ClassSession[];
  masterMap?: MasterMap;
}
