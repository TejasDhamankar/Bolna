// Location: lib/bolna/agents/createAgent.ts

import Agent from "@/models/agentModel";
import connectDB from "@/lib/db";
import { getDefaultSystemTools } from "@/lib/systemTools";

// --- Interfaces ---
interface BolnaAgentConfig {
  agent_name: string;
  agent_welcome_message?: string;
  agent_type?: string;
  tasks: BolnaTask[];
}
interface BolnaTask {
  task_type: string;
  tools_config: {
    llm_agent: BolnaLlmAgent;
    synthesizer: BolnaSynthesizer;
    transcriber: BolnaTranscriber;
    input: { provider: string; format: string };
    output: { provider: string; format: string };
    api_tools?: any;
  };
  toolchain: {
    execution: string;
    pipelines: string[][];
  };
  task_config: BolnaTaskConfig;
}
interface BolnaLlmAgent {
  agent_type: string;
  agent_flow_type: string;
  llm_config: {
    provider: string;
    family: string;
    model: string;
    temperature: number;
  };
  vector_store?: {
    provider: string;
    provider_config: {
      vector_id: string;
    };
  };
}
interface BolnaSynthesizer {
  provider: string;
  provider_config: {
    voice?: string;
    voice_id?: string;
    model?: string;
    engine?: string;
    sampling_rate?: string;
    language?: string;
    [key: string]: any;
  };
  stream: boolean;
  buffer_size: number;
  audio_format: string;
}
interface BolnaTranscriber {
  provider: string;
  model: string;
  language: string;
  stream: boolean;
  sampling_rate: number;
  encoding: string;
  endpointing: number;
}
interface BolnaTaskConfig {
  hangup_after_silence: number;
  incremental_delay: number;
  number_of_words_for_interruption: number;
  call_terminate: number;
}
interface BolnaAgentPrompts {
  task_1: {
    system_prompt: string;
  };
}

type AnyObj = { [key: string]: any };

export async function createAgent(agentData: AnyObj) {
  try {
    const BOLNA_API_KEY = process.env.BOLNA_API_KEY!;
    const BOLNA_API_URL = "https://api.bolna.ai/v2/agent";

    // --- 1. Build the Bolna agent_config ---
    
    // --- Dynamic Synthesizer Config ---
    const voice = agentData.voiceObject;
    if (!voice) {
      throw new Error("voiceObject is missing from agentData");
    }

    // Helper to map language code
    const getBolnaLanguage = (lang: string, provider: string) => {
        const map: { [key: string]: string } = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'hi': 'hi-IN',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'pt': 'pt-BR',
            'it': 'it-IT',
        };
        // Some providers like Sarvam might just want 'hi' instead of 'hi-IN'
        if (provider === 'sarvam') {
            return map[lang] ? map[lang].split('-')[0] : 'en';
        }
        return map[lang] || 'en-US';
    };
    
    let provider_config: any = {};
    const language = getBolnaLanguage(agentData.language, voice.provider);

    switch (voice.provider) {
        case 'elevenlabs':
            provider_config = {
                voice: voice.name,
                voice_id: voice.voice_id,
                model: voice.model,
            };
            break;
        case 'polly':
            provider_config = {
                voice: voice.name,
                engine: voice.model || 'generative',
                sampling_rate: '8000', // Default from Bolna docs
                language: language,
            };
            break;
        
        // --- START OF FIX ---
        case 'sarvam':
            // Sarvam (and others) need both the name and the ID,
            // just like ElevenLabs.
            provider_config = {
                voice: voice.name,     // e.g., "Vidya"
                voice_id: voice.voice_id, // e.g., "arya"
                language: language,
                model: voice.model,
            };
            break;
        // --- END OF FIX ---
            
        case 'deepgram':
        case 'azuretts':
        default:
            // This is the default for 'cartesia' and 'inworld' as well
            provider_config = {
                voice: voice.name,
                model: voice.model,
                language: language,
            };
            break;
    }
    
    const dynamicSynthesizer: BolnaSynthesizer = {
      provider: voice.provider,
      provider_config: provider_config,
      stream: true,
      buffer_size: 150,
      audio_format: "wav",
    };

    console.log("--- Synthesizer Config Being Sent ---");
    console.log(JSON.stringify(dynamicSynthesizer, null, 2));

    // --- Dynamic LLM Agent Config ---
    const vectorId = agentData.knowledgeVectorIds && agentData.knowledgeVectorIds[0];
    let llm_agent_config: BolnaLlmAgent;
    if (vectorId) {
      llm_agent_config = {
        agent_type: "knowledgebase_agent", 
        agent_flow_type: "streaming",
        llm_config: {
          provider: "openai", 
          family: "openai",
          model: agentData.llm_model || "gpt-3.5-turbo",
          temperature: agentData.temperature || 0.1,
        },
        vector_store: { 
          provider: "lancedb", 
          provider_config: {
            vector_id: vectorId 
          }
        }
      };
    } else {
      llm_agent_config = {
        agent_type: "simple_llm_agent",
        agent_flow_type: "streaming",
        llm_config: {
          provider: "openai",
          family: "openai",
          model: agentData.llm_model || "gpt-3.5-turbo",
          temperature: agentData.temperature || 0.1,
        },
      };
    }

    // --- Main Agent Config ---
    const agent_config: BolnaAgentConfig = {
      agent_name: agentData.name,
      agent_welcome_message: agentData.firstMessage,
      agent_type: "other",
      tasks: [
        {
          task_type: "conversation",
          tools_config: {
            llm_agent: llm_agent_config,
            synthesizer: dynamicSynthesizer,
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: agentData.language || "en",
              stream: true,
              sampling_rate: 16000,
              encoding: "linear16",
              endpointing: 100,
            },
            input: { provider: "exotel", format: "wav" },
            output: { provider: "exotel", format: "wav" },
            api_tools: null, // TODO: Map your tools
          },
          toolchain: {
            execution: "parallel",
            pipelines: [["transcriber", "llm", "synthesizer"]],
          },
          task_config: {
            hangup_after_silence: 10,
            incremental_delay: 400,
            number_of_words_for_interruption: 2,
            call_terminate: agentData.max_duration_seconds || 90,
          },
        },
      ],
    };

    // --- 2. Build the Bolna agent_prompts ---
    const agent_prompts: BolnaAgentPrompts = {
      task_1: {
        system_prompt: agentData.systemPrompt,
      },
    };

    // --- 3. Build the final request body ---
    const requestBody = {
      agent_config,
      agent_prompts,
    };

    // --- 4. Call the Bolna API ---
    const response = await fetch(BOLNA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BOLNA_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bolna AI API Error:", { status: response.status, text: errorText });
      throw new Error(`Failed to create agent with Bolna AI (${response.status}): ${errorText}`);
    }

    const bolnaAgent = await response.json();
    console.log("🧠 Bolna AI Agent Response:", bolnaAgent);

    const agentId = bolnaAgent.agent_id;
    if (!agentId) {
      console.error("❌ Bolna AI response missing agent_id:", bolnaAgent);
      throw new Error("Invalid Bolna AI response: Missing agent ID");
    }

    // --- 5. Save to your DB ---
    await connectDB();
    
    const agent = new Agent({
      ...agentData, // Spreads most fields (name, description, etc.)
      
      // --- Explicitly save the correct fields ---
      agentId: agentId,
      voiceId: agentData.voiceObject.id,      // The Bolna UUID
      voiceName: agentData.voiceObject.name,  // The voice's name (e.g., "Kartik")
      language: agentData.language,         // The language (e.g., "hi")

      knowledgeVectorIds: agentData.knowledgeVectorIds || [],
      systemTools: getDefaultSystemTools(),
      voiceObject: undefined, // Don't save the full object to the DB
    });
    await agent.save();

    return {
      agent_id: agentId,
      name: agentData.name,
      message: "AI agent created successfully.",
    };

  } catch (error: any) {
    console.error("Error in createAgent (Bolna) service:", error);
    throw error;
  }
}