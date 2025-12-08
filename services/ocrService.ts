import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleData } from "../types";

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

export const OCRService = {
  parseSchedule: async (file: File): Promise<ScheduleData> => {
     // Initialize Gemini
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     // Prepare File
     const filePart = await fileToGenerativePart(file);

     // Define Prompt
     const prompt = `
        You are an intelligent data extraction assistant for a retail roster system. 
        Analyze this image or PDF of a weekly staff schedule.
        
        Extract the following:
        1. The 'week_period' (e.g., "Nov 30 - Dec 7").
        2. A list of 'shifts' for each employee found in the roster.

        For each employee row, extract:
        - Name (Format: "Lastname, Firstname" or "Firstname Lastname").
        - Role (e.g., Lead, Stock, Overnight, Supervisor). If not clearly visible, infer 'Stock' based on context.
        - Shift times for each day (sun, mon, tue, wed, thu, fri, sat).
        
        CRITICAL FORMATTING RULES FOR TIMES:
        - **PRESERVE AM/PM SUFFIXES**: If the image shows "5:00AM", extract "5:00AM". If it shows "5:00PM", extract "5:00PM".
        - Do NOT convert to 24-hour format. Keep it as 12-hour with suffix.
        - Format as "Start-End" (e.g., "7:00AM-3:00PM", "10:00PM-6:00AM").
        - If the employee is off, return "OFF".
        - If the cell says "LOANED", return "LOANED OUT".
        - Only if NO suffix is present in the image, return simple H:MM (e.g. "5:00-1:00").

        Return ONLY the JSON object matching the schema.
     `;

     // Call API
     const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
            parts: [filePart, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    week_period: { type: Type.STRING },
                    shifts: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                role: { type: Type.STRING },
                                sun: { type: Type.STRING },
                                mon: { type: Type.STRING },
                                tue: { type: Type.STRING },
                                wed: { type: Type.STRING },
                                thu: { type: Type.STRING },
                                fri: { type: Type.STRING },
                                sat: { type: Type.STRING },
                            },
                            required: ["name", "sun", "mon", "tue", "wed", "thu", "fri", "sat"]
                        }
                    }
                }
            }
        }
     });
     
     if (!response.text) throw new Error("Failed to parse schedule");
     
     let data: ScheduleData;
     try {
         data = JSON.parse(response.text) as ScheduleData;
     } catch (e) {
         console.error("JSON Parse Error", e);
         throw new Error("Failed to parse AI response as JSON");
     }
     
     // Validate shifts array to prevent crashes
     if (!data.shifts || !Array.isArray(data.shifts)) {
         console.warn("No shifts array found in AI response, defaulting to empty.");
         data.shifts = [];
     }
     
     // Post-process to ensure IDs exist and data is clean
     data.shifts = data.shifts.map((s, i) => ({
         ...s,
         id: String(Date.now() + i),
         role: s.role || "Stock",
         // Ensure fallbacks for missing days
         sun: s.sun || "OFF",
         mon: s.mon || "OFF",
         tue: s.tue || "OFF",
         wed: s.wed || "OFF",
         thu: s.thu || "OFF",
         fri: s.fri || "OFF",
         sat: s.sat || "OFF",
     }));
     
     if (!data.week_period) data.week_period = "Imported Schedule";
     
     return data;
  }
};