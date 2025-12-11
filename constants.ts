
import { TaskRule } from "./types";

export const DEFAULT_TASK_DB: TaskRule[] = [
  {
    id: 101,
    code: "ON",
    name: "Truck Unload & Sort",
    type: "skilled",
    fallbackChain: [
      "Essix, Solomon",
      "Powell, Marlon"
    ],
    effort: 240,
    frequency: 'daily',
    excludedDays: ['thu'] // Excluded Thu (Wed Night/Thu Morning truck gap)
  },
  {
    id: 112,
    code: "EOD",
    name: "Breakdown All Pallets in Cooler/BR",
    type: "skilled",
    fallbackChain: [
      "Essix, Solomon",
      "Powell, Marlon",
      "Wood, William B",
      "Shah, Nabil",
      "OHare, Barry"
    ],
    frequency: 'daily'
  },
  {
    id: 102,
    code: "ORD",
    name: "DOB Order",
    type: "skilled",
    fallbackChain: [
      "Powell, Marlon",
      "Cooley, Sandra K",
      "Nash, Deb A",
      "Mullinix, James"
    ],
    effort: 90,
    frequency: 'daily'
  },
  {
    id: 103,
    code: "ORD",
    name: "Freshpak Order",
    type: "skilled",
    fallbackChain: [
      "Cooley, Sandra K",
      "Cannon, Beth M",
      "Nash, Deb A",
      "Powell, Marlon",
      "Mullinix, James"
    ],
    effort: 20,
    frequency: 'daily'
  },
  {
    id: 201,
    code: "T0",
    name: "First Impressions Set",
    type: "general",
    fallbackChain: [],
    frequency: 'daily',
    dueTime: "9:00 AM"
  },
  {
    id: 204,
    code: "T1",
    name: "Citrus Set",
    type: "general",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 203,
    code: "T2",
    name: "Apple Set",
    type: "general",
    fallbackChain: [],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 205,
    code: "T3",
    name: "Berries/Grapes Set",
    type: "general",
    fallbackChain: [],
    effort: 45,
    frequency: 'daily'
  },
  {
    id: 202,
    code: "T4",
    name: "Banana/Tropical Set",
    type: "general",
    fallbackChain: [],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 206,
    code: "T5",
    name: "Tomato/Pepper Set",
    type: "general",
    fallbackChain: [],
    effort: 45,
    frequency: 'daily'
  },
  {
    id: 207,
    code: "T6",
    name: "Organic Set",
    type: "general",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 208,
    code: "T7",
    name: "Potato/Onion Set",
    type: "general",
    fallbackChain: [],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 209,
    code: "G1",
    name: "Dry Stock/Nuts Set",
    type: "general",
    fallbackChain: [],
    effort: 45,
    frequency: 'daily'
  },
  {
    id: 104,
    code: "W1",
    name: "Freshpak Fruit/Veg Set",
    type: "skilled",
    fallbackChain: [
      "Cooley, Sandra K",
      "Cannon, Beth M",
      "Nash, Deb A",
      "Shah, Nabil",
      "Wood, William B",
      "Powell, Marlon"
    ],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 105,
    code: "W2",
    name: "Salad- Juice Set",
    type: "skilled",
    fallbackChain: [
      "Nash, Deb A",
      "Cooley, Sandra K",
      "Wood, William B",
      "Cannon, Beth M"
    ],
    effort: 240,
    frequency: 'daily'
  },
  {
    id: 106,
    code: "W3",
    name: "Mirror Wall Set",
    type: "skilled",
    fallbackChain: [
      "Her, Heidi P",
      "Finazzo, John S",
      "Wood, William B",
      "Shah, Nabil",
      "Powell, Marlon",
      "Cannon, Beth M"
    ],
    effort: 45,
    frequency: 'daily'
  },
  {
    id: 107,
    code: "W4",
    name: "Wet Rack/Herb Set",
    type: "skilled",
    fallbackChain: [
      "Her, Heidi P",
      "Finazzo, John S",
      "Cooley, Sandra K",
      "Nash, Deb A",
      "Wood, William B",
      "Shah, Nabil"
    ],
    effort: 180,
    frequency: 'daily'
  },
  {
    id: 216,
    code: "9AM",
    name: "Floor Set By 9am (All)",
    type: "general",
    fallbackChain: [],
    frequency: 'daily',
    dueTime: "9:00 AM"
  },
  {
    id: 212,
    code: "AN",
    name: "Roll Bag Refill (3x Daily)",
    type: "shift_based",
    fallbackChain: [],
    effort: 10,
    frequency: 'daily'
  },
  {
    id: 215,
    code: "AN",
    name: "Sweep & Mop Floor (As Needed)",
    type: "shift_based",
    fallbackChain: [],
    effort: 10,
    frequency: 'daily'
  },
  {
    id: 218,
    code: "ON/PS",
    name: "Backroom Cleanliness",
    type: "shift_based",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 213,
    code: "PS",
    name: "Return Carts Putaway (As Needed)",
    type: "general",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 217,
    code: "PS",
    name: "Condition/Face Department (3x Daily)",
    type: "general",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 110,
    code: "PS",
    name: "Flashfood Bags",
    type: "all_staff",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 307,
    code: "AN",
    name: "Signage/Subads (Check Daily)",
    type: "general",
    fallbackChain: [
      "Cannon, Beth M",
      "Mullinix, James"
    ],
    frequency: 'daily'
  },
  {
    id: 301,
    code: "MAN",
    name: "Organix Sorting",
    type: "all_staff",
    fallbackChain: [
      "Wood, William B",
      "Hernandez, Victoria",
      "Her, Heidi P"
    ],
    frequency: 'daily'
  },
  {
    id: 302,
    code: "MAN",
    name: "Crisping",
    type: "general",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 303,
    code: "MAN",
    name: "IMS Aisle Work",
    type: "skilled",
    fallbackChain: [
      "Shah, Nabil",
      "Cannon, Beth M",
      "Cooley, Sandra K",
      "Nash, Deb A"
    ],
    frequency: 'daily'
  },
  {
    id: 304,
    code: "MAN",
    name: "Hole Scan Entire Department",
    type: "skilled",
    fallbackChain: [
      "Shah, Nabil",
      "Nash, Deb A",
      "Cooley, Sandra K",
      "Cannon, Beth M"
    ],
    frequency: 'daily'
  },
  {
    id: 305,
    code: "MAN",
    name: "Schedule Posting (Fri Only)",
    type: "skilled",
    fallbackChain: [
      "Mullinix, James",
      "Cannon, Beth M"
    ],
    frequency: 'weekly',
    frequencyDay: 'fri'
  },
  {
    id: 306,
    code: "MAN",
    name: "Condition Dry/Nuts",
    type: "skilled",
    fallbackChain: [
      "Essix, Solomon",
      "Powell, Marlon",
      "Cannon, Beth M",
      "Her, Heidi P",
      "Mullinix, James"
    ],
    effort: 20,
    frequency: 'daily'
  },
  {
    id: 308,
    code: "MAN",
    name: "Maintain/Upkeep Sales Floor",
    type: "skilled",
    fallbackChain: [
      "OHare, Barry",
      "Shah, Nabil"
    ],
    effort: 60,
    frequency: 'daily'
  },
  {
    id: 309,
    code: "MAN",
    name: "Close Department",
    type: "skilled",
    fallbackChain: [
      "OHare, Barry",
      "Shah, Nabil"
    ],
    effort: 60,
    frequency: 'daily',
    dueTime: 'Closing'
  },
  {
    id: 310,
    code: "MAN",
    name: "All L-carts folded",
    type: "shift_based",
    fallbackChain: [],
    frequency: 'daily'
  },
  {
    id: 311,
    code: "MAN",
    name: "Hallway Clean",
    type: "skilled",
    fallbackChain: [
      "OHare, Barry",
      "Powell, Marlon",
      "Shah, Nabil",
      "Cannon, Beth M"
    ],
    frequency: 'daily'
  },
  {
    id: 108,
    code: "PS",
    name: "Markdowns (Entire Department)",
    type: "skilled",
    fallbackChain: [
      "Cooley, Sandra K",
      "Nash, Deb A",
      "Cannon, Beth M",
      "Wood, William B",
      "Shah, Nabil"
    ],
    frequency: 'daily'
  },
  {
    id: 109,
    code: "PS",
    name: "Throwaways/Organix",
    type: "skilled",
    fallbackChain: [
      "Shah, Nabil",
      "Cannon, Beth M",
      "Wood, William B"
    ],
    frequency: 'daily'
  }
];

export const PRIORITY_PINNED_IDS = [110, 216, 215, 218, 213, 307, 309];
