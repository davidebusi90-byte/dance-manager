import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Trophy, Settings, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitionsImport from "@/components/CompetitionsImport";

interface Competition {
  id: string;
  name: string;
  date: string;
}

interface ClassRule {
  competition_id: string;
  class: string;
  is_allowed: boolean;
}

interface EventType {
  id?: string;
  competition_id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

// Available dance classes
// Available dance classes
const DANCE_CLASSES = ["MASTER", "AS", "A1", "A2", "A", "B1", "B2", "B3", "B", "C", "D"];

const DISCIPLINES = ["Danze Standard", "Danze Latino Americane", "Combinata"];

// Predefined event types for Standard and Latin
const STANDARD_LATIN_EVENTS: { name: string; classes: string[]; minAge?: number; maxAge?: number }[] = [
  { name: "Adult Master", classes: ["MASTER"] },
  { name: "Adult Open", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 19 },
  { name: "Rising Star", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 19 },
  { name: "Open A", classes: ["A", "A1", "A2", "D"] },
  { name: "A1", classes: ["A1"] },
  { name: "A2", classes: ["A2"] },
  { name: "Under 21", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 18, maxAge: 20 },
  { name: "Open B", classes: ["B1", "B2", "B3", "C", "D"] },
  { name: "B1", classes: ["B1"] },
  { name: "B2", classes: ["B2"] },
  { name: "B3", classes: ["B3"] },
  { name: "Open C", classes: ["C", "D"] },
  { name: "C", classes: ["C"] },
  { name: "D", classes: ["D"] },
  { name: "Under 16", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], maxAge: 15 },
  { name: "Open Over 35", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 35 },
  { name: "Open Over 45", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 45 },
  { name: "Open Over 55", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 55 },
  { name: "Open Over 65", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 65 },
  { name: "Open Over 70", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 70 },
  { name: "Open Over 75", classes: ["A", "A1", "A2", "B1", "B2", "B3", "B", "D"], minAge: 75 },
];

// Specific event types for Combinata
const COMBINATA_EVENTS: { name: string; classes: string[]; minAge?: number; maxAge?: number }[] = [
  { name: "Combinata 10 Balli", classes: ["MASTER", "AS", "A", "A1", "A2", "B", "B1", "B2", "B3"] },
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
  const [classRules, setClassRules] = useState<ClassRule[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingClassChanges, setPendingClassChanges] = useState<Map<string, boolean>>(new Map());
  const [pendingEventChanges, setPendingEventChanges] = useState<Map<string, boolean>>(new Map());
  const [selectedCompetitionForEvents, setSelectedCompetitionForEvents] = useState<string | null>(null);
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

  const fetchData = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true);
    try {
      const [competitionsRes, rulesRes, eventTypesRes] = await Promise.all([
        supabase.from("competitions").select("id, name, date").order("date", { ascending: true }),
        supabase.from("competition_class_rules").select("competition_id, class, is_allowed"),
        supabase.from("competition_event_types").select("*"),
      ]);

      if (competitionsRes.data) setCompetitions(competitionsRes.data);
      if (rulesRes.data) setClassRules(rulesRes.data);
      if (eventTypesRes.data) setEventTypes(eventTypesRes.data as EventType[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (!isRefetch) setLoading(false);
    }
  };

  const makeKey = (competitionId: string, className: string) => `${competitionId}::${className}`;
  const makeEventKey = (competitionId: string, eventName: string) => `${competitionId}::${eventName}`;

  const parseKey = (key: string) => {
    const [competitionId, className] = key.split("::");
    return { competitionId, className };
  };

  const getClassAllowed = (competitionId: string, className: string): boolean => {
    const pendingKey = makeKey(competitionId, className);
    if (pendingClassChanges.has(pendingKey)) {
      return pendingClassChanges.get(pendingKey)!;
    }
    const rule = classRules.find(
      r => r.competition_id === competitionId && r.class === className
    );
    return rule?.is_allowed ?? false;
  };

  const getEventActive = (competitionId: string, eventName: string): boolean => {
    const pendingKey = makeEventKey(competitionId, eventName);
    if (pendingEventChanges.has(pendingKey)) {
      return pendingEventChanges.get(pendingKey)!;
    }
    return eventTypes.some(
      e => e.competition_id === competitionId && e.event_name === eventName
    );
  };

  const toggleClass = (competitionId: string, className: string) => {
    if (!isAdmin) {
      toast({ title: "Accesso negato", description: "Solo gli amministratori possono modificare le regole", variant: "destructive" });
      return;
    }
    const key = makeKey(competitionId, className);
    const currentValue = getClassAllowed(competitionId, className);
    setPendingClassChanges(prev => {
      const next = new Map(prev);
      next.set(key, !currentValue);
      return next;
    });
  };

  const toggleEventType = (competitionId: string, eventName: string) => {
    if (!isAdmin) {
      toast({ title: "Accesso negato", description: "Solo gli amministratori possono modificare le regole", variant: "destructive" });
      return;
    }
    const key = makeEventKey(competitionId, eventName);
    const currentValue = getEventActive(competitionId, eventName);
    setPendingEventChanges(prev => {
      const next = new Map(prev);
      next.set(key, !currentValue);
      return next;
    });
  };

  const toggleClassesRange = (competitionId: string, targetClasses: string[]) => {
    if (!isAdmin) return;

    // Check if all target classes are currently allowed
    const allAllowed = targetClasses.every(cls => getClassAllowed(competitionId, cls));
    const newValue = !allAllowed;

    setPendingClassChanges(prev => {
      const next = new Map(prev);
      targetClasses.forEach(cls => {
        const key = makeKey(competitionId, cls);
        if (getClassAllowed(competitionId, cls) !== newValue) {
          next.set(key, newValue);
        }
      });
      return next;
    });
  };

  const toggleAllClasses = (competitionId: string) => toggleClassesRange(competitionId, DANCE_CLASSES);
  const toggleSyllabusClasses = (competitionId: string) => toggleClassesRange(competitionId, ["B1", "B2", "B3", "B", "C", "D"]);

  const toggleEventTypesRange = (competitionId: string, discipline: string, targetNames: string[]) => {
    if (!isAdmin) return;

    // Check if all target events are currently active for this discipline
    const allActive = targetNames.every(name => getEventActive(competitionId, `${discipline} - ${name}`));
    const newValue = !allActive;

    setPendingEventChanges(prev => {
      const next = new Map(prev);
      targetNames.forEach(name => {
        const fullEventName = `${discipline} - ${name}`;
        const key = makeEventKey(competitionId, fullEventName);
        if (getEventActive(competitionId, fullEventName) !== newValue) {
          next.set(key, newValue);
        }
      });
      return next;
    });
  };

  const toggleAllEvents = (competitionId: string, discipline: string) => {
    const events = getEventsForDiscipline(discipline);
    toggleEventTypesRange(competitionId, discipline, events.map(p => p.name));
  };

  const toggleSyllabusEvents = (competitionId: string, discipline: string) => {
    const events = getEventsForDiscipline(discipline);
    const syllabusNames = events.filter(p =>
      p.classes.every(cls => ["B", "B1", "B2", "B3", "C", "D"].includes(cls))
    ).map(p => p.name);
    toggleEventTypesRange(competitionId, discipline, syllabusNames);
  };

  const saveAllChanges = async () => {
    if (pendingClassChanges.size === 0 && pendingEventChanges.size === 0) return;
    setSaving(true);
    try {
      // 1. Save Class Changes
      const classUpsertPromises = [];
      for (const [key, isAllowed] of pendingClassChanges) {
        const { competitionId, className } = parseKey(key);
        const existingRule = classRules.find(
          r => r.competition_id === competitionId && r.class === className
        );
        if (existingRule) {
          classUpsertPromises.push(
            supabase.from("competition_class_rules").update({ is_allowed: isAllowed }).eq("competition_id", competitionId).eq("class", className)
          );
        } else {
          classUpsertPromises.push(
            supabase.from("competition_class_rules").insert({ competition_id: competitionId, class: className, is_allowed: isAllowed })
          );
        }
      }

      // 2. Save Event Changes
      const eventPromises = [];
      for (const [key, isActive] of pendingEventChanges) {
        const [competitionId, fullEventName] = key.split("::");
        // Extract the preset name from "Discipline - EventName"
        const eventNameParts = fullEventName.split(" - ");
        const discipline = eventNameParts[0];
        const presetName = eventNameParts.length > 1 ? eventNameParts[1] : fullEventName;

        const events = getEventsForDiscipline(discipline);
        const preset = events.find(p => p.name === presetName);

        if (isActive) {
          // Insert if not exists
          const exists = eventTypes.some(e => e.competition_id === competitionId && e.event_name === fullEventName);
          if (!exists && preset) {
            eventPromises.push(
              supabase.from("competition_event_types").insert({
                competition_id: competitionId,
                event_name: fullEventName,
                allowed_classes: preset.classes,
                min_age: preset.minAge ?? null,
                max_age: preset.maxAge ?? null,
              })
            );
          }
        } else {
          // Delete if exists
          const existing = eventTypes.find(e => e.competition_id === competitionId && e.event_name === fullEventName);
          if (existing?.id) {
            eventPromises.push(
              supabase.from("competition_event_types").delete().eq("id", existing.id)
            );
          }
        }
      }

      const results = await Promise.all([...classUpsertPromises, ...eventPromises]);
      const hasError = results.some(r => r.error);
      if (hasError) throw results.find(r => r.error)?.error;

      toast({ title: "Salvato", description: "Modifiche salvate con successo" });
      setPendingClassChanges(new Map());
      setPendingEventChanges(new Map());
      fetchData(true); // Background refresh
    } catch (error) {
      console.error("Error saving:", error);
      toast({ title: "Errore", description: "Impossibile salvare le modifiche", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getCompetitionEventTypes = (competitionId: string) => {
    return eventTypes.filter(e => e.competition_id === competitionId);
  };

  const formatDate = (date: string) => {
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
            {isAdmin && <CompetitionsImport onImportComplete={() => fetchData(true)} />}
            {isAdmin && (pendingClassChanges.size > 0 || pendingEventChanges.size > 0) && (
              <Button onClick={saveAllChanges} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva ({pendingClassChanges.size + pendingEventChanges.size})
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
              <p className="text-muted-foreground">Importa le competizioni dalla dashboard per configurare le classi ammesse.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="classes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="classes">Classi Ammesse</TabsTrigger>
              <TabsTrigger value="events">Tipi di Gara</TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" />
                    Configura Classi per Competizione
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Seleziona le classi ammesse per ogni competizione. Le coppie potranno iscriversi solo se la loro classe è abilitata.
                  </p>
                </CardContent>
              </Card>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="min-w-[200px]">Competizione</th>
                      <th className="text-center">Data</th>
                      <th className="text-center px-2">
                        <span className="sr-only">Azioni</span>
                      </th>
                      {DANCE_CLASSES.map(cls => (
                        <th key={cls} className="text-center w-14 text-xs">{cls}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competitions.map(competition => (
                      <tr key={competition.id}>
                        <td className="font-medium">{competition.name}</td>
                        <td className="text-center text-muted-foreground">{formatDate(competition.date)}</td>
                        <td className="text-center">
                          {isAdmin && (
                            <div className="flex flex-wrap gap-1 justify-center min-w-[280px]">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600"
                                onClick={() => toggleAllClasses(competition.id)}
                              >
                                Championship
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600"
                                onClick={() => toggleSyllabusClasses(competition.id)}
                              >
                                Syllabus
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600"
                                onClick={() => toggleAllClasses(competition.id)}
                              >
                                Star Cup
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] bg-green-50 hover:bg-green-100 text-green-600"
                                onClick={() => toggleSyllabusClasses(competition.id)}
                              >
                                Gara di Ballo
                              </Button>
                            </div>
                          )}
                        </td>
                        {DANCE_CLASSES.map(cls => {
                          const isAllowed = getClassAllowed(competition.id, cls);
                          const isPending = pendingClassChanges.has(makeKey(competition.id, cls));
                          return (
                            <td key={cls} className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={isAllowed}
                                  onCheckedChange={() => toggleClass(competition.id, cls)}
                                  disabled={!isAdmin}
                                  className={isPending ? "ring-2 ring-primary" : ""}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
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

                return (
                  <Card key={competition.id}>
                    <CardHeader
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCompetitionForEvents(isExpanded ? null : competition.id)}
                    >
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{competition.name} - {formatDate(competition.date)}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Badge count={compEvents.length} />
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
                                          Classi: {preset.classes.join(", ")}
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
            </TabsContent>
          </Tabs>
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
