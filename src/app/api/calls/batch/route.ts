import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/jwt';
import { initiateCall } from '@/lib/bolna/call/initiateCall';

export async function POST(request: NextRequest) {
    console.log("--- POST /api/calls/batch: Received batch call request ---");
    try {
        const userData = await getUserFromRequest(request);
        if (!userData || typeof userData === 'string') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { agentId, contacts } = body;

        if (!agentId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
            console.warn("[POST /api/calls/batch] Validation failed: Missing agentId or contacts.");
            return NextResponse.json({ message: 'Agent ID and a list of contacts are required' }, { status: 400 });
        }

        console.log(`[POST /api/calls/batch] Starting batch job for agent ${agentId} with ${contacts.length} contacts.`);
        let initiated = 0;
        let failed = 0;

        // We run these in sequence for now.
        // For parallel, we would use Promise.allSettled
        for (const contact of contacts) {
            try {
                if (!contact.phoneNumber || !contact.name) {
                    console.warn("[POST /api/calls/batch] Skipping contact, missing name or phone:", contact);
                    failed++;
                    continue;
                }
                
                await initiateCall(
                    userData.userId,
                    agentId,
                    contact.phoneNumber,
                    contact.name,
                    contact.customMessage
                );
                initiated++;
            } catch (error: any) {
                console.error(`[POST /api/calls/batch] Failed to initiate call for ${contact.phoneNumber}:`, error.message);
                failed++;
            }
        }

        console.log(`[POST /api/calls/batch] Batch complete. Initiated: ${initiated}, Failed: ${failed}`);
        return NextResponse.json({
            message: `Batch processing complete.`,
            initiated,
            failed
        });

    } catch (error: any) {
        console.error('Error in POST /api/calls/batch:', error);
        return NextResponse.json({ message: 'Failed to start batch calls', error: error.message }, { status: 500 });
    }
}