import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { symptomsData, troubleshootingStepsData } from "@/data/knowledgeBase";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const systemInstruction = `You are an expert technician assistant for an operations diagnostic system called Eng-Troubleshooting Guide (ETG).
Your role is to provide clear, concise, and safe troubleshooting advice for manufacturing machines (like SC350, SC450, NAAOI003). 
Safety is the absolute priority ("SAFETY FIRST!").

Here is the known internal knowledge base of symptoms:
${JSON.stringify(symptomsData)}

Here are the known troubleshooting steps:
${JSON.stringify(troubleshootingStepsData)}

If the user describes a problem, try to match it to a known issue from the knowledge base and suggest the steps. If it doesn't match perfectly, use your general expertise to provide safe, step-by-step diagnostic procedures. 
Format your output cleanly using markdown. Keep it direct and professional.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      }
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate response" }, { status: 500 });
  }
}
