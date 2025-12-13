
import { GoogleGenAI } from "@google/genai";
import { ScheduleData, TaskRule } from "../types";
import { getGeminiApiKey } from "src/services/env";

const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: { 
        data: await base64EncodedDataPromise, 
        mimeType: file.type 
    },
  };
};

const cleanJsonString = (str: string) => {
    if (!str) return "";
    let clean = str.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean;
};

export const AIService = {
  // 1. Complex Vision Task: Schedule OCR
  // Upgraded to gemini-3-pro-preview for maximum accuracy on complex tables
  parseSchedule: async (file: File): Promise<ScheduleData> => {
     const filePart = await fileToGenerativePart(file);
     const prompt = `
        Analyze this roster image. Return a JSON object with:
        1. 'week_period': The date range found (e.g., "Nov 1 - Nov 7").
        2. 'shifts': An array of objects for each employee row.

        Schema for 'shifts':
        {
          "name": "Employee Name",
          "role": "Job Title (or 'Stock' if unclear)",
          "sun": "Time Range",
          "mon": "Time Range",
          "tue": "Time Range",
          "wed": "Time Range",
          "thu": "Time Range",
          "fri": "Time Range",
          "sat": "Time Range"
        }

        Rules:
        - Format Times: "HH:MM(AM/PM)-HH:MM(AM/PM)".
        - If blank/X/Loan, use "OFF".
        - Return ONLY JSON.
     `;

     try {
         const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: { parts: [filePart, { text: prompt }] },
            config: { responseMimeType: "application/json" }
         });
         
         const cleanJson = cleanJsonString(response.text || "{}");
         const data = JSON.parse(cleanJson) as ScheduleData;
         
         // Data hydration
         if (!data.shifts) data.shifts = [];
         data.shifts = data.shifts.map((s, i) => ({
             ...s,
             id: String(Date.now() + i),
             role: s.role || "Stock",
             sun: s.sun || "OFF", mon: s.mon || "OFF", tue: s.tue || "OFF",
             wed: s.wed || "OFF", thu: s.thu || "OFF", fri: s.fri || "OFF", sat: s.sat || "OFF",
         }));
         
         return data;
     } catch (err: any) {
         console.error("AI Schedule Error:", err);
         throw new Error("Failed to parse schedule. Ensure image is clear.");
     }
  },

  // 2. Complex Vision Task: Workplace Analysis
  // Uses gemini-3-pro-preview to identify tasks from a photo
  analyzeWorkplaceImage: async (file: File): Promise<TaskRule[]> => {
      const filePart = await fileToGenerativePart(file);
      const prompt = `
        You are a retail operations expert. Analyze this image of a store environment.
        Identify 3-5 specific, actionable tasks to improve the area (stocking, cleaning, safety, organizing).
        
        Return a JSON array of objects with this schema:
        {
            "code": "Short Code (e.g., CLN, STK)",
            "name": "Actionable Task Name",
            "type": "general",
            "effort": Estimated minutes (integer)
        }
        
        Do not include generic advice. Be specific to what you see in the photo.
      `;

      try {
          const response = await ai.models.generateContent({
              model: "gemini-3-pro-preview",
              contents: { parts: [filePart, { text: prompt }] },
              config: { responseMimeType: "application/json" }
          });

          const cleanJson = cleanJsonString(response.text || "[]");
          const tasks = JSON.parse(cleanJson);
          
          return tasks.map((t: any, i: number) => ({
              ...t,
              id: 8000 + Math.floor(Math.random() * 1000),
              fallbackChain: [], // No specific person assigned yet
          }));
      } catch (err: any) {
          console.error("AI Vision Error:", err);
          throw new Error("Could not analyze image.");
      }
  },

  // 3. Fast Text Task: Daily Huddle
  // Uses gemini-2.5-flash-lite for low latency response
  generateDailyHuddle: async (day: string, shiftCount: number, focusAreas: string[]): Promise<string> => {
      const prompt = `
        Write a high-energy, 30-second pre-shift huddle speech for a retail team.
        Day: ${day}
        Staff Count: ${shiftCount}
        Focus Areas: ${focusAreas.join(', ') || "General Service & Speed"}
        
        Keep it professional but motivating. Do not use markdown. Just plain text.
      `;

      try {
          const response = await ai.models.generateContent({
              model: "gemini-2.5-flash-lite",
              contents: { parts: [{ text: prompt }] },
          });
          return response.text || "Let's have a great shift team!";
      } catch (err) {
          console.error("AI Huddle Error:", err);
          return "Team, let's focus on safety and customers today! (AI Offline)";
      }
  }
};
