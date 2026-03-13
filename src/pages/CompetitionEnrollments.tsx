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

interface Competition {
  id: string;
  name: string;
  date: string;
  end_date?: string | null;
}

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
  // Juvenile & Junior
  { name: "Juvenile 1 (6/9)", classes: ["D", "C", "B1", "B2", "B3"], minAge: 6, maxAge: 9 },
  { name: "Juvenile 2 (10/11)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 10, maxAge: 11 },
  { name: "Junior 1 (12/13)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 12, maxAge: 13 },
  { name: "Junior 2 (14/15)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 14, maxAge: 15 },

  // Youth
  { name: "Youth (16/18)", classes: ["C", "B1", "B2", "B3", "A", "AS"], minAge: 16, maxAge: 18 },

  // Under 16 & Under 21 (Special)
  { name: "Under 16", classes: ["C", "B1", "B2", "B3", "A1", "A2", "AS"], maxAge: 15 },
  { name: "Under 21", classes: ["C", "B1", "B2", "B3", "A1", "A2", "AS"], minAge: 16, maxAge: 20 },

  // Adult
  { name: "Adult (19/34)", classes: ["C", "B1", "B2", "B3", "A1", "A2", "AS", "MASTER"], minAge: 19, maxAge: 34 },

  // Senior 1 & 2
  { name: "Senior 1 (35/44)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35, maxAge: 44 },
  { name: "Senior 2 (45/54)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45, maxAge: 54 },

  // Senior 3, 4, 5
  { name: "Senior 3 (55/64)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55, maxAge: 64 },
  { name: "Senior 4 (65/74)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65, maxAge: 74 },
  { name: "Senior 5 (75+)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 75 },

  // Over Specifics
  { name: "Over 35", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35 },
  { name: "Over 45", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45 },
  { name: "Over 55", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55 },
  { name: "Over 65", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65 },

  // Open / General
  { name: "Open Classe A", classes: ["A", "A1", "A2"], minAge: 16 },
  { name: "Open Classe B", classes: ["B1", "B2", "B3"] },
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
      const competitionsRes = await supabase
        .from("competitions")
        .select("id, name, date, end_date, is_deleted")
        .eq("is_deleted", false)
        .order("date", { ascending: true });

      const eventTypesRes = await supabase
        .from("competition_event_types")
        .select("*");

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

  const toggleSyllabusEvents = (competitionId: string, discipline: string) => {
    const events = getEventsForDiscipline(discipline);
    const names = events.filter(p => {
      const nameLower = p.name.toLowerCase();
      const isSyllabusClass = p.classes.every(cls => ["B", "B1", "B2", "B3", "C", "D"].includes(cls));
      const isNotSpecial = !nameLower.includes("over") && !nameLower.includes("under");
      return isSyllabusClass && isNotSpecial;
    }).map(p => p.name);
    toggleEventTypesRange(competitionId, discipline, names);
  };

  const toggleAllEvents = (competitionId: string, discipline: string) => {
    const events = getEventsForDiscipline(discipline);
    // Anche per Championship/Star Cup escludiamo Over/Under per le selezioni rapide
    const names = events.filter(p => {
      const nameLower = p.name.toLowerCase();
      return !nameLower.includes("over") && !nameLower.includes("under");
    }).map(p => p.name);
    toggleEventTypesRange(competitionId, discipline, names);
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-xl font-display font-bold">Iscrizioni Gara</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <AddCompetitionDialog onSuccess={handleCompetitionAdded} />}
            {isAdmin && pendingEventChanges.size > 0 && (
              <Button onClick={saveAllChanges} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva ({pendingEventChanges.size})
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isAdmin && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-warning">Solo gli amministratori possono modificare le regole delle classi.</p>
          </div>
        )}

        {competitions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nessuna competizione</h3>
              <p className="text-muted-foreground">Inizia aggiungendo una nuova competizione tramite il pulsante "+" in alto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" />
                  Tipi di Gara per Competizione
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Configura quali tipi di gara sono disponibili per ogni competizione (es. Adult Open, Rising Star, ecc.).
                  Ogni tipo ha restrizioni di classe e di età predefinite.
                </p>
              </CardContent>
            </Card>

            {competitions.map(competition => {
              const compEvents = getCompetitionEventTypes(competition.id);
              const isExpanded = selectedCompetitionForEvents === competition.id;

              // Current selected classes for this competition (stays even if no races)
              const activeClasses = competitionClasses.get(competition.id) || new Set<string>();

              const toggleGlobalClass = (targetClass: string) => {
                if (!isAdmin) return;
                
                const classGroup: string[] = [];
                if (targetClass === "B") classGroup.push("B", "B1", "B2", "B3");
                else if (targetClass === "A") classGroup.push("A", "A1", "A2");
                else classGroup.push(targetClass);

                const isAdding = !activeClasses.has(targetClass);

                // Update local competition classes state immediately
                setCompetitionClasses(prev => {
                  const next = new Map(prev);
                  const currentCompSet = new Set(next.get(competition.id) || []);
                  if (isAdding) currentCompSet.add(targetClass);
                  else currentCompSet.delete(targetClass);
                  next.set(competition.id, currentCompSet);
                  return next;
                });

                // Update all currently active events of this competition in the eventTypes state
                const updatedEventTypes = eventTypes.map(e => {
                  if (e.competition_id !== competition.id) return e;
                  const currentAllowed = new Set(e.allowed_classes || []);
                  if (isAdding) classGroup.forEach(c => currentAllowed.add(c));
                  else classGroup.forEach(c => currentAllowed.delete(c));
                  return { ...e, allowed_classes: Array.from(currentAllowed) };
                });
                setEventTypes(updatedEventTypes);

                // Mark all events as modified for saving
                setPendingEventChanges(prev => {
                  const next = new Map(prev);
                  compEvents.forEach(e => {
                    const key = makeEventKey(competition.id, e.event_name);
                    next.set(key, true); // Keep active
                  });
                  return next;
                });
              };

              return (
                <Card key={competition.id}>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCompetitionForEvents(isExpanded ? null : competition.id)}
                  >
                    <CardTitle className="text-base flex flex-col gap-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                          <div className="flex flex-col gap-1 min-w-[200px]">
                            <span className="font-bold text-lg">{competition.name}</span>
                            <span className="text-sm text-muted-foreground">{formatDate(competition.date, competition.end_date)}</span>
                          </div>

                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-1.5 bg-muted/30 p-2 rounded-xl border border-border/50">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 px-1">Coppie:</span>
                              {["D", "C", "B", "A", "AS", "MASTER"].map(cls => (
                                <Button
                                  key={cls}
                                  variant={activeClasses.has(cls) ? "default" : "outline"}
                                  size="sm"
                                  className={`
                                    h-7 px-2.5 text-[10px] font-bold transition-all border
                                    ${activeClasses.has(cls) 
                                      ? (cls === "D" ? "bg-slate-600 border-slate-700 text-white" : 
                                         cls === "C" ? "bg-blue-600 border-blue-700 text-white" :
                                         cls === "B" ? "bg-purple-600 border-purple-700 text-white" :
                                         cls === "A" ? "bg-green-600 border-green-700 text-white" :
                                         cls === "AS" ? "bg-amber-600 border-amber-700 text-white" :
                                         "bg-red-600 border-red-700 text-white")
                                      : (cls === "D" ? "border-slate-200 text-slate-500 hover:bg-slate-50" : 
                                         cls === "C" ? "border-blue-200 text-blue-500 hover:bg-blue-50" :
                                         cls === "B" ? "border-purple-200 text-purple-500 hover:bg-purple-50" :
                                         cls === "A" ? "border-green-200 text-green-500 hover:bg-green-50" :
                                         cls === "AS" ? "border-amber-200 text-amber-500 hover:bg-amber-50" :
                                         "border-red-200 text-red-500 hover:bg-red-50")
                                    }
                                  `}
                                  onClick={(e) => { e.stopPropagation(); toggleGlobalClass(cls); }}
                                >
                                  {cls}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Badge count={compEvents.length} />
                          </div>
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {DISCIPLINES.map(discipline => (
                          <div key={discipline} className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                              <h3 className="font-semibold">{discipline}</h3>
                              {isAdmin && (
                                <div className="flex flex-col gap-1">
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 w-full"
                                      onClick={(e) => { e.stopPropagation(); toggleAllEvents(competition.id, discipline); }}
                                    >
                                      Championship
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 w-full"
                                      onClick={(e) => { e.stopPropagation(); toggleAllEvents(competition.id, discipline); }}
                                    >
                                      Star Cup
                                    </Button>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 w-full"
                                      onClick={(e) => { e.stopPropagation(); toggleSyllabusEvents(competition.id, discipline); }}
                                    >
                                      Syllabus
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] bg-green-50 hover:bg-green-100 text-green-600 w-full"
                                      onClick={(e) => { e.stopPropagation(); toggleSyllabusEvents(competition.id, discipline); }}
                                    >
                                      Gara di Ballo
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {getEventsForDiscipline(discipline).map(preset => {
                                const fullEventName = `${discipline} - ${preset.name}`;
                                const isActive = getEventActive(competition.id, fullEventName);
                                const pendingKey = makeEventKey(competition.id, fullEventName);
                                const isPending = pendingEventChanges.has(pendingKey);
                                
                                // Find current event data if it exists in DB or state
                                const existingEvent = eventTypes.find(e => e.competition_id === competition.id && e.event_name === fullEventName);
                                const classesToShow = existingEvent ? existingEvent.allowed_classes : preset.classes;

                                return (
                                  <div
                                    key={fullEventName}
                                    className={`
                                      flex items-start gap-3 p-3 rounded-lg border transition-colors
                                      ${isActive ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:border-primary/20"}
                                    `}
                                  >
                                    <Checkbox
                                      id={`${competition.id}-${fullEventName}`}
                                      checked={isActive}
                                      onCheckedChange={() => toggleEventType(competition.id, fullEventName)}
                                      disabled={!isAdmin}
                                      className={isPending ? "ring-2 ring-primary mt-1" : "mt-1"}
                                    />
                                    <div className="space-y-1">
                                      <label
                                        htmlFor={`${competition.id}-${fullEventName}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                      >
                                        {preset.name}
                                      </label>
                                      <p className="text-xs text-muted-foreground">
                                        Classi: {classesToShow.join(", ")}
                                      </p>
                                      {(preset.minAge || preset.maxAge) && (
                                        <p className="text-xs text-muted-foreground">
                                          Età: {preset.minAge ? `${preset.minAge}+` : ""}{preset.minAge && preset.maxAge ? " - " : ""}{preset.maxAge ? `max ${preset.maxAge}` : ""}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
      {count} {count === 1 ? "tipo" : "tipi"}
    </span>
  );
}
