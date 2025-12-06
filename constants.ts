import { TaskRule } from "./types";

export const DEFAULT_TASK_DB: TaskRule[] = [
    // --- SKILLED / PRIORITY TASKS ---
    { id: 101, code: "ON", name: "Truck Unload & Sort", type: "skilled", fallbackChain: ["Essix, Solomon", "Powell, Marlon", "Wood, William B"] },
    { id: 112, code: "EOD", name: "Breakdown All Pallets in Cooler/BR", type: "skilled", fallbackChain: ["Essix, Solomon", "Powell, Marlon", "Wood, William B"] },
    { id: 102, code: "ORD", name: "DOB Orders (Daily Ordering)", type: "skilled", fallbackChain: ["Powell, Marlon", "Mullinix, James", "Nash, Deb A"] },
    { id: 103, code: "FP", name: "Freshpak Production", type: "skilled", fallbackChain: ["Cooley, Sandra K", "Nash, Deb A", "Cannon, Beth M"] },
    { id: 110, code: "SAFE", name: "Department Safety Walk", type: "skilled", fallbackChain: ["Cannon, Beth M", "Mullinix, James"] },
    { id: 301, code: "ORG", name: "Organix Sorting & Cull", type: "skilled", fallbackChain: ["Hernandez, Victoria", "Her, Heidi P", "Wood, William B"] },
    { id: 309, code: "CLS", name: "Close Department (Secure & Clean)", type: "skilled", fallbackChain: ["OHare, Barry", "Mullinix, James"] },
    { id: 305, code: "AUD", name: "Inventory Audit / Counts", type: "skilled", fallbackChain: ["Cannon, Beth M"] },

    // --- SETS (GENERAL) ---
    { id: 201, code: "T0", name: "First Impressions Set (Lobby/Entrance)", type: "general", fallbackChain: ["Wood, William B", "Hernandez, Victoria"] },
    { id: 203, code: "T2", name: "Apple/Pear Set", type: "general", fallbackChain: ["Wood, William B", "Cooley, Sandra K"] },
    { id: 204, code: "T1", name: "Tropical & Citrus Set", type: "general", fallbackChain: ["Hernandez, Victoria", "Nash, Deb A"] },
    { id: 205, code: "T3", name: "Berries & Grapes Set", type: "general", fallbackChain: ["Hernandez, Victoria", "Her, Heidi P"] },
    { id: 206, code: "T4", name: "Melon Set", type: "general", fallbackChain: [] },
    { id: 207, code: "T5", name: "Hard Veg (Potatoes/Onions) Set", type: "general", fallbackChain: ["Essix, Solomon"] },
    { id: 208, code: "T6", name: "Wet Rack Set (Leafy Greens)", type: "general", fallbackChain: ["Powell, Marlon"] },
    { id: 209, code: "T7", name: "Tomato/Avocado Set", type: "general", fallbackChain: ["Cooley, Sandra K"] },
    { id: 213, code: "WR", name: "Wet Rack Deep Clean & Rotate", type: "general", fallbackChain: ["Powell, Marlon", "Essix, Solomon"] },
    
    // --- GENERAL MAINTENANCE ---
    { id: 216, code: "9AM", name: "Floor Set By 9am (All Hands)", type: "general", fallbackChain: [] },
    { id: 215, code: "FLR", name: "Sweep & Mop Floor (Safety)", type: "general", fallbackChain: [] },
    { id: 218, code: "QC", name: "Quality Check / Culling Round", type: "general", fallbackChain: ["Her, Heidi P", "OHare, Barry"] },
    { id: 219, code: "BAL", name: "Bale Cardboard", type: "general", fallbackChain: [] },
    { id: 220, code: "TR", name: "Trash Run", type: "general", fallbackChain: [] },
    { id: 221, code: "SUP", name: "Refill Supplies (Towels/Bags)", type: "general", fallbackChain: [] },
    { id: 307, code: "DEM", name: "Sample/Demo Station Setup", type: "general", fallbackChain: ["Nash, Deb A"] },
    { id: 308, code: "SGN", name: "Signage & Price Check", type: "general", fallbackChain: ["Cannon, Beth M"] },

    // --- SHIFT BASED ---
    { id: 212, code: "RB", name: "Roll Bag Refill", type: "shift_based", fallbackChain: [] },
    { id: 217, code: "CON", name: "Condition/Face Department", type: "shift_based", fallbackChain: [] },
    { id: 401, code: "5PM", name: "5PM Recovery", type: "shift_based", fallbackChain: [] },
    { id: 402, code: "CRT", name: "Clear Carts/L-Boats", type: "shift_based", fallbackChain: [] },
    { id: 403, code: "COM", name: "Compost Run", type: "shift_based", fallbackChain: [] },
    { id: 404, code: "SAN", name: "Sanitize High Touch Areas", type: "shift_based", fallbackChain: [] },
    { id: 405, code: "WAT", name: "Water Plants/Floral", type: "shift_based", fallbackChain: [] },
];

export const PRIORITY_PINNED_IDS = [110, 216, 215, 218, 213, 307, 309];