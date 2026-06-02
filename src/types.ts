export type UserType = 'student' | 'instructor' | 'QA' | 'admin' | 'qa';

export interface GA {
  id: string;
  name: string;
  description: string;
  departmentId?: string; // Optional department association so each department has different GAs
  programId?: string; // Optional program association so each program has separate GAs
}

export interface ProgramObjective {
  id: string;
  text: string;
  mappedGAs: string[]; // array of GA ids
}

export interface Program {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  pos: ProgramObjective[]; // exactly 4 POs
  vision?: string;
  mission?: string;
}

export interface Department {
  id: string;
  name: string;
  vision: string;
  mission: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  type: 'core' | 'elective';
  mappedGAs: string[]; // array of GA ids
  departmentId: string;
  programId?: string; // separate courses for each program
}

export interface OBEData {
  departments: Department[];
  programs: Program[];
  gas: GA[];
  courses: Course[];
}
