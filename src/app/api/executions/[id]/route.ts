import { NextRequest, NextResponse } from "next/server";

/**
 * Unified Execution endpoint
 * - Fetches execution from Bolna
 * - If Exotel provider and no recording_url, fetches Exotel Call details
 * - Returns unified JSON containing the requested fields
 *
 * Required env:
 *  - BOLNA_API_KEY
 *  - EXOTEL_SID
 *  - EXOTEL_API_KEY
 *  - EXOTEL_API_TOKEN
 */

function safeString(v: any) {
  return v === undefined ? null : v;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    if (!executionId) {
      return NextResponse.json({ error: "execution id is required" }, { status: 400 });
    }

    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    if (!BOLNA_API_KEY) {
      return NextResponse.json({ error: "Missing BOLNA_API_KEY in env" }, { status: 500 });
    }

    // 1) Fetch from Bolna
    const bolnaUrl = `https://api.bolna.ai/v2/execution/${executionId}`;
    const bolnaRes = await fetch(bolnaUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${BOLNA_API_KEY}`, "Content-Type": "application/json" },
    });

    if (!bolnaRes.ok) {
      const text = await bolnaRes.text();
      return NextResponse.json({ error: "Failed to fetch from Bolna", status: bolnaRes.status, details: text }, { status: bolnaRes.status });
    }

    const data = await bolnaRes.json();

    // Basic extraction helpers (Bolna shape may vary slightly)
    const bolnaAgentId = data?.agent_id ?? data?.agentId ?? null;
    const agent_name = data?.agent_name ?? data?.agentName ?? null;

    const telephony = data?.telephony_data ?? data?.telephonyData ?? null;

    // Pull fields requested
    const to_number = telephony?.to_number ?? telephony?.toNumber ?? null;
    const from_number = telephony?.from_number ?? telephony?.fromNumber ?? null;
    const provider_call_id = telephony?.provider_call_id ?? telephony?.providerCallId ?? null;
    const duration = telephony?.duration ?? data?.conversation_time ?? null;
    const hangup_by = telephony?.hangup_by ?? null;
    const hangup_reason = telephony?.hangup_reason ?? null;

    // Bolna might sometimes include recording_url under top-level or under telephony_data
    let recordingUrl = data?.recording_url ?? telephony?.recording_url ?? null;

    // If recording_url is missing and provider is exotel, try to fetch from Exotel using provider_call_id
    let recording_file_size: number | null = null;
    let recording_format: string | null = null;

    const provider = telephony?.provider ?? null;

    if (!recordingUrl && provider && provider.toLowerCase() === "exotel" && provider_call_id) {
      const EXOTEL_SID = process.env.EXOTEL_SID;
      const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
      const EXOTEL_API_TOKEN = process.env.EXOTEL_API_TOKEN;

      if (EXOTEL_SID && EXOTEL_API_KEY && EXOTEL_API_TOKEN) {
        try {
          // Exotel call detail endpoint returns XML that contains RecordingUrl element
          const callUrl = `https://api.exotel.com/v1/Accounts/${EXOTEL_SID}/Calls/${provider_call_id}`;
          const auth = "Basic " + Buffer.from(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`).toString("base64");

          const exoRes = await fetch(callUrl, {
            method: "GET",
            headers: { Authorization: auth },
          });

          if (exoRes.ok) {
            const xmlText = await exoRes.text();
            // naive XML extraction for <RecordingUrl> ... </RecordingUrl>
            const match = xmlText.match(/<RecordingUrl>(.*?)<\/RecordingUrl>/i);
            if (match && match[1]) {
              recordingUrl = match[1];
            } else {
              // Some Exotel account setups might list recordings under <Recordings> or different nodes.
              // Try a more general regex for https links ending with mp3/wav
              const hrefMatch = xmlText.match(/https?:\/\/[^<>"']+\.(mp3|wav)/i);
              if (hrefMatch) recordingUrl = hrefMatch[0];
            }
          } else {
            // not fatal — just include the Exotel status/text in response debug if needed
            // Do not fail the whole request
            // optionally you could capture exoRes.status/text for debugging
          }
        } catch (e) {
          // ignore exotel fetch errors — we'll return what we have
          console.error("Exotel fetch error:", e);
        }
      } else {
        // Exotel env missing; we will still return bolna data (null recording)
      }
    }

    // If we have a recording URL, try to HEAD it to get size and content-type
    if (recordingUrl) {
      try {
        const headRes = await fetch(recordingUrl, { method: "HEAD" });
        if (headRes.ok) {
          const len = headRes.headers.get("content-length");
          const ctype = headRes.headers.get("content-type");
          recording_file_size = len ? parseInt(len, 10) : null;
          recording_format = ctype ?? null;
        } else {
          // If HEAD not allowed, do a GET of first bytes - OPTIONAL: skipped to avoid heavy downloads
        }
      } catch (e) {
        console.warn("Failed to HEAD recording URL:", e);
      }
    }

    // Transcript
    const transcript = data?.transcript ?? null;

    // Simple local agent summary (no external LLM) — short abstract of transcript
    let agent_summary: string | null = null;
    if (transcript && typeof transcript === "string") {
      // crude heuristic: take first 240 chars or up to first sentence
      const firstSentenceMatch = transcript.match(/^(.*?[.?!])\s/);
      if (firstSentenceMatch) {
        agent_summary = firstSentenceMatch[1].trim();
      } else {
        agent_summary = transcript.trim().slice(0, 240) + (transcript.trim().length > 240 ? "…" : "");
      }
    }

    // Build response object with requested fields
    const responsePayload = {
      execution_id: safeString(executionId),
      status: safeString(data?.status ?? null),
      created_at: safeString(data?.created_at ?? data?.createdAt ?? null),
      updated_at: safeString(data?.updated_at ?? data?.updatedAt ?? null),

      // Telephony
      to_number: safeString(to_number),
      from_number: safeString(from_number),
      provider_call_id: safeString(provider_call_id),
      duration: safeString(duration),
      hangup_by: safeString(hangup_by),
      hangup_reason: safeString(hangup_reason),

      // Recording
      recording_url: safeString(recordingUrl),
      recording_file_size: recording_file_size,
      recording_format: recording_format,

      // Transcript
      transcript: safeString(transcript),
      agent_summary: safeString(agent_summary),

      // Bolna meta
      bolnaAgentId: safeString(bolnaAgentId),
      agent_name: safeString(agent_name),

      // raw bolna telephony data for debugging if needed
      telephony_data: telephony ?? null,
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: any) {
    console.error("Execution route error:", err);
    return NextResponse.json({ error: "Internal server error", details: err?.message ?? String(err) }, { status: 500 });
  }
}
