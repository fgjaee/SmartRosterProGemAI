import { getSupabaseClient } from './supabaseClient';

export interface AreaRow {
  id?: number | string;
  name?: string;
  description?: string | null;
  [key: string]: any;
}

export interface TaskRow {
  id?: number | string;
  code?: string;
  name?: string;
  title?: string;
  type?: string;
  fallback_chain?: string[];
  timing?: string | null;
  time_window?: string | null;
  due_time?: string | null;
  dueTime?: string | null;
  effort?: number | null;
  frequency?: string | null;
  frequency_day?: string | null;
  frequency_date?: string | null;
  excluded_days?: string[];
  [key: string]: any;
}

export interface MemberRow {
  id?: number | string;
  member_id?: number | string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string;
  title?: string | null;
  is_active?: boolean;
  active?: boolean;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  [key: string]: any;
}

export interface SkillRow {
  id?: number | string;
  name?: string;
  description?: string | null;
  [key: string]: any;
}

export interface MemberSkillRow {
  id?: number | string;
  member_id?: number | string;
  skill_id?: number | string;
  proficiency?: string | null;
  [key: string]: any;
}

export interface MemberAliasRow {
  id?: number | string;
  member_id?: number | string;
  alias?: string;
  [key: string]: any;
}

export interface PlannedShiftRow {
  id?: number | string;
  shift_id?: number | string;
  member_id?: number | string;
  name?: string;
  employee_name?: string;
  member_name?: string;
  role?: string;
  title?: string;
  sun?: string;
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun_shift?: string;
  mon_shift?: string;
  tue_shift?: string;
  wed_shift?: string;
  thu_shift?: string;
  fri_shift?: string;
  sat_shift?: string;
  is_manual?: boolean;
  is_manual_edit?: boolean;
  [key: string]: any;
}

export interface WeeklyScheduleRow {
  id?: number | string;
  name?: string;
  week_period?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AssignmentRow {
  id?: number | string;
  day_key?: string;
  day?: string;
  dayKey?: string;
  employee_name?: string;
  employee?: string;
  member_name?: string;
  name?: string;
  tasks?: any[];
  payload?: any[];
  [key: string]: any;
}

export interface ManagerSettingsRow {
  id?: number | string;
  settings?: Record<string, any>;
  [key: string]: any;
}

export interface ExplicitRuleRow {
  id?: number | string;
  rule?: Record<string, any>;
  [key: string]: any;
}

const fetchTable = async <T>(table: string): Promise<T[]> => {
  const client = getSupabaseClient();

  if (!client) return [];

  const { data, error } = await client.from(table).select('*');

  if (error) {
    console.warn(`Failed to fetch ${table} from Supabase`, error.message);
    return [];
  }

  return data ?? [];
};

const upsertRow = async <T>(table: string, payload: T) => {
  const client = getSupabaseClient();

  if (!client) return null;

  const { data, error } = await client.from(table).upsert(payload).select();

  if (error) {
    console.warn(`Failed to upsert into ${table}`, error.message);
    return null;
  }

  return data ?? null;
};

const deleteRow = async (table: string, id: string | number): Promise<boolean> => {
  const client = getSupabaseClient();

  if (!client) return false;

  const { error } = await client.from(table).delete().eq('id', id);

  if (error) {
    console.warn(`Failed to delete from ${table}`, error.message);
    return false;
  }

  return true;
};

export const db = {
  loadAll: async () => {
    const client = getSupabaseClient();

    if (!client) {
      return {
        areas: [],
        tasks: [],
        members: [],
        skills: [],
        member_skills: [],
        member_aliases: [],
        planned_shifts: [],
        weekly_schedule: [],
        assignments: [],
        manager_settings: [],
        explicit_rules: [],
      };
    }

    const [
      areas,
      tasks,
      members,
      skills,
      member_skills,
      member_aliases,
      planned_shifts,
      weekly_schedule,
      assignments,
      manager_settings,
      explicit_rules,
    ] = await Promise.all([
      fetchTable<AreaRow>('areas'),
      fetchTable<TaskRow>('tasks'),
      fetchTable<MemberRow>('members'),
      fetchTable<SkillRow>('skills'),
      fetchTable<MemberSkillRow>('member_skills'),
      fetchTable<MemberAliasRow>('member_aliases'),
      fetchTable<PlannedShiftRow>('planned_shifts'),
      fetchTable<WeeklyScheduleRow>('weekly_schedule'),
      fetchTable<AssignmentRow>('assignments'),
      fetchTable<ManagerSettingsRow>('manager_settings'),
      fetchTable<ExplicitRuleRow>('explicit_rules'),
    ]);

    return {
      areas,
      tasks,
      members,
      skills,
      member_skills,
      member_aliases,
      planned_shifts,
      weekly_schedule,
      assignments,
      manager_settings,
      explicit_rules,
    };
  },

  upsertTask: (task: TaskRow) => upsertRow<TaskRow>('tasks', task),
  upsertArea: (area: AreaRow) => upsertRow<AreaRow>('areas', area),
  upsertMember: (member: MemberRow) => upsertRow<MemberRow>('members', member),
  upsertPlannedShift: (shift: PlannedShiftRow) => upsertRow<PlannedShiftRow>('planned_shifts', shift),
  upsertWeeklySchedule: (row: WeeklyScheduleRow) => upsertRow<WeeklyScheduleRow>('weekly_schedule', row),
  upsertAssignment: (row: AssignmentRow) => upsertRow<AssignmentRow>('assignments', row),
  upsertManagerSettings: (row: ManagerSettingsRow) => upsertRow<ManagerSettingsRow>('manager_settings', row),
  upsertExplicitRule: (row: ExplicitRuleRow) => upsertRow<ExplicitRuleRow>('explicit_rules', row),

  deleteTask: (id: string | number) => deleteRow('tasks', id),
  deleteMember: (id: string | number) => deleteRow('members', id),
  deleteArea: (id: string | number) => deleteRow('areas', id),
};

export type LoadedDbData = Awaited<ReturnType<typeof db.loadAll>>;
