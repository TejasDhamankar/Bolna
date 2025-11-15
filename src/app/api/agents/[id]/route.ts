import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Agent from "@/models/agentModel";
import { getDefaultSystemTools } from "@/lib/systemTools";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const agent = await Agent.findById(params.id);
    if (!agent) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json(agent);
  } catch (error: any) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// --- Interfaces for Bolna API Payload (copied from src/lib/bolna/agents/createAgent.ts) ---
interface BolnaAgentConfig { agent_name: string; agent_welcome_message?: string; agent_type?: string; tasks: BolnaTask[]; }
interface BolnaTask { task_type: string; tools_config: { llm_agent: BolnaLlmAgent; synthesizer: BolnaSynthesizer; transcriber: BolnaTranscriber; input: { provider: string; format: string }; output: { provider: string; format: string }; api_tools?: any; }; toolchain: { execution: string; pipelines: string[][]; }; task_config: BolnaTaskConfig; }
interface BolnaLlmAgent { agent_type: string; agent_flow_type: string; llm_config: { provider: string; family: string; model: string; temperature: number; }; vector_store?: { provider: string; provider_config: { vector_id: string; }; }; }
interface BolnaSynthesizer { provider: string; provider_config: { voice?: string; voice_id?: string; model?: string; engine?: string; sampling_rate?: string; language?: string; [key: string]: any; }; stream: boolean; buffer_size: number; audio_format: string; }
interface BolnaTranscriber { provider: string; model: string; language: string; stream: boolean; sampling_rate: number; encoding: string; endpointing: number; }
interface BolnaTaskConfig { hangup_after_silence: number; incremental_delay: number; number_of_words_for_interruption: number; call_terminate: number; }
interface BolnaAgentPrompts { task_1: { system_prompt: string; }; }

// Helper to map language code (from createAgent.ts)
const getBolnaLanguage = (lang: string, provider: string) => {
    const map: { [key: string]: string } = {
        'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'hi': 'hi-IN',
        'ja': 'ja-JP', 'ko': 'ko-KR', 'pt': 'pt-BR', 'it': 'it-IT',
    };
    if (provider === 'sarvam') {
        return map[lang] ? map[lang].split('-')[0] : 'en';
    }
    return map[lang] || 'en-US';
};

// Helper to build dynamicSynthesizer (adapted from createAgent.ts)
function buildDynamicSynthesizer(voiceData: { provider: string; name: string; voice_id?: string; model?: string; engine?: string; }, language: string): BolnaSynthesizer {
    let provider_config: any = {};
    const bolnaLanguage = getBolnaLanguage(language, voiceData.provider);

    switch (voiceData.provider) {
        case 'elevenlabs':
            provider_config = {
                voice: voiceData.name,
                voice_id: voiceData.voice_id,
                model: voiceData.model,
            };
            break;
        case 'polly':
            provider_config = {
                voice: voiceData.name,
                engine: voiceData.model || 'generative', // Polly uses 'engine' for model
                sampling_rate: '8000', // Default from Bolna docs
                language: bolnaLanguage,
            };
            break;
        case 'sarvam':
            provider_config = {
                voice: voiceData.name,
                voice_id: voiceData.voice_id,
                language: bolnaLanguage,
                model: voiceData.model,
            };
            break;
        case 'deepgram':
        case 'azuretts':
        default:
            provider_config = {
                voice: voiceData.name,
                model: voiceData.model,
                language: bolnaLanguage,
            };
            break;
    }

    return {
        provider: voiceData.provider,
        provider_config: provider_config,
        stream: true,
        buffer_size: 150,
        audio_format: "wav",
    };
}

// Helper to build llm_agent_config (adapted from createAgent.ts)
function buildLlmAgentConfig(llmModel: string, temperature: number, knowledgeVectorIds?: string[]): BolnaLlmAgent {
    const vectorId = knowledgeVectorIds && knowledgeVectorIds.length > 0 ? knowledgeVectorIds[0] : undefined;
    if (vectorId) {
        return { agent_type: "knowledgebase_agent", agent_flow_type: "streaming", llm_config: { provider: "openai", family: "openai", model: llmModel || "gpt-3.5-turbo", temperature: temperature || 0.1, }, vector_store: { provider: "lancedb", provider_config: { vector_id: vectorId } } };
    } else {
        return { agent_type: "simple_llm_agent", agent_flow_type: "streaming", llm_config: { provider: "openai", family: "openai", model: llmModel || "gpt-3.5-turbo", temperature: temperature || 0.1, }, };
    }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const agent: IAgent | null = await Agent.findById(params.id);

    if (!agent) {
      return NextResponse.json({ message: "Agent not found in DB" }, { status: 404 });
    }

    const bolnaAgentId = agent.agentId;
    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;

    // 1. Delete from Bolna
    const response = await fetch(`https://api.bolna.ai/v2/agent/${bolnaAgentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
    });

    if (!response.ok) {
      console.error(`Failed to delete agent from Bolna: ${response.statusText}`);
      // Decide if you want to proceed with DB deletion or not. For now, we'll proceed.
    }

    // 2. Delete from MongoDB
    await Agent.findByIdAndDelete(params.id);

    return NextResponse.json({ message: "Agent deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 });
  }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } } // params.id is MongoDB _id
) {
    try {
        await connectDB();
        const mongoDbAgentId = params.id;
        const updates = await request.json(); // Incoming updates from frontend

        const existingAgent: IAgent | null = await Agent.findById(mongoDbAgentId);

        if (!existingAgent) {
            return NextResponse.json({ message: "Agent not found in DB" }, { status: 404 });
        }

        const bolnaAgentId = existingAgent.agentId;
        const BOLNA_API_KEY = process.env.BOLNA_API_KEY;

        if (!BOLNA_API_KEY) {
            throw new Error("BOLNA_API_KEY is not set in environment variables.");
        }

        // Prepare data for Bolna API payload, merging existing with updates
        const currentName = updates.name !== undefined ? updates.name : existingAgent.name;
        const currentDescription = updates.description !== undefined ? updates.description : existingAgent.description;
        const currentFirstMessage = updates.firstMessage !== undefined ? updates.firstMessage : existingAgent.firstMessage;
        const currentSystemPrompt = updates.systemPrompt !== undefined ? updates.systemPrompt : existingAgent.systemPrompt;
        const currentLlmModel = updates.llmModel !== undefined ? updates.llmModel : existingAgent.llmModel;
        const currentTemperature = updates.temperature !== undefined ? updates.temperature : existingAgent.temperature;
        const currentLanguage = updates.language !== undefined ? updates.language : existingAgent.language;
        const currentMaxDurationSeconds = updates.maxDurationSeconds !== undefined ? updates.maxDurationSeconds : existingAgent.maxDurationSeconds;
        const currentKnowledgeVectorIds = updates.knowledgeVectorIds !== undefined ? updates.knowledgeVectorIds : existingAgent.knowledgeVectorIds;
        const currentTools = updates.tools !== undefined ? updates.tools : existingAgent.tools;

        // Voice details: Use updates if provided, otherwise fallback to existingAgent
        const currentVoiceId = updates.voiceId !== undefined ? updates.voiceId : existingAgent.voiceId;
        const currentVoiceName = updates.voiceName !== undefined ? updates.voiceName : existingAgent.voiceName;
        const currentVoiceProvider = updates.voiceProvider !== undefined ? updates.voiceProvider : existingAgent.voiceProvider;
        const currentVoiceModel = updates.voiceModel !== undefined ? updates.voiceModel : existingAgent.voiceModel;

        if (!currentVoiceProvider || !currentVoiceModel) {
            throw new Error("Voice provider or model missing for constructing Bolna payload. Frontend must provide full voice details for update.");
        }

        const voiceDataForBolna = {
            id: currentVoiceId,
            voice_id: currentVoiceId,
            provider: currentVoiceProvider,
            name: currentVoiceName,
            model: currentVoiceModel,
            accent: "unknown", // Default if not provided
        };

        const dynamicSynthesizer = buildDynamicSynthesizer(voiceDataForBolna, currentLanguage);
        const llm_agent_config = buildLlmAgentConfig(currentLlmModel, currentTemperature, currentKnowledgeVectorIds);

        const agent_config: BolnaAgentConfig = {
            agent_name: currentName,
            agent_welcome_message: currentFirstMessage,
            agent_type: "other",
            tasks: [
                {
                    task_type: "conversation",
                    tools_config: {
                        llm_agent: llm_agent_config,
                        synthesizer: dynamicSynthesizer,
                        transcriber: { provider: "deepgram", model: "nova-2", language: currentLanguage || "en", stream: true, sampling_rate: 16000, encoding: "linear16", endpointing: 100, },
                        input: { provider: "exotel", format: "wav" },
                        output: { provider: "exotel", format: "wav" },
                        api_tools: null,
                    },
                    toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]], },
                    task_config: { hangup_after_silence: 10, incremental_delay: 400, number_of_words_for_interruption: 2, call_terminate: currentMaxDurationSeconds || 90, },
                },
            ],
        };

        const agent_prompts: BolnaAgentPrompts = {
            task_1: { system_prompt: currentSystemPrompt },
        };

        const requestBody = { agent_config, agent_prompts };

        // 1. Update Bolna Agent
        const response = await fetch(`https://api.bolna.ai/v2/agent/${bolnaAgentId}`, {
            method: 'PUT',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${BOLNA_API_KEY}`, },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update agent in Bolna: ${response.status} - ${errorText}`);
            throw new Error(`Failed to update agent in Bolna: ${errorText}`);
        }

        const bolnaUpdateResult = await response.json();
        console.log("Bolna Agent Update Result:", bolnaUpdateResult);

        // 2. Update MongoDB Agent
        const dbUpdatePayload: Partial<IAgent> = {
            name: currentName,
            description: currentDescription,
            voiceId: currentVoiceId,
            voiceName: currentVoiceName,
            voiceProvider: currentVoiceProvider,
            voiceModel: currentVoiceModel,
            firstMessage: currentFirstMessage,
            systemPrompt: currentSystemPrompt,
            llmModel: currentLlmModel,
            temperature: currentTemperature,
            language: currentLanguage,
            maxDurationSeconds: currentMaxDurationSeconds,
            knowledgeVectorIds: currentKnowledgeVectorIds,
            tools: currentTools,
        };

        const updatedAgent = await Agent.findByIdAndUpdate(
            mongoDbAgentId,
            dbUpdatePayload,
            { new: true, runValidators: true }
        );

        if (!updatedAgent) {
            return NextResponse.json({ message: "Agent not found in DB after update attempt" }, { status: 404 });
        }

        return NextResponse.json({ message: "Agent updated successfully", agent: updatedAgent });

    } catch (error: any) {
        console.error("Error updating agent:", error);
        return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 });
    }
}