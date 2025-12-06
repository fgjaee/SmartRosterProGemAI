export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface Shift {
  id: string; // Unique ID for the employee/row
  name: string;
  role: string;
  sun: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  isManual?: boolean;
}

export interface ScheduleData {
  week_period: string;
  shifts: Shift[];
}

export type TaskType = 'skilled' | 'general' | 'shift_based' | 'manual';

export interface TaskRule {
  id: number;
  code: string;
  name: string;
  type: TaskType;
  fallbackChain: string[]; // List of employee names prioritized for this task
  timing?: string;
}

export interface AssignedTask extends TaskRule {
  instanceId: string; // Unique ID for this specific assignment
  isComplete?: boolean;
}

// Map: "fri-JohnDoe" -> [Task1, Task2]
export type TaskAssignmentMap = Record<string, AssignedTask[]>;

export interface AppState {
  activeTab: 'vision' | 'schedule' | 'tasks';
  selectedDay: DayKey;
}

export const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday'
};

export const INITIAL_SCHEDULE: ScheduleData = {
  week_period: 'New Week',
  shifts: [
    { id: '1', name: "Cannon, Beth M", role: "Lead", sun: "12:00-8:00", mon: "6:00-2:00", tue: "7:00-3:00", wed: "OFF", thu: "5:00-1:00", fri: "OFF", sat: "7:00-3:00" },
    { id: '2', name: "Powell, Marlon", role: "Overnight", sun: "OFF", mon: "OFF", tue: "1:00-9:00", wed: "1:00-9:00", thu: "OFF", fri: "1:00-9:00", sat: "8:00-4:00" },
    { id: '3', name: "Wood, William B", role: "Stock", sun: "OFF", mon: "5:00-1:00", tue: "5:00-1:00", wed: "5:00-1:00", thu: "OFF", fri: "5:00-1:00", sat: "5:00-1:00" },
    { id: '4', name: "Cooley, Sandra K", role: "Stock", sun: "OFF", mon: "OFF", tue: "4:00-12:00", wed: "4:00-12:00", thu: "4:00-12:00", fri: "4:00-12:00", sat: "4:00-12:00" },
    { id: '5', name: "Mullinix, James", role: "Supervisor", sun: "5:00-1:00", mon: "5:00-1:00", tue: "1:15-8:00", wed: "2:00-10:00", thu: "OFF", fri: "5:00-1:00", sat: "OFF" }
  ]
};