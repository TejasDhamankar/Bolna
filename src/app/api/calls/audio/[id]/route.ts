import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;

    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    if (!BOLNA_API_KEY) {
      return new Response("Missing API KEY", { status: 500 });
    }

    // Fetch execution to get recording URL
    const executionRes = await fetch(
      `https://api.bolna.ai/executions/${executionId}`,
      { headers: { Authorization: `Bearer ${BOLNA_API_KEY}` } }
    );

    const executionData = await executionRes.json();
    const recordingUrl = executionData?.telephony_data?.recording_url;

    if (!recordingUrl) {
      return new Response("Recording not available", { status: 404 });
    }

    const audioRes = await fetch(recordingUrl);

    return new Response(audioRes.body, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;

    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    const executionRes = await fetch(
      `https://api.bolna.ai/executions/${executionId}`,
      { headers: { Authorization: `Bearer ${BOLNA_API_KEY}` } }
    );

    const executionData = await executionRes.json();
    const recordingUrl = executionData?.telephony_data?.recording_url;

    if (!recordingUrl) {
      return new Response(null, { status: 404 });
    }

    // HEAD request to check availability
    const audioHead = await fetch(recordingUrl, { method: "HEAD" });

    return new Response(null, { status: audioHead.ok ? 200 : 404 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
