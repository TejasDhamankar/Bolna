import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Agent from "@/models/agentModel";
import { getUserFromRequest } from "@/lib/jwt";
import { createAgent } from "@/lib/bolna/agents/createAgent";
import KnowledgeDocument from "@/models/knowledgeModel";

// Helper function to get template name from ID
function getTemplateName(templateId: string) {
  const templateMap: { [key: string]: string } = {
    "sales-assistant": "Sales Assistant",
    "customer-support": "Customer Support",
    "appointment-scheduler": "Appointment Scheduler",
    "lead-qualification": "Lead Qualification",
    "followup-scheduler": "Followup Scheduler",
    "booking-agent": "Booking Agent"
  };
  return templateMap[templateId] || null;
}

export async function POST(request: NextRequest) {
  try {
    const userData = await getUserFromRequest(request);
    if (!userData) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const agentDataString = formData.get('agentData');
    if (!agentDataString || typeof agentDataString !== 'string') {
      return NextResponse.json({ message: "Missing agentData" }, { status: 400 });
    }
    const body = JSON.parse(agentDataString);

    const processedKnowledgeDocuments = body.knowledgeDocuments || [];
    const userId = typeof userData === "object" ? userData.userId : userData;
    await connectDB();

    const { getDefaultSystemTools } = await import('@/lib/systemTools');
   
    // ⭐️ CRITICAL FIX: The frontend sends the full voice object as 'voiceObject'. 
    // We pass it directly to the service layer, which will extract the necessary info
    // for the Bolna API call and the database save.
    const agentData = {
      userId,
      name: body.name,
      description: body.description || "",
      voiceObject: body.voiceObject, // <-- PASS THE FULL NESTED OBJECT
      firstMessage: body.firstMessage,
      systemPrompt: body.systemPrompt,
      templateId: body.templateId,
      template_name: body.templateId ? getTemplateName(body.templateId) : null,
      llm_model: body.llm_model || "gpt-4o-mini",
      temperature: body.temperature || 0.3,
      language: body.language || "en",
      max_duration_seconds: body.max_duration_seconds || 1800,
     
      knowledge_documents: processedKnowledgeDocuments,
     
      tools: body.tools || [],
      systemTools: getDefaultSystemTools()
    };
   
    // Call the createAgent service function
    const result = await createAgent(agentData);

    // Update knowledge documents (this is fine)
    try {
      const createdAgent = await Agent.findOne({ agentId: result.agent_id });
      if (createdAgent) {
        await KnowledgeDocument.updateMany(
          { userId },
          { $push: { agentIds: createdAgent._id } }
        );
      }
    } catch (updateError) {
      console.error("Error updating knowledge documents with agent reference:", updateError);
    }

    return NextResponse.json({
      agent_id: result.agent_id,
      name: result.name,
      message: result.message
    });

  } catch (err: any) {
    console.error("FULL ERROR IN ROUTE:", err);
    return NextResponse.json(
      { message: "Failed to create agent", error: err.message },
      { status: 500 }
    );
  }
}