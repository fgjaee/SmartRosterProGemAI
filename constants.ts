
import { TaskRule, Employee } from "./types";

export const DEFAULT_TEAM: Employee[] = [
    { id: '101', name: "Cannon, Beth M", role: "Lead", isActive: true },
    { id: '102', name: "Powell, Marlon", role: "Overnight", isActive: true },
    { id: '103', name: "Essix, Solomon", role: "Overnight", isActive: true },
    { id: '104', name: "Mullinix, James", role: "Supervisor", isActive: true },
    { id: '105', name: "Wood, William B", role: "Stock", isActive: true },
    { id: '106', name: "Cooley, Sandra K", role: "Stock", isActive: true },
    { id: '107', name: "Nash, Deb A", role: "Stock", isActive: true },
    { id: '108', name: "Shah, Nabil", role: "Stock", isActive: true },
    { id: '109', name: "Her, Heidi P", role: "Stock", isActive: true },
    { id: '110', name: "Finazzo, John S", role: "Stock", isActive: true },
    { id: '111', name: "OHare, Barry", role: "Stock", isActive: true }
];

export const COMMON_SHIFTS = [
    "OFF",
    "VAC",
    "REQ",
    "4:00A-12:00P",
    "5:00A-1:00P",
    "6:00-2:00",
    "7:00-3:00",
    "8:00-4:00",
    "9:00-5:00",
    "10:00-6:00",
    "11:30-8:00",
    "12:00-8:00",
    "1:00-9:00",
    "2:00-10:00",
    "10:00P-6:00A",
    "12:00A-8:00A",
    "1:00A-9:00A"
];

export const DEFAULT_TASK_DB: TaskRule[] = [
  // --- TRCK: Truck (Overnight) ---
  {
    id: 101,
    code: "TRCK",
    name: "Truck Unload & Sort (BR/Cooler)",
    type: "skilled",
    fallbackChain: ["Essix, Solomon", "Powell, Marlon"],
    effort: 240,
    frequency: 'daily',
    excludedDays: ['thu'] // Not on Wed overnight (Thursday)
  },
  // --- ORDR: Orders (7:55 AM Deadline) ---
  {
    id: 102,
    code: "ORDR",
    name: "DOB Order Submission",
    type: "skilled",
    fallbackChain: ["Powell, Marlon", "Cooley, Sandra K", "Nash, Deb A", "Mullinix, James"],
    dueTime: "7:55 AM",
    effort: 90,
    frequency: 'daily',
    excludedDays: ['wed'] // No DOB on Wednesdays
  },
  {
    id: 103,
    code: "ORDR",
    name: "Freshpak Order Submission",
    type: "skilled",
    fallbackChain: ["Cooley, Sandra K", "Cannon, Beth M", "Nash, Deb A", "Mullinix, James"],
    dueTime: "7:55 AM",
    effort: 20,
    frequency: 'daily'
  },
  // --- IMS: Inventory Management ---
  {
    id: 303,
    code: "IMS",
    name: "System Aisle Work",
    type: "skilled",
    fallbackChain: ["Shah, Nabil", "Cannon, Beth M", "Cooley, Sandra K", "Nash, Deb A"],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 304,
    code: "IMS",
    name: "Manual Hole Scans (Outs)",
    type: "skilled",
    fallbackChain: ["Shah, Nabil", "Nash, Deb A", "Cooley, Sandra K", "Cannon, Beth M"],
    effort: 60,
    frequency: 'daily'
  },
  // --- Tables: Front to Back (T0 - T7) ---
  { id: 201, code: "T0", name: "First Impressions Set", type: "general", fallbackChain: [], dueTime: "9:00 AM", effort: 60, frequency: 'daily' },
  { id: 204, code: "T1", name: "Citrus Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 45 },
  { id: 203, code: "T2", name: "Apple Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 60 },
  { id: 205, code: "T3", name: "Berries/Grapes Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 45 },
  { id: 202, code: "T4", name: "Banana/Tropical Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 60 },
  { id: 206, code: "T5", name: "Tomato/Pepper Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 45 },
  { id: 207, code: "T6", name: "Organic Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 60 },
  { id: 208, code: "T7", name: "Potato/Onion Set", type: "general", fallbackChain: [], frequency: 'daily', effort: 60 },
  // --- Walls: Outer Edges (W1 - W4) ---
  { id: 104, code: "W1", name: "Freshpak Fruit/Veg Set", type: "skilled", fallbackChain: ["Cooley, Sandra K", "Cannon, Beth M", "Wood, William B"], effort: 60, frequency: 'daily' },
  { id: 105, code: "W2", name: "Salad/Juice Set", type: "skilled", fallbackChain: ["Nash, Deb A", "Cooley, Sandra K", "Wood, William B"], effort: 240, frequency: 'daily' },
  { id: 106, code: "W3", name: "Mirror Wall Set", type: "skilled", fallbackChain: ["Her, Heidi P", "Finazzo, John S", "Wood, William B"], effort: 45, frequency: 'daily' },
  { id: 107, code: "W4", name: "Wet Rack/Herb Set", type: "skilled", fallbackChain: ["Her, Heidi P", "Finazzo, John S", "Cooley, Sandra K"], effort: 180, frequency: 'daily' },
  // --- Specialized Morning Tasks ---
  { id: 306, code: "FACE", name: "Dry Stock/Nuts (Opening)", type: "skilled", fallbackChain: ["Essix, Solomon", "Powell, Marlon", "Cannon, Beth M"], dueTime: "6:00 AM", effort: 20, frequency: 'daily' },
  // --- Maintenance & Upkeep ---
  { id: 212, code: "RBAG", name: "Roll Bag Refill (Opening)", type: "shift_based", fallbackChain: [], effort: 10, frequency: 'daily' },
  { id: 2121, code: "RBAG", name: "Roll Bag Refill (Midday)", type: "shift_based", fallbackChain: [], effort: 10, frequency: 'daily' },
  { id: 2122, code: "RBAG", name: "Roll Bag Refill (Drive-Time)", type: "shift_based", fallbackChain: [], effort: 10, frequency: 'daily' },
  { id: 309, code: "CLSE", name: "Close Department (Full/Clean)", type: "skilled", fallbackChain: ["OHare, Barry", "Shah, Nabil"], dueTime: 'Closing', effort: 120, frequency: 'daily' },
  { id: 110, code: "FLAS", name: "Flashfood Bags contribution", type: "all_staff", fallbackChain: [], effort: 15, frequency: 'daily' },
  // --- Admin/Management ---
  { id: 307, code: "SIGN", name: "Signage & Subads Check", type: "skilled", fallbackChain: ["Cannon, Beth M", "Mullinix, James"], frequency: 'daily' },
  { id: 305, code: "SCHD", name: "Post Two-Week Schedule", type: "skilled", fallbackChain: ["Mullinix, James", "Cannon, Beth M"], dueTime: "1:00 PM", effort: 30, frequency: 'weekly', frequencyDay: 'fri' },
  // --- Monthly Tasks ---
  { id: 999, code: "PEI", name: "Period End Inventory", type: "skilled", fallbackChain: ["Mullinix, James", "Powell, Marlon"], effort: 480, frequency: 'monthly', frequencyDate: 30 }
];

export const PRIORITY_PINNED_IDS = [102, 103, 201, 305, 309, 306];
