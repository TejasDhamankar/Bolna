"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DashboardHeader } from "@/components/dashboard/header";
import { motion } from "framer-motion";

// UI Components
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Icons
import {
    Search, ArrowLeft, Bot, UserRoundCheck, HelpCircle, Clock, Lightbulb, Sparkles, Mic,
    Settings, Volume2, Wand2, User, Globe, CalendarCheck, Calendar, CheckCircle, Upload, FileText,
    Link as LinkIcon, BookOpen, Trash2, Plus, Calculator, Search as SearchIcon, Mail, Wrench,
    PlayCircle, PauseCircle, Server, Loader2
} from "lucide-react";
import { Label } from "@radix-ui/react-label";

// --- Schema for agent form ---
const agentSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    description: z.string().optional(),
    voice_id: z.string().min(1, "Please select a voice"),
    first_message: z.string().min(3, "First message is required"),
    system_prompt: z.string().min(10, "System prompt must be at least 10 characters"),
    template_id: z.string().optional(),
    llm_model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    language: z.string().optional(),
    max_duration_seconds: z.number().min(60).max(7200).optional(),
    knowledge_documents: z.array(z.object({
        type: z.enum(['file', 'url', 'text']),
        name: z.string(),
        content: z.string().optional(),
        url: z.string().optional(),
        file: z.any().optional(),
    })).optional(),
    tools: z.array(z.string()).optional(),
});

// Constants (assuming these are available or defined elsewhere)
const llmModels = [
    { id: "gpt-4o-mini", name: "GPT-4O Mini (Recommended)", description: "Best for most use cases" },
    { id: "gpt-4o", name: "GPT-4O", description: "Most capable model" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Fast and capable" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and cost-effective" }
];
const languages = [
    { id: "en", name: "English" }, { id: "es", name: "Spanish" }, { id: "fr", name: "French" },
    { id: "de", name: "German" }, { id: "it", name: "Italian" }, { id: "pt", name: "Portuguese" },
    { id: "hi", name: "Hindi" }, { id: "ja", name: "Japanese" }, { id: "ko", name: "Korean" }, { id: "zh", name: "Chinese" }
];
const availableTools = [
    { id: "web_search", name: "Web Search", description: "Search the internet for current information", icon: SearchIcon },
    { id: "calculator", name: "Calculator", description: "Perform mathematical calculations", icon: Calculator },
    { id: "calendar", name: "Calendar", description: "Access calendar and scheduling functions", icon: Calendar },
    { id: "email", name: "Email", description: "Send and manage email communications", icon: Mail }
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

type Voice = {
    id: string;
    voice_id: string;
    provider: string;
    name: string;
    model: string;
    accent: string;
    tags?: string;
    demo?: string;
};

type AgentData = {
    _id: string;
    name: string;
    description?: string;
    voiceId: string;
    voiceProvider?: string;
    voiceModel?: string;
    firstMessage: string;
    systemPrompt: string;
    templateId?: string;
    llmModel?: string;
    temperature?: number;
    language?: string;
    maxDurationSeconds?: number;
    knowledgeVectorIds?: string[];
    tools?: string[];
};

export default function EditAgentPage() {
    const router = useRouter();
    const params = useParams();
    const agentId = params.id as string;

    // Fetch existing agent data
    const { data: agentData, error: agentError, isLoading: isAgentLoading } = useSWR<AgentData>(agentId ? `/api/agents/${agentId}` : null, fetcher);

    // Fetch available voices
    const { data: voicesData, error: voicesError, isLoading: areVoicesLoading } = useSWR<{ voices: Voice[] }>("/api/voices", fetcher);

    const [updatingAgent, setUpdatingAgent] = useState(false);
    const [voiceSearch, setVoiceSearch] = useState("");
    const [selectedProvider, setSelectedProvider] = useState<string>("all");
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const allVoices: Voice[] = voicesData?.voices || [];
    const providers = Array.from(new Set(allVoices.map(v => v.provider))).sort();

    const form = useForm<z.infer<typeof agentSchema>>({
        resolver: zodResolver(agentSchema),
        defaultValues: {
            name: "",
            description: "",
            voice_id: "",
            first_message: "",
            system_prompt: "",
            llm_model: "gpt-4o-mini",
            temperature: 0.3,
            language: "en",
            max_duration_seconds: 1800,
            knowledge_documents: [],
            tools: [],
        }
    });

    // Populate form with fetched agent data
    useEffect(() => {
        if (agentData) {
            form.reset({
                name: agentData.name,
                description: agentData.description || "",
                voice_id: agentData.voiceId,
                first_message: agentData.firstMessage,
                system_prompt: agentData.systemPrompt,
                template_id: agentData.templateId || "",
                llm_model: agentData.llmModel || "gpt-4o-mini",
                temperature: agentData.temperature || 0.3,
                language: agentData.language || "en",
                max_duration_seconds: agentData.maxDurationSeconds || 1800,
                tools: agentData.tools || [],
                // knowledge_documents are not directly editable in this UI yet
            });
        }
    }, [agentData, form]);

    // Voice playback logic
    useEffect(() => {
        audioRef.current = new Audio();
        const audio = audioRef.current;
        const onEnded = () => setPlayingVoiceId(null);
        audio.addEventListener("ended", onEnded);
        return () => {
            audio.removeEventListener("ended", onEnded);
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    const filteredVoices = allVoices.filter(v => {
        const providerMatch = selectedProvider === "all" || v.provider === selectedProvider;
        const search = voiceSearch.toLowerCase();
        const searchMatch = (v.name || "").toLowerCase().includes(search) ||
            (v.accent || "").toLowerCase().includes(search) ||
            (v.provider || "").toLowerCase().includes(search);
        return providerMatch && searchMatch;
    });

    const handlePlayVoice = (e: React.MouseEvent, voiceId: string, demoUrl?: string) => {
        e.stopPropagation();
        if (!audioRef.current || !demoUrl) return;

        if (playingVoiceId === voiceId) {
            audioRef.current.pause();
            setPlayingVoiceId(null);
        } else {
            if (audioRef.current.src && playingVoiceId) {
                audioRef.current.pause();
            }
            audioRef.current.src = demoUrl;
            audioRef.current.play();
            setPlayingVoiceId(voiceId);
        }
    };

    const handleProviderChange = (providerId: string) => {
        setSelectedProvider(providerId);
        form.setValue("voice_id", "");
        if (audioRef.current) {
            audioRef.current.pause();
            setPlayingVoiceId(null);
        }
    };

    const onSubmit = async (payload: z.infer<typeof agentSchema>) => {
        try {
            setUpdatingAgent(true);

            const selectedVoice = allVoices.find(v => v.id === payload.voice_id);
            if (!selectedVoice) {
                form.setError("voice_id", { type: "manual", message: "Please select a valid voice." });
                setUpdatingAgent(false);
                return;
            }

            // Construct the update payload for the PUT request
            const updateData = {
                name: payload.name,
                description: payload.description,
                firstMessage: payload.first_message,
                systemPrompt: payload.system_prompt,
                llmModel: payload.llm_model,
                temperature: payload.temperature,
                language: payload.language,
                maxDurationSeconds: payload.max_duration_seconds,
                tools: payload.tools,
                // Voice details must be sent for Bolna to reconstruct the synthesizer
                voiceId: selectedVoice.id,
                voiceName: selectedVoice.name,
                voiceProvider: selectedVoice.provider,
                voiceModel: selectedVoice.model,
            };

            const response = await fetch(`/api/agents/${agentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update agent");
            }

            router.push("/dashboard/agents");
            router.refresh(); // To show updated data on the agents list page

        } catch (error) {
            console.error("Error updating agent:", error);
            // You might want to show a toast notification here
        } finally {
            setUpdatingAgent(false);
        }
    };

    if (isAgentLoading) {
        return (
            <div className="min-h-screen text-foreground flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#A7A7A7]" />
                <p className="ml-2">Loading agent...</p>
            </div>
        );
    }

    if (agentError) {
        return <div className="text-red-500 text-center p-8">Failed to load agent data.</div>;
    }

    const maxDuration = form.watch("max_duration_seconds") || 1800;

    const containerVariant = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const fadeInUpVariant = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    };

    return (
        <div className="min-h-screen text-foreground flex">
            <main className="flex-1 h-screen overflow-y-auto bg-[#111111]">
                <DashboardHeader />
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                            <div>
                                <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-[#A7A7A7] hover:text-[#F3FFD4]" onClick={() => router.push('/dashboard/agents')}>
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Agents
                                </Button>
                                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F3FFD4]">Edit AI Voice Agent</h1>
                                <p className="text-[#A7A7A7] mt-2 text-lg">Modify your conversational AI assistant.</p>
                            </div>
                        </div>

                        <motion.div initial="hidden" animate="visible" variants={containerVariant}>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
                                    <motion.div variants={fadeInUpVariant}>
                                        <Tabs defaultValue="basic" className="w-full">
                                            <TabsList className="grid w-full grid-cols-4 bg-[#1a1a1a] border border-[#333333] p-1 h-auto">
                                                <TabsTrigger value="basic">Basic</TabsTrigger>
                                                <TabsTrigger value="behavior">Behavior</TabsTrigger>
                                                <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
                                                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                                            </TabsList>
                                            <div className="mt-6">
                                                <TabsContent value="basic" className="m-0">
                                                    <Card className="border-[#333333] bg-[#1a1a1a] shadow-md">
                                                        <CardHeader><CardTitle className="text-[#F3FFD4]">Agent Identity</CardTitle><CardDescription className="text-[#A7A7A7]">Define your AI assistant's name and purpose.</CardDescription></CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Agent Name</FormLabel>
                                                                    <FormControl><Input placeholder="e.g., Sales Assistant" {...field} /></FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="voice_id" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Voice Selection</FormLabel>
                                                                    <div className="flex items-center space-x-2">
                                                                        <div className="flex-grow">
                                                                            <Label className="text-[#A7A7A7] flex items-center gap-1 mb-1">
                                                                                <Server className="h-4 w-4" /> Voice Provider
                                                                            </Label>
                                                                            <Select onValueChange={handleProviderChange} defaultValue={selectedProvider}>
                                                                                <SelectTrigger className="w-full">
                                                                                    <SelectValue placeholder="Select a provider" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="all">All Providers</SelectItem>
                                                                                    {providers.map(p => (
                                                                                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="flex-grow">
                                                                            <Label className="text-[#A7A7A7] flex items-center gap-1 mb-1">
                                                                                <Search className="h-4 w-4" /> Search Voice
                                                                            </Label>
                                                                            <Input placeholder="Search voices..." value={voiceSearch} onChange={(e) => setVoiceSearch(e.target.value)} />
                                                                        </div>
                                                                    </div>
                                                                    <FormDescription className="text-red-400">
                                                                        {selectedProvider !== "all" && `Showing voices for provider: ${selectedProvider}`}
                                                                        {field.value && !filteredVoices.find(v => v.id === field.value) && "The previously selected voice is not visible with the current filter. Please select a new one."}
                                                                    </FormDescription>
                                                                    <FormControl>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                                                                            {areVoicesLoading ? <p className="text-[#A7A7A7]">Loading voices...</p> :
                                                                                voicesError ? <p className="text-red-400">Failed to load voices.</p> :
                                                                                    filteredVoices.length === 0 ? <p className="text-[#A7A7A7]">No voices match your filters.</p> :
                                                                                        filteredVoices.map(voice => (
                                                                                            <div
                                                                                                key={voice.id}
                                                                                                onClick={() => field.onChange(voice.id)}
                                                                                                className={cn(
                                                                                                    "border rounded-lg p-3 cursor-pointer flex justify-between items-center border-[#333333] transition-all",
                                                                                                    field.value === voice.id ? "ring-2 ring-[#A7B3AC] border-[#A7B3AC] bg-[#A7B3AC]/10" : "hover:bg-white/5 bg-[#111111]/50"
                                                                                                )}>
                                                                                                <div>
                                                                                                    <p className="font-medium text-[#F3FFD4]">{voice.name || "Unnamed Voice"}</p>
                                                                                                    <p className="text-xs text-[#A7A7A7]">{voice.accent}</p>
                                                                                                    <Badge variant="outline" className="mt-1 text-xs px-1 py-0 border-[#A7A7A7] text-[#A7A7A7]/80">{voice.provider}</Badge>
                                                                                                </div>
                                                                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-[#A7B3AC]/20"
                                                                                                    onClick={(e) => handlePlayVoice(e, voice.id, voice.demo)}
                                                                                                    disabled={!voice.demo}
                                                                                                    title={voice.demo ? "Play voice" : "Demo not available"}
                                                                                                >
                                                                                                    {playingVoiceId === voice.id ? (
                                                                                                        <PauseCircle className="h-5 w-5 text-[#A7B3AC]" />
                                                                                                    ) : (
                                                                                                        <PlayCircle className="h-5 w-5 text-[#A7B3AC]" />
                                                                                                    )}
                                                                                                </Button>
                                                                                            </div>
                                                                                        ))}
                                                                        </div>
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </CardContent>
                                                    </Card>
                                                </TabsContent>

                                                <TabsContent value="behavior" className="m-0">
                                                    <Card className="border-[#333333] bg-[#1a1a1a] shadow-md">
                                                        <CardHeader><CardTitle className="text-[#F3FFD4]">Agent Behavior</CardTitle><CardDescription className="text-[#A7A7A7]">Define how your agent communicates and responds.</CardDescription></CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <FormField control={form.control} name="system_prompt" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">System Prompt</FormLabel>
                                                                    <FormControl><Textarea rows={8} placeholder="You are a friendly AI assistant..." {...field} /></FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="first_message" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">First Message</FormLabel>
                                                                    <FormControl><Textarea rows={3} placeholder="Hello! How can I help you today?" {...field} /></FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </CardContent>
                                                    </Card>
                                                </TabsContent>

                                                <TabsContent value="knowledge" className="m-0">
                                                    <Card className="border-[#333333] bg-[#1a1a1a] shadow-md">
                                                        <CardHeader><CardTitle className="text-[#F3FFD4]">Knowledge & Tools</CardTitle><CardDescription className="text-[#A7A7A7]">This section is not yet editable.</CardDescription></CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <div>
                                                                <Label className="text-[#A7A7A7] font-semibold">Knowledge Base</Label>
                                                                <p className="text-sm text-[#A7A7A7]/80 mb-4">Editing knowledge base documents is coming soon.</p>
                                                            </div>
                                                            <Separator className="bg-[#333333]" />
                                                            <div>
                                                                <Label className="text-[#A7A7A7] font-semibold">Tools</Label>
                                                                <p className="text-sm text-[#A7A7A7]/80 mb-4">Enable tools for your agent to perform actions.</p>
                                                                <FormField control={form.control} name="tools" render={({ field }) => (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        {availableTools.map((tool) => (
                                                                            <div key={tool.id} onClick={() => { const current = field.value || []; const updated = current.includes(tool.id) ? current.filter(t => t !== tool.id) : [...current, tool.id]; field.onChange(updated); }} className={cn("border rounded-lg p-3 cursor-pointer flex items-center gap-3 border-[#333333] hover:bg-white/5", field.value?.includes(tool.id) && "ring-2 ring-[#A7B3AC] border-[#A7B3AC]")}>
                                                                                <tool.icon className="h-5 w-5 text-[#A7B3AC]" />
                                                                                <div><p className="font-medium text-sm text-[#F3FFD4]">{tool.name}</p><p className="text-xs text-[#A7A7A7]">{tool.description}</p></div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )} />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </TabsContent>

                                                <TabsContent value="advanced" className="m-0">
                                                    <Card className="border-[#333333] bg-[#1a1a1a] shadow-md">
                                                        <CardHeader><CardTitle className="text-[#F3FFD4]">Advanced Settings</CardTitle><CardDescription className="text-[#A7A7A7]">Fine-tune the technical parameters of your agent.</CardDescription></CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <FormField control={form.control} name="llm_model" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Language Model</FormLabel>
                                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                        <SelectContent>{llmModels.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="temperature" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Temperature: {field.value}</FormLabel>
                                                                    <FormControl><Slider min={0} max={1} step={0.1} value={[field.value || 0.3]} onValueChange={(v) => field.onChange(v[0])} /></FormControl>
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="language" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Primary Language</FormLabel>
                                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                        <SelectContent>{languages.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="max_duration_seconds" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[#A7A7A7]">Max Call Duration: {Math.floor(maxDuration / 60)} minutes</FormLabel>
                                                                    <FormControl><Slider min={60} max={7200} step={60} value={[field.value || 1800]} onValueChange={(v) => field.onChange(v[0])} /></FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </CardContent>
                                                    </Card>
                                                </TabsContent>
                                            </div>
                                        </Tabs>
                                    </motion.div>

                                    <motion.div variants={fadeInUpVariant} className="flex justify-end space-x-4">
                                        <Button type="button" variant="outline" className="border-[#333333] hover:bg-white/5 text-[#A7A7A7] hover:text-[#F3FFD4]" onClick={() => router.push('/dashboard/agents')}>Cancel</Button>
                                        <Button type="submit" disabled={updatingAgent || !form.formState.isValid} className="gap-2 min-w-[160px] bg-[#A7B3AC] text-[#111111] hover:bg-[#A7B3AC]/90 font-bold">
                                            {updatingAgent ? (<><Loader2 className="h-4 w-4 animate-spin" /> Updating Agent...</>) : (<><Sparkles className="h-4 w-4" />Save Changes</>)}
                                        </Button>
                                    </motion.div>
                                </form>
                            </Form>
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
}