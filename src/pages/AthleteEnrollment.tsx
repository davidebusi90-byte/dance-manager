import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, User, Users, Trophy, Calendar, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Check, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBestClass } from "@/lib/class-utils";
import { getCategoryMinAge } from "@/lib/category-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/use-user-role";


interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  category: string;
  class: string;
}

interface Couple {
  id: string;
  category: string;
  class: string;
  disciplines: string[];
  athlete1: Athlete;
  athlete2: Athlete;
  discipline_info?: Record<string, string> | null;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  registration_deadline: string | null;
}



interface EventType {
  id: string;
  competition_id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

export default function AthleteEnrollment() {
  const [cidCode, setCidCode] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  // const [classRules, setClassRules] = useState<ClassRule[]>([]); // Removed unused
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [existingEntries, setExistingEntries] = useState<Set<string>>(new Set());
  const [selectedCompetitions, setSelectedCompetitions] = useState<Set<string>>(new Set());
  const [selectedRaces, setSelectedRaces] = useState<Record<string, string[]>>({});
  const [expandedCompetitions, setExpandedCompetitions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"cid" | "enrollment" | "success" | "couple">("cid");
  const { toast } = useToast();
  const { role: userRole } = useUserRole();

  // Lookup athlete by CID code
  const handleCidLookup = async () => {
    const trimmed = cidCode.trim();
    if (!trimmed) {
      toast({ title: "Inserisci il tuo codice CID", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrollment-data`;
      const res = await fetch(`${baseUrl}?action=search-athletes&q=${encodeURIComponent(trimmed)}`, {
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
      });
      const result = await res.json();
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
        return;
      }

      // Find exact CID match
      const found = (result.data || []).find(
        (a: Athlete) => a.code.toLowerCase() === trimmed.toLowerCase()
      );

      if (!found) {
        toast({
          title: "Codice CID non trovato",
          description: "Verifica il codice inserito e riprova.",
          variant: "destructive",
        });
        return;
      }

      setAthlete(found);
      await fetchCouples(found.id);
      setStep("enrollment");
    } catch (err) {
      console.error("CID lookup error:", err);
      toast({ title: "Errore nella ricerca", variant: "destructive" });
    }
    setLoading(false);
  };

  const fetchCouples = async (athleteId: string) => {
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrollment-data`;
      const res = await fetch(`${baseUrl}?action=couples&athlete_id=${encodeURIComponent(athleteId)}`, {
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
      });
      const result = await res.json();
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
      } else {
        const couplesData = (result.data as Couple[]) || [];
        setCouples(couplesData);

        // Auto-select if only one active couple
        if (couplesData.length === 1) {
          selectCouple(couplesData[0]);
        }
      }
    } catch (err) {
      console.error("Fetch couples error:", err);
      toast({ title: "Errore nel caricamento coppie", variant: "destructive" });
    }
  };

  const fetchCompetitionsAndEntries = async (coupleId: string) => {
    setLoading(true);
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrollment-data`;
      const res = await fetch(`${baseUrl}?action=competitions&couple_id=${encodeURIComponent(coupleId)}`, {
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
      });
      const result = await res.json();
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
      } else {
        setCompetitions(result.competitions || []);
        setExistingEntries(new Set(result.existingEntries || []));
        setEventTypes(result.eventTypes || []);
      }
    } catch (err) {
      console.error("Fetch competitions error:", err);
      toast({ title: "Errore nel caricamento gare", variant: "destructive" });
    }
    setLoading(false);
  };

  const selectCouple = async (couple: Couple) => {
    setSelectedCouple(couple);
    await fetchCompetitionsAndEntries(couple.id);
  };

  const getEffectiveClass = (couple: Couple, eventName: string) => {
    if (!couple.discipline_info) return couple.class;
    const eventNameNorm = eventName.toLowerCase();

    if (eventNameNorm.includes("latino") || eventNameNorm.includes("latini"))
      return couple.discipline_info["latino"] || couple.class;
    if (eventNameNorm.includes("standard"))
      return couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("combinata")) {
      const combClass = couple.discipline_info["combinata"] || couple.class;
      const latClass = couple.discipline_info["latino"];
      const stdClass = couple.discipline_info["standard"];

      let resolvedClass = combClass;
      if (latClass) resolvedClass = getBestClass(resolvedClass, latClass);
      if (stdClass) resolvedClass = getBestClass(resolvedClass, stdClass);
      return resolvedClass;
    }

    // Handle specific Adult classes A1/A2
    if (eventNameNorm.includes("a1")) return couple.discipline_info["a1"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("a2")) return couple.discipline_info["a2"] || couple.discipline_info["latino"] || couple.discipline_info["standard"] || couple.class;
    if (eventNameNorm.includes("master")) return couple.discipline_info["master"] || couple.class;
    if (eventNameNorm.includes("south american"))
      return couple.discipline_info["show_dance_sa"] || couple.class;
    if (eventNameNorm.includes("classic showdance"))
      return couple.discipline_info["show_dance_classic"] || couple.class;
    if (eventNameNorm.includes("show dance") || eventNameNorm.includes("showdance"))
      return couple.discipline_info["show_dance"] || couple.class;

    return couple.class;
  };

  const isEventAllowedByAge = (et: EventType, category: string) => {
    const coupleMinAge = getCategoryMinAge(category);
    // If event has min_age, couple's category min_age must be >= event.min_age
    if (et.min_age !== null && coupleMinAge < et.min_age) return false;
    // If event has max_age, couple's category min_age must be <= event.max_age
    if (et.max_age !== null && coupleMinAge > et.max_age) return false;
    return true;
  };

  /* 
    STRICT ENROLLMENT LOGIC:
    - If a competition has NO event types configured, it is NOT allowed.
    - If event types are configured, the couple must match at least one (Class + Discipline + Age).
  */
  const isCompetitionAllowed = (competition: Competition, couple: Couple) => {
    const compEvents = eventTypes.filter(et => et.competition_id === competition.id);
    if (compEvents.length === 0) return false;

    // Se la coppia è classe D, nascondi la competizione se contiene SOLO gare di classe A
    // (verrà filtrata meglio a livello di singoli eventi, ma questo aiuta a nascondere comp intere)
    const isClasseD = couple.class.toUpperCase() === "D";

    const hasAllowedEvent = compEvents.some(et => {
      // Regola base Classe D: non può mai vedere classi A
      if (isClasseD && (et.event_name.toUpperCase().includes("CLASSE A") || et.event_name.toUpperCase().includes(" A1") || et.event_name.toUpperCase().includes(" A2") || et.event_name.toUpperCase().includes(" AS"))) {
        return false;
      }

      const effectiveClass = getEffectiveClass(couple, et.event_name);

      // Controllo Disciplina
      if (!isEventMatchingCoupleDiscipline(et.event_name, couple.disciplines)) return false;

      // Controllo Età
      if (!isEventAllowedByAge(et, couple.category)) return false;

      // Regole Speciali Classe D per visibilità e iscrizione
      if (isClasseD) {
        const eventNameNorm = et.event_name.toLowerCase();

        // 1. D può ballare C Open, B Open
        if (eventNameNorm.includes("c open") || eventNameNorm.includes("b open")) return true;
      }

      // Regola Universale: Open Classe A solo per 16+ anni
      if (et.event_name.toUpperCase().includes("OPEN CLASSE A")) {
        const coupleMinAge = getCategoryMinAge(couple.category);
        if (coupleMinAge < 16) return false;
      }

      // Regola Universale Under 16 per Classi D, C, B, A
      if (et.event_name.toLowerCase().includes("under 16")) {
        const c = couple.class.toUpperCase();
        if (["D", "C", "B", "B1", "B2", "B3", "A", "A1", "A2"].includes(c)) return true;
      }

      // Controllo Classe standard
      if (!et.allowed_classes.includes(effectiveClass)) return false;

      return true;
    });

    return hasAllowedEvent;
  };

  const getEventDiscipline = (eventName: string): string | null => {
    const lowerName = eventName.toLowerCase();

    // Riconoscimento flessibile (cerca la parola chiave ovunque nel nome)
    if (lowerName.includes("standard")) return "standard";
    if (lowerName.includes("latino") || lowerName.includes("latini") || lowerName.includes("latin")) return "latino";
    if (lowerName.includes("combinata")) return "combinata";

    return null;
  };

  const isEventMatchingCoupleDiscipline = (eventName: string, coupleDisciplines: string[]): boolean => {
    const eventDiscipline = getEventDiscipline(eventName);
    if (!eventDiscipline) return true;

    const normalizedCoupleDisciplines = coupleDisciplines.map(d => d.toLowerCase());

    // Supporto per nuovi nomi completi richiesti
    const isLatino = normalizedCoupleDisciplines.includes("latino") || normalizedCoupleDisciplines.includes("danze latino americane");
    const isStandard = normalizedCoupleDisciplines.includes("standard") || normalizedCoupleDisciplines.includes("danze standard");
    const isCombinata = normalizedCoupleDisciplines.includes("combinata");

    if (eventDiscipline === "latino" && isLatino) return true;
    if (eventDiscipline === "standard" && isStandard) return true;
    if (eventDiscipline === "combinata" && isCombinata) return true;

    return normalizedCoupleDisciplines.includes(eventDiscipline);
  };

  const sortEventTypes = (events: EventType[]) => {
    const getPriority = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.startsWith("danze standard") || lower.startsWith("standard")) return 1;
      if (lower.startsWith("danze latino") || lower.startsWith("latini") || lower.startsWith("latino")) return 2;
      if (lower.startsWith("combinata")) return 3;
      return 4;
    };

    return [...events].sort((a, b) => {
      const pA = getPriority(a.event_name);
      const pB = getPriority(b.event_name);
      if (pA !== pB) return pA - pB;
      return a.event_name.localeCompare(b.event_name);
    });
  };

  const isDeadlinePassed = (competition: Competition) => {
    if (!competition.registration_deadline) return false;
    return new Date() > new Date(competition.registration_deadline);
  };

  const toggleExpansion = (competitionId: string) => {
    setExpandedCompetitions(prev => {
      const next = new Set(prev);
      if (next.has(competitionId)) {
        next.delete(competitionId);
      } else {
        next.add(competitionId);
      }
      return next;
    });
  };

  const toggleRace = (competitionId: string, eventTypeIdOrDiscipline: string, isDiscipline = false) => {
    setSelectedRaces(prev => {
      // Use a special key for disciplines to avoid conflicts with event type IDs
      const key = isDiscipline ? `${competitionId}_disciplines` : competitionId;
      const current = prev[key] || [];
      const nextRaces = current.includes(eventTypeIdOrDiscipline)
        ? current.filter(id => id !== eventTypeIdOrDiscipline)
        : [...current, eventTypeIdOrDiscipline];

      const newSelectedRaces = { ...prev, [key]: nextRaces };

      // Sync selectedCompetitions
      // If ANY race or discipline is selected for this competition, mark it as selected
      const hasRaces = (newSelectedRaces[competitionId]?.length || 0) > 0;
      const hasDisciplines = (newSelectedRaces[`${competitionId}_disciplines`]?.length || 0) > 0;

      setSelectedCompetitions(prevComps => {
        const nextComps = new Set(prevComps);
        if (hasRaces || hasDisciplines) {
          nextComps.add(competitionId);
        } else {
          nextComps.delete(competitionId);
        }
        return nextComps;
      });

      return newSelectedRaces;
    });
  };

  const resetFlow = () => {
    setCidCode("");
    setAthlete(null);
    setCouples([]);
    setSelectedCouple(null);
    setCompetitions([]);
    setEventTypes([]);
    setExistingEntries(new Set());
    setSelectedCompetitions(new Set());
    setExpandedCompetitions(new Set());
    setSelectedRaces({});
    setStep("cid");
  };

  const isReadOnly = userRole === "instructor" || userRole === "supervisor";

  const handleSubmit = async () => {
    if (isReadOnly) {
      toast({
        title: "Azione non consentita",
        description: "Il tuo account ha permessi di sola lettura.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedCouple || selectedCompetitions.size === 0) return;

    setSubmitting(true);
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-enrollment`;
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          couple_id: selectedCouple.id,
          entries: Array.from(selectedCompetitions).map(compId => {
            // Get event type IDs if they exist
            const eventTypeIds = selectedRaces[compId] || [];
            // Get discipline selections if they exist (for competitions without event types)
            const disciplines = selectedRaces[`${compId}_disciplines`] || [];

            return {
              competition_id: compId,
              event_type_ids: eventTypeIds,
              disciplines: disciplines.length > 0 ? disciplines : undefined
            };
          }),
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast({
          title: "Errore nell'iscrizione",
          description: result.error || "Errore durante l'iscrizione",
          variant: "destructive",
        });
      } else {
        setStep("success");
        toast({
          title: "FATTO!",
          description: "La tua iscrizione è stata registrata.",
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast({
        title: "Errore nell'iscrizione",
        description: "Si è verificato un errore. Riprova.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };



  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white/10 rounded-full p-3 flex items-center justify-center">
            <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <h1 className="text-3xl font-bold">Iscrizione Gara</h1>
          <p className="mt-2 opacity-90">Per qualsiasi anomalia contattare <a href="mailto:ufficiogare@ritmodanza.net" className="underline underline-offset-2">ufficiogare@ritmodanza.net</a></p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {userRole === "instructor" && (
          <Alert className="mb-6 border-warning bg-warning/10 text-warning-foreground">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Modalità Sola Lettura</AlertTitle>
            <AlertDescription>
              In qualità di istruttore, puoi visualizzare le iscrizioni ma non puoi effettuarne di nuove.
              Questa funzione è ora riservata agli amministratori o agli atleti stessi tramite il portale pubblico.
            </AlertDescription>
          </Alert>
        )}

        {userRole === "supervisor" && (
          <Alert className="mb-6 border-accent bg-accent/10 text-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Accesso Supervisore</AlertTitle>
            <AlertDescription>
              Hai accesso in sola lettura a tutte le competizioni. Non puoi effettuare nuove iscrizioni.
            </AlertDescription>
          </Alert>
        )}

        {/* Step indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {[
              { id: "cid", label: "Accedi" },
              { id: "enrollment", label: "Iscrizione" },
              { id: "success", label: "Fine" }
            ].map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step === s.id || (step === "enrollment" && s.id === "enrollment")
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : (step === "enrollment" && i === 0) || step === "success"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  {i + 1}
                </div>
                <div className="ml-2 mr-4 hidden sm:block">
                  <p className={`text-xs font-bold uppercase tracking-wider ${step === s.id ? "text-primary" : "text-muted-foreground"}`}>
                    {s.label}
                  </p>
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-muted mr-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: CID Input */}
        {step === "cid" && (
          <Card className="bg-yellow-50/50 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-yellow-700" />
                Inserisci Codice CID
              </CardTitle>
              <CardDescription>
                Inserisci il tuo codice identificativo atleta per accedere alle iscrizioni
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Codice CID..."
                  value={cidCode}
                  onChange={(e) => setCidCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCidLookup()}
                  className="font-mono"
                />
                <Button onClick={handleCidLookup} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Il codice CID è il tuo identificativo presente nella tessera o nel foglio atleti.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Enrollment (Couple selection + Competitions) */}
        {step === "enrollment" && athlete && (
          <div className="space-y-6">
            {!selectedCouple ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Seleziona Partner
                  </CardTitle>
                  <CardDescription>
                    Coppie attive di {athlete.first_name} {athlete.last_name} ({athlete.code})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                    </div>
                  ) : couples.length > 0 ? (
                    <div className="space-y-2">
                      {couples.map((couple) => {
                        const partner =
                          couple.athlete1.id === athlete.id
                            ? couple.athlete2
                            : couple.athlete1;

                        return (
                          <Button
                            key={couple.id}
                            variant="outline"
                            className="w-full justify-start h-auto py-4"
                            onClick={() => selectCouple(couple)}
                          >
                            <Users className="w-5 h-5 mr-3" />
                            <div className="text-left flex-1">
                              <div className="font-medium">
                                Con {partner.first_name} {partner.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {couple.category} • Classe {couple.class}
                              </div>
                              <div className="flex gap-1 mt-1">
                                {couple.disciplines.map((d) => (
                                  <Badge key={d} variant="secondary" className="text-xs">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nessuna coppia attiva trovata.</p>
                      <p className="text-sm">Contatta il tuo istruttore.</p>
                    </div>
                  )}

                  <Button variant="ghost" onClick={resetFlow} className="w-full">
                    ← Torna all'inserimento CID
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Partner Summary Card */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-foreground" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground mb-0.5">Iscrizione in coppia con:</p>
                        <p className="font-bold text-lg leading-tight uppercase">
                          {selectedCouple.athlete1.id === athlete.id
                            ? `${selectedCouple.athlete2.first_name} ${selectedCouple.athlete2.last_name}`
                            : `${selectedCouple.athlete1.first_name} ${selectedCouple.athlete1.last_name}`}
                        </p>

                        <div className="mt-1 space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {selectedCouple.category} • Classe {selectedCouple.class}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {selectedCouple.disciplines.map((d) => {
                              let label = d;
                              if (d.toLowerCase() === "standard") label = "Danze Standard";
                              if (d.toLowerCase() === "latino") label = "Danze Latino Americane";
                              if (d.toLowerCase() === "combinata") label = "Combinata";

                              return (
                                <Badge key={d} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCouple(null);
                        setSelectedCompetitions(new Set());
                        setSelectedRaces({});
                        setExpandedCompetitions(new Set());
                        setStep("enrollment"); // Reset to enrollment step to pick couple
                      }}
                      className="text-primary hover:text-primary hover:bg-primary/10 shrink-0 self-start sm:self-center ml-auto sm:ml-0"
                    >
                      Cambia Partner
                    </Button>
                  </CardContent>
                </Card>

                {/* Competitions Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Seleziona Gare
                    </CardTitle>
                    <CardDescription>
                      Gare disponibili per la tua categoria e classe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                      </div>
                    ) : competitions.length > 0 ? (
                      <div className="space-y-3">
                        {competitions
                          .filter(competition => isCompetitionAllowed(competition, selectedCouple)) // Mostra solo competizioni permesse
                          .map((competition) => {
                            const isAllowed = true; // Già filtrato sopra
                            const alreadyEnrolled = existingEntries.has(competition.id);
                            const deadlinePassed = isDeadlinePassed(competition);
                            const isDisabled = !isAllowed || alreadyEnrolled || deadlinePassed;
                            const isSelected = selectedCompetitions.has(competition.id);
                            const isExpanded = expandedCompetitions.has(competition.id);

                            const selectedRacesCount = (selectedRaces[competition.id]?.length || 0) + (selectedRaces[`${competition.id}_disciplines`]?.length || 0);

                            return (
                              <div
                                key={competition.id}
                                className={`border rounded-lg overflow-hidden transition-all ${isDisabled
                                  ? "opacity-50 bg-muted"
                                  : isSelected
                                    ? "border-primary/50 bg-primary/5"
                                    : "hover:border-primary/50"
                                  }`}
                              >
                                {/* Accordion Header */}
                                <div
                                  className={`p-4 flex items-center gap-3 cursor-pointer ${isExpanded ? "bg-muted/50" : ""}`}
                                  onClick={() => !isDisabled && toggleExpansion(competition.id)}
                                >
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}>
                                    {isSelected ? <Check className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{competition.name}</div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(competition.date)}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {alreadyEnrolled && (
                                        <Badge variant="secondary" className="text-xs">
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          Già iscritto
                                        </Badge>
                                      )}
                                      {!isAllowed && (
                                        <Badge variant="destructive" className="text-xs">
                                          <AlertCircle className="w-3 h-3 mr-1" />
                                          Non disponibile
                                        </Badge>
                                      )}
                                      {deadlinePassed && !alreadyEnrolled && (
                                        <Badge variant="outline" className="text-xs">
                                          Iscrizioni chiuse
                                        </Badge>
                                      )}
                                      {isSelected && (
                                        <Badge variant="default" className="text-xs bg-primary/80 hover:bg-primary/80">
                                          {selectedRacesCount} gare selezionate
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Side: Chevron & Confirm Button */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isExpanded && !isDisabled && (
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpansion(competition.id);
                                        }}
                                        className="gap-2 h-8 hidden sm:flex"
                                      >
                                        <Check className="w-3 h-3" />
                                        Conferma
                                      </Button>
                                    )}

                                    {!isDisabled && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpansion(competition.id);
                                        }}
                                      >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && !isDisabled && (
                                  <div className="p-4 pt-0 border-t bg-background animate-in slide-in-from-top-2">
                                    <div className="mt-4 space-y-3">
                                      <p className="text-sm font-semibold flex items-center gap-2 mb-4">
                                        Seleziona le gare:
                                      </p>

                                      <div className="grid gap-2">
                                        {sortEventTypes(eventTypes)
                                          .filter(et => et.competition_id === competition.id)
                                          .filter(et => isEventMatchingCoupleDiscipline(et.event_name, selectedCouple.disciplines))
                                          .filter(et => isEventAllowedByAge(et, selectedCouple.category))
                                          .filter(et => {
                                            // 1. Controllo Idoneità (Età e Classe)
                                            const effectiveClass = getEffectiveClass(selectedCouple, et.event_name);
                                            let isRaceAllowed = et.allowed_classes.includes(effectiveClass);
                                            const eventNameNorm = et.event_name.toLowerCase();
                                            const c = selectedCouple.class.toUpperCase();

                                            // Regola Universale Under 16 (D-A)
                                            if (eventNameNorm.includes("under 16") && ["D", "C", "B", "B1", "B2", "B3", "A", "A1", "A2"].includes(c)) {
                                              isRaceAllowed = true;
                                            } else if (c === "D") {
                                              const coupleMinAge = getCategoryMinAge(selectedCouple.category);
                                              if (eventNameNorm.includes("c open") || eventNameNorm.includes("b open") || eventNameNorm.includes("under 16")) isRaceAllowed = true;
                                              else if (coupleMinAge >= 35 && (eventNameNorm.includes("over") || eventNameNorm.includes("adult open"))) isRaceAllowed = true;
                                              else if (coupleMinAge >= 16 && coupleMinAge <= 18 && (eventNameNorm.includes("youth open") || eventNameNorm.includes("adult open"))) isRaceAllowed = true;
                                              else if (coupleMinAge >= 19 && coupleMinAge <= 34 && eventNameNorm.includes("adult open")) isRaceAllowed = true;
                                              else if (coupleMinAge >= 19 && coupleMinAge <= 20 && eventNameNorm.includes("under 21")) isRaceAllowed = true;
                                            }

                                            if (!isRaceAllowed) return false;

                                            // 2. Filtro aggiuntivo visibilità Classe D (A, A1, A2, AS)
                                            if (c === "D") {
                                              const name = et.event_name.toUpperCase();
                                              if (name.includes("CLASSE A") || name.includes(" A1") || name.includes(" A2") || name.includes(" AS")) return false;
                                            }
                                            return true;
                                          })
                                          .map(et => {
                                            const isRaceSelected = (selectedRaces[competition.id] || []).includes(et.id);

                                            return (
                                              <div
                                                key={et.id}
                                                className={`flex items-center gap-3 p-3 rounded-md transition-colors border ${isRaceSelected
                                                  ? "bg-primary/5 border-primary"
                                                  : "hover:bg-muted border-transparent bg-muted/30"
                                                  } cursor-pointer`}
                                                onClick={() => toggleRace(competition.id, et.id)}
                                              >
                                                <Checkbox
                                                  id={et.id}
                                                  checked={isRaceSelected}
                                                  onCheckedChange={() => toggleRace(competition.id, et.id)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex-1">
                                                  <Label
                                                    htmlFor={et.id}
                                                    className="text-sm font-medium cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    {et.event_name}
                                                  </Label>
                                                </div>
                                              </div>
                                            );
                                          })
                                        }

                                        {eventTypes.filter(et => et.competition_id === competition.id).length === 0 && (
                                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                                            <p className="text-sm text-destructive font-medium">
                                              Nessuna gara disponibile per la tua categoria/disciplina.
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex justify-end pt-4 mt-4 border-t sm:hidden">
                                        <Button
                                          size="sm"
                                          onClick={() => toggleExpansion(competition.id)}
                                          className="gap-2 w-full"
                                          disabled={isReadOnly}
                                        >
                                          <Check className="w-4 h-4" />
                                          Conferma Selezione
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna gara disponibile al momento.</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCouple(null);
                          setSelectedCompetitions(new Set());
                          setSelectedRaces({});
                        }}
                        className="flex-1"
                      >
                        ← Indietro
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={selectedCompetitions.size === 0 || submitting}
                        className="flex-1"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Iscriviti ({selectedCompetitions.size})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Fatto!</h2>
              <p className="text-muted-foreground mb-6">
                La tua iscrizione è stata registrata. <br />
                Ricorda di lasciare la quota in buchetta.
              </p>
              <Button onClick={resetFlow}>Nuova Iscrizione</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
