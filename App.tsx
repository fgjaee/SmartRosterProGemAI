
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Calendar, CheckCircle, Wand2, Printer, 
  Download, Upload, Plus, Trash2, ArrowRight, X, 
  Menu, RotateCcw, Save, AlertCircle, ScanLine, Loader2, Clock, Settings, UserPlus, Briefcase,
  Camera, Zap, Sparkles, MessageSquare, RefreshCw
} from 'lucide-react';

import { 
  ScheduleData, TaskRule, TaskAssignmentMap, 
  DayKey, Shift, AssignedTask, DAY_LABELS, Employee 
} from './types';
import { PRIORITY_PINNED_IDS } from './constants';
import { StorageService } from './services/storageService';
import { AIService } from './services/aiService'; // Updated import
import TaskDBModal from './components/TaskDBModal';

// --- Utility Functions ---

const cleanTaskName = (n: string) => n.replace(/\(Sat Only\)/gi, '').replace(/\(Fri Only\)/gi, '').replace(/\(Excl.*?\)/gi, '').trim();

const getPrevDay = (d: DayKey): DayKey => {
    const days: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const idx = days.indexOf(d);
    return days[idx === 0 ? 6 : idx - 1];
};

// Robust Time Parsing
const parseTime = (timeStr: string, role: string, isSpillover = false) => {
    if (!timeStr) return { h: 24, label: 'OFF', category: 'OFF' };
    
    // Normalize: remove special chars, extra spaces, upper case
    const cleanStr = timeStr.replace(/[^a-zA-Z0-9:]/g, '').toUpperCase();
    
    // Explicit OFF checks
    if (['OFF', 'O', '0', 'LOAN', 'LOANED', 'LOANEDOUT', 'X', 'VAC', 'SICK', '-'].includes(cleanStr)) {
        return { h: 24, label: 'OFF', category: 'OFF' };
    }

    // Try to find ANY number. If no number, assume OFF (or malformed).
    // Regex finds the FIRST number sequence, optionally followed by minutes and AM/PM
    const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?/i);

    if (!match) {
        return { h: 24, label: timeStr, category: 'OFF' };
    }

    let h = parseInt(match[1]);
    const m = match[2] || '00';
    const suffix = match[3] ? match[3].toUpperCase() : null;

    // Logic to convert 12h -> 24h
    if (suffix) {
        if ((suffix.startsWith('P')) && h !== 12) h += 12;
        if ((suffix.startsWith('A')) && h === 12) h = 0;
    } else {
        // Inference without suffix
        if (h >= 1 && h <= 6) {
             // 1-4 is usually PM for normal staff, AM for overnight/openers
             if (role?.toLowerCase().includes('overnight') && h <= 4) {
                 // AM
             } else {
                 h += 12; // PM
             }
        } else if (h === 12) {
             // 12 is usually PM
        }
    }

    // Categorize
    let category = 'Mid';
    if (h >= 20 || h <= 3) category = 'Overnight'; // 8pm - 3am starts
    else if (h >= 4 && h <= 6) category = 'Open';  // 4am - 6am starts
    else if (h >= 7 && h <= 15) category = 'Mid';  // 7am - 3pm starts
    else category = 'Close';                       // 4pm - 7pm starts

    if (isSpillover) category = 'Overnight';

    // Formatting label
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayAmPm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const displayLabel = `${displayH}:${m}${displayAmPm}`;

    return { h, label: isSpillover ? `${displayLabel} (Prev)` : displayLabel, category };
};

const formatShiftString = (timeStr: string) => {
    if (!timeStr || ['OFF', 'LOANED OUT', 'O', 'X'].includes(timeStr.toUpperCase())) return timeStr;
    // Return as is for editing view, let parseTime handle logic
    return timeStr; 
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
    if(s1.includes(s2) || s2.includes(s1)) return true;
    return false;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks' | 'team'>('tasks');
  const [selectedDay, setSelectedDay] = useState<DayKey>('fri');
  
  // Data States
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [taskDB, setTaskDB] = useState<TaskRule[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignmentMap>({});
  const [team, setTeam] = useState<Employee[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDBModal, setShowDBModal] = useState(false);
  const [showAutoAssignConfirm, setShowAutoAssignConfirm] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [manualTaskInput, setManualTaskInput] = useState<{emp: string, text: string} | null>(null);
  
  // AI States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [huddleText, setHuddleText] = useState<string | null>(null);
  const [aiTasks, setAiTasks] = useState<TaskRule[] | null>(null);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const workAreaInputRef = useRef<HTMLInputElement>(null);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [s, t, a, tm] = await Promise.all([
                StorageService.getSchedule(),
                StorageService.getTaskDB(),
                StorageService.getAssignments(),
                StorageService.getTeam()
            ]);
            setSchedule(s);
            setTaskDB(t);
            setAssignments(a);
            setTeam(tm);
        } catch (e) {
            console.error("Failed to load data", e);
            alert("Error loading data. Please check console.");
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);

  // Autosave Effects (Debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveData = (key: string, fn: () => Promise<void>) => {
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
          try {
            await fn();
          } catch(e) { console.error("Save failed", e); }
          finally { setIsSaving(false); }
      }, 1000);
  };

  useEffect(() => { if (schedule) saveData('sched', () => StorageService.saveSchedule(schedule)); }, [schedule]);
  useEffect(() => { if (taskDB.length) saveData('taskdb', () => StorageService.saveTaskDB(taskDB)); }, [taskDB]);
  useEffect(() => { if (Object.keys(assignments).length) saveData('assign', () => StorageService.saveAssignments(assignments)); }, [assignments]);
  useEffect(() => { if (team.length) saveData('team', () => StorageService.saveTeam(team)); }, [team]);

  const getDailyStaff = useCallback(() => {
    if (!schedule) return [];
    const shifts = schedule.shifts || [];
    // Current Day
    const todayStaff = shifts.map(s => {
        const t = s[selectedDay];
        if (!t) return null;
        const { category } = parseTime(t, s.role);
        if (category === 'OFF') return null;
        return { ...s, activeTime: t, isSpillover: false };
    }).filter(s => s !== null);

    // Spillover (Overnight from prev day)
    const prevDay = getPrevDay(selectedDay);
    const spilloverStaff = shifts.map(s => {
        const t = s[prevDay];
        if (!t) return null;
        const { category } = parseTime(t, s.role, true);
        if (category === 'Overnight') {
            return { ...s, activeTime: t, isSpillover: true };
        }
        return null;
    }).filter(s => s !== null);

    // Merge & Dedupe
    const uniqueMap = new Map();
    [...spilloverStaff, ...todayStaff].forEach(item => {
        if (item && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values()) as (Shift & { activeTime: string, isSpillover: boolean })[];
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
        console.table(staff.map(s => ({ name: s.name, role: s.role, time: s.activeTime })));

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
        console.log("Current System Date:", currentSystemDate);
        console.log("Total Rules in DB:", taskDB.length);
        
        // --- 1. Filter Rules ---
        const validRules = taskDB.filter(t => {
            // Frequency Logic
            if (t.frequency === 'weekly') {
                const targetDay = t.frequencyDay || 'fri';
                if (targetDay !== selectedDay) {
                    console.log(`Skipping Weekly task '${t.name}': Configured for ${targetDay}, today is ${selectedDay}`);
                    return false;
                }
            } else if (t.frequency === 'monthly') {
                if (!t.frequencyDate) return false;
                if (t.frequencyDate !== currentSystemDate) {
                    console.log(`Skipping Monthly task '${t.name}': Configured for date ${t.frequencyDate}, today is ${currentSystemDate}`);
                    return false;
                }
            }
            return true;
        });
        console.log("Rules active for today:", validRules.length);

        // --- 2. Skilled Tasks (Rules Based) ---
        console.log("--- Distributing Skilled Tasks ---");
        validRules.filter(t => t.type === 'skilled' && !PRIORITY_PINNED_IDS.includes(t.id)).forEach(t => {
            const matches = staff.filter(s => t.fallbackChain.some(fc => namesMatch(s.name, fc)));
            if (matches.length > 0) {
                matches.sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));
                assign(matches[0].name, t);
            } else {
                const anyStaff = [...staff].sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));
                if(anyStaff.length > 0) assign(anyStaff[0].name, t);
            }
        });

        // --- 3. Shift Based Tasks ---
        console.log("--- Distributing Shift Tasks ---");
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

        // --- 4. General Tasks (Enhanced Round Robin) ---
        console.log("--- Distributing General Tasks (Round Robin) ---");
        const generalTasks = validRules.filter(t => t.type === 'general' && !PRIORITY_PINNED_IDS.includes(t.id));
        console.log("General Tasks count:", generalTasks.length);
        
        // 4a. Separate Preferred vs Any
        const preferredTasks: TaskRule[] = [];
        const poolTasks: TaskRule[] = [];

        generalTasks.forEach(t => {
            if (t.fallbackChain.length > 0) preferredTasks.push(t);
            else poolTasks.push(t);
        });
        console.log(`Split: ${preferredTasks.length} Preferred / ${poolTasks.length} Pool`);

        // 4b. Assign Preferred
        preferredTasks.forEach(t => {
             const match = staff.find(s => t.fallbackChain.some(fc => namesMatch(s.name, fc)));
             if (match) {
                 assign(match.name, t);
             } else {
                 console.log(`Preferred task '${t.name}' had no match active, moving to pool.`);
                 poolTasks.push(t); // No preference match found, add to general pool
             }
        });

        // 4c. Round Robin for Pool
        // Sort staff by current load (including preferred tasks just assigned) to start fairly
        let rrStaff = [...staff].sort((a,b) => getWorkerLoad(a.name, newAssignments) - getWorkerLoad(b.name, newAssignments));
        console.log("Round Robin Staff Order (by Load):", rrStaff.map(s => `${s.name} (${getWorkerLoad(s.name, newAssignments)})`));
        
        if (rrStaff.length > 0) {
            poolTasks.forEach((t, i) => {
                // Determine worker index. 
                // We use (i % length) to deal cards one by one to the sorted list.
                const worker = rrStaff[i % rrStaff.length];
                assign(worker.name, t);
            });
        }

        // --- 5. Fill Gaps ---
        staff.forEach(s => {
            const load = getWorkerLoad(s.name, newAssignments);
            if (load === 0) {
                console.log(`Fill Gap: Assigning generic support to ${s.name}`);
                assign(s.name, { 
                    id: 9000 + Math.floor(Math.random()*1000), code: 'GEN', name: 'General Department Support', type: 'general', fallbackChain: [], effort: 60 
                });
            }
        });

        setAssignments(newAssignments);
        console.log("Final Assignments State:", newAssignments);
        console.groupEnd();
        
        // User Feedback
        if(assignedCount > 0) {
            alert(`Success: Distributed ${assignedCount} tasks across ${staff.length} staff members.`);
        } else {
            alert(`Process completed but 0 tasks were assigned. Check your Rules Database frequency settings for ${DAY_LABELS[selectedDay]}.`);
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
      // Add tasks to the manual distribution pool or first available person
      // For simplicity, we add them as unassigned or assign to Lead
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

  // ---

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
                    {Object.entries(DAY_LABELS).map(([k, l]) => (
                        <button key={k} onClick={()=>setSelectedDay(k as DayKey)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedDay===k ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {k.toUpperCase()}
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
                     <button onClick={window.print} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
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
                            const tasks = (assignments[`${selectedDay}-${staff.name}`] || []).sort((a,b) => {
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
                                                            <div className="text-sm font-medium text-slate-700 leading-snug">{cleanTaskName(t.name)}</div>
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
                                {(schedule.shifts || []).map((shift, idx) => (
                                    <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {isEditingSchedule ? (
                                                <div className="space-y-1">
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-bold" value={shift.name} onChange={e => {
                                                        const newShifts = [...(schedule.shifts || [])];
                                                        newShifts[idx].name = e.target.value;
                                                        setSchedule({...schedule, shifts: newShifts});
                                                    }} />
                                                    <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-500" placeholder="Role" value={shift.role} onChange={e => {
                                                        const newShifts = [...(schedule.shifts || [])];
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
                                                            const newShifts = [...(schedule.shifts || [])];
                                                            // @ts-ignore
                                                            newShifts[idx][day] = e.target.value;
                                                            setSchedule({...schedule, shifts: newShifts});
                                                        }}
                                                    />
                                                ) : (
                                                    <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${shift[day as DayKey] === 'OFF' ? 'text-slate-300 bg-slate-50' : 'text-slate-700 bg-white border border-slate-200'}`}>
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
