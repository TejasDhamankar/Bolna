"use client";

import { useState, useEffect, useRef, JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

// UI Components
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

// Icons
import {
  ArrowDownToLine, Phone, Search, X, MoreHorizontal, PlayCircle, Bot, User,
  Pause, RotateCcw, RotateCw, Info, PhoneOff, Loader2, AlertCircle,
  CheckCircle, XCircle, Clock, VolumeX
} from "lucide-react";

type Call = {
  _id: string;
  contactName: string;
  phoneNumber: string;
  status: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  agentId: string;
  agentName?: string;
  transcription?: string;
  summary?: string;
  notes?: string;
  conversationId?: string;
  outcome?: string;

  // Bolna fields
  recording_url?: string;
  telephony_data?: {
    duration: number;
    to_number: string;
    from_number: string;
  };
  conversation_time?: number;
  updated_at?: string;
};

export default function CallHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Fetch Call History
  useEffect(() => {
    fetchCalls();
  }, [currentPage, searchTerm, statusFilter, dateRange]);

  const fetchCalls = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: "20" });
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);
      if (dateRange?.from) params.append("startDate", dateRange.from.toISOString());
      if (dateRange?.to) params.append("endDate", dateRange.to.toISOString());

      const res = await fetch(`/api/calls/history?${params.toString()}`);
      const data = await res.json();

      setCalls(data.calls || []);
      setTotalPages(data.pagination.pages);
    } catch {
      setError("Failed to load call history");
    }

    setLoading(false);
  };
  // ================================
  // VIEW DETAILS (Load Execution Data)
  // ================================
  const handleViewDetails = async (call: Call) => {
    setSelectedCall(call);

    if (!call.conversationId) return;

    setIsDetailsLoading(true);

    try {
      console.log("[Frontend] Fetching execution:", call.conversationId);

      const res = await fetch(`/api/executions/${call.conversationId}`);
      const data = await res.json();

      console.log("[Execution Data]", data);

      // Merge execution data with existing call
      const updatedCall = {
        ...call,
        transcript: data.transcript,
        recording_url: data.recording_url || data.telephony_data?.recording_url,
        telephony_data: data.telephony_data,
        conversation_time: data.conversation_time,
      };

      setSelectedCall(updatedCall);

      // Update call in displayed list
      setCalls(prev =>
        prev.map(c => (c._id === call._id ? updatedCall : c))
      );
    } catch (err) {
      console.log("Error fetching execution details:", err);
    }

    setIsDetailsLoading(false);
  };

  // ========================
  // AUDIO PLAYER MANAGEMENT
  // ========================
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectedCall) return;

    // Reset audio state
    setIsPlaying(false);
    setAudioDuration(0);
    setAudioTime(0);
    setAudioError(null);

    if (!selectedCall.recording_url) return;

    console.log("[AUDIO] Trying to load:", selectedCall.recording_url);

    audio.src = selectedCall.recording_url;
    audio.load();

    const handleLoaded = () => {
      setAudioDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setAudioTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [selectedCall]);

  // ============
  // AUDIO CONTROLS
  // ============
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  const handleRewind = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  };

  const handleForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(
      audioDuration,
      audioRef.current.currentTime + 10
    );
  };

  const handleTimeChange = (val: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = val[0];
  };

  const formatTime = (sec: number) => {
    if (!sec) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };
  // ===============
  // RENDER / JSX
  // ===============
  const fadeInUpVariant = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <div className="min-h-screen text-foreground flex bg-[#111111]">
      <main className="flex-1 overflow-y-auto h-fit max-h-screen">
        <DashboardHeader />
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <motion.div initial="hidden" animate="visible" variants={fadeInUpVariant} className="mb-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#F3FFD4]">Call History</h1>
                <p className="text-[#A7A7A7] mt-1">Complete record of all AI voice calls</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => {/* implement export if needed */}}>
                  <ArrowDownToLine className="h-4 w-4" /> Export
                </Button>
                <Button onClick={() => router.push('/dashboard/calls')}>
                  <Phone className="h-4 w-4" /> New Call
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeInUpVariant} className="mb-6">
            <Card className="p-4 bg-[#1a1a1a] border-[#333333]">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#A7A7A7]" />
                  <Input placeholder="Search by contact or phone..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>

                <Select value={statusFilter || "All"} onValueChange={val => setStatusFilter(val === 'All' ? null : val)}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="no-answer">No Answer</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-shrink-0">
                  <DateRangePicker date={dateRange} setDate={setDateRange} />
                </div>

                {(searchTerm || statusFilter || dateRange?.from) && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter(null); setDateRange(undefined); }} className="h-10">
                    <X className="h-4 w-4 mr-2" /> Clear Filters
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeInUpVariant}>
            <Card className="bg-[#1a1a1a] border-[#333333]">
              {loading ? (
                <CardContent className="p-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center py-4 border-b border-[#333333] last:border-0">
                      <Skeleton className="h-10 w-10 rounded-full bg-[#333333]" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-1/3 bg-[#333333]" />
                        <Skeleton className="h-4 w-1/4 bg-[#333333]" />
                      </div>
                      <Skeleton className="h-6 w-24 bg-[#333333] rounded-md" />
                      <Skeleton className="h-6 w-28 bg-[#333333] rounded-md hidden lg:block" />
                    </div>
                  ))}
                </CardContent>
              ) : error ? (
                <CardContent className="p-6 text-center py-12">
                  <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
                  <p className="text-red-400">Error: {error}</p>
                </CardContent>
              ) : calls.length === 0 ? (
                <CardContent className="p-6 text-center py-12">
                  <PhoneOff className="mx-auto h-10 w-10 text-[#A7A7A7] mb-3" />
                  <h3 className="text-xl font-medium text-[#F3FFD4] mb-1">No Calls Found</h3>
                  <p className="text-[#A7A7A7]">Try adjusting your filters or make a new call.</p>
                </CardContent>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#333333]">
                      <thead className="bg-[#111111]">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm text-[#A7A7A7]">Contact</th>
                          <th className="px-4 py-3 text-left text-sm text-[#A7A7A7]">Status</th>
                          <th className="px-4 py-3 text-left text-sm text-[#A7A7A7] hidden lg:table-cell">Outcome</th>
                          <th className="px-4 py-3 text-left text-sm text-[#A7A7A7] hidden md:table-cell">Agent</th>
                          <th className="px-4 py-3 text-left text-sm text-[#A7A7A7] hidden lg:table-cell">Date</th>
                          <th className="px-4 py-3 text-right text-sm text-[#A7A7A7]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#111111] divide-y divide-[#333333]">
                        {calls.map(call => (
                          <tr key={call._id} className="cursor-pointer hover:bg-[#161616]" onClick={() => handleViewDetails(call)}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#F3FFD4]">{call.contactName}</div>
                              <div className="text-xs text-[#A7A7A7]">{call.phoneNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20"> {call.status}</Badge>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">{call.outcome || '-'}</td>
                            <td className="px-4 py-3 hidden md:table-cell text-[#A7A7A7]">{call.agentName || "-"}</td>
                            <td className="px-4 py-3 hidden lg:table-cell text-[#A7A7A7]">{call.startTime ? format(new Date(call.startTime), "MMM d, h:mm a") : "-"}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#A7A7A7] hover:bg-[#333333]">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewDetails(call)}><Info className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/dashboard/calls/new?phone=${call.phoneNumber}&name=${encodeURIComponent(call.contactName || 'Unknown')}&agent=${call.agentId}`); }}>
                                      <Phone className="h-4 w-4 mr-2" />Call Again
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination (simple) */}
                  {totalPages > 1 && (
                    <div className="py-4 border-t border-[#333333] flex justify-center">
                      <div className="space-x-2">
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</Button>
                        <span className="text-sm text-[#A7A7A7]">Page {currentPage} / {totalPages}</span>
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </motion.div>
        </div>
      </main>

      {/* DETAILS DIALOG */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => { if (!open) setSelectedCall(null); }}>
        <DialogContent className="sm:max-w-[800px] w-full max-h-[90vh] overflow-y-auto bg-[#1a1a1a] border-[#333333]">
          <DialogHeader>
            <DialogTitle className="text-[#F3FFD4]">Call Details</DialogTitle>
            <DialogDescription className="text-[#A7A7A7]">Complete information about this call</DialogDescription>
          </DialogHeader>

          {isDetailsLoading ? (
            <div className="py-10 flex items-center justify-center"><Loader2 className="animate-spin h-6 w-6 mr-3" /><span className="text-[#A7A7A7]">Loading details…</span></div>
          ) : selectedCall ? (
            <div className="space-y-6 text-[#F3FFD4]">
              <div className="flex items-center gap-4">
                <Avatar><AvatarFallback className="bg-[#A7B3AC]/10 text-[#A7B3AC]">{(selectedCall.contactName?.charAt(0) || 'U')}</AvatarFallback></Avatar>
                <div>
                  <h3 className="font-medium text-lg">{selectedCall.contactName}</h3>
                  <p className="text-[#A7A7A7]">{selectedCall.phoneNumber}</p>
                </div>
                <div className="ml-auto">
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">{selectedCall.status}</Badge>
                </div>
              </div>

              <Separator className="bg-[#333333]" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[#A7A7A7]">Agent</p>
                  <p className="font-medium">{selectedCall.agentName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A7A7A7]">Start Time</p>
                  <p>{selectedCall.startTime ? format(new Date(selectedCall.startTime), "MMM d, yyyy h:mm a") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A7A7A7]">Duration</p>
                  <p>{selectedCall.telephony_data?.duration ? `${Math.floor(selectedCall.telephony_data.duration / 60)}m ${selectedCall.telephony_data.duration % 60}s` : (selectedCall.duration ? `${Math.floor(selectedCall.duration/60)}m ${selectedCall.duration%60}s` : "—")}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A7A7A7]">Updated</p>
                  <p>{selectedCall.updated_at ? format(new Date(selectedCall.updated_at), "MMM d, yyyy h:mm a") : "-"}</p>
                </div>
              </div>

              <Tabs defaultValue="transcript" className="space-y-4">
                <TabsList className="w-full grid grid-cols-3 bg-[#222222] border-[#333333]">
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="recording">Recording</TabsTrigger>
                </TabsList>

                <TabsContent value="transcript">
                  {selectedCall.transcript ? (
                    <ScrollArea className="h-[240px] p-3">
                      <div className="p-3 bg-[#222222] rounded-md text-sm border border-[#333333] whitespace-pre-wrap text-[#E6E6E6]">
                        {selectedCall.transcript}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-[#A7A7A7] text-sm text-center py-6">Transcript not available.</p>
                  )}
                </TabsContent>

                <TabsContent value="summary">
                  {selectedCall.summary ? (
                    <div className="p-3 bg-[#222222] rounded-md text-sm border border-[#333333]">{selectedCall.summary}</div>
                  ) : (
                    <p className="text-[#A7A7A7] text-sm text-center py-6">Summary not available.</p>
                  )}
                </TabsContent>

                <TabsContent value="recording">
                  {isAudioLoading ? (
                    <div className="py-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" /><p className="text-[#A7A7A7]">Loading audio...</p></div>
                  ) : audioError && !selectedCall.recording_url ? (
                    <div className="py-8 text-center"><AlertCircle className="h-8 w-8 text-yellow-400 mx-auto mb-2" /><p className="text-yellow-400">Audio not available</p></div>
                  ) : selectedCall.recording_url ? (
                    <div className="space-y-4">
                      <audio ref={audioRef} preload="metadata" className="hidden" />
                      <div className="bg-[#222222] rounded-lg p-4 space-y-4 border border-[#333333]">
                        <div className="flex items-center justify-between text-sm">
                          <div>{formatTime(audioTime)} / {formatTime(audioDuration)}</div>
                          <div className="text-xs text-[#A7A7A7]">{selectedCall.telephony_data?.to_number || ''}</div>
                        </div>

                        <Slider value={[audioTime]} max={audioDuration || 100} step={0.1} onValueChange={handleTimeChange} />

                        <div className="flex items-center justify-center gap-3">
                          <Button variant="ghost" size="icon" onClick={handleRewind}><RotateCcw className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={togglePlayPause}>
                            {isPlaying ? <Pause className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={handleForward}><RotateCw className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center"><VolumeX className="h-8 w-8 text-[#A7A7A7] mx-auto mb-2" /><p className="text-[#A7A7A7]">Recording not available.</p></div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex flex-wrap gap-3 sm:gap-2 pt-4">
                <Button variant="outline" onClick={() => { router.push(`/dashboard/calls/new?phone=${selectedCall.phoneNumber}&name=${encodeURIComponent(selectedCall.contactName || 'Unknown')}&agent=${selectedCall.agentId}`); setSelectedCall(null); }}>
                  <Phone className="h-4 w-4 mr-2" /> Call Again
                </Button>
                <DialogClose asChild>
                  <Button onClick={() => setSelectedCall(null)}>Close</Button>
                </DialogClose>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
