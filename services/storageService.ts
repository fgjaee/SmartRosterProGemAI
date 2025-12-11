
import { ScheduleData, TaskRule, TaskAssignmentMap, INITIAL_SCHEDULE, Employee } from "../types";
import { DEFAULT_TASK_DB } from "../constants";

// Updated version keys to force refresh of data structure
const KEYS = {
  SCHEDULE: 'smartRoster_schedule_v6',
  TASK_DB: 'smartRoster_taskDB_v6',
  ASSIGNMENTS: 'smartRoster_assignments_v6',
  TEAM: 'smartRoster_team_v6',
};

export const StorageService = {
  getSchedule: async (): Promise<ScheduleData> => {
    const data = localStorage.getItem(KEYS.SCHEDULE);
    return data ? JSON.parse(data) : INITIAL_SCHEDULE;
  },

  saveSchedule: async (data: ScheduleData): Promise<void> => {
    localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(data));
  },

  getTaskDB: async (): Promise<TaskRule[]> => {
    const data = localStorage.getItem(KEYS.TASK_DB);
    // If no data found, return the full new default DB
    return data ? JSON.parse(data) : DEFAULT_TASK_DB;
  },

  saveTaskDB: async (data: TaskRule[]): Promise<void> => {
    localStorage.setItem(KEYS.TASK_DB, JSON.stringify(data));
  },

  getAssignments: async (): Promise<TaskAssignmentMap> => {
    const data = localStorage.getItem(KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : {};
  },

  saveAssignments: async (data: TaskAssignmentMap): Promise<void> => {
    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(data));
  },

  // --- Team / Employee Management ---
  getTeam: async (): Promise<Employee[]> => {
      const data = localStorage.getItem(KEYS.TEAM);
      if(data) return JSON.parse(data);
      
      // Seed from initial schedule if empty
      const seed: Employee[] = INITIAL_SCHEDULE.shifts.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          isActive: true
      }));
      return seed;
  },

  saveTeam: async (data: Employee[]): Promise<void> => {
      localStorage.setItem(KEYS.TEAM, JSON.stringify(data));
  },

  // Export full backup
  exportData: async () => {
    const exportObj = {
      schedule: localStorage.getItem(KEYS.SCHEDULE) ? JSON.parse(localStorage.getItem(KEYS.SCHEDULE)!) : INITIAL_SCHEDULE,
      taskDB: localStorage.getItem(KEYS.TASK_DB) ? JSON.parse(localStorage.getItem(KEYS.TASK_DB)!) : DEFAULT_TASK_DB,
      assignments: localStorage.getItem(KEYS.ASSIGNMENTS) ? JSON.parse(localStorage.getItem(KEYS.ASSIGNMENTS)!) : {},
      team: localStorage.getItem(KEYS.TEAM) ? JSON.parse(localStorage.getItem(KEYS.TEAM)!) : [],
      timestamp: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `roster_backup_${new Date().toLocaleDateString().replace(/\//g,'-')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },

  // Import full backup
  importData: (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.schedule) localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(json.schedule));
          if (json.taskDB) localStorage.setItem(KEYS.TASK_DB, JSON.stringify(json.taskDB));
          if (json.assignments) localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(json.assignments));
          if (json.team) localStorage.setItem(KEYS.TEAM, JSON.stringify(json.team));
          resolve(true);
        } catch (error) {
          console.error("Import failed", error);
          reject(false);
        }
      };
      reader.readAsText(file);
    });
  }
};
