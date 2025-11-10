// Location: src/models/callModel.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface ICall extends Document {
  // --- Core Relationships ---
  userId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId; // Our internal Agent DB _id
  contactId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId; 

  // --- Bolna-Specific IDs ---
  bolnaAgentId: string; // The agent_id FROM Bolna
  execution_id?: string; // The call execution_id FROM Bolna
  
  // --- Contact Info ---
  phoneNumber: string;
  contactName?: string;
  agentName?: string; // Copied from the agent for easy display

  // --- Call Status & Info ---
  direction: "inbound" | "outbound";
  status:
    | "queued"
    | "initiated"
    | "in-progress"
    | "completed"
    | "failed"
    | "ended" // Added "ended" as a final state from Bolna
    | "no-answer";
  
  failureReason?: string;
  notes?: string; // For the custom message
  
  // --- Call Results (from webhooks) ---
  summary?: string;
  recordingUrl?: string;
  transcription?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in seconds
  cost: number; // in cents/paise
  outcome?: string;
}

const CallSchema = new Schema<ICall>(
  {
    // --- Core Relationships ---
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", index: true },

    // --- Bolna-Specific IDs ---
    bolnaAgentId: { type: String, required: true, index: true },
    execution_id: { type: String, index: true }, // This replaces elevenLabsCallSid

    // --- Contact Info ---
    phoneNumber: { type: String, required: true },
    contactName: String,
    agentName: String,

    // --- Call Status & Info ---
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "outbound",
    },
    status: {
      type: String,
      enum: [
        "queued",
        "initiated",
        "in-progress",
        "completed",
        "failed",
        "ended",
        "no-answer",
      ],
      default: "queued",
    },
    failureReason: String,
    notes: String,

    // --- Call Results (from webhooks) ---
    summary: String,
    recordingUrl: String,
    transcription: String,
    startTime: Date,
    endTime: Date,
    duration: Number,
    cost: { type: Number, default: 0 },
    outcome: String,
  },
  { timestamps: true }
);

// This function will ensure old/stale ElevenLabs fields are not saved
CallSchema.pre('save', function(next) {
  this.set('elevenLabsAgentId', undefined);
  this.set('elevenLabsCallSid', undefined);
  this.set('twilioCallSid', undefined);
  this.set('conversationId', undefined);
  next();
});


const Call = mongoose.models.Call || mongoose.model<ICall>('Call', CallSchema);

export default Call;