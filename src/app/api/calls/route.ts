import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Call from '@/models/callModel';
import Agent from '@/models/agentModel';
import { getUserFromRequest } from '@/lib/jwt';
import { initiateCall } from '@/lib/bolna/call/initiateCall'; // <-- IMPORT NEW SERVICE
import { parse } from 'csv-parse/sync';

export async function GET(request: NextRequest) {
    console.log("--- GET /api/calls: Fetching recent calls ---");
    try {
        const userData = await getUserFromRequest(request);
        if (!userData || typeof userData === 'string') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        console.log(`Fetching last ${limit} calls for user ${userData.userId}`);

        const calls = await Call.find({ userId: userData.userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(); 

        console.log(`Found ${calls.length} calls.`);
        return NextResponse.json({ calls });
    } catch (error: any) {
        console.error('Error fetching calls:', error);
        return NextResponse.json({ message: 'Failed to fetch calls', error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    console.log("--- POST /api/calls: Received new single call request ---");
    try {
        const userData = await getUserFromRequest(request);
        if (!userData || typeof userData === 'string') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log("[POST /api/calls] Request body:", body);
        const { agentId, phoneNumber, contactName, customMessage } = body;

        if (!agentId || !phoneNumber || !contactName) {
            console.warn("[POST /api/calls] Validation failed: Missing required fields.");
            return NextResponse.json({ message: 'Agent, Phone Number, and Name are required' }, { status: 400 });
        }

        // Call the new service
        const result = await initiateCall(userData.userId, agentId, phoneNumber, contactName, customMessage);
        
        console.log("[POST /api/calls] Single call initiated successfully, result:", result);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error in POST /api/calls:', error);
        return NextResponse.json({ message: 'Failed to initiate call', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    console.log("--- PUT /api/calls: Received CSV upload request ---");
    try {
        const userData = await getUserFromRequest(request);
        if (!userData || typeof userData === 'string') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const agentId = formData.get('agentId') as string;

        if (!file || !agentId) {
            console.warn("[PUT /api/calls] Validation failed: Missing file or agentId.");
            return NextResponse.json({ message: 'File and agent ID are required' }, { status: 400 });
        }
        
        console.log(`[PUT /api/calls] Processing CSV for agentId: ${agentId}`);
        await connectDB();
        
        const agent = await Agent.findOne({ userId: userData.userId, agentId: agentId });
        if (!agent) {
            console.warn(`[PUT /api/calls] Agent not found: ${agentId}`);
            return NextResponse.json({ message: 'Agent not found' }, { status: 404 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const records = parse(buffer, { columns: true, skip_empty_lines: true });
        console.log(`[PUT /api/calls] Parsed ${records.length} records from CSV.`);

        const results = { created: 0, skipped: 0, failed: 0 };
        const uploadedContacts = [];

        for (const record of records) {
            const name = record.name || record.Name;
            const phone = record.phone || record.Phone || record.phoneNumber;
            const customMessage = record.message || record.customMessage;

            if (!name || !phone) {
                console.log("[PUT /api/calls] Skipping record:", record);
                results.skipped++;
                continue;
            }
            
            uploadedContacts.push({ name, phoneNumber: phone, customMessage });
            results.created++;
        }

        console.log(`[PUT /api/calls] CSV processing complete:`, results);
        return NextResponse.json({
            message: `Processed ${records.length} contacts from CSV.`,
            results,
            uploadedContacts,
        });
    } catch (error: any) {
        console.error('Error processing CSV:', error);
        return NextResponse.json({ message: 'Failed to process CSV', error: error.message }, { status: 500 });
    }
}