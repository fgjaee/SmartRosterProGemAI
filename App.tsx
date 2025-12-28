
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Users, Calendar, CheckCircle, Wand2, Printer, 
  Download, Upload, Plus, Trash2, ArrowRight, X, 
  Menu, RotateCcw, Save, AlertCircle, ScanLine, Loader2, Clock, Settings, UserPlus, Briefcase,
  Camera, Zap, Sparkles, MessageSquare, RefreshCw, Megaphone, Edit3, ArrowRightLeft, User, LayoutGrid, List,
  Type, AlignLeft, ListOrdered, UserCheck, GripVertical, Eraser, MousePointerClick, Layers
} from 'lucide-react';

import { 
  ScheduleData, TaskRule, TaskAssignmentMap, 
  DayKey, Shift, AssignedTask, DAY_LABELS, Employee 
} from './types';
import { PRIORITY_PINNED_IDS, COMMON_SHIFTS } from './constants';
import { StorageService } from './services/storageService';
import { AIService } from './services/aiService'; 
import TaskDBModal from './components/TaskDBModal';

// --- Utility Functions ---

const ORDERED_DAYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const cleanTaskName = (n: string) => n.replace(/\(Sat Only\)/gi, '').replace(/\(Fri Only\)/gi, '').replace(/\(Excl.*?\)/gi, '').trim();

const getDueTimeValue = (t: string | undefined) => {
    if (!t) return 9999;
    if (t === "Store Open") return 700;
    if (t === "Closing") return 2200;
    const norm = t.toUpperCase().replace(/\s+/g, ' ').trim();
    const match = norm.match(/(\d{1,2})(?::(\d{2}))?\s*(A|P|AM|PM)?/);
    if (match) {
        let h = parseInt(match[1]);
        const m = parseInt(match[2] || '0');
        const suffix = match[3];
        if (suffix && suffix.startsWith('P') && h !== 12) h += 12;
        if (suffix && suffix.startsWith('A') && h === 12) h = 0;
        if (!suffix && h < 7) h += 12;
        return h * 100 + m;
    }
    return 9999;
};

const parseShiftStartEnd = (timeStr: string) => {
    if (!timeStr || ['OFF', 'X', 'VAC'].some(x => timeStr.toUpperCase().includes(x))) {
        return { start: -1, end: -1 };
    }
    const clean = timeStr.replace(/\s/g, '').toUpperCase();
    const parts = clean.split('-');
    if (parts.length !== 2) return { start: -1, end: -1 };
    const parsePart = (p: string) => {
        const match = p.match(/(\d{1,2})(?::(\d{2}))?(A|P|AM|PM)?/);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const m = parseInt(match[2] || '0');
        const suffix = match[3];
        if (suffix && (suffix.startsWith('P')) && h !== 12) h += 12;
        if (suffix && (suffix.startsWith('A')) && h === 12) h = 0;
        return h * 100 + m;
    };
    let start = parsePart(parts[0]);
    let end = parsePart(parts[1]);
    const hasExplicitSuffix = parts[0].includes('A') || parts[0].includes('P');
    if (!hasExplicitSuffix && start < 500) start += 1200; 
    if (end < start) end += 2400; 
    return { start, end };
};

const isStaffCompatibleWithTask = (start: number, end: number, task: TaskRule) => {
    if (start === -1 || end === -1) return false;
    if (task.dueTime === "Closing" || task.code === "CLSE") {
        if (end < 1800) return false;
        return true; 
    }
    if (task.dueTime) {
        const dueVal = getDueTimeValue(task.dueTime);
        if (dueVal < 2200 && start >= dueVal) return false;
    }
    return true;
};

const parseTime = (timeStr: any, role: string, isSpillover = false) => {
    if (timeStr === null || timeStr === undefined || timeStr === '') return { h: 24, label: 'OFF', category: 'OFF' };
    const raw = String(timeStr).toUpperCase().trim();
    if (!raw || ['OFF', 'X', 'VAC', 'SICK', 'REQ', 'LOAN', 'LOANED OUT', 'L.O.', 'PTO', 'BRV', 'NOT', 'N/A'].some(off => raw.includes(off))) {
        return { h: 24, label: 'OFF', category: 'OFF' };
    }
    const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(A|P|AM|PM)?/);
    if (!match) return { h: 24, label: raw, category: 'OFF' };
    let h = parseInt(match[1]);
    const m = match[2] || '00';
    const suffix = match[3];
    if (suffix) {
        if (suffix.startsWith('P') && h !== 12) h += 12;
        if (suffix.startsWith('A') && h === 12) h = 0;
    } else {
        if (h >= 1 && h <= 3) h += 12;
        else if (h >= 4 && h <= 6) {
             const r = (role || '').toLowerCase();
             const amRoles = ['stock', 'flow', 'baker', 'open', 'truck', 'merch', 'rec', 'lead', 'sup', 'mngr', 'manager', 'dir'];
             if (!amRoles.some(am => r.includes(am))) h += 12;
        }
    }
    let category = 'Mid';
    if (h >= 20 || h <= 3) category = 'Overnight';
    else if (h >= 4 && h <= 6) category = 'Open';
    else if (h >= 16 && h <= 19) category = 'Close';
    else category = 'Mid'; 
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

const getBadgeColor = (code: string) => {
    if (code === 'ORDR') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (code === 'TRCK') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (code.startsWith('T')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (code.startsWith('W')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

const namesMatch = (n1: string, n2: string) => {
    if (!n1 || !n2) return false;
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const s1 = clean(n1);
    const s2 = clean(n2);
    if (s1.length < 3 || s2.length < 3) return s1 === s2;
    return s1.includes(s2) || s2.includes(s1);
};

// --- Sub-Components ---

interface PrintSettings {
    layout: 'grid' | 'list';
    fontSize: 'small' | 'normal' | 'large';
    showTimes: boolean;
    dayLabel: string;
    pageTitle: string;
    announcementTitle: string;
    fontStyle: 'sans' | 'serif' | 'mono';
    announcementFormat: 'text' | 'list';
}

const PrintableRoster = ({ 
    staff, 
    assignments, 
    settings,
    pinnedMessage
}: { 
    staff: any[], 
    assignments: TaskAssignmentMap, 
    settings: PrintSettings,
    pinnedMessage: string 
}) => {
    const fontSizeClass = {
        small: 'text-[10px]',
        normal: 'text-xs',
        large: 'text-sm'
    }[settings.fontSize];

    const headerClass = {
        small: 'text-sm',
        normal: 'text-base',
        large: 'text-lg'
    }[settings.fontSize];

    const fontClass = {
        sans: 'font-sans',
        serif: 'font-serif',
        mono: 'font-mono'
    }[settings.fontStyle] || 'font-sans';

    return (
        <div className={`p-8 bg-white text-slate-900 w-full h-full ${fontClass}`}>
            <div className="mb-6 border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">{settings.pageTitle}</h1>
                    <div className="font-bold text-slate-600 uppercase mt-1">{settings.dayLabel}</div>
                </div>
                {pinnedMessage && (
                    <div className="max-w-md text-right bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <div className="text-[10px] font-bold text-amber-700 uppercase mb-1">{settings.announcementTitle}</div>
                        {settings.announcementFormat === 'list' ? (
                            <ul className="text-sm font-medium text-slate-800 list-disc list-inside text-left">
                                {pinnedMessage.split('\n').filter(l => l.trim()).map((line, i) => (
                                    <li key={i}>{line}</li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{pinnedMessage}</div>
                        )}
                    </div>
                )}
            </div>

            {settings.layout === 'grid' ? (
                <div className="grid grid-cols-2 gap-6">
                    {staff.map(s => {
                        const tasks = (assignments[`${s.selectedDay}-${s.name}`] || []).sort((a,b) => getDueTimeValue(a.dueTime) - getDueTimeValue(b.dueTime));
                        return (
                            <div key={s.id} className="border border-slate-300 rounded-lg break-inside-avoid">
                                <div className="bg-slate-100 p-2 border-b border-slate-300 flex justify-between items-center">
                                    <span className={`${headerClass} font-bold`}>{s.name}</span>
                                    <span className={`${fontSizeClass} font-bold bg-white px-2 py-0.5 rounded border border-slate-200`}>{s.activeTime}</span>
                                </div>
                                <div className="p-2">
                                    <ul className="space-y-1">
                                        {tasks.length === 0 && <li className={`${fontSizeClass} text-slate-400 italic`}>No tasks assigned</li>}
                                        {tasks.map(t => (
                                            <li key={t.instanceId} className={`flex items-start gap-2 ${fontSizeClass}`}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"></div>
                                                <div className="flex-1">
                                                    <span className="font-medium">{cleanTaskName(t.name)}</span>
                                                    {settings.showTimes && t.dueTime && <span className="ml-2 font-bold text-slate-500">({t.dueTime})</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <table className="w-full border-collapse border border-slate-300">
                    <thead>
                        <tr className="bg-slate-100 text-left">
                            <th className={`p-2 border border-slate-300 ${headerClass} w-1/4`}>Staff Member</th>
                            <th className={`p-2 border border-slate-300 ${headerClass} w-1/4`}>Shift</th>
                            <th className={`p-2 border border-slate-300 ${headerClass}`}>Tasks</th>
                        </tr>
                    </thead>
                    <tbody>
                         {staff.map(s => {
                            const tasks = (assignments[`${s.selectedDay}-${s.name}`] || []).sort((a,b) => getDueTimeValue(a.dueTime) - getDueTimeValue(b.dueTime));
                            return (
                                <tr key={s.id} className="break-inside-avoid">
                                    <td className={`p-2 border border-slate-300 font-bold align-top ${headerClass}`}>{s.name}</td>
                                    <td className={`p-2 border border-slate-300 align-top ${fontSizeClass}`}>{s.activeTime}</td>
                                    <td className="p-2 border border-slate-300 align-top">
                                        <ul className="space-y-1">
                                            {tasks.map(t => (
                                                <li key={t.instanceId} className={`flex items-start gap-2 ${fontSizeClass}`}>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"></div>
                                                    <div>
                                                        <span className="font-medium">{cleanTaskName(t.name)}</span>
                                                        {settings.showTimes && t.dueTime && <span className="ml-2 font-bold text-slate-500 text-[10px] bg-slate-100 px-1 rounded">By {t.dueTime}</span>}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks' | 'team'>('tasks');
  const [selectedDay, setSelectedDay] = useState<DayKey>('fri');
  
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [taskDB, setTaskDB] = useState<TaskRule[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignmentMap>({});
  const [team, setTeam] = useState<Employee[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDBModal, setShowDBModal] = useState(false);
  const [showAutoAssignConfirm, setShowAutoAssignConfirm] = useState(false);
  const [showTaskPool, setShowTaskPool] = useState(false);
  
  const [manualTaskInput, setManualTaskInput] = useState<{emp: string, text: string} | null>(null);
  const [moveTaskModal, setMoveTaskModal] = useState<{empName: string, task: AssignedTask} | null>(null);
  const [isEditingPinned, setIsEditingPinned] = useState(false);
  
  // Quick Shift Palette State
  const [selectedPaletteShift, setSelectedPaletteShift] = useState<string | null>(null);
  
  // Drag State
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
      layout: 'grid',
      fontSize: 'normal',
      showTimes: true,
      dayLabel: '',
      pageTitle: 'Daily Roster & Worklist',
      announcementTitle: 'Team Announcements',
      fontStyle: 'sans',
      announcementFormat: 'text'
  });
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [huddleText, setHuddleText] = useState<string | null>(null);
  const [aiTasks, setAiTasks] = useState<TaskRule[] | null>(null);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const workAreaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [s, t, a, tm, pm] = await Promise.all([
                StorageService.getSchedule(),
                StorageService.getTaskDB(),
                StorageService.getAssignments(),
                StorageService.getTeam(),
                StorageService.getPinnedMessage()
            ]);
            setSchedule(s);
            setTaskDB(t);
            setAssignments(a);
            setTeam(tm);
            setPinnedMessage(pm);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveData = (key: string, fn: () => Promise<void>) => {
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
          try { await fn(); } catch(e) {}
          finally { setIsSaving(false); }
      }, 500);
  };

  useEffect(() => { if (schedule) saveData('sched', () => StorageService.saveSchedule(schedule)); }, [schedule]);
  useEffect(() => { if (taskDB.length) saveData('taskdb', () => StorageService.saveTaskDB(taskDB)); }, [taskDB]);
  useEffect(() => { if (Object.keys(assignments).length) saveData('assign', () => StorageService.saveAssignments(assignments)); }, [assignments]);
  useEffect(() => { if (team.length) saveData('team', () => StorageService.saveTeam(team)); }, [team]);
  useEffect(() => { if (pinnedMessage) saveData('pinned', () => StorageService.savePinnedMessage(pinnedMessage)); }, [pinnedMessage]);

  const handleOpenPrintModal = () => {
      setPrintSettings(prev => ({ ...prev, dayLabel: `${DAY_LABELS[selectedDay]} | ${schedule?.week_period}` }));
      setShowPrintModal(true);
  };

  const executePrint = () => {
      setTimeout(() => {
          window.print();
      }, 100);
  };

  const getDailyStaff = useCallback(() => {
    if (!schedule) return [];
    const shifts = schedule.shifts || [];
    const staff = shifts.map(s => {
        const t = s[selectedDay];
        if (!t) return null;
        const { category, label } = parseTime(t, s.role);
        if (category === 'OFF') return null;
        const { start, end } = parseShiftStartEnd(t);
        return { 
            ...s, 
            activeTime: label, 
            isSpillover: false, 
            compStart: start, 
            compEnd: end, 
            rawShift: t,
            selectedDay 
        };
    }).filter(s => s !== null);

    const uniqueMap = new Map();
    staff.forEach(item => {
        if (item && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values()) as (Shift & { activeTime: string, isSpillover: boolean, compStart: number, compEnd: number, rawShift: string, selectedDay: string })[];
  }, [schedule, selectedDay]);

  const getWorkerLoad = (empName: string, currentAssignments: TaskAssignmentMap) => {
    const key = `${selectedDay}-${empName}`;
    return (currentAssignments[key] || []).reduce((acc, t) => acc + (t.effort || 30), 0);
  };

  // --- Task Pool Logic ---
  const unassignedTasks = useMemo(() => {
    const currentSystemDate = new Date().getDate(); 
    const validRules = taskDB.filter(t => {
        if (t.excludedDays && t.excludedDays.includes(selectedDay)) return false;
        if (t.frequency === 'weekly' && (t.frequencyDay || 'fri') !== selectedDay) return false;
        if (t.frequency === 'monthly' && (t.frequencyDate !== currentSystemDate)) return false;
        return true;
    });

    // Get all assigned task IDs for the selected day
    const assignedIds = new Set();
    Object.keys(assignments).forEach(key => {
        if (key.startsWith(`${selectedDay}-`)) {
            assignments[key].forEach(t => assignedIds.add(t.id));
        }
    });

    return validRules.filter(t => !assignedIds.has(t.id));
  }, [taskDB, assignments, selectedDay]);

  const runAutoDistribute = () => {
    setShowAutoAssignConfirm(false);
    try {
        const staff = getDailyStaff();
        if (staff.length === 0) return;
        
        const newAssignments: TaskAssignmentMap = { ...assignments };
        staff.forEach(s => delete newAssignments[`${selectedDay}-${s.name}`]);

        const assign = (empName: string, rule: TaskRule) => {
            const key = `${selectedDay}-${empName}`;
            if (!newAssignments[key]) newAssignments[key] = [];
            if (newAssignments[key].some(t => t.id === rule.id)) return;
            newAssignments[key].push({ ...rule, instanceId: Math.random().toString(36).substr(2, 9) });
        };

        const currentSystemDate = new Date().getDate(); 
        const validRules = taskDB.filter(t => {
            if (t.excludedDays && t.excludedDays.includes(selectedDay)) return false;
            if (t.frequency === 'weekly' && (t.frequencyDay || 'fri') !== selectedDay) return false;
            if (t.frequency === 'monthly' && (t.frequencyDate !== currentSystemDate)) return false;
            return true;
        }).sort((a, b) => {
            const getRank = (r: TaskRule) => {
                if (r.code === 'TRCK' || r.code === 'ORDR') return 1;
                if (r.code.startsWith('T')) return 10 + parseInt(r.code.slice(1) || '0');
                if (r.code.startsWith('W')) return 30 + parseInt(r.code.slice(1) || '0');
                if (r.code === 'FACE') return 2;
                return 100;
            };
            return getRank(a) - getRank(b);
        });

        // TRCK SPECIAL LOGIC
        const truckTask = validRules.find(t => t.code === 'TRCK');
        if (truckTask) {
            const eligibles = staff.filter(s => s.role.includes("Overnight") || s.name.includes("Solomon") || s.name.includes("Marlon"));
            if (selectedDay === 'wed') { 
                eligibles.forEach(s => assign(s.name, truckTask));
            } else {
                const primary = eligibles.find(s => s.name.includes("Solomon")) || eligibles[0];
                if (primary) assign(primary.name, truckTask);
            }
        }

        const flashTask = validRules.find(t => t.code === 'FLAS');
        if (flashTask) {
            const bagsTotal = 10;
            const bagsPerPerson = Math.ceil(bagsTotal / staff.length);
            staff.forEach(s => assign(s.name, { ...flashTask, name: `${bagsPerPerson} Flashfood Bags` }));
        }

        validRules.filter(t => t.type === 'skilled' && !['TRCK', 'FLAS'].includes(t.code)).forEach(t => {
            let assigned = false;
            for (const name of t.fallbackChain) {
                const match = staff.find(s => namesMatch(s.name, name));
                if (match && isStaffCompatibleWithTask(match.compStart, match.compEnd, t)) {
                    assign(match.name, t);
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                const best = staff.filter(s => isStaffCompatibleWithTask(s.compStart, s.compEnd, t))
                                  .sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments))[0];
                if(best) assign(best.name, t);
            }
        });

        const pool = validRules.filter(t => (t.type === 'general' || t.type === 'shift_based') && !['TRCK', 'FLAS'].includes(t.code));
        pool.forEach(t => {
            const best = staff.filter(s => isStaffCompatibleWithTask(s.compStart, s.compEnd, t))
                              .sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments))[0];
            if(best) assign(best.name, t);
        });

        setAssignments(newAssignments);
    } catch (e: any) {
        alert(`Auto-assign failed: ${e.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files?.[0]) {
          await StorageService.importData(e.target.files[0]);
          window.location.reload();
      }
  };

  const handleScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsScanning(true);
      setScanStatus('Reading Schedule...');
      try {
          const scannedData = await AIService.parseSchedule(file);
          setSchedule(scannedData);
      } catch (error: any) {
          alert("Scan failed: " + error.message);
      } finally {
          setIsScanning(false);
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
          if(workAreaInputRef.current) workAreaInputRef.current.value = '';
      }
  };

  const handleGenerateHuddle = async () => {
      const staff = getDailyStaff();
      if(staff.length === 0) return alert("No staff scheduled for today");
      setIsScanning(true);
      setScanStatus('Writing Huddle...');
      try {
          const focus = taskDB.filter(t => PRIORITY_PINNED_IDS.includes(t.id)).map(t => t.name);
          const speech = await AIService.generateDailyHuddle(DAY_LABELS[selectedDay], staff.length, focus.slice(0, 3));
          setHuddleText(speech);
      } catch(e) {
          alert("Failed to generate huddle");
      } finally {
          setIsScanning(false);
      }
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

  const handleUpdateTaskName = (empName: string, instanceId: string, newName: string) => {
      const key = `${selectedDay}-${empName}`;
      setAssignments(prev => ({
          ...prev,
          [key]: prev[key].map(t => t.instanceId === instanceId ? { ...t, name: newName } : t)
      }));
  };

  const handleAddManualTask = () => {
      if(!manualTaskInput || !manualTaskInput.text) return;
      const key = `${selectedDay}-${manualTaskInput.emp}`;
      const existingTask = taskDB.find(t => t.name.toLowerCase() === manualTaskInput.text.toLowerCase());
      const newTask: AssignedTask = existingTask ? {
          ...existingTask,
          instanceId: Date.now().toString()
      } : {
          id: 9999, code: 'MAN', name: manualTaskInput.text, type: 'manual', fallbackChain: [], instanceId: Date.now().toString(), effort: 30
      };
      setAssignments(prev => ({ ...prev, [key]: [...(prev[key] || []), newTask] }));
      setManualTaskInput(null);
  };

  const handleMoveTask = (targetEmpName: string) => {
      if (!moveTaskModal) return;
      const { empName: sourceEmpName, task } = moveTaskModal;
      const sourceKey = sourceEmpName ? `${selectedDay}-${sourceEmpName}` : null;
      const targetKey = `${selectedDay}-${targetEmpName}`;
      const newAssignments = { ...assignments };
      
      if (sourceKey && newAssignments[sourceKey]) {
          newAssignments[sourceKey] = newAssignments[sourceKey].filter(t => t.instanceId !== task.instanceId);
      }
      
      if (!newAssignments[targetKey]) newAssignments[targetKey] = [];
      newAssignments[targetKey].push(task);
      setAssignments(newAssignments);
      setMoveTaskModal(null);
  };

  const handleImportScheduleToTeam = () => {
      if(!schedule) return;
      const existingNames = new Set(team.map(t => t.name.toLowerCase().trim()));
      const newMembers: Employee[] = [];
      schedule.shifts.forEach((s, i) => {
          if (!existingNames.has(s.name.toLowerCase().trim()) && s.name !== "New Staff") {
              newMembers.push({ id: (Date.now() + i).toString(), name: s.name, role: s.role, isActive: true });
          }
      });
      setTeam([...team, ...newMembers]);
  };

  const handlePopulateScheduleFromTeam = () => {
      if(!schedule) return;
      if(!confirm("Append all active team members to the schedule?")) return;
      
      const existingNames = new Set(schedule.shifts.map(s => s.name.toLowerCase().trim()));
      const newShifts: Shift[] = team
        .filter(t => t.isActive && !existingNames.has(t.name.toLowerCase().trim()))
        .map(t => ({
            id: t.id, 
            name: t.name, 
            role: t.role,
            sun: "OFF", mon: "OFF", tue: "OFF", wed: "OFF", thu: "OFF", fri: "OFF", sat: "OFF"
        }));
        
      if(newShifts.length > 0) {
          setSchedule(prev => prev ? { ...prev, shifts: [...prev.shifts, ...newShifts] } : null);
      } else {
          alert("No new active team members to add.");
      }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || !schedule) return;
    
    const newShifts = [...schedule.shifts];
    const [draggedItem] = newShifts.splice(draggedRowIndex, 1);
    newShifts.splice(dropIndex, 0, draggedItem);
    
    setSchedule({ ...schedule, shifts: newShifts });
    setDraggedRowIndex(null);
  };

  const applyPaletteToCell = (shiftIndex: number, day: DayKey) => {
    if (selectedPaletteShift && schedule) {
        const newShifts = schedule.shifts.map((s, i) => i === shiftIndex ? { ...s, [day]: selectedPaletteShift } : s);
        setSchedule({ ...schedule, shifts: newShifts });
    }
  };

  if (isLoading || !schedule) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-4">
              <Loader2 size={48} className="animate-spin text-indigo-600"/>
              <p className="font-medium">Connecting to database...</p>
          </div>
      );
  }

  const shiftOptions = COMMON_SHIFTS;

  return (
    <>
    <div id="app-root" className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md z-20 no-print">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-500 p-1.5 rounded-lg"><CheckCircle className="w-6 h-6 text-white" /></div>
           <div>
               <div className="flex items-center gap-2">
                   <h1 className="font-bold text-lg leading-tight">SmartRoster Pro</h1>
                   {isSaving && <Loader2 size={12} className="animate-spin text-indigo-400"/>}
               </div>
               <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Manager Dashboard</div>
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
                <div className="flex gap-3 ml-auto items-center">
                     <button onClick={() => setShowTaskPool(!showTaskPool)} className={`flex items-center gap-2 px-3 py-2 font-bold text-sm rounded-lg border transition-all ${showTaskPool ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-inner' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                        <Layers size={16}/> Task Pool {unassignedTasks.length > 0 && <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full">{unassignedTasks.length}</span>}
                     </button>
                     <button onClick={handleGenerateHuddle} className="flex items-center gap-2 px-3 py-2 text-amber-600 font-bold text-sm bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200"><Zap size={16}/> Huddle</button>
                     <button onClick={() => workAreaInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-blue-600 font-bold text-sm bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"><Camera size={16}/> Scan Floor
                        <input type="file" ref={workAreaInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleAnalyzeWorkplace}/>
                     </button>
                     <div className="h-6 w-px bg-slate-200 mx-2"></div>
                     <button onClick={() => setShowDBModal(true)} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"><Menu size={18}/> Rules</button>
                     <button onClick={handleClearDay} className="flex items-center gap-2 px-4 py-2 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg"><RotateCcw size={18}/> Clear</button>
                     <button onClick={handleOpenPrintModal} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"><Printer size={18}/> Print</button>
                     <button onClick={() => setShowAutoAssignConfirm(true)} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg">
                        <Wand2 size={18}/> Auto-Assign
                     </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                <div className="max-w-[1600px] mx-auto">
                    <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 shadow-sm rounded-r-lg flex items-start gap-4 no-print">
                        <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                            <Megaphone size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-amber-900 uppercase text-xs tracking-wider">Team Announcements</h3>
                                <button onClick={() => setIsEditingPinned(!isEditingPinned)} className="text-amber-500 hover:text-amber-700">
                                    <Edit3 size={14}/>
                                </button>
                            </div>
                            {isEditingPinned ? (
                                <div className="flex flex-col gap-2">
                                    <textarea 
                                        className="w-full p-2 border border-amber-200 rounded text-sm focus:ring-2 focus:ring-amber-400 outline-none" 
                                        rows={3}
                                        value={pinnedMessage}
                                        onChange={(e) => setPinnedMessage(e.target.value)}
                                    />
                                    <button onClick={() => setIsEditingPinned(false)} className="self-end px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded">Save Message</button>
                                </div>
                            ) : (
                                <p className="text-slate-800 text-sm font-medium whitespace-pre-wrap">{pinnedMessage || "No announcements set."}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Task Pool Card */}
                        {showTaskPool && (
                            <div className="bg-indigo-50 rounded-xl shadow-md border-2 border-indigo-200 overflow-hidden break-inside-avoid">
                                <div className="p-4 border-b border-indigo-100 bg-indigo-100/50 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Layers className="text-indigo-600" size={20}/>
                                        <h3 className="font-bold text-lg text-indigo-900 leading-none">Task Pool</h3>
                                    </div>
                                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Unassigned</span>
                                </div>
                                <div className="p-2 min-h-[120px]">
                                    {unassignedTasks.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center py-8 text-indigo-400">
                                            <CheckCircle size={32} className="mb-2 opacity-20"/>
                                            <p className="text-xs font-bold uppercase">All tasks assigned</p>
                                        </div>
                                    ) : (
                                        <ul className="space-y-1">
                                            {unassignedTasks.sort((a,b) => getDueTimeValue(a.dueTime) - getDueTimeValue(b.dueTime)).map((t) => (
                                                <li key={t.id} className="group flex items-start p-2 rounded bg-white border border-indigo-100 hover:border-indigo-400 shadow-sm transition-all">
                                                    <div className="mr-2 mt-0.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(t.code)}`}>{t.code}</span></div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-sm font-bold text-indigo-900">{cleanTaskName(t.name)}</span>
                                                            {t.dueTime && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded ml-2 whitespace-nowrap">By {t.dueTime}</span>}
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => setMoveTaskModal({ empName: '', task: { ...t, instanceId: Date.now().toString() } })} 
                                                        className="ml-2 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1 rounded transition-colors"
                                                        title="Assign Task"
                                                    >
                                                        <UserPlus size={14} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {getDailyStaff().map(staff => {
                            const tasks = (assignments[`${selectedDay}-${staff.name}`] || []).sort((a,b) => getDueTimeValue(a.dueTime) - getDueTimeValue(b.dueTime));
                            const { label, category } = parseTime(staff.activeTime, staff.role, staff.isSpillover);
                            const hours = (getWorkerLoad(staff.name, assignments) / 60).toFixed(1);
                            return (
                                <div key={staff.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800 leading-none">{staff.name}</h3>
                                            <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide flex items-center gap-2">
                                                {label} <span className={`px-1.5 rounded text-[10px] ${staff.isSpillover ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>{category}</span>
                                            </div>
                                        </div>
                                        <div className="text-right print:hidden">
                                            <div className="text-xs font-bold text-slate-400">~{hours}h Load</div>
                                        </div>
                                    </div>
                                    <div className="p-2 min-h-[120px]">
                                        <ul className="space-y-1">
                                            {tasks.map((t) => (
                                                <li key={t.instanceId} className="group flex items-start p-2 rounded hover:bg-slate-50 border border-transparent hover:border-indigo-100">
                                                    <div className="mr-2 mt-0.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(t.code)}`}>{t.code}</span></div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <input 
                                                                className="w-full text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -ml-1"
                                                                value={cleanTaskName(t.name)}
                                                                onChange={(e) => handleUpdateTaskName(staff.name, t.instanceId, e.target.value)}
                                                            />
                                                            {t.dueTime && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded ml-2 whitespace-nowrap">By {t.dueTime}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setMoveTaskModal({ empName: staff.name, task: t })} className="text-slate-300 hover:text-indigo-500" title="Move"><ArrowRightLeft size={14} /></button>
                                                        <button onClick={() => handleDeleteTask(staff.name, t.instanceId)} className="text-slate-300 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="p-2 border-t border-slate-100 bg-slate-50 print:hidden">
                                        {manualTaskInput?.emp === staff.name ? (
                                            <div className="flex gap-2">
                                                <input autoFocus list="task-options" className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1" placeholder="Task Name..." value={manualTaskInput.text} onChange={e => setManualTaskInput({...manualTaskInput, text: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAddManualTask()}/>
                                                <datalist id="task-options">{taskDB.map(t => (<option key={t.id} value={t.name} />))}</datalist>
                                                <button onClick={handleAddManualTask} className="bg-indigo-600 text-white rounded px-3 py-1 text-xs font-bold">Add</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setManualTaskInput({emp: staff.name, text: ''})} className="w-full py-1.5 border border-dashed border-slate-300 rounded text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-white flex items-center justify-center gap-1"><Plus size={14}/> Add Task</button>
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
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 flex flex-col items-center">
                <datalist id="common-shifts">
                    {shiftOptions.map(s => <option key={s} value={s} />)}
                </datalist>

                <div className="w-full max-w-6xl mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase mr-2 flex items-center gap-1"><MousePointerClick size={14}/> Quick Shift:</span>
                    <button onClick={() => setSelectedPaletteShift(null)} className={`px-3 py-1 text-xs font-bold rounded border ${!selectedPaletteShift ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>Cursor</button>
                    {COMMON_SHIFTS.filter(s => !['OFF', 'VAC', 'REQ'].includes(s)).map(s => (
                        <button key={s} onClick={() => setSelectedPaletteShift(s)} className={`px-3 py-1 text-xs font-bold rounded border ${selectedPaletteShift === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}>
                            {s}
                        </button>
                    ))}
                    <button onClick={() => setSelectedPaletteShift("OFF")} className={`px-3 py-1 text-xs font-bold rounded border ${selectedPaletteShift === "OFF" ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-700 border-slate-200 hover:border-red-300'}`}>OFF</button>
                </div>

                <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center no-print flex-wrap gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Staff Schedule</h2>
                        <div className="flex gap-2">
                             <input type="file" ref={scanInputRef} className="hidden" onChange={handleScanFileChange} accept="image/*,application/pdf" />
                             <button onClick={handlePopulateScheduleFromTeam} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors">
                                <UserCheck size={16}/> Populate from Team
                             </button>
                             <button onClick={() => scanInputRef.current?.click()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md transition-colors"><ScanLine size={16}/> Scan Schedule</button>
                             <button onClick={handleOpenPrintModal} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"><Printer size={16}/> Print</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 tracking-wider">
                                <tr>
                                    <th className="p-4 border-b border-slate-200 w-10"></th>
                                    <th className="p-4 border-b border-slate-200 w-64">Employee</th>
                                    {ORDERED_DAYS.map(d => <th key={d} className="p-4 border-b border-slate-200 text-center">{DAY_LABELS[d].slice(0,3)}</th>)}
                                    <th className="p-4 border-b border-slate-200 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {schedule.shifts.map((shift, idx) => (
                                    <tr 
                                        key={shift.id} 
                                        className={`group hover:bg-slate-50/50 break-inside-avoid ${draggedRowIndex === idx ? 'opacity-50' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx)}
                                    >
                                        <td className="p-4 text-slate-300 cursor-move hover:text-slate-500"><GripVertical size={16}/></td>
                                        <td className="p-4 font-medium text-slate-800">
                                            <input 
                                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-bold text-slate-800"
                                                value={shift.name} 
                                                onChange={e => {
                                                    const newShifts = [...schedule.shifts];
                                                    newShifts[idx].name = e.target.value;
                                                    setSchedule({...schedule, shifts: newShifts});
                                                }}
                                            />
                                            <input 
                                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs text-slate-500 mt-1"
                                                value={shift.role}
                                                onChange={e => {
                                                    const newShifts = [...schedule.shifts];
                                                    newShifts[idx].role = e.target.value;
                                                    setSchedule({...schedule, shifts: newShifts});
                                                }}
                                            />
                                        </td>
                                        {ORDERED_DAYS.map((day) => (
                                            <td 
                                                key={day} 
                                                className="p-1 text-center cursor-pointer relative"
                                                onClick={() => applyPaletteToCell(idx, day)}
                                            >
                                                <input 
                                                    list="common-shifts"
                                                    className={`w-full text-center text-xs py-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition-colors 
                                                        ${['OFF', 'X'].includes(String(shift[day as DayKey]).toUpperCase()) ? 'bg-slate-50 text-slate-400 font-medium' : 'bg-white border border-slate-200 text-slate-800 font-bold shadow-sm'}
                                                        ${selectedPaletteShift ? 'cursor-pointer' : ''}
                                                    `}
                                                    placeholder="OFF"
                                                    value={shift[day as DayKey] || ''} 
                                                    onChange={e => {
                                                        const newShifts = schedule.shifts.map((s, i) => i === idx ? { ...s, [day]: e.target.value } : s);
                                                        setSchedule({...schedule, shifts: newShifts});
                                                    }}
                                                />
                                            </td>
                                        ))}
                                        <td className="p-4">
                                            <button 
                                                onClick={() => {
                                                    if(confirm("Remove this row?")) {
                                                        setSchedule({...schedule, shifts: schedule.shifts.filter((_, i) => i !== idx)});
                                                    }
                                                }}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={10} className="p-4">
                                        <button 
                                            onClick={() => setSchedule({...schedule, shifts: [...schedule.shifts, { id: Date.now().toString(), name: "New Employee", role: "Stock", sun: "OFF", mon: "OFF", tue: "OFF", wed: "OFF", thu: "OFF", fri: "OFF", sat: "OFF" }]})}
                                            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={20}/> Add Schedule Row
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'team' && (
            <div className="flex-1 overflow-auto p-8 bg-slate-50 flex justify-center">
                <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">Team Database</h2>
                        <div className="flex gap-2">
                             <button onClick={handleImportScheduleToTeam} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-slate-200"><RefreshCw size={16}/> Sync</button>
                             <button onClick={() => setTeam([...team, { id: Date.now().toString(), name: 'New Employee', role: 'Associate', isActive: true }])} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><UserPlus size={16}/> Add Member</button>
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {team.map(member => (
                            <div key={member.id} className="p-4 rounded-xl border-2 border-slate-100 flex justify-between">
                                <div>
                                    <input className="font-bold text-slate-800 bg-transparent focus:ring-1 focus:ring-indigo-500 rounded px-1" value={member.name} onChange={e => setTeam(team.map(t => t.id === member.id ? { ...t, name: e.target.value } : t))}/>
                                    <input className="text-xs text-slate-500 uppercase bg-transparent w-full mt-1 focus:ring-1 focus:ring-indigo-500 rounded px-1" value={member.role} onChange={e => setTeam(team.map(t => t.id === member.id ? { ...t, role: e.target.value } : t))}/>
                                </div>
                                <button onClick={() => setTeam(team.filter(t => t.id !== member.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      <TaskDBModal isOpen={showDBModal} onClose={() => setShowDBModal(false)} tasks={taskDB} setTasks={setTaskDB} staffNames={schedule.shifts.map(s => s.name)}/>
      
      {showPrintModal && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Print Customization</h3>
                      <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  <div className="space-y-6 mb-8">
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Type size={14}/> Text Content</label>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Main Title</label>
                                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={printSettings.pageTitle} onChange={(e) => setPrintSettings(s => ({...s, pageTitle: e.target.value}))}/>
                              </div>
                              <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Announcement Header</label>
                                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={printSettings.announcementTitle} onChange={(e) => setPrintSettings(s => ({...s, announcementTitle: e.target.value}))}/>
                              </div>
                          </div>
                      </div>
                      <div className="h-px bg-slate-100"></div>
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><LayoutGrid size={14}/> Style Preferences</label>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">View Mode</label>
                                  <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                                      <button onClick={() => setPrintSettings(s => ({...s, layout: 'grid'}))} className={`flex-1 py-1.5 rounded flex justify-center ${printSettings.layout === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><LayoutGrid size={16}/></button>
                                      <button onClick={() => setPrintSettings(s => ({...s, layout: 'list'}))} className={`flex-1 py-1.5 rounded flex justify-center ${printSettings.layout === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><List size={16}/></button>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Font Selection</label>
                                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" value={printSettings.fontStyle} onChange={(e) => setPrintSettings(s => ({...s, fontStyle: e.target.value as any}))}>
                                      <option value="sans">Modern Sans</option>
                                      <option value="serif">Classic Serif</option>
                                      <option value="mono">Technical Mono</option>
                                  </select>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Text Size</label>
                                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" value={printSettings.fontSize} onChange={(e) => setPrintSettings(s => ({...s, fontSize: e.target.value as any}))}>
                                      <option value="small">Compact</option>
                                      <option value="normal">Standard</option>
                                      <option value="large">High Visibility</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Bullets/Formatting</label>
                                  <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                                      <button onClick={() => setPrintSettings(s => ({...s, announcementFormat: 'text'}))} className={`flex-1 py-1.5 rounded flex justify-center ${printSettings.announcementFormat === 'text' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><AlignLeft size={16}/></button>
                                      <button onClick={() => setPrintSettings(s => ({...s, announcementFormat: 'list'}))} className={`flex-1 py-1.5 rounded flex justify-center ${printSettings.announcementFormat === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><ListOrdered size={16}/></button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <button onClick={executePrint} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all transform active:scale-95"><Printer size={18}/> Generate Print View</button>
              </div>
          </div>
      )}

      {/* Move/Assign Task Modal */}
      {moveTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">{moveTaskModal.empName ? 'Move Task' : 'Assign Task'}</h3>
                    <button onClick={() => setMoveTaskModal(null)}><X size={20}/></button>
                </div>
                <div className="mb-4">
                    <div className="text-xs font-bold text-slate-500 uppercase">Task</div>
                    <div className="font-medium text-slate-800">{moveTaskModal.task.name}</div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {getDailyStaff().filter(s => s.name !== moveTaskModal.empName).map(s => (
                        <button key={s.id} onClick={() => handleMoveTask(s.name)} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors flex items-center gap-2">
                            <div className="bg-slate-200 p-1 rounded"><User size={14}/></div>
                            <span className="font-bold text-sm">{s.name}</span>
                        </button>
                    ))}
                    {getDailyStaff().length === 0 && <p className="text-center text-slate-400 text-sm py-4">No staff scheduled today</p>}
                </div>
            </div>
        </div>
      )}

      {/* Auto Assign Confirmation */}
      {showAutoAssignConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold mb-2">Run Auto-Assign?</h3>
                <p className="text-slate-600 text-sm mb-6">This will intelligently redistribute tasks for this day based on employee roles and availability.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowAutoAssignConfirm(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg">Cancel</button>
                    <button onClick={runAutoDistribute} className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg">Distribute</button>
                </div>
            </div>
        </div>
      )}

      {/* Loading Overlays */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center backdrop-blur-sm text-white">
            <Loader2 size={64} className="animate-spin mb-4"/>
            <div className="font-bold text-2xl tracking-tight">{scanStatus}</div>
        </div>
      )}
    </div>

    <div id="print-root">
        <PrintableRoster 
            staff={getDailyStaff()} 
            assignments={assignments}
            settings={printSettings}
            pinnedMessage={pinnedMessage}
        />
    </div>
    </>
  );
}
