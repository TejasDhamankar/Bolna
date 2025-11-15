import connectDB from '@/lib/db';
import Call from '@/models/callModel';
import Agent from '@/models/agentModel'; // Your existing agent model
import { IAgent } from '@/models/agentModel'; // Import the interface

// 1. Get Bolna and Exotel credentials from .env
const BOLNA_API_KEY = process.env.BOLNA_API_KEY!;
const EXOTEL_CALLER_ID = process.env.EXOTEL_CALLER_ID!;

export async function initiateCall(
    userId: string,
    bolnaAgentId: string, // This is the agent_id from Bolna
    phoneNumber: string,
    contactName: string,
    customMessage?: string
) {
    console.log(`[initiateCall] Service started for user ${userId}, agent ${bolnaAgentId}, phone ${phoneNumber}`);
    
    if (!BOLNA_API_KEY || !EXOTEL_CALLER_ID) {
        console.error("[initiateCall] Missing BOLNA_API_KEY or EXOTEL_CALLER_ID in .env");
        throw new Error("Server configuration error.");
    }

    await connectDB();

    // 2. Find the agent in our local DB to get its name
    const agent: IAgent | null = await Agent.findOne({ userId, agentId: bolnaAgentId });
    if (!agent) {
        console.error(`[initiateCall] Agent not found in local DB with agentId: ${bolnaAgentId}`);
        throw new Error("Agent not found or does not belong to the user.");
    }
    console.log(`[initiateCall] Found local agent: ${agent.name}`);

    // 3. Create a local call record FIRST
    const newCall = new Call({
        userId,
        agentId: agent._id, // Store our internal MongoDB _id
        bolnaAgentId: bolnaAgentId, // Store the Bolna agent_id
        agentName: agent.name,
        contactName,
        phoneNumber,
        status: 'queued',
        notes: customMessage || '',
    });
    await newCall.save();
    console.log(`[initiateCall] Created local call record with ID: ${newCall._id}`);

    // 4. Prepare the payload for Bolna
    const bolnaPayload = {
        agent_id: bolnaAgentId,
        recipient_phone_number: phoneNumber,
        from_phone_number: EXOTEL_CALLER_ID,
        metadata: {
            local_call_id: newCall._id.toString(),
            contact_name: contactName,
            user_id: userId,
        }
    };

    console.log("[initiateCall] Sending payload to Bolna /call:", JSON.stringify(bolnaPayload, null, 2));

    try {
        // 5. Make the API call to Bolna
        const response = await fetch("https://api.bolna.ai/call", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${BOLNA_API_KEY}`,
            },
            body: JSON.stringify(bolnaPayload),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[initiateCall] Bolna API Error (${response.status}):`, errorData);
            
            // 6a. Update local call record with failure
            newCall.status = 'failed';
            newCall.failureReason = `Bolna API Error: ${errorData}`;
            await newCall.save();
            
            throw new Error(`Failed to initiate call via Bolna: ${errorData}`);
        }

        const result = await response.json();
        console.log("[initiateCall] Bolna API Success:", result);

        // 6b. Update local call record with success
        newCall.status = 'initiated';
        newCall.execution_id = result.execution_id; // Save Bolna's call ID
        await newCall.save();

        console.log(`[initiateCall] Call initiated. Local ID: ${newCall._id}, Bolna Execution ID: ${result.execution_id}`);
        return {
            message: 'Call initiated successfully.',
            localCallId: newCall._id,
            execution_id: result.execution_id,
            status: newCall.status
        };

    } catch (error: any) {
        console.error("[initiateCall] Network or fetch error:", error);
        newCall.status = 'failed';
        newCall.failureReason = error.message || "Unknown fetch error";
        await newCall.save();
        throw error; // Re-throw the error
    }
}