import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Settings, Loader2, Archive, ChevronDown, ChevronUp, Copy, ClipboardPaste, Trash2, Pencil, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-is-admin";
import AddCompetitionDialog from "@/components/AddCompetitionDialog";
import EditCompetitionDialog from "@/components/EditCompetitionDialog";
import AddCustomEventDialog from "@/components/AddCustomEventDialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { Competition } from "@/types/dashboard";

interface EventType {
  id: string;
  competition_id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

function CustomBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-xs font-bold text-primary">{count} gare</span>
    </div>
  );
}

export default function CompetitionEnrollments() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompetitionForEvents, setSelectedCompetitionForEvents] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [clipboardEvents, setClipboardEvents] = useState<Omit<EventType, 'id' | 'competition_id'>[]>([]);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAnyAdmin, loading: adminLoading } = useIsAdmin();

  const activeCompetitions = competitions.filter(c => !c.is_completed);
  const archivedCompetitions = competitions.filter(c => c.is_completed);

  useEffect(() => {
    if (adminLoading) return;
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      if (!isAnyAdmin) {
        navigate("/dashboard");
        return;
      }
      fetchData();
      
      // Load clipboard
      try {
        const saved = localStorage.getItem("dance_manager_copied_events");
        if (saved) {
          setClipboardEvents(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to load clipboard", e);
      }
    };
    checkAuth();
  }, [navigate, adminLoading, isAnyAdmin]);

  const fetchData = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true);
    try {
      const [competitionsRes, eventTypesRes] = await Promise.all([
        supabase
          .from("competitions")
          .select("*")
          .eq("is_deleted", false)
          .order("date", { ascending: true }) as any,
        supabase
          .from("competition_event_types")
          .select("*")
          .order("event_name", { ascending: true }) as any
      ]);

      if (competitionsRes.data) {
        const unique = new Map();
        (competitionsRes.data as any[]).forEach(c => {
          const key = `${c.name?.toLowerCase() || ""}-${c.date}`;
          if (!unique.has(key)) unique.set(key, c);
        });
        setCompetitions(Array.from(unique.values()));
      }
      if (eventTypesRes.data) setEventTypes(eventTypesRes.data as EventType[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (!isRefetch) setLoading(false);
    }
  };

  const getCompetitionEventTypes = (competitionId: string) => {
    const events = eventTypes.filter(e => e.competition_id === competitionId);
    
    return events.sort((a, b) => {
      const nameA = a.event_name.toLowerCase();
      const nameB = b.event_name.toLowerCase();
      
      const isAtEndA = nameA.includes("over") || nameA.includes("under") || nameA.includes("open") || nameA.includes("master");
      const isAtEndB = nameB.includes("over") || nameB.includes("under") || nameB.includes("open") || nameB.includes("master");
      
      if (isAtEndA && !isAtEndB) return 1;
      if (!isAtEndA && isAtEndB) return -1;
      
      let minAgeA = a.min_age;
      if (minAgeA === null) {
        minAgeA = (nameA.includes("master") || nameA.includes("over") || nameA.includes("adult")) ? 99 : 0;
      }
      
      let minAgeB = b.min_age;
      if (minAgeB === null) {
        minAgeB = (nameB.includes("master") || nameB.includes("over") || nameB.includes("adult")) ? 99 : 0;
      }
      
      if (minAgeA !== minAgeB) {
        return minAgeA - minAgeB;
      }
      
      const maxAgeA = a.max_age ?? 999;
      const maxAgeB = b.max_age ?? 999;
      
      if (maxAgeA !== maxAgeB) {
        return maxAgeA - maxAgeB;
      }
      
      return a.event_name.localeCompare(b.event_name);
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Sei sicuro di voler eliminare questa gara?")) return;
    
    try {
      const { error } = await supabase.from("competition_event_types").delete().eq("id", eventId);
      if (error) throw error;
      toast({ title: "Gara eliminata" });
      setSelectedEvents(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      fetchData(true);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile eliminare la gara", variant: "destructive" });
    }
  };

  const handleDeleteSelected = async (competitionId: string) => {
    if (!isAdmin) return;
    const eventsToDelete = Array.from(selectedEvents);
    if (eventsToDelete.length === 0) return;
    if (!window.confirm(`Sei sicuro di voler eliminare ${eventsToDelete.length} gare selezionate?`)) return;
    
    try {
      const { error } = await supabase.from("competition_event_types").delete().in("id", eventsToDelete);
      if (error) throw error;
      toast({ title: "Gare eliminate", description: `${eventsToDelete.length} gare sono state rimosse.` });
      setSelectedEvents(new Set());
      fetchData(true);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile eliminare le gare", variant: "destructive" });
    }
  };

  const handleSelectAll = (competitionId: string) => {
    const compEvents = getCompetitionEventTypes(competitionId);
    const allIds = compEvents.map(e => e.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedEvents.has(id));
    
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleCopySingleEvent = (event: EventType) => {
    const toCopy = [{
      event_name: event.event_name,
      allowed_classes: event.allowed_classes,
      min_age: event.min_age,
      max_age: event.max_age
    }];
    setClipboardEvents(toCopy);
    localStorage.setItem("dance_manager_copied_events", JSON.stringify(toCopy));
    toast({ title: "Gara copiata", description: "Ora puoi incollarla in un'altra competizione" });
  };

  const handleCopyAllEvents = (competitionId: string) => {
    const events = getCompetitionEventTypes(competitionId);
    if (events.length === 0) return;
    
    const toCopy = events.map(e => ({
      event_name: e.event_name,
      allowed_classes: e.allowed_classes,
      min_age: e.min_age,
      max_age: e.max_age
    }));
    
    setClipboardEvents(toCopy);
    localStorage.setItem("dance_manager_copied_events", JSON.stringify(toCopy));
    toast({ title: "Gare copiate", description: `${events.length} gare copiate in memoria` });
  };

  const handlePasteEvents = async (competitionId: string) => {
    if (!isAdmin || clipboardEvents.length === 0) return;
    
    try {
      const toInsert = clipboardEvents.map(e => ({
        competition_id: competitionId,
        event_name: e.event_name,
        allowed_classes: e.allowed_classes,
        min_age: e.min_age,
        max_age: e.max_age
      }));

      const { error } = await supabase.from("competition_event_types").insert(toInsert);
      if (error) throw error;

      toast({ title: "Successo", description: `${toInsert.length} gare incollate correttamente` });
      fetchData(true);
    } catch (error) {
      console.error("Paste error", error);
      toast({ title: "Errore", description: "Impossibile incollare le gare", variant: "destructive" });
    }
  };

  const handleToggleArchive = async (competitionId: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    setArchivingId(competitionId);
    try {
      const { error } = await supabase
        .from("competitions")
        .update({ is_completed: !currentStatus } as any)
        .eq("id", competitionId);

      if (error) throw error;

      toast({
        title: !currentStatus ? "Competizione archiviata" : "Competizione ripristinata",
        description: !currentStatus 
          ? "La competizione è stata spostata nell'archivio delle gare passate." 
          : "La competizione è stata ripristinata tra le gare attive."
      });
      await fetchData(true);
    } catch (error) {
      console.error("Error toggling archive status:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato di archiviazione",
        variant: "destructive"
      });
    } finally {
      setArchivingId(null);
    }
  };

  const formatDate = (date: string, endDate?: string | null) => {
    const start = new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    if (endDate && endDate !== date) {
      const end = new Date(endDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
      return `${start} - ${end}`;
    }
    return new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <main className="container mx-auto px-4 py-8 space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-accent/10 dark:bg-accent/20 rounded-3xl flex items-center justify-center shadow-xl shadow-accent/10 border border-accent/20">
              <Trophy className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Gestione Gare</h1>
              <p className="text-muted-foreground font-medium">Configura regolamenti e gare per le competizioni</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Torna al Menù
            </Button>
            {isAdmin && <AddCompetitionDialog onSuccess={() => fetchData(true)} />}
          </div>
        </motion.div>
        
        {!isAdmin && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-warning">Solo gli amministratori possono modificare le regole delle classi.</p>
          </div>
        )}

        {activeCompetitions.length === 0 ? (
          <div className="py-20 text-center glass rounded-3xl">
            <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-display font-bold mb-2">Nessuna competizione attiva</h3>
            <p className="text-muted-foreground">Inizia aggiungendo una nuova competizione tramite il pulsante "+" in alto.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCompetitions.map((competition, idx) => {
              const compEvents = getCompetitionEventTypes(competition.id);
              const isExpanded = selectedCompetitionForEvents === competition.id;

              return (
                <motion.div
                  key={competition.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="overflow-hidden glass-card transition-all hover:shadow-xl border-white/10">
                    <CardHeader
                      className="cursor-pointer group py-6 px-8"
                      onClick={() => setSelectedCompetitionForEvents(isExpanded ? null : competition.id)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1">
                          <div className="flex flex-col gap-1 min-w-[240px]">
                            <div className="flex items-center gap-3">
                              <span className="font-display font-bold text-xl tracking-tight leading-none group-hover:text-primary transition-colors">
                                {competition.name}
                              </span>
                              {isAdmin && (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <EditCompetitionDialog 
                                    competition={competition} 
                                    onSuccess={() => fetchData(true)} 
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-xl"
                                    onClick={() => handleToggleArchive(competition.id, false)}
                                    disabled={archivingId === competition.id}
                                    title="Archivia competizione"
                                  >
                                    {archivingId === competition.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Archive className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">{formatDate(competition.date, competition.end_date)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <CustomBadge count={compEvents.length} />
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="text-muted-foreground group-hover:text-primary transition-colors"
                          >
                            <Settings className="w-5 h-5" />
                          </motion.div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <CardContent className="pt-0 pb-8 px-8">
                            <div className="pt-6 border-t border-white/5">
                              {isAdmin && (
                                <div className="flex items-center gap-3 mb-6 bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/10">
                                  <AddCustomEventDialog competitionId={competition.id} onSuccess={() => fetchData(true)} />
                                  <div className="w-px h-6 bg-border mx-2"></div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleSelectAll(competition.id)}
                                    disabled={compEvents.length === 0}
                                    className="gap-2"
                                  >
                                    <Checkbox 
                                      checked={compEvents.length > 0 && compEvents.every(e => selectedEvents.has(e.id))} 
                                      className="pointer-events-none"
                                    /> Seleziona Tutte
                                  </Button>
                                  {Array.from(selectedEvents).some(id => compEvents.some(e => e.id === id)) ? (
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      onClick={() => handleDeleteSelected(competition.id)}
                                      className="gap-2 ml-auto"
                                    >
                                      <Trash2 className="w-4 h-4" /> Elimina Selezionate ({Array.from(selectedEvents).filter(id => compEvents.some(e => e.id === id)).length})
                                    </Button>
                                  ) : (
                                    <>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleCopyAllEvents(competition.id)}
                                        disabled={compEvents.length === 0}
                                        className="gap-2 ml-auto"
                                      >
                                        <Copy className="w-4 h-4" /> Copia Tutte
                                      </Button>
                                      <div className="flex items-center bg-background border border-border rounded-md overflow-hidden">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handlePasteEvents(competition.id)}
                                          disabled={clipboardEvents.length === 0}
                                          className="gap-2 rounded-none border-0 focus-visible:ring-0"
                                        >
                                          <ClipboardPaste className="w-4 h-4" /> Incolla ({clipboardEvents.length})
                                        </Button>
                                        {clipboardEvents.length > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setClipboardEvents([]);
                                              localStorage.removeItem("dance_manager_copied_events");
                                            }}
                                            className="px-2 h-9 rounded-none text-muted-foreground hover:bg-destructive hover:text-destructive-foreground border-l border-border focus-visible:ring-0"
                                            title="Svuota appunti"
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {compEvents.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <p>Nessuna gara configurata per questa competizione.</p>
                                </div>
                              ) : (
                                <div className="border border-white/10 rounded-xl overflow-hidden">
                                  <Table>
                                    <TableHeader className="bg-black/5 dark:bg-white/5">
                                      <TableRow>
                                        {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                                        <TableHead>Nome Gara</TableHead>
                                        <TableHead>Classi Ammesse</TableHead>
                                        <TableHead>Età</TableHead>
                                        {isAdmin && <TableHead className="text-right">Azioni</TableHead>}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {compEvents.map(event => (
                                        <TableRow 
                                          key={event.id}
                                          className={cn(
                                            "group transition-colors cursor-pointer",
                                            selectedEvents.has(event.id) ? "bg-primary/5" : "hover:bg-black/5 dark:hover:bg-white/5"
                                          )}
                                          onClick={() => {
                                            setSelectedEvents(prev => {
                                              const next = new Set(prev);
                                              if (next.has(event.id)) next.delete(event.id);
                                              else next.add(event.id);
                                              return next;
                                            });
                                          }}
                                        >
                                          {isAdmin && (
                                            <TableCell onClick={e => e.stopPropagation()}>
                                              <Checkbox 
                                                checked={selectedEvents.has(event.id)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedEvents(prev => {
                                                    const next = new Set(prev);
                                                    if (checked) next.add(event.id);
                                                    else next.delete(event.id);
                                                    return next;
                                                  });
                                                }}
                                              />
                                            </TableCell>
                                          )}
                                          <TableCell className="font-medium text-xs sm:text-sm">{event.event_name}</TableCell>
                                          <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                              {event.allowed_classes.map(c => (
                                                <span key={c} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-muted-foreground">
                                                  {c}
                                                </span>
                                              ))}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {(event.min_age !== null || event.max_age !== null) && (
                                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {event.min_age ? `${event.min_age}+` : ""}{event.min_age && event.max_age ? " - " : ""}{event.max_age ? `max ${event.max_age}` : ""}
                                              </span>
                                            )}
                                          </TableCell>
                                          {isAdmin && (
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <AddCustomEventDialog 
                                                  competitionId={competition.id} 
                                                  onSuccess={() => fetchData(true)} 
                                                  existingEvent={event}
                                                  trigger={
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10" title="Modifica gara">
                                                      <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                  }
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleCopySingleEvent(event)} title="Copia singola gara">
                                                  <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEvent(event.id)} title="Elimina gara">
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {archivedCompetitions.length > 0 && (
          <div className="mt-12 space-y-6">
            <div 
              onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
              className="flex items-center justify-between p-6 bg-neutral-900/5 dark:bg-white/5 hover:bg-neutral-900/10 dark:hover:bg-white/10 border border-white/5 rounded-3xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold tracking-tight">Archivio Gare Passate</h2>
                  <p className="text-sm text-muted-foreground font-medium">{archivedCompetitions.length} competizioni archiviate</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl">
                {isArchiveExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>

            <AnimatePresence>
              {isArchiveExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6 overflow-hidden"
                >
                  {archivedCompetitions.map((competition, idx) => {
                    const compEvents = getCompetitionEventTypes(competition.id);
                    const isExpanded = selectedCompetitionForEvents === competition.id;

                    return (
                      <motion.div
                        key={competition.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className="overflow-hidden glass-card border-white/5 opacity-70 hover:opacity-100 transition-opacity">
                          <CardHeader
                            className="cursor-pointer group py-4 px-6"
                            onClick={() => setSelectedCompetitionForEvents(isExpanded ? null : competition.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div>
                                  <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                                    {competition.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">{formatDate(competition.date, competition.end_date)}</p>
                                </div>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-500/10 rounded-xl"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleArchive(competition.id, true);
                                    }}
                                    disabled={archivingId === competition.id}
                                    title="Ripristina competizione"
                                  >
                                    {archivingId === competition.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ArchiveRestore className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                              <CustomBadge count={compEvents.length} />
                            </div>
                          </CardHeader>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                              >
                                <CardContent className="pt-0 pb-6 px-6">
                                  {compEvents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Nessuna gara</p>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/5">
                                      {compEvents.map(event => (
                                        <div key={event.id} className="bg-black/20 rounded-xl p-3">
                                          <h4 className="font-bold text-xs mb-2">{event.event_name}</h4>
                                          <div className="flex flex-wrap gap-1">
                                            {event.allowed_classes.map(c => (
                                              <span key={c} className="text-[9px] font-mono px-1 rounded bg-white/5 text-muted-foreground">
                                                {c}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </>
  );
}
