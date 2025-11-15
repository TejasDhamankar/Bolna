// Location: src/app/api/voices/route.ts

import { NextRequest, NextResponse } from "next/server";

// Use the new Bolna API Key
const BOLNA_API_KEY = process.env.BOLNA_API_KEY!;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  
  console.log("--- /api/voices ---");
  console.log("API Key being used by server:", BOLNA_API_KEY ? `${BOLNA_API_KEY.substring(0, 6)}...` : "--- UNDEFINED ---");

  if (!BOLNA_API_KEY) {
    console.error("Missing BOLNA_API_KEY environment variable");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.bolna.ai/me/voices", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BOLNA_API_KEY}`, // Use Bearer token
      },
      cache: "no-store", 
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Bolna Voices API Error:", errorText);
      return NextResponse.json(
        { voices: [], message: `Failed to fetch voices: ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // --- START OF FIX ---
    // The Bolna API might return { data: [...] }, { voices: [...] }, or just [...].
    // This code handles all three possibilities.
    const voices =
      Array.isArray(data) ? data :
      Array.isArray(data.data) ? data.data :
      Array.isArray(data.voices) ? data.voices : [];

    console.log(`Successfully fetched ${voices.length} voices from Bolna.`);
    // --- END OF FIX ---

    const mappedVoices = voices.map((v: any) => ({
      // --- New Structure ---
      id: v.id, // Bolna's internal UUID
      voice_id: v.voice_id, // Provider's voice_id (e.g., 'Matthew')
      provider: v.provider, // e.g., 'polly', 'elevenlabs'
      name: v.name, // e.g., 'Matthew'
      model: v.model, // e.g., 'eleven_turbo_v2_5'
      accent: v.accent, // e.g., 'United States (English) female'

      // --- Map to old fields for frontend compatibility ---
      tags: v.accent || `${v.provider} ${v.name}`,
      
      // --- FIX FOR DEMO URL ---
      demo: v.sample_url || v.demo || null, // Look for the correct demo URL field
    }));

    return NextResponse.json({ voices: mappedVoices });

  } catch (error: any) {
    console.error("Error in /api/voices route:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}