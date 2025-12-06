import { TaskRule } from "./types";

export const DEFAULT_TASK_DB: TaskRule[] = [
    { id: 101, code: "ON", name: "Truck Unload & Sort", type: "skilled", fallbackChain: ["Essix, Solomon", "Powell, Marlon"] },
    { id: 112, code: "EOD", name: "Breakdown All Pallets in Cooler/BR", type: "skilled", fallbackChain: ["Essix, Solomon", "Powell, Marlon", "Wood, William B"] },
    { id: 102, code: "ORD", name: "DOB Orders", type: "skilled", fallbackChain: ["Powell, Marlon", "Mullinix, James", "Nash, Deb A"] },
    { id: 103, code: "ORD", name: "Freshpak Production", type: "skilled", fallbackChain: ["Cooley, Sandra K", "Nash, Deb A", "Cannon, Beth M"] },
    { id: 201, code: "T0", name: "First Impressions Set", type: "general", fallbackChain: ["Wood, William B"] },
    { id: 204, code: "T1", name: "Tropical/Harvest Set", type: "general", fallbackChain: ["Hernandez, Victoria"] },
    { id: 203, code: "T2", name: "Apple Set", type: "general", fallbackChain: ["Wood, William B"] },
    { id: 205, code: "T3", name: "Berries/Grapes Set", type: "general", fallbackChain: ["Hernandez, Victoria"] },
    { id: 216, code: "9AM", name: "Floor Set By 9am (All)", type: "general", fallbackChain: [] },
    { id: 215, code: "AN", name: "Sweep & Mop Floor (As Needed)", type: "general", fallbackChain: [] },
    { id: 212, code: "3X", name: "Roll Bag Refill", type: "shift_based", fallbackChain: [] },
    { id: 217, code: "3X", name: "Condition/Face Department", type: "shift_based", fallbackChain: [] },
    { id: 301, code: "MAN", name: "Organix Sorting", type: "skilled", fallbackChain: ["Hernandez, Victoria", "Her, Heidi P", "Wood, William B"] },
    { id: 309, code: "MAN", name: "Close Department", type: "skilled", fallbackChain: ["OHare, Barry"] },
];

export const PRIORITY_PINNED_IDS = [110, 216, 215, 218, 213, 307];