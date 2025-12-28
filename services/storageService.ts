
import { ScheduleData, TaskRule, TaskAssignmentMap, INITIAL_SCHEDULE, Employee } from "../types";
import { DEFAULT_TASK_DB, DEFAULT_TEAM } from "../constants";

// Updated version keys to force refresh of data structure to v7
// This ensures the new 'Hardcoded Team' logic takes precedence over old cached dummy data
const KEYS = {
  SCHEDULE: 'smartRoster_schedule_v7',
  TASK_DB: 'smartRoster_taskDB_v7',
  ASSIGNMENTS: 'smartRoster_assignments_v7',
  TEAM: 'smartRoster_team_v7',
  PINNED_MSG: 'smartRoster_pinned_msg_v1'
};

export const StorageService = {
  getSchedule: async (): Promise<ScheduleData> => {
    const data = localStorage.getItem(KEYS.SCHEDULE);
    if (data) {
        return JSON.parse(data);
    }

    // CRITICAL FIX: If no schedule exists, generate it dynamically from the Hardcoded Team.
    // This prevents "overwriting" with generic dummy data.
    return {
        week_period: 'New Week',
        shifts: DEFAULT_TEAM.map((emp, index) => ({
            id: emp.id || String(index + 1),
            name: emp.name,
            role: emp.role,
            sun: "OFF", 
            mon: "OFF", 
            tue: "OFF", 
            wed: "OFF", 
            thu: "OFF", 
            fri: "OFF", 
            sat: "OFF"
        }))
    };
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
      
      // Use the hardcoded default team from constants
      return DEFAULT_TEAM;
  },

  saveTeam: async (data: Employee[]): Promise<void> => {
      localStorage.setItem(KEYS.TEAM, JSON.stringify(data));
  },

  // --- Pinned Message ---
  getPinnedMessage: async (): Promise<string> => {
    return localStorage.getItem(KEYS.PINNED_MSG) || "Welcome to the team! Focus on safety and customers today.";
  },

  savePinnedMessage: async (msg: string): Promise<void> => {
    localStorage.setItem(KEYS.PINNED_MSG, msg);
  },

  // Export full backup
  exportData: async () => {
    // Ensure we grab current state or defaults if null
    const schedule = localStorage.getItem(KEYS.SCHEDULE) ? JSON.parse(localStorage.getItem(KEYS.SCHEDULE)!) : (await StorageService.getSchedule());
    const team = localStorage.getItem(KEYS.TEAM) ? JSON.parse(localStorage.getItem(KEYS.TEAM)!) : DEFAULT_TEAM;

    const exportObj = {
      schedule,
      taskDB: localStorage.getItem(KEYS.TASK_DB) ? JSON.parse(localStorage.getItem(KEYS.TASK_DB)!) : DEFAULT_TASK_DB,
      assignments: localStorage.getItem(KEYS.ASSIGNMENTS) ? JSON.parse(localStorage.getItem(KEYS.ASSIGNMENTS)!) : {},
      team,
      pinnedMsg: localStorage.getItem(KEYS.PINNED_MSG) || "",
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
          if (json.pinnedMsg) localStorage.setItem(KEYS.PINNED_MSG, json.pinnedMsg);
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
