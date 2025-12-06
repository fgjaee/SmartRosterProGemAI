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
        - Format strictly as "Start-End" (e.g., "7:00-3:00", "12:00-8:00").
        - If the shift is overnight (e.g. 10pm to 6am), format as "10:00-6:00" or "22:00-6:00".
        - If the employee is off, return "OFF".
        - If the cell says "LOANED", return "LOANED OUT".
        - Remove "AM"/"PM" suffixes and convert to simple H:MM format, unless ambiguous. 
        - Example: "5a-1p" becomes "5:00-1:00". "1pm-9pm" becomes "1:00-9:00".

        Return ONLY the JSON object matching the schema.
     `;

     // Call API
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
     
     const data = JSON.parse(response.text) as ScheduleData;
     
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