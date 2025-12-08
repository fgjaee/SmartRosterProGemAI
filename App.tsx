import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Calendar, CheckCircle, Wand2, Printer, 
  Download, Upload, Plus, Trash2, ArrowRight, X, 
  Menu, RotateCcw, Save, AlertCircle, ScanLine, Loader2, Clock
} from 'lucide-react';

import { 
  ScheduleData, TaskRule, TaskAssignmentMap, 
  DayKey, Shift, AssignedTask, DAY_LABELS 
} from './types';
import { PRIORITY_PINNED_IDS } from './constants';
import { StorageService } from './services/storageService';
import { OCRService } from './services/ocrService';
import TaskDBModal from './components/TaskDBModal';

// --- Utility Functions ---

const cleanTaskName = (n: string) => n.replace(/\(Sat Only\)/gi, '').replace(/\(Fri Only\)/gi, '').replace(/\(Excl.*?\)/gi, '').trim();

const getPrevDay = (d: DayKey): DayKey => {
    const days: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const idx = days.indexOf(d);
    return days[idx === 0 ? 6 : idx - 1];
};

const parseTime = (timeStr: string, role: string, isSpillover = false) => {
    if (!timeStr || timeStr === 'OFF' || timeStr === 'LOANED OUT') return { h: 24, label: 'OFF', category: 'OFF' };
    
    // Normalize string
    const lower = timeStr.toLowerCase();
    const parts = lower.replace(/\s/g, '').split('-');
    if (parts.length < 2) return { h: 24, label: timeStr, category: 'OFF' };

    let startStr = parts[0];
    let label = parts[0];
    let category = 'Mid';

    // Helper to extract hour safely
    const getHour = (s: string) => {
        const t = parseInt(s.split(':')[0]);
        if (s.includes('p') && t !== 12) return t + 12;
        if (s.includes('a') && t === 12) return 0; // 12am
        return t;
    };

    let start = getHour(startStr);

    // Heuristics for 12h format without suffix (e.g. "10:00-6:00")
    if (!startStr.includes('m')) {
        if (start >= 1 && start <= 6) {
             // 1-6. Usually PM unless role says Overnight (then AM)
             if (role?.toLowerCase().includes('overnight') && start <= 4) {
                 category = 'Overnight';
                 label += ' AM';
             } else if (start === 4 || start === 5 || start === 6) {
                 if (role?.toLowerCase().includes('lead') || role?.toLowerCase().includes('open')) {
                    category = 'Open';
                    label += ' AM';
                 } else {
                    category = 'Mid'; // PM
                    start += 12;
                    label += ' PM';
                 }
             } else {
                 start += 12;
                 category = 'Mid';
                 label += ' PM';
             }
        } 
        else if (start >= 7 && start <= 11) {
            // 7-11. Usually AM.
            // But if role is Overnight or Stock with 10/11 start, likely PM.
            if (role?.toLowerCase().includes('overnight')) {
                start += 12; 
                category = 'Overnight';
                label += ' PM';
            } else if ((start === 10 || start === 11) && role?.toLowerCase().includes('stock')) {
                 // Heuristic: Stock team starting at 10 or 11 is likely Night Crew
                 start += 12;
                 category = 'Overnight';
                 label += ' PM';
            } else {
                category = 'Mid';
                label += ' AM';
            }
        }
        else if (start === 12) {
             start = 12;
             label += ' PM';
             category = 'Mid';
        }
    } else {
        // Has suffix
        if (startStr.includes('p') || (startStr.includes('12') && !startStr.includes('a'))) {
             if(start < 12) start += 12;
        }
        if (startStr.includes('a') && start === 12) start = 0;
    }

    // Explicit Overrides based on computed 24h 'start'
    if (start >= 20 || start <= 3) category = 'Overnight'; // 8pm - 3am starts
    if (start >= 4 && start <= 6) category = 'Open';       // 4am - 6am starts

    if (isSpillover) {
        category = 'Overnight';
        label += ' (Prev)';
    }

    return { h: start, label, category };
};

const formatShiftString = (timeStr: string, role: string) => {
    if (!timeStr || timeStr === 'OFF' || timeStr === 'LOANED OUT') return timeStr;
    // If already has suffix, assume manual entry is correct
    if (timeStr.toLowerCase().match(/[a-z]/)) return timeStr;

    const parts = timeStr.split('-');
    if (parts.length < 2) return timeStr;

    const startRaw = parts[0].trim();
    const endRaw = parts[1].trim();

    // 1. Determine Start 24h
    const { h: start24 } = parseTime(timeStr, role);
    
    // 2. Determine End 24h
    const endParts = endRaw.split(':');
    let end12 = parseInt(endParts[0]);
    if (end12 === 0) end12 = 12; // safety
    
    const endMin = endParts[1] || '00';

    // Try candidates: End as AM, End as PM, End next day...
    // Candidates are 24h representations of the 12h digit
    // e.g. 1 -> 1, 13, 25, 37
    const targets = [
        end12 === 12 ? 0 : end12,        // AM same day (e.g. 12am is 0)
        end12 === 12 ? 12 : end12 + 12,  // PM same day
        (end12 === 12 ? 0 : end12) + 24,       // AM next day
        (end12 === 12 ? 12 : end12 + 12) + 24  // PM next day
    ];

    // Find target that gives duration approx 3-14 hours
    let selectedEnd = -1;
    for (const t of targets) {
        const diff = t - start24;
        if (diff >= 3 && diff <= 16) { // slightly wider range
            selectedEnd = t;
            break;
        }
    }
    
    // Fallback: Use smallest positive diff
    if (selectedEnd === -1) {
         let bestDist = Infinity;
         for (const t of targets) {
             const d = t - start24;
             if (d > 0 && d < bestDist) {
                 bestDist = d;
                 selectedEnd = t;
             }
         }
    }
    
    if (selectedEnd === -1) selectedEnd = start24 + 8; // final fallback

    // 3. Format Output
    const formatTime = (h24: number, min: string) => {
        // Normalize
        let h = h24 % 24;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${min}${ampm}`;
    };

    const startMin = startRaw.split(':')[1] || '00';
    return `${formatTime(start24, startMin)} - ${formatTime(selectedEnd, endMin)}`;
};

const getBadgeColor = (code: string) => {
    if (code.includes('ON')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (code.startsWith('T')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (code.startsWith('W')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (code === 'PS') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (code === 'EOD') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (code === 'ORD') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (code === 'MAN') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

// --- Name Matching Utility ---
const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z\s]/g, '');

const namesMatch = (n1: string, n2: string) => {
    if (!n1 || !n2) return false;
    const norm1 = normalizeName(n1);
    const norm2 = normalizeName(n2);
    if (norm1 === norm2) return true;

    const parts1 = norm1.split(/\s+/).filter(x => x.length > 0);
    const parts2 = norm2.split(/\s+/).filter(x => x.length > 0);

    if (parts1.length >= 2 && parts2.length >= 2) {
        const p1InP2 = parts1.every(p => parts2.includes(p));
        const p2InP1 = parts2.every(p => parts1.includes(p));
        if (p1InP2 || p2InP1) return true;
    }

    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

    return false;
};

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks'>('tasks');
  const [selectedDay, setSelectedDay] = useState<DayKey>('fri');
  const [schedule, setSchedule] = useState<ScheduleData>(StorageService.getSchedule());
  const [taskDB, setTaskDB] = useState<TaskRule[]>(StorageService.getTaskDB());
  const [assignments, setAssignments] = useState<TaskAssignmentMap>(StorageService.getAssignments());
  
  const [showDBModal, setShowDBModal] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [manualTaskInput, setManualTaskInput] = useState<{emp: string, text: string} | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => StorageService.saveSchedule(schedule), [schedule]);
  useEffect(() => StorageService.saveTaskDB(taskDB), [taskDB]);
  useEffect(() => StorageService.saveAssignments(assignments), [assignments]);

  // --- Helpers ---
  const getDailyStaff = useCallback(() => {
    const todayStaff = schedule.shifts.map(s => {
        const t = s[selectedDay];
        if (!t || t === 'OFF' || t === 'LOANED OUT') return null;
        return { ...s, activeTime: t, isSpillover: false };
    }).filter(s => s !== null);

    // Check previous day for overnight shifts (starts >= 8pm or categorized as Overnight)
    const prevDay = getPrevDay(selectedDay);
    const spilloverStaff = schedule.shifts.map(s => {
        const t = s[prevDay];
        if (!t || t === 'OFF' || t === 'LOANED OUT') return null;
        
        // Parse the PREVIOUS day's time to see if it's overnight
        const { category } = parseTime(t, s.role);
        if (category === 'Overnight') {
            return { ...s, activeTime: t, isSpillover: true };
        }
        return null;
    }).filter(s => s !== null);

    return [...spilloverStaff, ...todayStaff] as (Shift & { activeTime: string, isSpillover: boolean })[];
  }, [schedule, selectedDay]);

  const getStaffTasks = (empName: string) => {
    const key = `${selectedDay}-${empName}`;
    return assignments[key] || [];
  };

  const getWorkerLoad = (empName: string, currentAssignments: TaskAssignmentMap) => {
    const key = `${selectedDay}-${empName}`;
    const tasks = currentAssignments[key] || [];
    return tasks.reduce((acc, t) => acc + (t.effort || 30), 0);
  };

  const sortTasks = (tasks: AssignedTask[]) => {
      const getPriority = (t: AssignedTask) => {
          if (t.code.startsWith('T') || t.code.startsWith('W') || t.code === '9AM') return 1;
          if (t.code === 'ORD') return 2;
          if (t.code === 'ON') return 3;
          if (t.code === 'PS') return 4;
          if (t.code === 'MAN') return 99;
          return 50;
      };
      return [...tasks].sort((a, b) => getPriority(a) - getPriority(b));
  };

  // --- Core Algorithm: Auto Distribute ---
  const autoDistribute = () => {
    const staff = getDailyStaff();
    if (staff.length === 0) { alert("No staff found working on " + DAY_LABELS[selectedDay]); return; }

    if(!window.confirm(`Auto-Assign will overwrite assignments for ${DAY_LABELS[selectedDay]}. Continue?`)) return;

    const newAssignments: TaskAssignmentMap = { ...assignments };
    // Clear current day
    staff.forEach(s => delete newAssignments[`${selectedDay}-${s.name}`]);
    const pinned: AssignedTask[] = [];

    // Helper to assign
    const assign = (empName: string, rule: TaskRule) => {
        const key = `${selectedDay}-${empName}`;
        if (!newAssignments[key]) newAssignments[key] = [];
        if (newAssignments[key].some(t => t.id === rule.id)) return;
        newAssignments[key].push({ ...rule, instanceId: Date.now() + Math.random().toString() });
    };

    // Filter DB for today
    const dayLabel = DAY_LABELS[selectedDay].slice(0, 3); // Mon, Tue...
    const validRules = taskDB.filter(t => {
        if (t.name.includes("Only") && !t.name.includes(dayLabel)) return false;
        if (t.name.includes(`Excl. ${dayLabel}`)) return false;
        return true;
    });

    // 1. Pinned Tasks (Shared List)
    validRules.filter(t => PRIORITY_PINNED_IDS.includes(t.id)).forEach(t => pinned.push({ ...t, instanceId: 'pinned' }));

    // 2. Skilled Logic
    validRules.filter(t => t.type === 'skilled' && !PRIORITY_PINNED_IDS.includes(t.id)).forEach(t => {
        const candidates = staff.filter(s => 
            t.fallbackChain.some(fcName => namesMatch(s.name, fcName))
        );

        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                // If task is Truck Unload (ON) or Breakdown (EOD), prioritize Spillover staff
                if (['ON', 'EOD'].includes(t.code)) {
                    if (a.isSpillover && !b.isSpillover) return -1;
                    if (!a.isSpillover && b.isSpillover) return 1;
                }

                const loadA = getWorkerLoad(a.name, newAssignments);
                const loadB = getWorkerLoad(b.name, newAssignments);
                const skillIndexA = t.fallbackChain.findIndex(fc => namesMatch(a.name, fc));
                const skillIndexB = t.fallbackChain.findIndex(fc => namesMatch(b.name, fc));

                // Granular Balance: If loads are roughly equal (within 30 mins), prioritize skill rank (lower index is better)
                if (Math.abs(loadA - loadB) <= 30) {
                    return skillIndexA - skillIndexB;
                }

                // Otherwise, prioritize the person with less work
                return loadA - loadB;
            });
            assign(candidates[0].name, t);
        } else {
            // Fallback for skilled tasks with no skilled staff working
            const backups = staff.filter(s => 
                s.role?.toLowerCase().includes('overnight') || 
                s.role?.toLowerCase().includes('stock') ||
                s.role?.toLowerCase().includes('lead')
            );
            const targetGroup = backups.length ? backups : staff;
            targetGroup.sort((a, b) => {
                 const loadA = getWorkerLoad(a.name, newAssignments);
                 const loadB = getWorkerLoad(b.name, newAssignments);
                 return loadA - loadB;
            });
            assign(targetGroup[0].name, t);
        }
    });

    // 3. Shift Based & General
    const shifts = { 'Open': [] as Shift[], 'Mid': [] as Shift[], 'Close': [] as Shift[], 'Overnight': [] as Shift[] };
    staff.forEach(s => {
        const { category } = parseTime(s.activeTime, s.role, s.isSpillover);
        if(category !== 'OFF') shifts[category as keyof typeof shifts].push(s);
    });

    // Assign Shift-based tasks ensuring workload balance
    validRules.filter(t => t.type === 'shift_based').forEach(t => {
        ['Open', 'Mid', 'Close', 'Overnight'].forEach(cat => {
            const group = shifts[cat as keyof typeof shifts];
            if(group.length > 0) {
                 const avail = [...group].sort((a,b) => {
                    const loadA = getWorkerLoad(a.name, newAssignments);
                    const loadB = getWorkerLoad(b.name, newAssignments);
                    return loadA - loadB;
                 });
                 if(avail.length) assign(avail[0].name, { ...t, name: `${t.name} (${cat})` });
            }
        });
    });

    // Assign General tasks (Round robin based on effort load)
    validRules.filter(t => t.type === 'general' && !PRIORITY_PINNED_IDS.includes(t.id)).forEach(t => {
         const sortedStaff = [...staff].sort((a, b) => {
            const loadA = getWorkerLoad(a.name, newAssignments);
            const loadB = getWorkerLoad(b.name, newAssignments);
            return loadA - loadB;
         });
         assign(sortedStaff[0].name, t);
    });

    setAssignments(newAssignments);
  };

  // --- Handlers ---
  const handleAddManualTask = () => {
      if(!manualTaskInput || !manualTaskInput.text) return;
      const key = `${selectedDay}-${manualTaskInput.emp}`;
      const newTask: AssignedTask = {
          id: 9999, code: 'MAN', name: manualTaskInput.text, type: 'manual', fallbackChain: [], instanceId: Date.now().toString(), effort: 30
      };
      setAssignments(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), newTask]
      }));
      setManualTaskInput(null);
  };

  const handleDeleteTask = (empName: string, instanceId: string) => {
      const key = `${selectedDay}-${empName}`;
      setAssignments(prev => ({
          ...prev,
          [key]: prev[key].filter(t => t.instanceId !== instanceId)
      }));
  };

  const handleClearDay = () => {
      if(!confirm("Clear all tasks for this day?")) return;
      const newAsg = {...assignments};
      getDailyStaff().forEach(s => delete newAsg[`${selectedDay}-${s.name}`]);
      setAssignments(newAsg);
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
      try {
          const scannedData = await OCRService.parseSchedule(file);
          if (scannedData.shifts.length === 0) {
              alert("No shifts found in the image. Please try a clearer image.");
          } else {
              setSchedule(scannedData);
              alert("Schedule scanned successfully! Please verify the data.");
          }
      } catch (error) {
          console.error(error);
          alert("Failed to scan schedule. Ensure the image is clear and try again.");
      } finally {
          setIsScanning(false);
          if (scanInputRef.current) scanInputRef.current.value = '';
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md z-20 no-print">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-500 p-1.5 rounded-lg">
             <CheckCircle className="w-6 h-6 text-white" />
           </div>
           <div>
               <h1 className="font-bold text-lg leading-tight">SmartRoster Pro</h1>
               <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Manager Dashboard</div>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-800 rounded-lg p-1">
             <button onClick={()=>setActiveTab('tasks')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab==='tasks'?'bg-slate-700 text-white shadow':'text-slate-400 hover:text-white'}`}>Worklists</button>
             <button onClick={()=>setActiveTab('schedule')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab==='schedule'?'bg-slate-700 text-white shadow':'text-slate-400 hover:text-white'}`}>Schedule</button>
           </div>
           <div className="h-6 w-px bg-slate-700 mx-2"></div>
           <button onClick={StorageService.exportData} title="Backup Data" className="text-slate-400 hover:text-white"><Download size={20}/></button>
           <label className="text-slate-400 hover:text-white cursor-pointer" title="Import Data">
              <Upload size={20}/>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".json"/>
           </label>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'tasks' && (
            <>
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 no-print shadow-sm">
                <div className="flex gap-2">
                    {Object.entries(DAY_LABELS).map(([k, l]) => (
                        <button key={k} onClick={()=>setSelectedDay(k as DayKey)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedDay===k ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {k.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex gap-3">
                     <button onClick={() => setShowDBModal(true)} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        <Menu size={18}/> Rules
                     </button>
                     <button onClick={handleClearDay} className="flex items-center gap-2 px-4 py-2 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg transition-colors">
                        <RotateCcw size={18}/> Clear
                     </button>
                     <button onClick={window.print} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
                        <Printer size={18}/> Print
                     </button>
                     <button onClick={autoDistribute} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95">
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
                            const staffTasks = sortTasks(getStaffTasks(staff.name));
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
                                                {staffTasks.length}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Clock size={10}/> ~{estimatedHours}h
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-2 min-h-[150px]">
                                        {staffTasks.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-8 print:hidden">
                                                <AlertCircle size={32} className="mb-2 opacity-50"/>
                                                <span className="text-xs font-medium">No tasks assigned</span>
                                            </div>
                                        ) : (
                                            <ul className="space-y-1">
                                                {staffTasks.map((t, idx) => (
                                                    <li key={t.instanceId} className="group flex items-start p-2 rounded hover:bg-slate-50 border border-transparent hover:border-indigo-100 transition-colors">
                                                        <div className="print:hidden mr-2 mt-0.5">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(t.code)}`}>{t.code}</span>
                                                        </div>
                                                        <div className="hidden print:block mr-2 mt-1">
                                                            <div className="w-3 h-3 border border-slate-600"></div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-slate-700 leading-snug">{cleanTaskName(t.name)}</div>
                                                            {t.effort && <div className="text-[10px] text-slate-400 font-medium print:hidden">{t.effort} mins</div>}
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
                            <p className="text-slate-500 text-sm">Week Period: <input className="border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500" value={schedule.week_period} onChange={(e) => setSchedule({...schedule, week_period: e.target.value})} /></p>
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
                                    {Object.values(DAY_LABELS).map(d => <th key={d} className="p-4 border-b border-slate-200 text-center">{d.slice(0,3)}</th>)}
                                    {isEditingSchedule && <th className="p-4 border-b border-slate-200 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {schedule.shifts.map((shift, idx) => (
                                    <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {isEditingSchedule ? (
                                                <div className="space-y-1">
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-bold" value={shift.name} onChange={e => {
                                                        const newShifts = [...schedule.shifts];
                                                        newShifts[idx].name = e.target.value;
                                                        setSchedule({...schedule, shifts: newShifts});
                                                    }} />
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-500" placeholder="Role" value={shift.role} onChange={e => {
                                                        const newShifts = [...schedule.shifts];
                                                        newShifts[idx].role = e.target.value;
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
                                        {Object.keys(DAY_LABELS).map((day) => (
                                            <td key={day} className="p-4 text-center">
                                                {isEditingSchedule ? (
                                                    <input 
                                                        className="w-24 text-center text-sm border border-slate-200 rounded py-1 focus:ring-2 ring-indigo-500 outline-none" 
                                                        value={shift[day as DayKey]}
                                                        onChange={e => {
                                                            const newShifts = [...schedule.shifts];
                                                            // @ts-ignore
                                                            newShifts[idx][day] = e.target.value;
                                                            setSchedule({...schedule, shifts: newShifts});
                                                        }}
                                                    />
                                                ) : (
                                                    <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${shift[day as DayKey] === 'OFF' ? 'text-slate-300 bg-slate-50' : 'text-slate-700 bg-white border border-slate-200'}`}>
                                                        {formatShiftString(shift[day as DayKey], shift.role)}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        {isEditingSchedule && (
                                            <td className="p-4">
                                                <button onClick={() => {
                                                     const newShifts = schedule.shifts.filter((_, i) => i !== idx);
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
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button 
                                onClick={() => setSchedule({...schedule, shifts: [...schedule.shifts, { id: Date.now().toString(), name: "New Staff", role: "Stock", sun: "OFF", mon: "OFF", tue: "OFF", wed: "OFF", thu: "OFF", fri: "OFF", sat: "OFF" }]})}
                                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18}/> Add Staff Row
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

      </main>

      <TaskDBModal 
        isOpen={showDBModal} 
        onClose={() => setShowDBModal(false)} 
        tasks={taskDB} 
        setTasks={setTaskDB}
        staffNames={schedule.shifts.map(s => s.name)}
      />
      
      {isScanning && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
            <Loader2 size={64} className="text-white animate-spin mb-6"/>
            <div className="text-white font-bold text-2xl tracking-tight">Analyzing Schedule...</div>
            <div className="text-white/60 text-sm mt-2 font-medium">Extracting names, roles, and shifts using AI</div>
        </div>
      )}
    </div>
  );
}