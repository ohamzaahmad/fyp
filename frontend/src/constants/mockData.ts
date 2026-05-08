import { Faculty, Room, Building, ClassSession } from '../types.ts';

export const MOCK_FACULTY: Faculty[] = [
  { id: 'f_nimra', name: 'Ms. Nimra Razzaq', department: 'Computer Science', tier: 1, requestedSlots: ['08:00', '09:40'] },
  { id: 'f_amara', name: 'Ms. Amara Rafique', department: 'Computer Science', tier: 1, requestedSlots: ['13:10', '14:50'] },
  { id: 'f_anam', name: 'Miss. Anam Khalid', department: 'Computer Science', tier: 2, requestedSlots: ['11:20'] },
  { id: 'f_raheela', name: 'Mrs. Raheela Nasim', department: 'Computer Science', tier: 1, requestedSlots: ['09:40'] },
  { id: 'f_iram', name: 'Ms. Iram Shazadi', department: 'Computer Science', tier: 1, requestedSlots: ['11:20'] },
  { id: 'f_nabeela', name: 'Miss. Nabeela Ashraf', department: 'Computer Science', tier: 2, requestedSlots: ['13:10'] },
  { id: 'f_asif', name: 'Mr. Asif Ashiq', department: 'Computer Science', tier: 2, requestedSlots: ['14:50'] },
  { id: 'f_kainat', name: 'Ms. Kainat Amjad', department: 'Computer Science', tier: 3, requestedSlots: ['16:30'] },
  { id: 'f_m_ahsan', name: 'Dr. M. Ahsan Latif', department: 'Computer Science', tier: 1, requestedSlots: [] },
  { id: 'f_salam', name: 'Dr. Salman Afsar Awan', department: 'Computer Science', tier: 1, requestedSlots: [] },
];

export const MOCK_BUILDINGS: Building[] = [
  {
    id: 'b_main',
    name: 'Main Campus',
    floors: [
      {
        id: 'fl_ground',
        number: 0,
        rooms: [
          { id: 'r1', buildingId: 'b_main', floorId: 'fl_ground', name: 'G-Floor R#1', capacity: 60 },
          { id: 'r2', buildingId: 'b_main', floorId: 'fl_ground', name: 'G-Floor R#2', capacity: 60 },
          { id: 'r3', buildingId: 'b_main', floorId: 'fl_ground', name: 'G-Floor R#3', capacity: 60 },
        ]
      },
      {
        id: 'fl_first',
        number: 1,
        rooms: [
          { id: 'r1_f1', buildingId: 'b_main', floorId: 'fl_first', name: 'First Floor R #1', capacity: 50 },
          { id: 'r2_f1', buildingId: 'b_main', floorId: 'fl_first', name: 'First Floor R #2', capacity: 50 },
          { id: 'lab1_f1', buildingId: 'b_main', floorId: 'fl_first', name: 'First Floor Lab #1', capacity: 40 },
          { id: 'lab2_f1', buildingId: 'b_main', floorId: 'fl_first', name: 'First Floor Lab #2', capacity: 40 },
          { id: 'lab3_f1', buildingId: 'b_main', floorId: 'fl_first', name: 'First Floor Lab #3', capacity: 40 },
        ]
      },
      {
        id: 'fl_second',
        number: 2,
        rooms: [
          { id: 'lab1_f2', buildingId: 'b_main', floorId: 'fl_second', name: 'Second Floor Lab#1', capacity: 40 },
          { id: 'lab2_f2', buildingId: 'b_main', floorId: 'fl_second', name: 'Second Floor Lab#2', capacity: 40 },
          { id: 'lab3_f2', buildingId: 'b_main', floorId: 'fl_second', name: 'Second Floor Lab#3', capacity: 40 },
          { id: 'lab4_f2', buildingId: 'b_main', floorId: 'fl_second', name: 'Second Floor Lab#4', capacity: 40 },
        ]
      }
    ]
  }
];

export const MOCK_CLASSES: ClassSession[] = [
  // Monday G-Floor R#1
  { id: 's1', subjectCode: 'CS-506-T', subjectName: 'Software Engineering', batchId: 'BSCS-6th-M3', facultyId: 'f_nimra', roomId: 'r1', startTime: '09:40', durationMinutes: 100 },
  { id: 's2', subjectCode: 'CS-408-T', subjectName: 'Database Systems', batchId: 'BSIT-4th-M2', facultyId: 'f_anam', roomId: 'r1', startTime: '11:20', durationMinutes: 100 },
  { id: 's3', subjectCode: 'CS-406-T', subjectName: 'Operating Systems', batchId: 'BSCS-4th-E1', facultyId: 'f_amara', roomId: 'r1', startTime: '13:10', durationMinutes: 100 },
  { id: 's4', subjectCode: 'IT-504-P', subjectName: 'Web Programming Lab', batchId: 'BSIT-6th-E1', facultyId: 'f_amara', roomId: 'r1', startTime: '14:50', durationMinutes: 100 },
  
  // Monday G-Floor R#2
  { id: 's5', subjectCode: 'CS-306-T', subjectName: 'Programming Fund.', batchId: 'BSDS-2nd-M1', facultyId: 'f_anam', roomId: 'r2', startTime: '08:00', durationMinutes: 100 },
  { id: 's6', subjectCode: 'CS-408-T', subjectName: 'Database Systems', batchId: 'BSCS-4th-M1', facultyId: 'f_raheela', roomId: 'r2', startTime: '09:40', durationMinutes: 100 },
  { id: 's7', subjectCode: 'IT-512-T', subjectName: 'Network Security', batchId: 'BSIT-6th-M2', facultyId: 'f_iram', roomId: 'r2', startTime: '11:20', durationMinutes: 100 },
  
  // Monday Second Floor Lab#1
  { id: 's8', subjectCode: 'SE-510-T', subjectName: 'Software Quality Assurance', batchId: 'BSSE-6th-M1', facultyId: 'f_raheela', roomId: 'lab1_f2', startTime: '08:00', durationMinutes: 100 },
  { id: 's9', subjectCode: 'SE-504-P', subjectName: 'Mobile App Dev Lab', batchId: 'BSSE-6th-M2', facultyId: 'f_m_ahsan', roomId: 'lab1_f2', startTime: '09:40', durationMinutes: 100 },
  { id: 's10', subjectCode: 'CS-509-P', subjectName: 'AI Lab', batchId: 'BSBI-6th-M1', facultyId: 'f_m_ahsan', roomId: 'lab1_f2', startTime: '11:20', durationMinutes: 100 },
];
