import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Trophy, Settings, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-is-admin";
import AddCompetitionDialog from "@/components/AddCompetitionDialog";
import EditCompetitionDialog from "@/components/EditCompetitionDialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { Competition } from "@/types/dashboard";

interface EventType {
  id?: string;
  competition_id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

const DISCIPLINES = ["Danze Standard", "Danze Latino Americane", "Combinata"];

// Predefined event types for Standard and Latin
const STANDARD_LATIN_EVENTS: { name: string; classes: string[]; minAge?: number; maxAge?: number }[] = [
  /**
   * --- SYLLABUS CATEGORIES ---
   */
  // Juvenile & Junior
  { name: "Juvenile 1 (6/9)", classes: ["D", "C", "B1", "B2", "B3"], minAge: 6, maxAge: 9 },
  { name: "Juvenile 2 (10/11)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 10, maxAge: 11 },
  { name: "Junior 1 (12/13)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 12, maxAge: 13 },
  { name: "Junior 2 (14/15)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 14, maxAge: 15 },

  // Youth & Adult
  { name: "Youth (16/18)", classes: ["C", "B1", "B2", "B3", "A", "AS"], minAge: 16, maxAge: 18 },
  { name: "Adult (19/34)", classes: ["D", "C", "B1", "B2", "B3", "A1", "A2"], minAge: 19, maxAge: 34 },

  // Seniors
  { name: "Senior 1 (35/44)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35, maxAge: 44 },
  { name: "Senior 2 (45/54)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45, maxAge: 54 },
  { name: "Senior 3a (55/60)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55, maxAge: 60 },
  { name: "Senior 3b (61/64)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 61, maxAge: 64 },
  { name: "Senior 4a (65/69)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65, maxAge: 69 },
  { name: "Senior 4b (70/74)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 70, maxAge: 74 },
  { name: "Senior 5 (75+)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 75 },

  // Age Specifics (Under/Over)
  { name: "Under 16", classes: ["C", "B1", "B2", "B3", "A", "A1", "A2", "AS"], maxAge: 15 },
  { name: "Under 21", classes: ["C", "B1", "B2", "B3", "A", "A1", "A2", "AS"], minAge: 16, maxAge: 20 },
  { name: "Over 35", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35 },
  { name: "Over 45", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45 },
  { name: "Over 55", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55 },
  { name: "Over 65", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65 },

  /**
   * --- OPEN & RISING STAR CATEGORIES ---
   */
  { name: "Adult Open", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Amator Open A", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Rising Star", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Youth Open", classes: ["B1", "B2", "B3", "A", "A1", "A2", "AS"], minAge: 16, maxAge: 18 },
  { name: "Rising Star Master", classes: ["MASTER"] },
  { name: "Open Classe B", classes: ["B1", "B2", "B3"] },
  { name: "Adult Master", classes: ["MASTER"] },
];

// Specific event types for Combinata
const COMBINATA_EVENTS: { name: string; classes: string[]; minAge?: number; maxAge?: number }[] = [
  { name: "Combinata 10 Balli", classes: ["MASTER", "AS", "A", "A1", "A2", "B1", "B2", "B3"] },
  { name: "Combinata 8 Balli", classes: ["C", "D"] },
  { name: "Classic Show Dance", classes: ["MASTER", "AS", "A"] },
  { name: "South America Showdance", classes: ["MASTER", "AS", "A"] },
];

const getEventsForDiscipline = (discipline: string) => {
  if (discipline === "Combinata") {
    return COMBINATA_EVENTS;
  }
  return STANDARD_LATIN_EVENTS;
};

export default function CompetitionEnrollments() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingEventChanges, setPendingEventChanges] = useState<Map<string, boolean>>(new Map());
  const [selectedCompetitionForEvents, setSelectedCompetitionForEvents] = useState<string | null>(null);
  const [competitionClasses, setCompetitionClasses] = useState<Map<string, Set<string>>>(new Map());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      fetchData();
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // Sync competitionClasses state with eventTypes
    setCompetitionClasses(prev => {
      const newMap = new Map(prev);
      
      // Group events by competition to see what classes are actually in use
      const compClassMap = new Map<string, Set<string>>();
      eventTypes.forEach(et => {
        if (!compClassMap.has(et.competition_id)) compClassMap.set(et.competition_id, new Set());
        const set = compClassMap.get(et.competition_id)!;
        et.allowed_classes?.forEach(cls => {
          if (["B1", "B2", "B3"].includes(cls)) set.add("B");
          else if (["A1", "A2"].includes(cls)) set.add("A");
          else set.add(cls);
        });
      });

      // Update competitionClasses for competitions that HAVE events.
      // Competitions WITHOUT events will keep their current set in competitionClasses (local override)
      compClassMap.forEach((set, compId) => {
        newMap.set(compId, set);
      });
      
      return newMap;
    });
  }, [eventTypes]);

  const fetchData = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true);
    try {
      const [competitionsRes, eventTypesRes] = await Promise.all([
        (supabase
          .from("competitions")
          .select("*")
          .eq("is_deleted", false)
          .order("date", { ascending: true }) as any),
        (supabase
          .from("competition_event_types")
          .select("*") as any)
      ]);

      if (competitionsRes.data) {
        // Extra safety: deduplicate by name and date in case duplicates already exist in DB
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

  const makeEventKey = (competitionId: string, eventName: string) => `${competitionId}::${eventName}`;

  const getEventActive = (competitionId: string, eventName: string): boolean => {
    const pendingKey = makeEventKey(competitionId, eventName);
    if (pendingEventChanges.has(pendingKey)) {
      return pendingEventChanges.get(pendingKey)!;
    }
    return eventTypes.some(
      e => e.competition_id === competitionId && e.event_name === eventName
    );
  };

  const toggleEventType = (competitionId: string, eventName: string) => {
    if (!isAdmin) {
      toast({ title: "Accesso negato", description: "Solo gli amministratori possono modificare le regole", variant: "destructive" });
      return;
    }
    const key = makeEventKey(competitionId, eventName);
    const currentValue = getEventActive(competitionId, eventName);
    const newValue = !currentValue;

    // Se stiamo attivando la gara, dobbiamo assicurarci che erediti le classi globali "cliccate" in alto
    if (newValue) {
      // Calcoliamo le classi globali attive in questo momento per questa competizione
      const compEvents = getCompetitionEventTypes(competitionId);
      const activeClasses = new Set<string>();
      compEvents.forEach(e => {
        e.allowed_classes?.forEach(cls => {
          if (["B1", "B2", "B3"].includes(cls)) activeClasses.add("B");
          else if (["A1", "A2"].includes(cls)) activeClasses.add("A");
          else activeClasses.add(cls);
        });
      });

      // Se non ci sono classi attive, usiamo quelle del preset come fallback per evitare gare vuote
      const eventNameParts = eventName.split(" - ");
      const discipline = eventNameParts[0];
      const presetName = eventNameParts.length > 1 ? eventNameParts[1] : eventName;
      const presets = getEventsForDiscipline(discipline);
      const preset = presets.find(p => p.name === presetName);
      
      let classesToSet = preset?.classes || [];
      if (activeClasses.size > 0) {
        classesToSet = [];
        activeClasses.forEach(c => {
          if (c === "B") classesToSet.push("B", "B1", "B2", "B3");
          else if (c === "A") classesToSet.push("A", "A1", "A2");
          else classesToSet.push(c);
        });
      }

      // Aggiorniamo lo stato locale immediatamente per feedback visivo
      const updatedEventTypes = [...eventTypes];
      const existingIdx = updatedEventTypes.findIndex(e => e.competition_id === competitionId && e.event_name === eventName);
      if (existingIdx >= 0) {
        updatedEventTypes[existingIdx] = { ...updatedEventTypes[existingIdx], allowed_classes: classesToSet };
      } else {
        // Sarà inserito nel saveAllChanges
      }
      setEventTypes(updatedEventTypes);
    }

    setPendingEventChanges(prev => {
      const next = new Map(prev);
      next.set(key, newValue);
      return next;
    });
  };

  const toggleEventTypesRange = (competitionId: string, discipline: string, targetNames: string[]) => {
    if (!isAdmin) return;

    // Check if all target events are currently active for this discipline
    const allActive = targetNames.every(name => getEventActive(competitionId, `${discipline} - ${name}`));
    const newValue = !allActive;

    // Se stiamo attivando un range, recuperiamo le classi globali attive
    const compEvents = getCompetitionEventTypes(competitionId);
    const activeClasses = new Set<string>();
    compEvents.forEach(e => {
      e.allowed_classes?.forEach(cls => {
        if (["B1", "B2", "B3"].includes(cls)) activeClasses.add("B");
        else if (["A1", "A2"].includes(cls)) activeClasses.add("A");
        else activeClasses.add(cls);
      });
    });

    setPendingEventChanges(prev => {
      const next = new Map(prev);
      targetNames.forEach(name => {
        const fullEventName = `${discipline} - ${name}`;
        const key = makeEventKey(competitionId, fullEventName);
        if (getEventActive(competitionId, fullEventName) !== newValue) {
          next.set(key, newValue);
          
          if (newValue && activeClasses.size > 0) {
             // La logica di aggiornamento allowed_classes per i nuovi preset 
             // deve essere gestita nel saveAllChanges
          }
        }
      });
      return next;
    });
  };

  /**
   * --- QUICK TOGGLE FUNCTIONS ---
   */

  const toggleEventsByFilter = (competitionId: string, discipline: string, filterFn: (name: string) => boolean) => {
    const events = getEventsForDiscipline(discipline);
    const names = events
      .filter(p => filterFn(p.name.toLowerCase()))
      .map(p => p.name);
    toggleEventTypesRange(competitionId, discipline, names);
  };

  const toggleAllEvents = (competitionId: string, discipline: string) => {
    toggleEventsByFilter(competitionId, discipline, () => true);
  };

  const toggleStarCupEvents = (competitionId: string, discipline: string) => {
    toggleEventsByFilter(competitionId, discipline, (name) => {
      // Per la Star Cup escludiamo solo Adult Open e Adult Master
      return !name.includes("adult open") && !name.includes("adult master");
    });
  };

  const toggleSyllabusEvents = (competitionId: string, discipline: string) => {
    toggleEventsByFilter(competitionId, discipline, (name) => {
      // Escludiamo specialità (over/under) e categorie Open alte
      const isNotSpecial = !name.includes("over") && !name.includes("under");
      const isNotOpen = !name.includes("open") && !name.includes("rising star") && !name.includes("master");
      return isNotSpecial && isNotOpen;
    });
  };

  const saveAllChanges = async () => {
    if (pendingEventChanges.size === 0) return;
    setSaving(true);
    try {
      // Recuperiamo le classi globali attive per competizione per applicarle alle nuove gare
      const eventPromises = [];
      const competitionClassMaps = new Map<string, string[]>();

      for (const competition of competitions) {
        const compEvents = getCompetitionEventTypes(competition.id);
        const activeClasses = new Set<string>();
        compEvents.forEach(e => {
          e.allowed_classes?.forEach(cls => {
            if (["B1", "B2", "B3"].includes(cls)) activeClasses.add("B");
            else if (["A1", "A2"].includes(cls)) activeClasses.add("A");
            else activeClasses.add(cls);
          });
        });
        
        const classList: string[] = [];
        activeClasses.forEach(c => {
          if (c === "B") classList.push("B", "B1", "B2", "B3");
          else if (c === "A") classList.push("A", "A1", "A2");
          else classList.push(c);
        });
        competitionClassMaps.set(competition.id, classList);
      }

      for (const [key, isActive] of pendingEventChanges) {
        const [competitionId, fullEventName] = key.split("::");
        const eventNameParts = fullEventName.split(" - ");
        const discipline = eventNameParts[0];
        const presetName = eventNameParts.length > 1 ? eventNameParts[1] : fullEventName;

        const events = getEventsForDiscipline(discipline);
        const preset = events.find(p => p.name === presetName);
        const existing = eventTypes.find(e => e.competition_id === competitionId && e.event_name === fullEventName);

        if (isActive) {
          const globalClasses = competitionClassMaps.get(competitionId) || [];
          const classesToSave = globalClasses.length > 0 ? globalClasses : (preset?.classes || []);

          if (!existing) {
            if (preset) {
              eventPromises.push(
                supabase.from("competition_event_types").insert({
                  competition_id: competitionId,
                  event_name: fullEventName,
                  allowed_classes: classesToSave,
                  min_age: preset.minAge ?? null,
                  max_age: preset.maxAge ?? null,
                })
              );
            }
          } else {
            // Aggiornamento classi per gara esistente (se cambiata via toggleGlobalClass)
            eventPromises.push(
              supabase.from("competition_event_types").update({
                allowed_classes: existing.allowed_classes
              }).eq("id", existing.id)
            );
          }
        } else if (existing?.id) {
          eventPromises.push(
            supabase.from("competition_event_types").delete().eq("id", existing.id)
          );
        }
      }

      const results = await Promise.all(eventPromises);
      const hasError = results.some(r => r.error);
      if (hasError) throw results.find(r => r.error)?.error;

      toast({ title: "Salvato", description: "Modifiche salvate con successo" });
      setPendingEventChanges(new Map());
      fetchData(true); // Background refresh
    } catch (error) {
      console.error("Error saving:", error);
      toast({ title: "Errore", description: "Impossibile salvare le modifiche", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const handleCompetitionAdded = async () => {
    await fetchData(true);
  };

  const getCompetitionEventTypes = (competitionId: string) => {
    return eventTypes.filter(e => e.competition_id === competitionId);
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
              <p className="text-muted-foreground font-medium">Configura regolamenti e classi per le competizioni</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {isAdmin && <AddCompetitionDialog onSuccess={handleCompetitionAdded} />}
            <AnimatePresence>
              {isAdmin && pendingEventChanges.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Button 
                    size="lg"
                    onClick={saveAllChanges} 
                    disabled={saving} 
                    className="rounded-2xl shadow-xl hover:shadow-2xl transition-all gap-3 bg-primary"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    <span>Salva Modifiche ({pendingEventChanges.size})</span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        {!isAdmin && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-warning">Solo gli amministratori possono modificare le regole delle classi.</p>
          </div>
        )}        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass border-white/10 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-3 font-display">
                  <Settings className="w-5 h-5 text-accent" />
                  Regole Globali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Configura quali tipi di gara sono disponibili per ogni competizione.
                  Ogni tipo ha restrizioni di classe e di età predefinite che puoi personalizzare globalmente.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {competitions.length === 0 ? (
          <div className="py-20 text-center glass rounded-3xl">
            <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-display font-bold mb-2">Nessuna competizione</h3>
            <p className="text-muted-foreground">Inizia aggiungendo una nuova competizione tramite il pulsante "+" in alto.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {competitions.map((competition, idx) => {
              const compEvents = getCompetitionEventTypes(competition.id);
              const isExpanded = selectedCompetitionForEvents === competition.id;
              const activeClasses = competitionClasses.get(competition.id) || new Set<string>();

              const toggleGlobalClass = (targetClass: string) => {
                if (!isAdmin) return;
                const classGroup: string[] = [];
                if (targetClass === "B") classGroup.push("B", "B1", "B2", "B3");
                else if (targetClass === "A") classGroup.push("A", "A1", "A2");
                else classGroup.push(targetClass);

                const isAdding = !activeClasses.has(targetClass);
                setCompetitionClasses(prev => {
                  const next = new Map(prev);
                  const currentCompSet = new Set(next.get(competition.id) || []);
                  if (isAdding) currentCompSet.add(targetClass);
                  else currentCompSet.delete(targetClass);
                  next.set(competition.id, currentCompSet);
                  return next;
                });

                const updatedEventTypes = eventTypes.map(e => {
                  if (e.competition_id !== competition.id) return e;
                  const currentAllowed = new Set(e.allowed_classes || []);
                  if (isAdding) classGroup.forEach(c => currentAllowed.add(c));
                  else classGroup.forEach(c => currentAllowed.delete(c));
                  return { ...e, allowed_classes: Array.from(currentAllowed) };
                });
                setEventTypes(updatedEventTypes);

                setPendingEventChanges(prev => {
                  const next = new Map(prev);
                  compEvents.forEach(e => {
                    const key = makeEventKey(competition.id, e.event_name);
                    next.set(key, true);
                  });
                  return next;
                });
              };

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
                                <div onClick={e => e.stopPropagation()}>
                                  <EditCompetitionDialog 
                                    competition={competition} 
                                    onSuccess={() => fetchData(true)} 
                                  />
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">{formatDate(competition.date, competition.end_date)}</span>
                          </div>

                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto print:hidden" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 mr-1">
                                {["D", "C", "B", "A", "AS", "MASTER"].map(cls => (
                                  <Button
                                    key={cls}
                                    variant={activeClasses.has(cls) ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                      "h-8 px-3 text-[11px] font-bold transition-all rounded-xl border-transparent",
                                      activeClasses.has(cls) 
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                                        : "bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 border-white/10"
                                    )}
                                    onClick={() => toggleGlobalClass(cls)}
                                  >
                                    {cls}
                                  </Button>
                                ))}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-4 text-[10px] uppercase font-bold tracking-widest bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-400 rounded-xl transition-all"
                                  onClick={() => DISCIPLINES.forEach(d => toggleAllEvents(competition.id, d))}
                                >
                                  Tutte
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-4 text-[10px] uppercase font-bold tracking-widest bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl transition-all"
                                  onClick={() => DISCIPLINES.filter(d => d !== "Combinata").forEach(d => toggleStarCupEvents(competition.id, d))}
                                >
                                  Star Cup
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-4 text-[10px] uppercase font-bold tracking-widest bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-xl transition-all"
                                  onClick={() => DISCIPLINES.filter(d => d !== "Combinata").forEach(d => toggleSyllabusEvents(competition.id, d))}
                                >
                                  Syllabus
                                </Button>
                              </div>
                            </div>
                          )}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6 border-t border-white/5">
                              {DISCIPLINES.map(discipline => (
                                <div key={discipline} className="space-y-4">
                                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                                    <h3 className="font-display font-bold text-lg tracking-tight">{discipline}</h3>
                                  </div>
                                  <div className="grid gap-3">
                                    {getEventsForDiscipline(discipline).map(preset => {
                                      const fullEventName = `${discipline} - ${preset.name}`;
                                      const isActive = getEventActive(competition.id, fullEventName);
                                      const pendingKey = makeEventKey(competition.id, fullEventName);
                                      const isPending = pendingEventChanges.has(pendingKey);
                                      const existingEvent = eventTypes.find(e => e.competition_id === competition.id && e.event_name === fullEventName);
                                      const classesToShow = existingEvent ? existingEvent.allowed_classes : preset.classes;

                                      return (
                                        <motion.div
                                          key={fullEventName}
                                          whileHover={{ x: 4 }}
                                          className={cn(
                                            "flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group/event",
                                            isActive 
                                              ? "bg-primary/5 border-primary/20 shadow-sm" 
                                              : "bg-black/5 dark:bg-white/5 border-transparent hover:border-white/10"
                                          )}
                                          onClick={() => toggleEventType(competition.id, fullEventName)}
                                        >
                                          {isActive && (
                                            <motion.div 
                                              layoutId={`active-bg-${competition.id}-${fullEventName}`}
                                              className="absolute inset-0 bg-primary/5 pointer-events-none" 
                                            />
                                          )}
                                          <Checkbox
                                            id={`${competition.id}-${fullEventName}`}
                                            checked={isActive}
                                            className={cn(
                                              "mt-1 rounded-md transition-all",
                                              isPending ? "ring-2 ring-primary ring-offset-2" : ""
                                            )}
                                            onClick={e => e.stopPropagation()}
                                          />
                                          <div className="space-y-1.5 relative z-10">
                                            <span className="text-sm font-bold leading-none block group-hover/event:text-primary transition-colors">
                                              {preset.name}
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                              {classesToShow.map(c => (
                                                <span key={c} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-muted-foreground">
                                                  {c}
                                                </span>
                                              ))}
                                            </div>
                                            {(preset.minAge || preset.maxAge) && (
                                              <p className="text-[11px] font-medium text-muted-foreground/60 flex items-center gap-1">
                                                <Settings className="w-3 h-3" />
                                                Età: {preset.minAge ? `${preset.minAge}+` : ""}{preset.minAge && preset.maxAge ? " - " : ""}{preset.maxAge ? `max ${preset.maxAge}` : ""}
                                              </p>
                                            )}
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
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
      </main>
    </>
  );
}

function CustomBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/10">
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      <span className="text-xs font-bold text-primary tracking-tight">
        {count} {count === 1 ? "Evento Configurato" : "Eventi Configurati"}
      </span>
    </div>
  );
}
