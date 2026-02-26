import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Trophy, Settings, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitionsImport from "@/components/CompetitionsImport";
import AddCompetitionDialog from "@/components/AddCompetitionDialog";
import * as XLSX from "xlsx";

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
  { name: "Youth (16/18)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 16, maxAge: 18 },

  // Under 16 & Under 21 (Special)
  { name: "Under 16", classes: ["D", "C", "B1", "B2", "B3", "A1", "A2", "AS"], maxAge: 15 },
  { name: "Under 21", classes: ["D", "C", "B1", "B2", "B3", "A1", "A2", "AS"], minAge: 16, maxAge: 20 },

  // Adult
  { name: "Adult (19/34)", classes: ["D", "C", "B1", "B2", "B3", "A1", "A2", "AS", "MASTER"], minAge: 19, maxAge: 34 },

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
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const [competitionsRes, eventTypesRes] = await Promise.all([
        supabase.from("competitions").select("id, name, date, end_date, is_deleted").eq("is_deleted", false).order("date", { ascending: true }) as any,
        supabase.from("competition_event_types").select("*"),
      ]);

      if (competitionsRes.data) {
        // Extra safety: deduplicate by name and date in case duplicates already exist in DB
        const unique = new Map();
        (competitionsRes.data as any[]).forEach(c => {
          const key = `${c.name.toLowerCase()}-${c.date}`;
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
    setPendingEventChanges(prev => {
      const next = new Map(prev);
      next.set(key, !currentValue);
      return next;
    });
  };

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
    if (pendingEventChanges.size === 0) return;
    setSaving(true);
    try {
      // Save Event Changes
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

  const exportCompetitionsToExcel = async () => {
    try {
      const { data: allCompetitions, error } = await supabase
        .from("competitions")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;

      const exportData = allCompetitions.map(comp => ({
        "Nome": comp.name,
        "Data": comp.date,
        "Data Fine": comp.end_date || "",
        "Luogo": comp.location || "",
        "Scadenza": comp.registration_deadline || "",
        "Data Aumento Quota": comp.late_fee_deadline || "",
        "Descrizione": comp.description || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Competizioni");
      XLSX.writeFile(wb, "Competizioni_Aggiornate.xlsx");

      toast({
        title: "Excel generato",
        description: "Il file delle competizioni è stato aggiornato e scaricato."
      });
    } catch (error) {
      console.error("Error exporting competitions:", error);
      toast({
        title: "Errore export",
        description: "Impossibile generare il file Excel",
        variant: "destructive"
      });
    }
  };

  const handleCompetitionAdded = async () => {
    await fetchData(true);
    await exportCompetitionsToExcel();
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
            {isAdmin && <CompetitionsImport onImportComplete={() => fetchData(true)} />}
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
              <p className="text-muted-foreground">Importa le competizioni dalla dashboard per configurare i tipi di gara.</p>
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

              return (
                <Card key={competition.id}>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCompetitionForEvents(isExpanded ? null : competition.id)}
                  >
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{competition.name} - {formatDate(competition.date, competition.end_date)}</span>
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
