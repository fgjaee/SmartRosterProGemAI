
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

export interface Employee {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
    email?: string;
    phone?: string;
}

export interface ScheduleData {
  week_period: string;
  shifts: Shift[];
}

export type TaskType = 'skilled' | 'general' | 'shift_based' | 'manual' | 'all_staff';

export interface TaskRule {
  id: number;
  code: string;
  name: string;
  type: TaskType;
  fallbackChain: string[]; // List of employee names prioritized for this task
  timing?: string;
  dueTime?: string; // e.g. "9:00 AM", "Store Open"
  effort?: number; // Estimated duration in minutes
  frequency?: 'daily' | 'weekly' | 'monthly';
  frequencyDay?: DayKey; // For Weekly: Which day?
  frequencyDate?: number; // For Monthly: Which date (1-31)?
  excludedDays?: DayKey[]; // Days to skip this task
}

export interface AssignedTask extends TaskRule {
  instanceId: string; // Unique ID for this specific assignment
  isComplete?: boolean;
}

// Map: "fri-JohnDoe" -> [Task1, Task2]
export type TaskAssignmentMap = Record<string, AssignedTask[]>;

export interface AppState {
  activeTab: 'vision' | 'schedule' | 'tasks' | 'team';
  selectedDay: DayKey;
  isLoading: boolean;
  isSaving: boolean;
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

// Intentionally empty default. The app now generates the initial schedule 
// dynamically from the Team Database in StorageService.ts
export const INITIAL_SCHEDULE: ScheduleData = {
  week_period: 'New Week',
  shifts: [] 
};
