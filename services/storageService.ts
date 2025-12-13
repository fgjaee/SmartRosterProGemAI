import { Session } from '@supabase/supabase-js';
import { ScheduleData, TaskRule, TaskAssignmentMap, INITIAL_SCHEDULE, Employee } from "../types";
import { DEFAULT_TASK_DB } from "../constants";
import { db, PlannedShiftRow, AssignmentRow, TaskRow, MemberRow } from "/src/services/db";
import { getSupabaseClient } from "/src/services/supabaseClient";

// Updated version keys to force refresh of data structure
const KEYS = {
  SCHEDULE: 'smartRoster_schedule_v6',
  TASK_DB: 'smartRoster_taskDB_v6',
  ASSIGNMENTS: 'smartRoster_assignments_v6',
  TEAM: 'smartRoster_team_v6',
};

const hasSupabaseSession = (session?: Session | null) => {
  return !!session && !!getSupabaseClient();
};

const toSupabaseTask = (task: TaskRule): TaskRow => ({
  id: task.id,
  code: task.code,
  name: task.name,
  type: task.type,
  fallback_chain: task.fallbackChain,
  timing: task.timing,
  due_time: task.dueTime,
  effort: task.effort,
  frequency: task.frequency,
  frequency_day: task.frequencyDay,
  frequency_date: task.frequencyDate,
  excluded_days: task.excludedDays,
});

const toSupabaseMember = (member: Employee): MemberRow => ({
  id: member.id,
  name: member.name,
  role: member.role,
  is_active: member.isActive,
  email: member.email,
  phone: member.phone,
});

const toSupabaseShift = (shift: any): PlannedShiftRow => ({
  id: shift.id,
  name: shift.name,
  role: shift.role,
  sun: shift.sun,
  mon: shift.mon,
  tue: shift.tue,
  wed: shift.wed,
  thu: shift.thu,
  fri: shift.fri,
  sat: shift.sat,
});

const toSupabaseAssignments = (assignments: TaskAssignmentMap): AssignmentRow[] =>
  Object.entries(assignments).map(([key, tasks]) => {
    const [dayKey, ...nameParts] = key.split('-');
    return {
      day_key: dayKey,
      employee_name: nameParts.join('-'),
      tasks,
    };
  });

export const StorageService = {
  getSchedule: async (_session?: Session | null): Promise<ScheduleData> => {
    const data = localStorage.getItem(KEYS.SCHEDULE);
    return data ? JSON.parse(data) : INITIAL_SCHEDULE;
  },

  saveSchedule: async (data: ScheduleData, session?: Session | null): Promise<void> => {
    if (hasSupabaseSession(session)) {
      await db.upsertWeeklySchedule({ week_period: data.week_period });
      await Promise.all(data.shifts.map((shift) => db.upsertPlannedShift(toSupabaseShift(shift))));
      return;
    }

    localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(data));
  },

  getTaskDB: async (_session?: Session | null): Promise<TaskRule[]> => {
    const data = localStorage.getItem(KEYS.TASK_DB);
    // If no data found, return the full new default DB
    return data ? JSON.parse(data) : DEFAULT_TASK_DB;
  },

  saveTaskDB: async (data: TaskRule[], session?: Session | null): Promise<void> => {
    if (hasSupabaseSession(session)) {
      await Promise.all(data.map((task) => db.upsertTask(toSupabaseTask(task))));
      return;
    }

    localStorage.setItem(KEYS.TASK_DB, JSON.stringify(data));
  },

  getAssignments: async (_session?: Session | null): Promise<TaskAssignmentMap> => {
    const data = localStorage.getItem(KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : {};
  },

  saveAssignments: async (data: TaskAssignmentMap, session?: Session | null): Promise<void> => {
    if (hasSupabaseSession(session)) {
      const rows = toSupabaseAssignments(data);
      await Promise.all(rows.map((row) => db.upsertAssignment(row)));
      return;
    }

    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(data));
  },

  // --- Team / Employee Management ---
  getTeam: async (_session?: Session | null): Promise<Employee[]> => {
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

  saveTeam: async (data: Employee[], session?: Session | null): Promise<void> => {
      if (hasSupabaseSession(session)) {
        await Promise.all(data.map((member) => db.upsertMember(toSupabaseMember(member))));
        return;
      }

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
