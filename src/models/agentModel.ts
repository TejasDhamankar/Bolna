import mongoose, { Document, Schema } from 'mongoose';

// --- MODIFICATION ---
// Removed the IKnowledgeDocument interface. This logic belongs in your 
// separate 'knowledgeModel.ts' (which we defined in the previous step).

export interface IAgent extends Document {
 userId: mongoose.Types.ObjectId;
 agentId: string; // This will be the Bolna agent_id
 name: string;
 description?: string;

  // --- Voice configuration ---
  voiceId: string; // This will store the Bolna Voice UUID
  voiceProvider?: string; // e.g., 'elevenlabs', 'polly'
  voiceModel?: string; // e.g., 'eleven_turbo_v2_5', 'generative'
  voiceName?: string;
  
  // --- DEPRECATED (Old API) ---
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceSpeed: number;

  // --- Core settings ---
  disabled: boolean;
  firstMessage: string; // Bolna uses 'agent_welcome_message'
  systemPrompt: string; // Bolna uses 'system_prompt'
  templateId?: string;
  templateName?: string;
  
  // --- DEPRECATED (Old API) ---
  disableFirstMessageInterruptions: boolean;

  // --- LLM configuration ---
  llmModel: string; // Bolna uses model
  temperature: number; // Bolna uses temperature
  
  // --- DEPRECATED (Old API) ---
  maxTokens: number;
  reasoningEffort?: string;
  customLlm?: any;

  // --- Language and localization ---
  language: string; // Bolna uses this
  
  // --- DEPRECATED (Old API) ---
  timezone?: string;

  // --- Advanced conversation settings ---
  maxDurationSeconds: number; // Bolna uses 'call_terminate'
  
  // --- DEPRECATED (Old API) ---
  turnMode: string;
  turnTimeout: number;
  silenceEndCallTimeout: number;
  textOnly: boolean;

  // --- DEPRECATED (Old API) ---
  outputAudioFormat: string;
  inputAudioFormat: string;
  optimizeStreamingLatency: number;

  // --- DEPRECATED (Old API) ---
  asrModel: string;
  asrLanguage: string;
  asrQuality: string;
  asrProvider: string;
  asrKeywords: string[];

  // --- DEPRECATED (Old API) ---
  backgroundVoiceDetection: boolean;

  // --- MODIFICATION: Knowledge and tools ---
  knowledgeVectorIds: string[]; // <-- NEW: Stores Bolna vector_id(s)
  tools: string[]; // Your internal tool names
  systemTools: any[];
  
  // --- DEPRECATED (Old API) ---
  knowledgeDocuments: any[]; // <-- REPLACED
  toolIds: string[];
  mcpServerIds: string[];
  nativeMcpServerIds: string[];
  dynamicVariables: any;

  // --- DEPRECATED (Old API) ---
  ragEnabled: boolean;
  embeddingModel: string;
  maxVectorDistance: number;
  maxDocumentsLength: number;
  maxRetrievedRagChunksCount: number;

  // --- DEPRECATED (Old API) ---
  enableEndCall: boolean;
  enableLanguageDetection: boolean;
  enableTransferToAgent: boolean;
  enableTransferToNumber: boolean;
  enableSkipTurn: boolean;
  enableKeypadTouchTone: boolean;
  enableVoicemailDetection: boolean;

  // --- DEPRECATED (Old API) ---
  clientEvents: string[];
  languagePresets: any;
  supportedVoices: string[];
  pronunciationDictionaryLocators: any[];
  ignoreDefaultPersonality: boolean;

  // --- Analytics and usage ---
  usageMinutes: number;
  lastCalledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// --- MODIFICATION ---
// Removed the embedded 'KnowledgeDocumentSchema'. This is not needed here.

const AgentSchema = new Schema<IAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    agentId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,

    // --- Voice configuration ---
    voiceId: {
      type: String,
      required: true,
    },
    voiceName: String,
    
    // --- DEPRECATED (Old API) ---
    voiceStability: { type: Number, default: 0.5 },
    voiceSimilarityBoost: { type: Number, default: 0.8 },
    voiceSpeed: { type: Number, default: 1.0 },

    // --- Core settings ---
    disabled: { type: Boolean, default: false },
    firstMessage: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    templateId: String,
    templateName: String,
    
    // --- DEPRECATED (Old API) ---
    disableFirstMessageInterruptions: { type: Boolean, default: false },

    // --- LLM configuration ---
    llmModel: { type: String, default: 'gpt-4o-mini' },
    temperature: { type: Number, default: 0.3 },
    
    // --- DEPRECATED (Old API) ---
    maxTokens: { type: Number, default: -1 },
    reasoningEffort: String,
    customLlm: Schema.Types.Mixed,

    // --- Language and localization ---
    language: { type: String, default: 'en' },
    
    // --- DEPRECATED (Old API) ---
    timezone: String,

    // --- Advanced conversation settings ---
    maxDurationSeconds: { type: Number, default: 1800 },
    
    // --- DEPRECATED (Old API) ---
    turnMode: { type: String, default: 'turn' },
    turnTimeout: { type: Number, default: 7.0 },
    silenceEndCallTimeout: { type: Number, default: -1 },
    textOnly: { type: Boolean, default: false },
    outputAudioFormat: { type: String, default: 'pcm_16000' },
    inputAudioFormat: { type: String, default: 'pcm_16000' },
    optimizeStreamingLatency: { type: Number, default: 3 },
    asrModel: { type: String, default: 'nova-2-general' },
    asrLanguage: { type: String, default: 'auto' },
    asrQuality: { type: String, default: 'high' },
    asrProvider: { type: String, default: 'elevenlabs' },
    asrKeywords: [String],
    backgroundVoiceDetection: { type: Boolean, default: false },

    // --- MODIFICATION: Knowledge and tools ---
    knowledgeVectorIds: { // <-- NEW FIELD
      type: [String],
      default: []
    },
    tools: [String],
    systemTools: [Schema.Types.Mixed],
    
    // --- DEPRECATED (Old API) ---
    knowledgeDocuments: [Schema.Types.Mixed], // <-- REPLACED
    toolIds: [String],
    mcpServerIds: [String],
    nativeMcpServerIds: [String],
    dynamicVariables: Schema.Types.Mixed,
    ragEnabled: { type: Boolean, default: false },
    embeddingModel: { type: String, default: 'e5_mistral_7b_instruct' },
    maxVectorDistance: { type: Number, default: 0.6 },
    maxDocumentsLength: { type: Number, default: 50000 },
    maxRetrievedRagChunksCount: { type: Number, default: 20 },
    enableEndCall: { type: Boolean, default: true },
    enableLanguageDetection: { type: Boolean, default: false },
    enableTransferToAgent: { type: Boolean, default: false },
    enableTransferToNumber: { type: Boolean, default: false },
    enableSkipTurn: { type: Boolean, default: false },
    enableKeypadTouchTone: { type: Boolean, default: false },
    enableVoicemailDetection: { type: Boolean, default: false },
    clientEvents: { type: [String], default: [] },
    languagePresets: Schema.Types.Mixed,
    supportedVoices: [String],
    pronunciationDictionaryLocators: [Schema.Types.Mixed],
    ignoreDefaultPersonality: { type: Boolean, default: false },

    // --- Analytics ---
    usageMinutes: { type: Number, default: 0 },
    lastCalledAt: Date,
  },
  { timestamps: true }
);


const Agent = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);

export default Agent;