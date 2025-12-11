import React, { useState, useRef } from 'react';
import { X, Trash2, Plus, ArrowLeft, ArrowRight, Database, Download, Upload, Save, CalendarClock, Ban, Clock } from 'lucide-react';
import { TaskRule, TaskType, DAY_LABELS, DayKey } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskRule[];
  setTasks: React.Dispatch<React.SetStateAction<TaskRule[]>>;
  staffNames: string[];
}

export default function TaskDBModal({ isOpen, onClose, tasks, setTasks, staffNames }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPersonInput, setNewPersonInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Use functional update pattern for safer state manipulation
  const handleUpdate = (id: number, field: keyof TaskRule, value: any) => {
    setTasks((prev) => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const toggleExcludedDay = (id: number, day: DayKey) => {
      // Find task in current props to get current exclusions
      const task = tasks.find(t => t.id === id);
      if(!task) return;
      
      const current = task.excludedDays || [];
      const newExcluded = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
      
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, excludedDays: newExcluded } : t));
  };

  const handleDeleteTask = (e: React.MouseEvent, id: number | string) => {
    e.stopPropagation();
    if(window.confirm("Are you sure you want to permanently delete this rule?")) {
        // Robust delete: Functional update + String conversion for safety
        setTasks((prev) => prev.filter(t => String(t.id) !== String(id)));
    }
  };

  const handleAddFallback = (id: number) => {
      if(!newPersonInput) return;
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, fallbackChain: [...t.fallbackChain, newPersonInput] } : t));
      setNewPersonInput('');
  };

  const handleRemoveFallback = (id: number, nameToRemove: string) => {
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, fallbackChain: t.fallbackChain.filter(n => n !== nameToRemove) } : t));
  };

  const handleMoveFallback = (id: number, idx: number, direction: 'up' | 'down') => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      
      const newChain = [...task.fallbackChain];
      if (direction === 'up') {
          if (idx === 0) return;
          [newChain[idx - 1], newChain[idx]] = [newChain[idx], newChain[idx - 1]];
      } else {
          if (idx === newChain.length - 1) return;
          [newChain[idx], newChain[idx + 1]] = [newChain[idx + 1], newChain[idx]];
      }
      
      setTasks((prev) => prev.map(t => t.id === id ? { ...t, fallbackChain: newChain } : t));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "smartroster_rules.json";
    a.click();
    a.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if(Array.isArray(json)) {
                // @ts-ignore
                setTasks(json);
                alert("Rules imported successfully");
            } else {
                alert("Invalid format");
            }
        } catch(e) { alert("Error parsing JSON"); }
    };
    reader.readAsText(file);
  };

  // Generate Time Options
  const timeOptions = [
      "Store Open",
      "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
      "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", 
      "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
      "Closing"
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <Database size={24} className="text-indigo-400"/>
                <div>
                    <h2 className="text-xl font-bold">Task Rules Database</h2>
                    <p className="text-xs text-slate-400">Manage assignment logic, priorities, and frequency</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                 <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold border border-slate-700 transition-colors">
                    <Download size={14}/> Export Rules
                 </button>
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold border border-slate-700 transition-colors">
                    <Upload size={14}/> Import Rules
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                 
                 <div className="h-6 w-px bg-slate-700 mx-2"></div>
                 <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            <div className="space-y-3">
                {tasks.map(task => (
                    <div key={task.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 w-full items-center">
                            
                            {/* Code */}
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Code</label>
                                <input 
                                    className="w-full text-sm font-bold border border-slate-300 rounded px-2 py-1 uppercase text-center"
                                    value={task.code}
                                    onChange={e => handleUpdate(task.id, 'code', e.target.value)}
                                />
                            </div>

                            {/* Name */}
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Task Name</label>
                                <input 
                                    className="w-full text-sm font-medium border border-slate-300 rounded px-2 py-1"
                                    value={task.name}
                                    onChange={e => handleUpdate(task.id, 'name', e.target.value)}
                                />
                            </div>

                            {/* Type */}
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</label>
                                <select 
                                    className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white"
                                    value={task.type}
                                    onChange={e => handleUpdate(task.id, 'type', e.target.value as TaskType)}
                                >
                                    <option value="skilled">Skilled (Priority)</option>
                                    <option value="general">General (Round Robin)</option>
                                    <option value="shift_based">Shift Based</option>
                                    <option value="all_staff">All Hands / Everyone</option>
                                </select>
                            </div>

                            {/* Frequency */}
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Frequency</label>
                                <div className="space-y-1">
                                    <select 
                                        className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white"
                                        value={task.frequency || 'daily'}
                                        onChange={e => handleUpdate(task.id, 'frequency', e.target.value)}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>

                                    {task.frequency === 'weekly' && (
                                        <select
                                            className="w-full text-xs border border-indigo-200 rounded px-2 py-1 bg-indigo-50 text-indigo-700 font-medium"
                                            value={task.frequencyDay || 'fri'}
                                            onChange={e => handleUpdate(task.id, 'frequencyDay', e.target.value)}
                                        >
                                            <option value="" disabled>Select Day</option>
                                            {Object.entries(DAY_LABELS).map(([k, label]) => (
                                                <option key={k} value={k}>{label}</option>
                                            ))}
                                        </select>
                                    )}

                                    {task.frequency === 'monthly' && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-500 font-bold">Day:</span>
                                            <input 
                                                type="number" 
                                                min="1" max="31"
                                                className="flex-1 text-xs border border-indigo-200 rounded px-2 py-1 bg-indigo-50 text-indigo-700"
                                                placeholder="1-31"
                                                value={task.frequencyDate || ''}
                                                onChange={e => handleUpdate(task.id, 'frequencyDate', parseInt(e.target.value))}
                                            />
                                        </div>
                                    )}

                                    {task.frequency === 'daily' && (
                                         <div className="flex items-center gap-1 relative group cursor-pointer">
                                             <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Ban size={10}/> Skip:</span>
                                             <div className="flex gap-1">
                                                 {Object.keys(DAY_LABELS).map((d) => {
                                                     const isExcluded = (task.excludedDays || []).includes(d as DayKey);
                                                     return (
                                                        <button 
                                                            key={d}
                                                            onClick={() => toggleExcludedDay(task.id, d as DayKey)}
                                                            className={`w-4 h-4 text-[9px] rounded flex items-center justify-center font-bold uppercase transition-colors ${isExcluded ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                                            title={isExcluded ? `Skipped on ${DAY_LABELS[d as DayKey]}` : `Run on ${DAY_LABELS[d as DayKey]}`}
                                                        >
                                                            {d.charAt(0).toUpperCase()}
                                                        </button>
                                                     );
                                                 })}
                                             </div>
                                         </div>
                                    )}
                                </div>
                            </div>

                            {/* Due Time (New) */}
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Due By</label>
                                <div className="relative">
                                    <select 
                                        className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white appearance-none"
                                        value={task.dueTime || ''}
                                        onChange={e => handleUpdate(task.id, 'dueTime', e.target.value)}
                                    >
                                        <option value="">Anytime</option>
                                        {timeOptions.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <Clock size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>

                             {/* Effort */}
                             <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mins</label>
                                <input 
                                    type="number"
                                    className="w-full text-sm border border-slate-300 rounded px-2 py-1"
                                    value={task.effort || 30}
                                    onChange={e => handleUpdate(task.id, 'effort', parseInt(e.target.value))}
                                />
                            </div>

                            {/* Fallback Chain */}
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Priority Team</label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {task.fallbackChain.map((person, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100" title={`Priority Level ${idx + 1}`}>
                                            <button 
                                                onClick={() => handleMoveFallback(task.id, idx, 'up')} 
                                                disabled={idx === 0} 
                                                className="hover:text-indigo-900 disabled:opacity-30"
                                            >
                                                <ArrowLeft size={10}/>
                                            </button>
                                            <span className="font-bold">{idx + 1}.</span> 
                                            <span className="truncate max-w-[50px]">{person.split(',')[0]}</span>
                                            <button 
                                                onClick={() => handleMoveFallback(task.id, idx, 'down')} 
                                                disabled={idx === task.fallbackChain.length - 1} 
                                                className="hover:text-indigo-900 disabled:opacity-30"
                                            >
                                                <ArrowRight size={10}/>
                                            </button>
                                            <div className="w-px h-3 bg-indigo-200 mx-1"></div>
                                            <button onClick={() => handleRemoveFallback(task.id, person)} className="hover:text-red-500"><X size={12}/></button>
                                        </span>
                                    ))}
                                    <div className="flex items-center gap-1 relative group">
                                         <button onClick={() => setEditingId(editingId === task.id ? null : task.id)} className="w-6 h-6 flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-400">
                                            <Plus size={12}/>
                                         </button>
                                         {editingId === task.id && (
                                             <div className="absolute top-8 right-0 z-10 bg-white shadow-xl border border-slate-200 p-2 rounded-lg w-48">
                                                 <input 
                                                    autoFocus
                                                    className="w-full text-xs border border-indigo-300 rounded px-2 py-1 mb-2 outline-none"
                                                    placeholder="Type Name..."
                                                    value={newPersonInput}
                                                    onChange={e => setNewPersonInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if(e.key === 'Enter') handleAddFallback(task.id);
                                                    }}
                                                 />
                                                 <div className="max-h-32 overflow-y-auto">
                                                     {staffNames.filter(n => n.toLowerCase().includes(newPersonInput.toLowerCase()) && !task.fallbackChain.includes(n)).map(name => (
                                                         <div key={name} onClick={() => { setNewPersonInput(name); handleAddFallback(task.id); }} className="text-xs px-2 py-1 hover:bg-indigo-50 cursor-pointer rounded">
                                                             {name}
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>
                                         )}
                                    </div>
                                </div>
                            </div>

                        </div>
                        <button onClick={(e) => handleDeleteTask(e, task.id)} className="p-2 text-slate-400 hover:text-white hover:bg-red-500 rounded transition-colors self-end lg:self-center" title="Delete Rule">
                            <Trash2 size={20}/>
                        </button>
                    </div>
                ))}
                
                <button onClick={() => {
                    // Generate a safe unique ID
                    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => Number(t.id) || 0)) + 1 : 1000;
                    // @ts-ignore
                    setTasks((prev) => [...prev, { id: newId, code: 'NEW', name: 'New Task', type: 'general', fallbackChain: [], effort: 30, frequency: 'daily', dueTime: '' }]);
                }} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2">
                    <Plus size={20}/> Add New Rule
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}