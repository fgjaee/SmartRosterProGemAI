import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleData } from "../types";
import { getGeminiApiKey } from "src/services/env";

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        // Handle standard base64 data URI (remove "data:image/jpeg;base64," prefix)
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

// Helper to strip markdown code blocks if present
const cleanJsonString = (str: string) => {
    if (!str) return "";
    let clean = str.trim();
    // Remove ```json and ``` wrapping
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean;
};

export const OCRService = {
  parseSchedule: async (file: File): Promise<ScheduleData> => {
     const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
     const filePart = await fileToGenerativePart(file);

     // Define Prompt with stricter constraints
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

        CRITICAL RULES:
        - **Format Times Strictly**: "HH:MM(AM/PM)-HH:MM(AM/PM)". Example: "7:00AM-3:00PM".
        - **Inference**: If only numbers appear (e.g., "7-3"), infer AM/PM based on typical retail shifts (7-3 is usually 7am-3pm). If "2-10", it is 2pm-10pm.
        - **OFF Days**: If a cell is blank, says "OFF", "X", or "Loan", return "OFF".
        - **Correction**: Treat 'S' as '5', 'O' as '0' if inside a time range.
        - **Noise**: Ignore text like "Shift", "Hrs", "Meal". Just extract the time.

        Return ONLY raw JSON. No markdown formatting.
     `;

     try {
         const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [filePart, { text: prompt }]
            },
            config: {
                responseMimeType: "application/json",
                // Using loose schema to allow model flexibility, manual validation below
            }
         });
         
         if (!response.text) throw new Error("AI returned empty response.");
         
         const cleanJson = cleanJsonString(response.text);
         let data: ScheduleData;
         
         try {
             data = JSON.parse(cleanJson) as ScheduleData;
         } catch (e) {
             console.error("JSON Parse Error", e);
             throw new Error("Failed to parse AI response. Try a clearer image.");
         }
         
         // Validation & Defaulting
         if (!data.shifts || !Array.isArray(data.shifts)) {
             data.shifts = [];
         }
         
         data.shifts = data.shifts.map((s, i) => ({
             ...s,
             id: String(Date.now() + i),
             role: s.role || "Stock",
             sun: s.sun || "OFF",
             mon: s.mon || "OFF",
             tue: s.tue || "OFF",
             wed: s.wed || "OFF",
             thu: s.thu || "OFF",
             fri: s.fri || "OFF",
             sat: s.sat || "OFF",
         }));
         
         if (!data.week_period) data.week_period = "New Schedule";
         
         return data;

     } catch (err: any) {
         console.error("OCR Service Error:", err);
         throw new Error(err.message || "Unknown OCR error");
     }
  }
};