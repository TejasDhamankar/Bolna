import { NextResponse } from "next/server";

const HOST = "https://api.bolna.ai";
const API_KEY = process.env.BOLNA_API_KEY;

/**
 * CREATE BATCH
 * POST /api/calls/batch
 * Body: FormData (agent_id, file, from_phone_number?)
 */
export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json({ message: "Missing API key" }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const agent_id = form.get("agent_id");
    const file = form.get("file") as File | null;
    const fromPhone = form.get("from_phone_number");

    if (!agent_id || !file)
      return NextResponse.json({ message: "agent_id and file required" }, { status: 400 });

    const forward = new FormData();
    forward.append("agent_id", String(agent_id));
    forward.append("file", file, file.name);
    if (fromPhone) forward.append("from_phone_number", String(fromPhone));

    const res = await fetch(`${HOST}/batches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: forward,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

/**
 * UPDATE / SCHEDULE BATCH
 * PUT /api/calls/batch
 * Body: { batch_id, scheduled_at }
 */
export async function PUT(req: Request) {
  try {
    const { batch_id, scheduled_at } = await req.json();

    if (!batch_id || !scheduled_at)
      return NextResponse.json({ message: "batch_id & scheduled_at required" }, { status: 400 });

    const res = await fetch(`${HOST}/batches/${batch_id}/schedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ scheduled_at }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

/**
 * GET BATCH DETAILS OR EXECUTIONS
 * GET /api/calls/batch?batch_id=xxx
 * GET /api/calls/batch?batch_id=xxx&executions=true
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batch_id");
  const executions = url.searchParams.get("executions");

  if (!batchId)
    return NextResponse.json({ message: "batch_id required" }, { status: 400 });

  try {
    // CALL EXECUTIONS
    if (executions === "true") {
      const res = await fetch(`${HOST}/batches/${batchId}/executions`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // BATCH STATUS
    const res = await fetch(`${HOST}/batches/${batchId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
