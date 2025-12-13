
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { 
  Users, Calendar, CheckCircle, Wand2, Printer, 
  Download, Upload, Plus, Trash2, ArrowRight, X, 
  Menu, RotateCcw, Save, AlertCircle, ScanLine, Loader2, Clock, Settings, UserPlus, Briefcase,
  Camera, Zap, Sparkles, MessageSquare, RefreshCw
} from 'lucide-react';

import {
  ScheduleData, TaskRule, TaskAssignmentMap,
  DayKey, Shift, AssignedTask, DAY_LABELS, Employee, TaskType
} from './types';
import { PRIORITY_PINNED_IDS } from './constants';
import { StorageService } from './services/storageService';
import { AIService } from './services/aiService';
import TaskDBModal from './components/TaskDBModal';
import { signInWithEmail, signInWithGoogle, supabase } from './src/services/supabaseClient';

// --- Utility Functions ---

const ORDERED_DAYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const normalizeDayKey = (value: any): DayKey | null => {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return (DAY_KEYS as string[]).includes(key) ? (key as DayKey) : null;
};

const makeLocalId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseFallbackChain = (value: any): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
    return [];
};

const parseExcludedDays = (value: any): DayKey[] => {
    if (!Array.isArray(value)) return [];
    return value.map(v => normalizeDayKey(v)).filter(Boolean) as DayKey[];
};

const mapTaskRulesFromSupabase = (rows: any[] = []): TaskRule[] => rows.map((row) => ({
    id: Number(row.id ?? row.task_id ?? Date.now()),
    code: row.code ?? row.task_code ?? '',
    name: row.name ?? row.title ?? 'Task',
    type: (row.type as TaskType) ?? 'general',
    fallbackChain: parseFallbackChain(row.fallback_chain ?? row.fallbackChain),
    timing: row.timing ?? row.time_window ?? undefined,
    dueTime: row.due_time ?? row.dueTime ?? undefined,
    effort: row.effort ?? row.duration ?? undefined,
    frequency: row.frequency ?? undefined,
    frequencyDay: normalizeDayKey(row.frequency_day) ?? undefined,
    frequencyDate: row.frequency_date ?? undefined,
    excludedDays: parseExcludedDays(row.excluded_days ?? row.excludedDays),
}));

const mapMembersFromSupabase = (rows: any[] = []): Employee[] => rows.map((row) => ({
    id: String(row.id ?? row.member_id ?? makeLocalId()),
    name: row.name ?? [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Member',
    role: row.role ?? row.title ?? 'Team Member',
    isActive: row.is_active ?? row.active ?? true,
    email: row.email ?? undefined,
    phone: row.phone ?? row.phone_number ?? undefined,
}));

const mapShiftsFromPlanned = (rows: any[] = []): Shift[] => rows.map((row) => ({
    id: String(row.id ?? row.shift_id ?? row.member_id ?? makeLocalId()),
    name: row.name ?? row.employee_name ?? row.member_name ?? 'Member',
    role: row.role ?? row.title ?? 'Team Member',
    sun: row.sun ?? row.sunday ?? row.sun_shift ?? 'OFF',
    mon: row.mon ?? row.monday ?? row.mon_shift ?? 'OFF',
    tue: row.tue ?? row.tuesday ?? row.tue_shift ?? 'OFF',
    wed: row.wed ?? row.wednesday ?? row.wed_shift ?? 'OFF',
    thu: row.thu ?? row.thursday ?? row.thu_shift ?? 'OFF',
    fri: row.fri ?? row.friday ?? row.fri_shift ?? 'OFF',
    sat: row.sat ?? row.saturday ?? row.sat_shift ?? 'OFF',
    isManual: row.is_manual ?? row.is_manual_edit ?? undefined,
}));

const mapScheduleFromSupabase = (weeklyScheduleRows: any[] = [], plannedShiftRows: any[] = []): ScheduleData | null => {
    const weekPeriod = weeklyScheduleRows[0]?.week_period || weeklyScheduleRows[0]?.name || 'New Week';
    const shifts = mapShiftsFromPlanned(plannedShiftRows);
    if (!shifts.length) return null;
    return { week_period: weekPeriod, shifts };
};

const ensureAssignedTask = (task: any, idx: number, dayKey: DayKey, employeeName: string): AssignedTask => ({
    ...task,
    type: task?.type ?? 'general',
    fallbackChain: parseFallbackChain(task?.fallbackChain ?? task?.fallback_chain),
    excludedDays: parseExcludedDays(task?.excludedDays ?? task?.excluded_days),
    instanceId: task?.instanceId || task?.instance_id || `${dayKey}-${employeeName}-${idx}-${task?.id ?? makeLocalId()}`,
    isComplete: task?.isComplete ?? task?.is_complete,
});

const mapAssignmentsFromSupabase = (rows: any[] = []): TaskAssignmentMap => {
    const map: TaskAssignmentMap = {};
    rows.forEach((row) => {
        const dayKey = normalizeDayKey(row.day_key ?? row.day ?? row.dayKey);
        const employeeName = row.employee_name ?? row.employee ?? row.member_name ?? row.name;
        if (!dayKey || !employeeName) return;
        const tasks = Array.isArray(row.tasks) ? row.tasks : Array.isArray(row.payload) ? row.payload : [];
        map[`${dayKey}-${employeeName}`] = tasks.map((task, idx) => ensureAssignedTask(task, idx, dayKey, employeeName));
    });
    return map;
};

const cleanTaskName = (n: string) => n.replace(/\(Sat Only\)/gi, '').replace(/\(Fri Only\)/gi, '').replace(/\(Excl.*?\)/gi, '').trim();

const getPrevDay = (d: DayKey): DayKey => {
    const idx = ORDERED_DAYS.indexOf(d);
    return ORDERED_DAYS[idx === 0 ? 6 : idx - 1];
};

const getDueTimeValue = (t: string | undefined) => {
    if (!t) return 9999;
    if (t === "Store Open") return 700;
    if (t === "Closing") return 2200;
    const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if (match) {
        let h = parseInt(match[1]);
        if (match[3] === "PM" && h !== 12) h += 12;
        if (match[3] === "AM" && h === 12) h = 0;
        return h * 100 + parseInt(match[2]);
    }
    return 9999;
};

// --- NEW: Accurate Shift Range Parsing ---
const parseShiftStartEnd = (timeStr: string) => {
    // Expected formats: "5:00-1:00", "7-3", "12:00-8:00"
    if (!timeStr || ['OFF', 'X', 'VAC'].some(x => timeStr.toUpperCase().includes(x))) {
        return { start: -1, end: -1 };
    }

    const clean = timeStr.replace(/\s/g, '');
    const parts = clean.split('-');
    if (parts.length !== 2) return { start: -1, end: -1 };

    const parsePart = (p: string, isEnd: boolean) => {
        const match = p.match(/(\d{1,2})(?::(\d{2}))?/);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const m = parseInt(match[2] || '0');

        // Logic to infer AM/PM based on typical retail flow if AM/PM missing
        // 4,5,6,7,8,9,10,11 -> Usually AM (Start)
        // 12,1,2,3 -> PM
        if (h <= 3 || h === 12) { 
             // Likely PM, unless 12 (Noon)
             // But if it is an End time and start was AM, 1 could be 13:00
        }
        
        return h * 100 + m;
    };

    let start = parsePart(parts[0], false);
    let end = parsePart(parts[1], true);

    // Normalize Start
    if (start < 500) start += 1200; // 1-4 is likely 1pm-4pm start (unless overnight, handled by context usually)
    
    // Normalize End relative to Start
    if (end < start) {
        end += 1200; // Crosses noon or midnight
    }
    
    // Specific Fixes for common patterns
    // 5:00-1:00 (5am to 1pm) -> 500 to 1300
    if (start === 500 && end === 100) end = 1300;
    
    return { start, end };
};

// --- NEW: Compatibility Check using Pre-Calculated Times ---
// Now accepts numbers instead of reparsing string to avoid errors
const isStaffCompatibleWithTask = (start: number, end: number, task: TaskRule) => {
    if (start === -1 || end === -1) return false;

    // 1. Closing Tasks
    if (task.dueTime === "Closing" || task.name.toLowerCase().includes("close")) {
        // Must work until at least 6pm (1800) to be considered for closing
        if (end < 1800) return false;
    }

    // 2. Opening Tasks
    if (task.dueTime === "Store Open" || task.name.toLowerCase().includes("open") || task.code === "T0") {
        // Must start by 8am
        if (start > 800) return false;
    }
    
    // 3. 9AM Sets
    if (task.dueTime === "9:00 AM") {
        // Must start early enough to complete it.
        // Assuming 9am tasks require starting before 9am.
        if (start >= 900) return false;
    }

    return true;
};

// Robust Time Parsing (Display oriented)
const parseTime = (timeStr: any, role: string, isSpillover = false) => {
    // 1. Sanitize input
    if (timeStr === null || timeStr === undefined || timeStr === '') return { h: 24, label: 'OFF', category: 'OFF' };
    const raw = String(timeStr).toUpperCase().trim();
    
    // 2. Strict OFF checks (Catches LOAN, REQ, VAC, SICK, X, etc.)
    if (!raw || ['OFF', 'X', 'VAC', 'SICK', 'REQ', 'LOAN', 'LOANED OUT', 'L.O.', 'PTO', 'BRV', 'NOT', 'N/A'].some(off => raw.includes(off))) {
        return { h: 24, label: 'OFF', category: 'OFF' };
    }

    // 3. Extract numbers
    const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(A|P|AM|PM)?/);
    if (!match) return { h: 24, label: raw, category: 'OFF' };

    let h = parseInt(match[1]);
    const m = match[2] || '00';
    const suffix = match[3];

    // 4. Time Inference Logic
    if (suffix) {
        // Explicit Suffix provided
        if (suffix.startsWith('P') && h !== 12) h += 12;
        if (suffix.startsWith('A') && h === 12) h = 0;
    } else {
        // No Suffix - Guess based on Role & Common Retail Shifts
        if (h === 12) {
             // 12:00 is Noon (Start) -> Mid (12:00)
        } else if (h >= 1 && h <= 3) {
             h += 12; // 1-3 is usually PM (13:00, 14:00, 15:00)
        } else if (h >= 7 && h <= 11) {
             // 7-11 is usually AM
        } else if (h >= 4 && h <= 6) {
             // 4-6 is Ambiguous (4am Stock vs 4pm Close)
             const r = (role || '').toLowerCase();
             // Check against early morning roles AND Leadership roles
             const amRoles = ['stock', 'flow', 'baker', 'open', 'truck', 'merch', 'rec', 'lead', 'sup', 'mngr', 'manager', 'dir'];
             if (amRoles.some(am => r.includes(am))) {
                 // AM (Keep h as is)
             } else {
                 h += 12; // PM (Default to Close)
             }
        }
    }

    // 5. Categorize Shift Type
    let category = 'Mid';
    if (h >= 20 || h <= 3) category = 'Overnight';
    else if (h >= 4 && h <= 6) category = 'Open';
    else if (h >= 16 && h <= 19) category = 'Close';
    else category = 'Mid'; 

    // 6. Spillover Logic
    if (isSpillover) {
        if (category === 'Overnight') {
             const dispH = h % 12 === 0 ? 12 : h % 12;
             const dispAmpm = h >= 12 ? 'PM' : 'AM';
             return { h, label: `${dispH}:${m}${dispAmpm} (Prev)`, category };
        }
        return { h: 24, label: 'OFF', category: 'OFF' };
    }

    const dispH = h % 12 === 0 ? 12 : h % 12;
    const dispAmpm = h >= 12 ? 'PM' : 'AM';
    return { h, label: `${dispH}:${m}${dispAmpm}`, category };
};

const formatShiftString = (timeStr: any) => {
    if (timeStr === null || timeStr === undefined) return "";
    const str = String(timeStr);
    if (!str || ['OFF', 'LOANED OUT', 'O', 'X'].includes(str.toUpperCase())) return str;
    return str; 
};

const getBadgeColor = (code: string) => {
    if (code === 'MAN') return 'bg-slate-100 text-slate-700 border-slate-200';
    if (code.includes('ON')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (code.startsWith('T')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

const namesMatch = (n1: string, n2: string) => {
    if (!n1 || !n2) return false;
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const s1 = clean(n1);
    const s2 = clean(n2);
    // require at least 3 chars to avoid matching initials too aggressively unless names are short
    if (s1.length < 3 || s2.length < 3) return s1 === s2;
    return s1.includes(s2) || s2.includes(s1);
};

function RosterApp({ session }: { session: Session }) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks' | 'team'>('tasks');
  const [selectedDay, setSelectedDay] = useState<DayKey>('fri');

  // Data States
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [taskDB, setTaskDB] = useState<TaskRule[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignmentMap>({});
  const [team, setTeam] = useState<Employee[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [memberSkills, setMemberSkills] = useState<any[]>([]);
  const [managerSettings, setManagerSettings] = useState<any[]>([]);
  const [weeklyScheduleMeta, setWeeklyScheduleMeta] = useState<any[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDBModal, setShowDBModal] = useState(false);
  const [showAutoAssignConfirm, setShowAutoAssignConfirm] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [manualTaskInput, setManualTaskInput] = useState<{emp: string, text: string} | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // AI States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [huddleText, setHuddleText] = useState<string | null>(null);
  const [aiTasks, setAiTasks] = useState<TaskRule[] | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const workAreaInputRef = useRef<HTMLInputElement>(null);

  const loadLocalFallback = useCallback(async () => {
    const [localSchedule, localTasks, localAssignments, localTeam] = await Promise.all([
        StorageService.getSchedule(),
        StorageService.getTaskDB(),
        StorageService.getAssignments(),
        StorageService.getTeam()
    ]);

    return {
        schedule: localSchedule,
        taskDB: localTasks,
        assignments: localAssignments,
        team: localTeam,
    };
  }, []);

  // Initial Load
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
        setIsLoading(true);
        setSupabaseLoading(true);
        setSupabaseError(null);

        try {
            const [
                tasksRes,
                areasRes,
                membersRes,
                memberSkillsRes,
                skillsRes,
                managerSettingsRes,
                weeklyScheduleRes,
                plannedShiftsRes,
                assignmentsRes,
            ] = await Promise.all([
                supabase.from('tasks').select('*').order('id', { ascending: true }),
                supabase.from('areas').select('*'),
                supabase.from('members').select('*'),
                supabase.from('member_skills').select('*'),
                supabase.from('skills').select('*'),
                supabase.from('manager_settings').select('*'),
                supabase.from('weekly_schedule').select('*').order('created_at', { ascending: false }),
                supabase.from('planned_shifts').select('*'),
                supabase.from('assignments').select('*'),
            ]);

            if (!isMounted) return;

            const taskRules = mapTaskRulesFromSupabase(tasksRes.data || []);
            const members = mapMembersFromSupabase(membersRes.data || []);
            const scheduleFromSupabase = mapScheduleFromSupabase(weeklyScheduleRes.data || [], plannedShiftsRes.data || []);
            const assignmentsFromSupabase = mapAssignmentsFromSupabase(assignmentsRes.data || []);

            setAreas(areasRes.data || []);
            setSkills(skillsRes.data || []);
            setMemberSkills(memberSkillsRes.data || []);
            setManagerSettings(managerSettingsRes.data || []);
            setWeeklyScheduleMeta(weeklyScheduleRes.data || []);

            let fallbackData: Awaited<ReturnType<typeof loadLocalFallback>> | null = null;
            const getFallbackData = async () => {
                if (!fallbackData) fallbackData = await loadLocalFallback();
                return fallbackData;
            };

            if (scheduleFromSupabase) {
                setSchedule(scheduleFromSupabase);
            } else {
                const fallback = await getFallbackData();
                if (!isMounted) return;
                setSchedule(fallback.schedule);
            }

            if (taskRules.length) {
                setTaskDB(taskRules);
            } else {
                const fallback = await getFallbackData();
                if (!isMounted) return;
                setTaskDB(fallback.taskDB);
            }

            if (members.length) {
                setTeam(members);
            } else {
                const fallback = await getFallbackData();
                if (!isMounted) return;
                setTeam(fallback.team);
            }

            if (Object.keys(assignmentsFromSupabase).length) {
                setAssignments(assignmentsFromSupabase);
            } else {
                const fallback = await getFallbackData();
                if (!isMounted) return;
                setAssignments(fallback.assignments);
            }

            const anyErrors = [
                tasksRes.error,
                areasRes.error,
                membersRes.error,
                memberSkillsRes.error,
                skillsRes.error,
                managerSettingsRes.error,
                weeklyScheduleRes.error,
                plannedShiftsRes.error,
                assignmentsRes.error,
            ].filter(Boolean);

            if (anyErrors.length) {
                console.warn('Supabase fetch returned errors', anyErrors.map(e => e?.message));
                setSupabaseError('Some Supabase data could not be loaded. Using available data.');
            }

        } catch (e) {
            console.error("Failed to load data", e);
            const fallback = await loadLocalFallback();
            if (isMounted) {
                setSupabaseError('Unable to load Supabase data. Using local data instead.');
                setSchedule(fallback.schedule);
                setTaskDB(fallback.taskDB);
                setAssignments(fallback.assignments);
                setTeam(fallback.team);
            }
        } finally {
            if (isMounted) {
                setIsLoading(false);
                setSupabaseLoading(false);
            }
        }
    };
    loadData();

    return () => { isMounted = false; };
  }, [session, loadLocalFallback]);

  // Autosave Effects (Debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveData = (key: string, fn: () => Promise<void>) => {
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // Reduced delay to 500ms for snappier saves
      saveTimeoutRef.current = setTimeout(async () => {
          console.log(`[AutoSave] Saving ${key}...`);
          try {
            await fn();
            console.log(`[AutoSave] ${key} saved.`);
          } catch(e) { console.error(`[AutoSave] ${key} failed`, e); }
          finally { setIsSaving(false); }
      }, 500);
  };

  useEffect(() => { if (schedule) saveData('sched', () => StorageService.saveSchedule(schedule)); }, [schedule]);
  useEffect(() => { if (taskDB.length) saveData('taskdb', () => StorageService.saveTaskDB(taskDB)); }, [taskDB]);
  useEffect(() => { if (Object.keys(assignments).length) saveData('assign', () => StorageService.saveAssignments(assignments)); }, [assignments]);
  useEffect(() => { if (team.length) saveData('team', () => StorageService.saveTeam(team)); }, [team]);

  const handlePrint = () => {
      console.log("Print initiated by user.");
      try {
          window.print();
          console.log("Print dialog requested.");
      } catch (e) {
          console.error("Print error:", e);
          alert("Printing failed. See console for error details.");
      }
  };

  const getDailyStaff = useCallback(() => {
    if (!schedule) return [];
    const shifts = schedule.shifts || [];
    // Current Day
    const todayStaff = shifts.map(s => {
        const t = s[selectedDay];
        if (!t) return null;
        const { category, label } = parseTime(t, s.role);
        if (category === 'OFF') return null;
        
        // Compute compatibility times once
        const { start, end } = parseShiftStartEnd(t);

        return { 
            ...s, 
            activeTime: label, 
            isSpillover: false,
            compStart: start,
            compEnd: end,
            rawShift: t
        };
    }).filter(s => s !== null);

    // Spillover (Overnight from prev day)
    const prevDay = getPrevDay(selectedDay);
    const spilloverStaff = shifts.map(s => {
        const t = s[prevDay];
        if (!t) return null;
        const { category, label } = parseTime(t, s.role, true);
        if (category === 'Overnight') {
            const { end } = parseShiftStartEnd(t);
            return { 
                ...s, 
                activeTime: label, 
                isSpillover: true,
                // Effective shift for today is 00:00 to End
                compStart: 0, 
                compEnd: end,
                rawShift: t
            };
        }
        return null;
    }).filter(s => s !== null);

    // Merge & Dedupe
    const uniqueMap = new Map();
    [...spilloverStaff, ...todayStaff].forEach(item => {
        if (item && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values()) as (Shift & { activeTime: string, isSpillover: boolean, compStart: number, compEnd: number, rawShift: string })[];
  }, [schedule, selectedDay]);

  const getWorkerLoad = (empName: string, currentAssignments: TaskAssignmentMap) => {
    const key = `${selectedDay}-${empName}`;
    return (currentAssignments[key] || []).reduce((acc, t) => acc + (t.effort || 30), 0);
  };

  const handleRequestAutoDistribute = () => {
      const staff = getDailyStaff();
      if (staff.length === 0) { 
          alert(`No working staff detected for ${DAY_LABELS[selectedDay]}. Please check the schedule to ensure shifts are entered correctly.`); 
          return; 
      }
      setShowAutoAssignConfirm(true);
  };

  const runAutoDistribute = () => {
    setShowAutoAssignConfirm(false);
    console.group("Auto Distribute Debug Log");
    console.log("Starting Auto Distribute...");
    console.log("Selected Day:", selectedDay);

    try {
        const staff = getDailyStaff();
        console.log("Detected Working Staff:", staff.length);
        console.table(staff.map(s => ({ name: s.name, role: s.role, time: s.activeTime, raw: s.rawShift, start: s.compStart, end: s.compEnd })));

        if (staff.length === 0) { 
            console.error("No staff found. Aborting.");
            console.groupEnd();
            return; 
        }
        
        // Reset assignments for the day
        const newAssignments: TaskAssignmentMap = { ...assignments };
        staff.forEach(s => delete newAssignments[`${selectedDay}-${s.name}`]);

        let assignedCount = 0;
        const assign = (empName: string, rule: TaskRule) => {
            console.log(`Assigning [${rule.code}] ${rule.name} -> ${empName}`);
            const key = `${selectedDay}-${empName}`;
            if (!newAssignments[key]) newAssignments[key] = [];
            if (newAssignments[key].some(t => t.id === rule.id)) return;
            newAssignments[key].push({ ...rule, instanceId: Math.random().toString(36).substr(2, 9) });
            assignedCount++;
        };

        const currentSystemDate = new Date().getDate(); // 1-31
        
        // --- 1. Filter & Sort Rules (Logic Update: Prioritize Front-End Tasks) ---
        const validRules = taskDB.filter(t => {
            // Excluded Days Logic
            if (t.excludedDays && t.excludedDays.includes(selectedDay)) return false;

            // Frequency Logic
            if (t.frequency === 'weekly') {
                const targetDay = t.frequencyDay || 'fri';
                if (targetDay !== selectedDay) return false;
            } else if (t.frequency === 'monthly') {
                if (!t.frequencyDate) return false;
                if (t.frequencyDate !== currentSystemDate) return false;
            }
            return true;
        }).sort((a, b) => {
            // Priority Sort Order:
            // 1. Pinned IDs (High Priority)
            // 2. "Set" Tasks (Stocking - Front of House) - codes T, W
            // 3. Other Skilled
            // 4. General
            const isAPinned = PRIORITY_PINNED_IDS.includes(a.id);
            const isBPinned = PRIORITY_PINNED_IDS.includes(b.id);
            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;

            const isAStock = a.code.startsWith('T') || a.code.startsWith('W');
            const isBStock = b.code.startsWith('T') || b.code.startsWith('W');
            if (isAStock && !isBStock) return -1;
            if (!isAStock && isBStock) return 1;

            return 0;
        });

        // --- 2. All Staff Tasks (Everyone gets them) ---
        validRules.filter(t => t.type === 'all_staff').forEach(t => {
            staff.forEach(s => {
                assign(s.name, t);
            });
        });

        // --- 3. Skilled Tasks (Rules Based + TIME COMPATIBILITY) ---
        validRules.filter(t => t.type === 'skilled').forEach(t => {
            let assigned = false;
            
            // STRICT CHAIN ORDER: Try 1st preference, then 2nd, etc.
            for (const name of t.fallbackChain) {
                const match = staff.find(s => namesMatch(s.name, name));
                if (match) {
                    // NEW: Compatibility Check (Uses computed numbers now)
                    if (!isStaffCompatibleWithTask(match.compStart, match.compEnd, t)) {
                        console.log(`Skipping ${match.name} for ${t.name} (Incompatible: Start ${match.compStart}, End ${match.compEnd})`);
                        continue;
                    }

                    assign(match.name, t);
                    assigned = true;
                    break;
                }
            }

            // Fallback: If no priority match found, assign to best available
            if (!assigned) {
                const anyStaff = [...staff]
                    .filter(s => isStaffCompatibleWithTask(s.compStart, s.compEnd, t))
                    .sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));
                
                if(anyStaff.length > 0) assign(anyStaff[0].name, t);
            }
        });

        // --- 4. Shift Based Tasks ---
        const shifts = { 'Open': [] as any[], 'Mid': [] as any[], 'Close': [] as any[], 'Overnight': [] as any[] };
        staff.forEach(s => {
            const { category } = parseTime(s.activeTime, s.role, s.isSpillover);
            if(category !== 'OFF') shifts[category as keyof typeof shifts].push(s);
        });

        validRules.filter(t => t.type === 'shift_based').forEach(t => {
            ['Open', 'Mid', 'Close', 'Overnight'].forEach(cat => {
                const group = shifts[cat as keyof typeof shifts];
                if(group.length > 0) {
                    group.sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));
                    assign(group[0].name, { ...t, name: `${t.name} (${cat})` });
                }
            });
        });

        // --- 5. General Tasks (Enhanced Round Robin) ---
        const generalTasks = validRules.filter(t => t.type === 'general');
        const poolTasks: TaskRule[] = [];

        generalTasks.forEach(t => {
            // If general task has a specific person assigned (e.g., Apple Set -> Wood), try them first
            if (t.fallbackChain.length > 0) {
                 let assigned = false;
                 for (const name of t.fallbackChain) {
                     const match = staff.find(s => namesMatch(s.name, name));
                     if(match && isStaffCompatibleWithTask(match.compStart, match.compEnd, t)) {
                         assign(match.name, t);
                         assigned = true;
                         break;
                     }
                 }
                 if(!assigned) poolTasks.push(t);
            } else {
                poolTasks.push(t);
            }
        });

        // Round Robin the remaining poolTasks
        // Filter RR staff by time compatibility for early/late tasks
        if (poolTasks.length > 0) {
            // We rotate through tasks
            poolTasks.forEach((t) => {
                // Find eligible staff for THIS specific task
                const eligibleStaff = staff
                    .filter(s => isStaffCompatibleWithTask(s.compStart, s.compEnd, t))
                    .sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));

                if (eligibleStaff.length > 0) {
                    assign(eligibleStaff[0].name, t);
                }
            });
        }

        // --- 6. Fill Gaps ---
        staff.forEach(s => {
            const load = getWorkerLoad(s.name, newAssignments);
            if (load === 0) {
                assign(s.name, { 
                    id: 9000 + Math.floor(Math.random()*1000), code: 'GEN', name: 'General Department Support', type: 'general', fallbackChain: [], effort: 60 
                });
            }
        });

        setAssignments(newAssignments);
        console.groupEnd();
        
        if(assignedCount > 0) {
            alert(`Success: Distributed ${assignedCount} tasks across ${staff.length} staff members.`);
        } else {
            alert(`Process completed but 0 tasks were assigned. Check your Rules Database settings for ${DAY_LABELS[selectedDay]}.`);
        }

    } catch (e: any) {
        console.error("Auto Assign Error", e);
        console.groupEnd();
        alert(`Auto-assign failed: ${e.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files?.[0]) {
          await StorageService.importData(e.target.files[0]);
          window.location.reload();
      }
  };

  // --- AI HANDLERS ---

  const handleScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsScanning(true);
      setScanStatus('Reading Schedule...');
      try {
          const scannedData = await AIService.parseSchedule(file);
          setSchedule(scannedData);
          alert("Schedule updated from image. Please verify rows.");
      } catch (error: any) {
          alert("Scan failed: " + error.message);
      } finally {
          setIsScanning(false);
          setScanStatus('');
          if(scanInputRef.current) scanInputRef.current.value = '';
      }
  };

  const handleAnalyzeWorkplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsScanning(true);
      setScanStatus('Analyzing Workplace...');
      try {
          const tasks = await AIService.analyzeWorkplaceImage(file);
          setAiTasks(tasks);
      } catch (error: any) {
          alert("Analysis failed: " + error.message);
      } finally {
          setIsScanning(false);
          setScanStatus('');
          if(workAreaInputRef.current) workAreaInputRef.current.value = '';
      }
  };

  const handleGenerateHuddle = async () => {
      const staff = getDailyStaff();
      if(staff.length === 0) return alert("No staff scheduled for today");
      
      setIsScanning(true);
      setScanStatus('Writing Huddle...');
      try {
          const pinnedTasks = taskDB.filter(t => PRIORITY_PINNED_IDS.includes(t.id)).map(t => t.name);
          const speech = await AIService.generateDailyHuddle(
              DAY_LABELS[selectedDay],
              staff.length,
              pinnedTasks.slice(0, 3)
          );
          setHuddleText(speech);
      } catch(e) {
          alert("Failed to generate huddle");
      } finally {
          setIsScanning(false);
          setScanStatus('');
      }
  };

  const handleConfirmAiTasks = () => {
      if(!aiTasks) return;
      const staff = getDailyStaff();
      const lead = staff.find(s => s.role.includes("Lead") || s.role.includes("Sup")) || staff[0];
      
      if(!lead) return alert("No staff to assign these tasks to.");

      const newAssignments = {...assignments};
      const key = `${selectedDay}-${lead.name}`;
      
      if(!newAssignments[key]) newAssignments[key] = [];
      
      aiTasks.forEach(t => {
          newAssignments[key].push({
              ...t,
              instanceId: Date.now() + Math.random().toString(),
          });
      });
      
      setAssignments(newAssignments);
      setAiTasks(null);
      alert(`Added ${aiTasks.length} tasks to ${lead.name}'s list.`);
  };

  const handleClearDay = () => {
    if(!confirm("Clear all tasks for this day?")) return;
    const newAsg = {...assignments};
    getDailyStaff().forEach(s => delete newAsg[`${selectedDay}-${s.name}`]);
    setAssignments(newAsg);
  };

  const handleDeleteTask = (empName: string, instanceId: string) => {
    const key = `${selectedDay}-${empName}`;
    setAssignments(prev => ({ ...prev, [key]: prev[key].filter(t => t.instanceId !== instanceId) }));
  };

  const handleAddManualTask = () => {
      if(!manualTaskInput || !manualTaskInput.text) return;
      const key = `${selectedDay}-${manualTaskInput.emp}`;
      setAssignments(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), {
              id: 9999, code: 'MAN', name: manualTaskInput.text, type: 'manual', fallbackChain: [], instanceId: Date.now().toString(), effort: 30
          }]
      }));
      setManualTaskInput(null);
  };

  const handleImportTeamToSchedule = () => {
      if(!schedule) return;
      const existingNames = new Set(schedule.shifts.map(s => s.name));
      const newShifts: Shift[] = team.filter(t => t.isActive && !existingNames.has(t.name)).map(t => ({
          id: t.id, name: t.name, role: t.role,
          sun: "OFF", mon: "OFF", tue: "OFF", wed: "OFF", thu: "OFF", fri: "OFF", sat: "OFF"
      }));
      
      if(newShifts.length === 0) {
          alert("No new active team members to add.");
          return;
      }
      setSchedule({ ...schedule, shifts: [...schedule.shifts, ...newShifts] });
      alert(`Added ${newShifts.length} team members to schedule.`);
  };

  const handleImportScheduleToTeam = () => {
      if(!schedule) return;
      const existingNames = new Set(team.map(t => t.name.toLowerCase()));
      const newMembers: Employee[] = [];
      const timestamp = Date.now();

      schedule.shifts.forEach((s, i) => {
          if (!existingNames.has(s.name.toLowerCase()) && s.name !== "New Staff") {
              newMembers.push({
                  id: (timestamp + i).toString(),
                  name: s.name,
                  role: s.role,
                  isActive: true
              });
              existingNames.add(s.name.toLowerCase());
          }
      });
      
      if(newMembers.length === 0) {
          alert("No new staff found in schedule to import.");
          return;
      }
      
      setTeam([...team, ...newMembers]);
      alert(`Imported ${newMembers.length} staff members from schedule.`);
  };

  if (isLoading || !schedule) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-4">
              <Loader2 size={48} className="animate-spin text-indigo-600"/>
              <p className="font-medium animate-pulse">Connecting to database...</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md z-20 no-print">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-500 p-1.5 rounded-lg">
             <CheckCircle className="w-6 h-6 text-white" />
           </div>
           <div>
               <div className="flex items-center gap-2">
                   <h1 className="font-bold text-lg leading-tight">SmartRoster Pro</h1>
                   {isSaving && <Loader2 size={12} className="animate-spin text-indigo-400"/>}
               </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-2">Manager Dashboard {supabaseLoading && <span className="text-indigo-300">Syncing…</span>}</div>
          </div>
       </div>
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-800 rounded-lg p-1">
             <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab==='tasks'?'bg-slate-700 text-white shadow':'text-slate-400 hover:text-white'}`}>Worklists</button>
             <button onClick={()=>setActiveTab('schedule')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab==='schedule'?'bg-slate-700 text-white shadow':'text-slate-400 hover:text-white'}`}>Schedule</button>
             <button onClick={()=>setActiveTab('team')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab==='team'?'bg-slate-700 text-white shadow':'text-slate-400 hover:text-white'}`}>Team</button>
           </div>
           <div className="h-6 w-px bg-slate-700 mx-2"></div>
           <button onClick={StorageService.exportData} title="Backup" className="text-slate-400 hover:text-white"><Download size={20}/></button>
           <label className="text-slate-400 hover:text-white cursor-pointer" title="Import">
              <Upload size={20}/>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".json"/>
           </label>
        </div>
      </nav>

      {supabaseError && (
        <div className="bg-amber-100 text-amber-800 text-sm px-6 py-2 border-b border-amber-200 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{supabaseError}</span>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'tasks' && (
            <>
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 no-print shadow-sm overflow-x-auto">
                <div className="flex gap-2">
                    {ORDERED_DAYS.map((k) => (
                        <button key={k} onClick={()=>setSelectedDay(k)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedDay===k ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {DAY_LABELS[k].toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 items-center ml-4 border-l pl-4 border-slate-200">
                     <button onClick={handleGenerateHuddle} className="flex items-center gap-2 px-3 py-2 text-amber-600 font-bold text-sm bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200" title="Uses Flash Lite (Fast)">
                        <Zap size={16} className="fill-current"/> Huddle
                     </button>
                     <button onClick={() => workAreaInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-blue-600 font-bold text-sm bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Uses Pro Vision (Smart)">
                        <Camera size={16}/> Snap & Solve
                        <input type="file" ref={workAreaInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleAnalyzeWorkplace}/>
                     </button>
                </div>
                <div className="flex gap-3 ml-auto">
                     <button onClick={() => setShowDBModal(true)} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        <Menu size={18}/> Rules
                     </button>
                     <button onClick={handleClearDay} className="flex items-center gap-2 px-4 py-2 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg transition-colors">
                        <RotateCcw size={18}/> Clear
                     </button>
                     <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
                        <Printer size={18}/> Print
                     </button>
                     <button onClick={handleRequestAutoDistribute} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95">
                        <Wand2 size={18}/> Auto-Assign
                     </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                <div className="max-w-[1600px] mx-auto">
                    <div className="print-only mb-6 border-b-2 border-slate-900 pb-4">
                        <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Daily Roster & Worklist</h1>
                        <div className="flex justify-between items-end">
                            <div className="text-sm font-bold text-slate-600 uppercase">{DAY_LABELS[selectedDay]} | {schedule.week_period}</div>
                            <div className="text-xs text-slate-400">Generated by SmartRoster Pro</div>
                        </div>
                    </div>

                    <div className="print-only mb-8 p-4 border-2 border-slate-300 rounded-xl bg-white">
                        <h3 className="font-bold text-lg uppercase underline mb-2">Team Priorities (Shared)</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            {taskDB.filter(t => PRIORITY_PINNED_IDS.includes(t.id)).map(t => (
                                <div key={t.id} className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-sm font-medium">{t.name}</span>
                                    <span className="w-12 border-b border-slate-300"></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-8">
                        {getDailyStaff().map(staff => {
                            // Sort by Due Time (earlier first), then priority score
                            const tasks = (assignments[`${selectedDay}-${staff.name}`] || []).sort((a,b) => {
                                // 1. Due Time Sort
                                const timeA = getDueTimeValue(a.dueTime);
                                const timeB = getDueTimeValue(b.dueTime);
                                if (timeA !== timeB) return timeA - timeB;

                                // 2. Priority Score Sort
                                const score = (t: AssignedTask) => t.type === 'skilled' ? 1 : t.code === 'MAN' ? 5 : 3;
                                return score(a) - score(b);
                            });
                            const { label, category } = parseTime(staff.activeTime, staff.role, staff.isSpillover);
                            const totalEffort = getWorkerLoad(staff.name, assignments);
                            const estimatedHours = (totalEffort / 60).toFixed(1);

                            return (
                                <div key={staff.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-2 print:border-slate-800 print:shadow-none break-inside-avoid">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 print:bg-white print:border-b-2 print:border-slate-800 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800 leading-none">{staff.name}</h3>
                                            <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide flex items-center gap-2">
                                                {label} 
                                                <span className={`px-1.5 rounded text-[10px] print:border print:border-slate-400 ${staff.isSpillover ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>{category}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end print:hidden">
                                            <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm mb-1">
                                                {tasks.length}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Clock size={10}/> ~{estimatedHours}h
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-2 min-h-[150px]">
                                        {tasks.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-8 print:hidden">
                                                <AlertCircle size={32} className="mb-2 opacity-50"/>
                                                <span className="text-xs font-medium">No tasks assigned</span>
                                            </div>
                                        ) : (
                                            <ul className="space-y-1">
                                                {tasks.map((t) => (
                                                    <li key={t.instanceId} className="group flex items-start p-2 rounded hover:bg-slate-50 border border-transparent hover:border-indigo-100 transition-colors">
                                                        <div className="print:hidden mr-2 mt-0.5">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(t.code)}`}>{t.code}</span>
                                                        </div>
                                                        <div className="hidden print:block mr-2 mt-1">
                                                            <div className="w-3 h-3 border border-slate-600"></div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <div className="text-sm font-medium text-slate-700 leading-snug">{cleanTaskName(t.name)}</div>
                                                                {t.dueTime && (
                                                                     <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 rounded whitespace-nowrap ml-2">
                                                                         By {t.dueTime}
                                                                     </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleDeleteTask(staff.name, t.instanceId)}
                                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="p-2 border-t border-slate-100 bg-slate-50 print:hidden">
                                        {manualTaskInput?.emp === staff.name ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    autoFocus
                                                    className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1 outline-none shadow-sm"
                                                    value={manualTaskInput.text}
                                                    onChange={e => setManualTaskInput({...manualTaskInput, text: e.target.value})}
                                                    onKeyDown={e => e.key === 'Enter' && handleAddManualTask()}
                                                    placeholder="Task description..."
                                                />
                                                <button onClick={handleAddManualTask} className="bg-indigo-600 text-white rounded px-3 py-1 text-xs font-bold">Add</button>
                                                <button onClick={() => setManualTaskInput(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setManualTaskInput({emp: staff.name, text: ''})}
                                                className="w-full py-1.5 border border-dashed border-slate-300 rounded text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-all flex items-center justify-center gap-1"
                                            >
                                                <Plus size={14}/> Add Manual Task
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            </>
        )}

        {activeTab === 'schedule' && (
            <div className="flex-1 overflow-auto p-8 bg-slate-50 flex justify-center">
                <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Staff Schedule</h2>
                            <p className="text-slate-500 text-sm">Week Period: <input className="border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500" value={schedule.week_period || ''} onChange={(e) => setSchedule({...schedule, week_period: e.target.value})} /></p>
                        </div>
                        <div className="flex gap-2">
                             <input type="file" ref={scanInputRef} className="hidden" onChange={handleScanFileChange} accept="image/*,application/pdf" />
                             <button onClick={() => scanInputRef.current?.click()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
                                <ScanLine size={16}/> Scan Schedule (OCR)
                             </button>
                             {isEditingSchedule ? (
                                 <button onClick={()=>setIsEditingSchedule(false)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm"><Save size={16}/> Save Changes</button>
                             ) : (
                                 <button onClick={()=>setIsEditingSchedule(true)} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200"><Calendar size={16}/> Edit Schedule</button>
                             )}
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 tracking-wider">
                                <tr>
                                    <th className="p-4 border-b border-slate-200 w-64">Employee</th>
                                    {ORDERED_DAYS.map(d => <th key={d} className="p-4 border-b border-slate-200 text-center">{DAY_LABELS[d].slice(0,3)}</th>)}
                                    {isEditingSchedule && <th className="p-4 border-b border-slate-200 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(schedule.shifts || []).map((shift, idx) => (
                                    <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {isEditingSchedule ? (
                                                <div className="space-y-1">
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-bold" value={shift.name} onChange={e => {
                                                        const newShifts = [...(schedule.shifts || [])];
                                                        newShifts[idx] = { ...newShifts[idx], name: e.target.value };
                                                        setSchedule({...schedule, shifts: newShifts});
                                                    }} />
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-500" placeholder="Role" value={shift.role} onChange={e => {
                                                        const newShifts = [...(schedule.shifts || [])];
                                                        newShifts[idx] = { ...newShifts[idx], role: e.target.value };
                                                        setSchedule({...schedule, shifts: newShifts});
                                                    }} />
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-bold text-slate-800">{shift.name}</div>
                                                    <div className="text-xs text-slate-500">{shift.role}</div>
                                                </div>
                                            )}
                                        </td>
                                        {ORDERED_DAYS.map((day) => (
                                            <td key={day} className="p-4 text-center">
                                                {isEditingSchedule ? (
                                                    <input 
                                                        className="w-24 text-center text-sm border border-slate-200 rounded py-1 focus:ring-2 ring-indigo-500 outline-none" 
                                                        value={shift[day as DayKey] || ''}
                                                        onChange={e => {
                                                            const newShifts = schedule.shifts.map((s, i) => 
                                                                i === idx ? { ...s, [day]: e.target.value } : s
                                                            );
                                                            setSchedule({...schedule, shifts: newShifts});
                                                        }}
                                                    />
                                                ) : (
                                                    <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${['OFF', 'X'].includes(String(shift[day as DayKey]).toUpperCase()) ? 'text-slate-300 bg-slate-50' : 'text-slate-700 bg-white border border-slate-200'}`}>
                                                        {formatShiftString(shift[day as DayKey])}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        {isEditingSchedule && (
                                            <td className="p-4">
                                                <button onClick={() => {
                                                     const newShifts = (schedule.shifts || []).filter((_, i) => i !== idx);
                                                     setSchedule({...schedule, shifts: newShifts});
                                                }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {isEditingSchedule && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
                            <button 
                                onClick={() => setSchedule({...schedule, shifts: [...(schedule.shifts || []), { id: Date.now().toString(), name: "New Staff", role: "Stock", sun: "OFF", mon: "OFF", tue: "OFF", wed: "OFF", thu: "OFF", fri: "OFF", sat: "OFF" }]})}
                                className="flex-1 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18}/> Add Staff Row
                            </button>
                             <button 
                                onClick={handleImportTeamToSchedule}
                                className="flex-1 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Briefcase size={18}/> Add From Team Database
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'team' && (
            <div className="flex-1 overflow-auto p-8 bg-slate-50 flex justify-center">
                <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-2xl">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Team Database</h2>
                            <p className="text-slate-500 text-sm">Manage global list of employees available for scheduling.</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleImportScheduleToTeam} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200 border border-slate-200">
                                <RefreshCw size={16}/> Sync from Schedule
                            </button>
                            <button onClick={() => setTeam([...team, { id: Date.now().toString(), name: 'New Employee', role: 'Associate', isActive: true }])} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md">
                                <UserPlus size={16}/> Add Employee
                            </button>
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {team.map(member => (
                            <div key={member.id} className={`p-4 rounded-xl border-2 flex justify-between items-start ${member.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${member.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <input 
                                            className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors"
                                            value={member.name}
                                            onChange={e => setTeam(team.map(t => t.id === member.id ? { ...t, name: e.target.value } : t))}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 pl-10">
                                        <Briefcase size={14}/>
                                        <input 
                                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-32"
                                            value={member.role}
                                            onChange={e => setTeam(team.map(t => t.id === member.id ? { ...t, role: e.target.value } : t))}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                     <button 
                                        onClick={() => setTeam(team.map(t => t.id === member.id ? { ...t, isActive: !t.isActive } : t))}
                                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${member.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                     >
                                         {member.isActive ? 'Active' : 'Inactive'}
                                     </button>
                                     <button 
                                        onClick={() => confirm("Delete employee completely?") && setTeam(team.filter(t => t.id !== member.id))}
                                        className="p-1.5 text-slate-300 hover:text-red-500 self-end"
                                     >
                                         <Trash2 size={16}/>
                                     </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      </main>

      <TaskDBModal 
        isOpen={showDBModal} 
        onClose={() => setShowDBModal(false)} 
        tasks={taskDB} 
        setTasks={setTaskDB}
        staffNames={(schedule?.shifts || []).map(s => s.name)}
      />
      
      {/* SCANNING LOADER */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
                <Loader2 size={64} className="text-white animate-spin mb-6 relative z-10"/>
            </div>
            <div className="text-white font-bold text-2xl tracking-tight flex items-center gap-2">
                <Sparkles className="text-amber-400 animate-bounce" size={24}/> {scanStatus || 'Processing...'}
            </div>
            <div className="text-white/60 text-sm mt-2 font-medium">Using Gemini Intelligence</div>
        </div>
      )}

      {/* AUTO ASSIGN CONFIRMATION MODAL */}
      {showAutoAssignConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                    <Wand2 size={24}/>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Auto-Assign Tasks?</h3>
                <p className="text-slate-600 text-sm mb-6">
                    This will distribute tasks to the <strong>{getDailyStaff().length} staff members</strong> working on <strong>{DAY_LABELS[selectedDay]}</strong>. 
                    <br/><br/>
                    <span className="text-amber-600 font-bold">Warning:</span> Existing assignments for this day will be overwritten.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setShowAutoAssignConfirm(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={runAutoDistribute} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 transition-colors">
                        Confirm & Run
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HUDDLE MODAL */}
      {huddleText && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><Zap size={20}/> Daily Huddle Script</h3>
                      <button onClick={() => setHuddleText(null)} className="hover:bg-white/20 p-1 rounded"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-lg leading-relaxed text-slate-700 font-medium whitespace-pre-wrap">{huddleText}</p>
                  </div>
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
                      <button onClick={() => setHuddleText(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm">Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* AI TASKS MODAL */}
      {aiTasks && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><Camera size={20}/> Work Area Analysis</h3>
                      <button onClick={() => setAiTasks(null)} className="hover:bg-white/20 p-1 rounded"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="mb-4 text-sm text-slate-500">Gemini detected the following potential tasks from your photo:</div>
                      <div className="space-y-2">
                          {aiTasks.map((t, i) => (
                              <div key={i} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                                  <div>
                                      <div className="font-bold text-slate-800">{t.name}</div>
                                      <div className="text-xs text-slate-500 uppercase tracking-wider">{t.effort} mins • {t.code}</div>
                                  </div>
                                  <CheckCircle size={20} className="text-green-500"/>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
                      <button onClick={() => setAiTasks(null)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
                      <button onClick={handleConfirmAiTasks} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-200">Add to Schedule</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session ?? null);
      setAuthReady(true);
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        setAuthError(null);
        setEmailNotice(null);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setEmailNotice(null);
    const { error } = await signInWithEmail(email);
    if (error) {
      setAuthError(error.message);
    } else {
      setEmailNotice('Magic link sent! Check your email to continue.');
    }
  };

  const handleGoogle = async () => {
    setAuthError(null);
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error.message);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" />
          <span className="font-medium">Checking your session…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md space-y-6 p-8">
          <div>
            <h1 className="text-xl font-bold">Sign in to SmartRoster</h1>
            <p className="text-sm text-slate-400">Use a magic link or continue with Google.</p>
          </div>
          <form onSubmit={handleMagicLink} className="space-y-3">
            <label className="text-sm font-semibold text-slate-200">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors"
            >
              Send magic link
            </button>
          </form>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-700" />
            <span>or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
          <button
            onClick={handleGoogle}
            className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-lg shadow-lg shadow-slate-900/20 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <span>Continue with Google</span>
          </button>
          {emailNotice && <div className="text-emerald-300 text-sm">{emailNotice}</div>}
          {authError && <div className="text-rose-300 text-sm">{authError}</div>}
        </div>
      </div>
    );
  }

  return <RosterApp session={session} />;
}
