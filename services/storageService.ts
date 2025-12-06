import { ScheduleData, TaskRule, TaskAssignmentMap, INITIAL_SCHEDULE } from "../types";
import { DEFAULT_TASK_DB } from "../constants";

// Updated version keys to force refresh of data structure
const KEYS = {
  SCHEDULE: 'smartRoster_schedule_v4',
  TASK_DB: 'smartRoster_taskDB_v4',
  ASSIGNMENTS: 'smartRoster_assignments_v4',
};

export const StorageService = {
  getSchedule: (): ScheduleData => {
    const data = localStorage.getItem(KEYS.SCHEDULE);
    return data ? JSON.parse(data) : INITIAL_SCHEDULE;
  },

  saveSchedule: (data: ScheduleData) => {
    localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(data));
  },

  getTaskDB: (): TaskRule[] => {
    const data = localStorage.getItem(KEYS.TASK_DB);
    // If no data found, return the full new default DB
    return data ? JSON.parse(data) : DEFAULT_TASK_DB;
  },

  saveTaskDB: (data: TaskRule[]) => {
    localStorage.setItem(KEYS.TASK_DB, JSON.stringify(data));
  },

  getAssignments: (): TaskAssignmentMap => {
    const data = localStorage.getItem(KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : {};
  },

  saveAssignments: (data: TaskAssignmentMap) => {
    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(data));
  },

  // Export full backup
  exportData: () => {
    const exportObj = {
      schedule: StorageService.getSchedule(),
      taskDB: StorageService.getTaskDB(),
      assignments: StorageService.getAssignments(),
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