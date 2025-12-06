import React, { useState } from 'react';
import { X, Trash2, Plus, ArrowUp, ArrowDown, Database } from 'lucide-react';
import { TaskRule, TaskType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskRule[];
  setTasks: (tasks: TaskRule[]) => void;
  staffNames: string[];
}

export default function TaskDBModal({ isOpen, onClose, tasks, setTasks, staffNames }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPersonInput, setNewPersonInput] = useState('');

  if (!isOpen) return null;

  const handleUpdate = (id: number, field: keyof TaskRule, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddPerson = (id: number) => {
    if (!newPersonInput) return;
    setTasks(tasks.map(t => t.id === id ? { ...t, fallbackChain: [...t.fallbackChain, newPersonInput] } : t));
    setNewPersonInput('');
  };

  const handleRemovePerson = (taskId: number, idx: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, fallbackChain: t.fallbackChain.filter((_, i) => i !== idx) } : t));
  };

  const handleAddNewTask = () => {
    const newId = Math.max(0, ...tasks.map(t => t.id)) + 1;
    const newTask: TaskRule = { id: newId, code: "NEW", name: "New Task", type: "general", fallbackChain: [] };
    setTasks([newTask, ...tasks]);
    setEditingId(newId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
               <Database size={20} />
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-800">Task Database</h3>
                <p className="text-xs text-slate-500">Configure automation rules and priority chains</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {tasks.map(t => (
            <div key={t.id} className={`bg-white border rounded-xl shadow-sm transition-all duration-200 ${editingId === t.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="p-4">
                <div className="flex flex-col md:flex-row gap-4 mb-3">
                  <div className="w-20 shrink-0">
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Code</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-center text-sm focus:outline-none focus:border-indigo-500" 
                      value={t.code} 
                      onChange={e => handleUpdate(t.id, 'code', e.target.value)} 
                      onFocus={() => setEditingId(t.id)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Task Name</label>
                    <input 
                        className="w-full font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent" 
                        value={t.name} 
                        onChange={e => handleUpdate(t.id, 'name', e.target.value)} 
                        onFocus={() => setEditingId(t.id)}
                    />
                  </div>
                  <div className="w-32">
                     <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Type</label>
                     <select 
                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50"
                        value={t.type} 
                        onChange={e => handleUpdate(t.id, 'type', e.target.value as TaskType)}
                    >
                        <option value="skilled">Skilled</option>
                        <option value="general">General</option>
                        <option value="shift_based">Shift Based</option>
                     </select>
                  </div>
                  <button 
                    onClick={() => setTasks(tasks.filter(x => x.id !== t.id))}
                    className="text-slate-300 hover:text-red-500 transition-colors p-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {t.type === 'skilled' && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                     <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Priority Chain (Fallback Logic)</div>
                     <div className="flex flex-wrap gap-2 mb-3">
                        {t.fallbackChain.length === 0 && <span className="text-xs text-slate-400 italic">No specific employees assigned.</span>}
                        {t.fallbackChain.map((person, idx) => (
                           <div key={idx} className="flex items-center bg-white border border-slate-200 shadow-sm rounded-md pl-3 pr-1 py-1 text-xs font-medium text-slate-700">
                              {person}
                              <button onClick={() => handleRemovePerson(t.id, idx)} className="ml-2 p-1 hover:bg-red-50 hover:text-red-500 rounded"><X size={12}/></button>
                           </div>
                        ))}
                     </div>
                     <div className="flex gap-2">
                        <select 
                            className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                            value={editingId === t.id ? newPersonInput : ''}
                            onChange={e => { setEditingId(t.id); setNewPersonInput(e.target.value); }}
                        >
                           <option value="">Select staff member...</option>
                           {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button onClick={() => handleAddPerson(t.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700">Add</button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-slate-200 bg-white rounded-b-2xl flex justify-between">
           <span className="text-xs text-slate-400 flex items-center">Changes save automatically to backup.</span>
           <button onClick={handleAddNewTask} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors">
              <Plus size={16}/> Add New Rule
           </button>
        </div>
      </div>
    </div>
  );
}