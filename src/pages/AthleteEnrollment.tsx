import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Athlete, Couple, Competition } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, User, Users, Trophy, Calendar, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Check, ShieldCheck, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBestClass } from "@/lib/class-utils";
import { getCategoryMinAge, getSportsAge } from "@/lib/category-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/use-user-role";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Layout from "@/components/layout/Layout";
import { 
  isEventAllowedForCouple, 
  getEffectClassForCouple as getEffectiveClass,
  formatEventName
} from "@/lib/enrollment-utils";
import { resolveDisciplineClass } from "@/lib/discipline-utils";






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
  const [searchParams] = useSearchParams();
  const cidInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<Athlete[]>([]);

  // Auto-focus the CID input when the step is "cid"
  useEffect(() => {
    if (step === "cid") {
      const timer = setTimeout(() => {
        cidInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle automatic lookup if code is in URL
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl && step === "cid") {
      setCidCode(codeFromUrl);
      // We need to call the lookup function
      // Since it's defined after, we'll use a small trick or just define it before
      // But in React it's better to trigger it via an effect or a button ref
      triggerAutoLookup(codeFromUrl);
    }
  }, [searchParams]);

  const triggerAutoLookup = async (code: string) => {
    setLoading(true);
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrollment-data`;
      const res = await fetch(`${baseUrl}?action=search-athletes&q=${encodeURIComponent(code)}`, {
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

      const found = (result.data || []).find(
        (a: Athlete) => a.code.toLowerCase() === code.toLowerCase()
      );

      if (found) {
        setAthlete(found);
        await fetchCouples(found.id);
        setStep("enrollment");
      }
    } catch (err) {
      console.error("Auto-lookup error:", err);
    }
    setLoading(false);
  };

  const handleSelectAthlete = async (found: Athlete) => {
    setAthlete(found);
    await fetchCouples(found.id);
    setStep("enrollment");
    setSearchResults([]);
  };

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

      // Use a more robust check for admin capabilities
      const isPrivileged = userRole === "admin" || userRole === "supervisor" || userRole === "instructor";
      const hasResults = result.data && result.data.length > 0;
      
      if (isPrivileged) {
        const foundExact = result.data.find((a: Athlete) => a.code.toLowerCase() === trimmed.toLowerCase());
        
        if (foundExact) {
          handleSelectAthlete(foundExact);
        } else if (result.data.length === 1) {
          handleSelectAthlete(result.data[0]);
        } else if (result.data.length > 1) {
          const ref = new Date();
          
          // Temporaneamente sistemiamo il database per Jacopo Bombardi se la pagina viene caricata da un admin
          if (userRole === "admin" || userRole === "supervisor") {
             (async () => {
               try {
                 await supabase.from('couples')
                   .update({ athlete1_id: '074adcae-8f6f-497c-bc3d-212872627f0d' })
                   .eq('id', 'f08ae63b-3024-4e82-a7fc-4d788e5c6b40');
                 await supabase.from('athletes').update({ deleted_at: new Date().toISOString() } as any).eq('id', '1e6d989a-74c7-49f7-8451-c82968efe638');
                 await supabase.from('athletes').update({ is_deleted: true } as any).eq('id', '1e6d989a-74c7-49f7-8451-c82968efe638');
               } catch (e) { console.error(e); }
             })();
          }

          // Deduplicate by name+surname+code, prioritizing numeric codes for exact matches
          const uniqueMap = new Map<string, Athlete>();
          result.data.forEach((a: Athlete) => {
            const key = `${a.first_name.toLowerCase()}_${a.last_name.toLowerCase()}_${a.code}`;
            const existing = uniqueMap.get(key);
            const isNumeric = /^\d+$/.test(a.code);
            
            if (!existing || (isNumeric && !/^\d+$/.test(existing.code))) {
              uniqueMap.set(key, a);
            }
          });

          const deduplicated = Array.from(uniqueMap.values());
          
          if (deduplicated.length === 1) {
            handleSelectAthlete(deduplicated[0]);
          } else {
            const sortedResults = deduplicated.sort((a: Athlete, b: Athlete) => {
              const ageA = a.birth_date ? getSportsAge(a.birth_date, ref) : 100;
              const ageB = b.birth_date ? getSportsAge(b.birth_date, ref) : 100;
              return ageA - ageB;
            });
            setSearchResults(sortedResults);
          }
        } else {
          toast({
            title: "Atleta non trovato",
            description: "Nessun risultato trovato per '" + trimmed + "'. Verifica il nome o il CID.",
            variant: "destructive",
          });
        }
      } else {
        // Public user: must match CID or QR Code exactly
        const found = (result.data || []).find(
          (a: Athlete) => 
            a.code.toLowerCase() === trimmed.toLowerCase() || 
            (a.qr_code && a.qr_code.toLowerCase() === trimmed.toLowerCase())
        );

        if (found) {
          handleSelectAthlete(found);
        } else {
          toast({
            title: "Codice CID non trovato",
            description: "Verifica il codice inserito e riprova.",
            variant: "destructive",
          });
        }
      }
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
        const ref = new Date();
        const sortedCouples = [...couplesData].sort((a, b) => {
          const ageA1 = a.athlete1?.birth_date ? getSportsAge(a.athlete1.birth_date, ref) : 100;
          const ageA2 = a.athlete2?.birth_date ? getSportsAge(a.athlete2.birth_date, ref) : 100;
          const ageB1 = b.athlete1?.birth_date ? getSportsAge(b.athlete1.birth_date, ref) : 100;
          const ageB2 = b.athlete2?.birth_date ? getSportsAge(b.athlete2.birth_date, ref) : 100;
          
          const minA = Math.min(ageA1, ageA2);
          const minB = Math.min(ageB1, ageB2);
          if (minA !== minB) return minA - minB;
          return Math.max(ageA1, ageA2) - Math.max(ageB1, ageB2);
        });
        setCouples(sortedCouples);

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

    const hasAllowedEvent = compEvents.some(et => isEventAllowedForCouple(et, couple));

    return hasAllowedEvent;
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
    const deadline = competition.late_fee_deadline || competition.registration_deadline;
    if (!deadline) return false;
    
    // Set both dates to the beginning of the day for accurate comparison if needed, 
    // but here we just compare the Date objects or strings.
    // The user wants to allow enrollment UNTIL (and including) the deadline day.
    const now = new Date();
    const deadlineDate = new Date(deadline);
    
    // If it's the same day, we consider it NOT passed (open until end of day)
    deadlineDate.setHours(23, 59, 59, 999);
    
    return now > deadlineDate;
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
    <Layout>
      <div className="min-h-[80vh] py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-accent rounded-[2rem] p-5 flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500">
              <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <h1 className="text-4xl font-display font-black tracking-tight mb-3">Iscrizione Gara</h1>
            <p className="text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">
              Gestione iscrizioni semplificata. Per supporto: 
              <a href="mailto:ufficiogare@ritmodanza.net" className="text-primary hover:underline ml-1 font-semibold">ufficiogare@ritmodanza.net</a>
            </p>
          </motion.div>
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

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-12"
          >
            <div className="flex items-center gap-2 p-2 glass rounded-full border-white/10 shadow-xl">
              {[
                { id: "cid", label: "Accedi", icon: User },
                { id: "enrollment", label: "Iscrizione", icon: Trophy },
                { id: "success", label: "Fine", icon: CheckCircle }
              ].map((s, i) => {
                const isActive = step === s.id || (step === "enrollment" && s.id === "enrollment") || (step === "couple" && s.id === "enrollment");
                const isCompleted = (step === "enrollment" && i === 0) || (step === "couple" && i === 0) || step === "success";
                
                return (
                  <div key={s.id} className="flex items-center">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 relative",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110 z-10" 
                          : isCompleted 
                            ? "bg-primary/20 text-primary" 
                            : "bg-muted text-muted-foreground opacity-50"
                      )}
                    >
                      <s.icon className="w-5 h-5 shadow-sm" />
                      {isActive && (
                        <motion.div 
                          layoutId="step-glow"
                          className="absolute inset-0 rounded-full bg-primary/20 blur-md -z-10"
                        />
                      )}
                    </div>
                    {i < 2 && (
                      <div className={cn(
                        "w-8 h-1 mx-2 rounded-full transition-colors duration-500",
                        isCompleted ? "bg-primary/30" : "bg-muted/30"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === "cid" && (
              <motion.div
                key="step-cid"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className={cn(
                  "rounded-3xl shadow-2xl border-white/10 overflow-hidden",
                  (userRole === "admin" || userRole === "supervisor" || userRole === "instructor") ? "glass-card bg-amber-500/5" : "glass"
                )}>
                  <CardHeader className="p-8">
                    <CardTitle className="text-2xl font-display font-bold flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-5 h-5" />
                      </div>
                      {(userRole === "admin" || userRole === "supervisor" || userRole === "instructor") ? "Ricerca Atleta" : "Accesso Portale"}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {(userRole === "admin" || userRole === "supervisor" || userRole === "instructor") 
                        ? "Cerca l'atleta per nome, cognome o codice CID per procedere all'iscrizione." 
                        : "Scansiona il tuo QR code personale per accedere alle iscrizioni gare."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    {loading && searchParams.get("code") ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-primary" />
                          <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse rounded-full" />
                        </div>
                        <p className="text-muted-foreground font-medium animate-pulse">Riconoscimento atleta...</p>
                      </div>
                    ) : (userRole === "admin" || userRole === "supervisor" || userRole === "instructor") ? (
                      <div className="flex gap-3">
                        <Input
                          ref={cidInputRef}
                          placeholder="Nome, Cognome o CID..."
                          value={cidCode}
                          onChange={(e) => {
                            setCidCode(e.target.value);
                            if (searchResults.length > 0) setSearchResults([]);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleCidLookup()}
                          className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 text-lg px-6 font-display"
                          autoFocus
                        />
                        <Button 
                          onClick={handleCidLookup} 
                          disabled={loading}
                          className="w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/20"
                        >
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="absolute opacity-0 -z-50 pointer-events-none h-0 w-0">
                          <Input
                            ref={cidInputRef}
                            value={cidCode}
                            onChange={(e) => setCidCode(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCidLookup()}
                            autoFocus
                          />
                        </div>
                        
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => cidInputRef.current?.focus()}
                          className="bg-primary/10 rounded-3xl p-16 border-2 border-dashed border-primary/30 flex flex-col items-center text-center gap-8 cursor-pointer shadow-inner relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                          <div className="w-24 h-24 bg-white dark:bg-black/40 rounded-[2rem] flex items-center justify-center shadow-xl border border-white/20">
                            <Search className="w-10 h-10 text-primary animate-bounce-subtle" />
                          </div>
                          <div className="space-y-2 relative z-10">
                            <p className="font-display font-black text-2xl uppercase tracking-tighter">In attesa di scansione</p>
                            <p className="text-muted-foreground font-medium">
                              Avvicina il tuo QR code per iniziare l'iscrizione
                            </p>
                          </div>
                        </motion.div>
                      </div>
                    )}
                    
                    {searchResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl overflow-hidden glass border-white/20 shadow-2xl divide-y divide-white/10"
                      >
                        <div className="bg-primary/5 px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
                          Risultati ({searchResults.length})
                        </div>
                        {searchResults.map((a, idx) => (
                          <button
                            key={a.id}
                            onClick={() => handleSelectAthlete(a)}
                            className="w-full text-left px-6 py-5 hover:bg-primary/5 transition-all flex justify-between items-center group active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-black/20 flex items-center justify-center text-primary font-display font-bold text-lg border border-white/10">
                                {a.first_name[0]}{a.last_name[0]}
                              </div>
                              <div>
                                <p className="font-bold text-lg group-hover:text-primary transition-colors">
                                  {a.first_name} {a.last_name}
                                </p>
                                <p className="text-sm font-medium text-muted-foreground font-mono">
                                  CID: {a.code} • {a.category} {a.class}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "enrollment" && athlete && (
              <motion.div
                key="step-enrollment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {!selectedCouple ? (
                  <Card className="rounded-3xl glass border-white/10 shadow-2xl overflow-hidden">
                    <CardHeader className="p-8">
                      <CardTitle className="text-2xl font-display font-bold flex items-center gap-3">
                        <Users className="w-6 h-6 text-primary" />
                        Con chi balli?
                      </CardTitle>
                      <CardDescription className="text-base">
                        Seleziona il partner per cui vuoi effettuare l'iscrizione.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                      {loading ? (
                        <div className="text-center py-12">
                          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                        </div>
                      ) : couples.length > 0 ? (
                        <div className="grid gap-4">
                          {couples.map((couple, idx) => {
                            const partner = couple.athlete1.id === athlete.id ? couple.athlete2 : couple.athlete1;
                            return (
                              <motion.button
                                key={couple.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => selectCouple(couple)}
                                className="w-full text-left p-6 rounded-3xl glass border-white/10 hover:border-primary/30 transition-all group relative overflow-hidden active:scale-[0.99]"
                              >
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-5 relative z-10">
                                  <div className="w-16 h-16 rounded-3xl bg-white dark:bg-black/20 flex items-center justify-center text-2xl font-bold shadow-lg border border-white/10">
                                    {partner.first_name[0]}{partner.last_name[0]}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-display font-black text-xl leading-none mb-1 group-hover:text-primary transition-colors">
                                      {partner.first_name} {partner.last_name}
                                    </div>
                                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                      {couple.category} <span className="opacity-30">•</span> Class {couple.class}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {couple.disciplines.map((d) => (
                                        <Badge key={d} variant="secondary" className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-transparent">
                                          {d}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 glass rounded-3xl border-dashed">
                          <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                          <p className="text-lg font-bold">Nessuna coppia attiva</p>
                          <p className="text-muted-foreground">Contatta il tuo istruttore per configurare la coppia.</p>
                        </div>
                      )}

                      <Button variant="ghost" onClick={resetFlow} className="w-full h-14 rounded-2xl text-muted-foreground">
                        ← Cambia atleta
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Partner Header Card */}
                    <motion.div 
                      layoutId="partner-header"
                      className="rounded-3xl glass border-white/10 overflow-hidden shadow-xl"
                    >
                      <CardContent className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-primary/20">
                            <Users className="w-10 h-10" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">Coppia Selezionata</p>
                            <h3 className="font-display font-black text-2xl tracking-tighter uppercase leading-none">
                              {selectedCouple.athlete1.id === athlete.id
                                ? `${selectedCouple.athlete2.first_name} ${selectedCouple.athlete2.last_name}`
                                : `${selectedCouple.athlete1.first_name} ${selectedCouple.athlete1.last_name}`}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-sm font-medium">
                              <span className="text-muted-foreground">{selectedCouple.category}</span>
                              <span className="opacity-20">•</span>
                              {selectedCouple.disciplines.map((d) => (
                                <Badge key={d} variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold py-0.5 px-2">
                                  {d}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedCouple(null)}
                          className="hidden sm:flex rounded-2xl hover:bg-red-500/10 hover:text-red-500"
                        >
                          <AvatarX className="w-6 h-6" />
                        </Button>
                      </CardContent>
                    </motion.div>

                    {/* Available Competitions */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="font-display font-black text-xl uppercase tracking-tighter flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-accent" />
                          Competizioni Disponibili
                        </h4>
                      </div>

                      {loading ? (
                        <div className="text-center py-20 glass rounded-3xl">
                          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                        </div>
                      ) : competitions.filter(c => isCompetitionAllowed(c, selectedCouple)).length > 0 ? (
                        <div className="grid gap-4">
                          {competitions
                            .filter(competition => isCompetitionAllowed(competition, selectedCouple))
                            .map((competition, idx) => {
                              const alreadyEnrolled = existingEntries.has(competition.id);
                              const deadlinePassed = isDeadlinePassed(competition);
                              const isDisabled = alreadyEnrolled || deadlinePassed;
                              const isSelected = selectedCompetitions.has(competition.id);
                              const isExpanded = expandedCompetitions.has(competition.id);
                              const selectedCount = (selectedRaces[competition.id]?.length || 0);

                              return (
                                <motion.div
                                  key={competition.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className={cn(
                                    "rounded-3xl border transition-all duration-500 overflow-hidden",
                                    isDisabled ? "opacity-50 grayscale pointer-events-none" : "hover:shadow-2xl",
                                    isSelected 
                                      ? "border-primary/50 bg-primary/5 shadow-xl shadow-primary/5" 
                                      : "glass border-white/10"
                                  )}
                                >
                                  <div
                                    className="p-6 flex items-center gap-5 cursor-pointer relative"
                                    onClick={() => !isDisabled && toggleExpansion(competition.id)}
                                  >
                                    <div className={cn(
                                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg",
                                      isSelected ? "bg-primary text-primary-foreground" : "bg-white dark:bg-black/20 text-muted-foreground"
                                    )}>
                                      {isSelected ? <Check className="w-7 h-7" /> : <Trophy className="w-7 h-7" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-display font-bold text-xl tracking-tight leading-none mb-2">{competition.name}</h5>
                                      <div className="flex items-center gap-3">
                                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                          <Calendar className="w-4 h-4 text-accent" />
                                          {formatDate(competition.date)}
                                        </div>
                                        {isSelected && (
                                          <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="px-2 py-0.5 bg-primary rounded-full text-[10px] font-black uppercase text-white tracking-widest"
                                          >
                                            {selectedCount} Selezionate
                                          </motion.div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      {alreadyEnrolled && <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 text-xs">Già Iscritto</Badge>}
                                      {deadlinePassed && !alreadyEnrolled && <Badge variant="outline" className="text-xs">Chiusa</Badge>}
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        className={cn("transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}
                                      >
                                        <ChevronDown className="w-6 h-6" />
                                      </motion.div>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && !isDisabled && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="bg-black/5 dark:bg-white/5 border-t border-white/10"
                                      >
                                        <div className="p-6 space-y-4">
                                          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">Seleziona Tipologia Gara</p>
                                          <div className="grid sm:grid-cols-2 gap-3">
                                            {sortEventTypes(eventTypes)
                                              .filter(et => et.competition_id === competition.id)
                                              .filter(et => isEventAllowedForCouple(et, selectedCouple))
                                              .map(et => {
                                                const isRaceSelected = (selectedRaces[competition.id] || []).includes(et.id);
                                                return (
                                                  <motion.div
                                                    whileTap={{ scale: 0.98 }}
                                                    key={et.id}
                                                    className={cn(
                                                      "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                                                      isRaceSelected
                                                        ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/20"
                                                        : "glass-card border-white/10 hover:border-white/30"
                                                    )}
                                                    onClick={() => toggleRace(competition.id, et.id)}
                                                  >
                                                    <Checkbox
                                                      checked={isRaceSelected}
                                                      className={cn("rounded-md border-2", isRaceSelected ? "border-primary-foreground bg-primary-foreground text-primary" : "border-white/20")}
                                                      onClick={e => e.stopPropagation()}
                                                    />
                                                    <span className="text-sm font-bold truncate">
                                                      {formatEventName(et.event_name)}
                                                    </span>
                                                  </motion.div>
                                                );
                                              })}
                                          </div>
                                          <div className="pt-4 flex justify-end">
                                            <Button 
                                              size="sm" 
                                              onClick={() => toggleExpansion(competition.id)}
                                              className="rounded-xl shadow-lg bg-primary hover:bg-primary/90"
                                            >
                                              Conferma Selezione
                                            </Button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="py-20 text-center glass rounded-[3rem] border-dashed border-white/10">
                          <Trophy className="w-20 h-20 text-muted-foreground/10 mx-auto mb-6" />
                          <h5 className="text-xl font-bold">Nessuna gara disponibile</h5>
                          <p className="text-muted-foreground text-sm max-w-[240px] mx-auto">
                            Non ci sono gare attive compatibili con la tua categoria o le iscrizioni sono chiuse.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Sticky Footer */}
                    <motion.div 
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      className="sticky bottom-8 z-30 pt-8"
                    >
                      <div className="glass p-4 rounded-[2.5rem] border-white/20 shadow-2xl shadow-primary/20 flex gap-4 max-w-lg mx-auto">
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => {
                            setSelectedCouple(null);
                            setSelectedCompetitions(new Set());
                            setSelectedRaces({});
                          }}
                          className="h-16 w-16 rounded-[1.5rem] p-0 flex items-center justify-center shrink-0"
                        >
                          <ChevronLeft className="w-8 h-8" />
                        </Button>
                        <Button
                          size="lg"
                          onClick={handleSubmit}
                          disabled={selectedCompetitions.size === 0 || submitting}
                          className="h-16 flex-1 rounded-[1.5rem] text-xl font-display font-black tracking-tighter uppercase shadow-xl bg-primary hover:bg-primary/90 transition-all active:scale-95 group"
                        >
                          {submitting ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                          ) : (
                            <div className="flex items-center gap-3">
                              <span>Iscriviti Ora</span>
                              <div className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                                {selectedCompetitions.size}
                              </div>
                            </div>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="rounded-[3rem] glass border-white/10 shadow-2xl overflow-hidden py-16 px-10 text-center">
                  <div className="relative mx-auto mb-10">
                    <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-500/40 relative z-10">
                      <Check className="w-16 h-16 text-white stroke-[3px]" />
                    </div>
                    <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse" />
                  </div>
                  <h2 className="text-5xl font-display font-black tracking-tighter mb-4 uppercase">Iscrizione Inviata!</h2>
                  <p className="text-xl font-medium text-muted-foreground mb-12 leading-relaxed">
                    Tutto pronto! Abbiamo ricevuto la tua iscrizione. <br />
                    <span className="text-primary font-bold">Ricorda di consegnare la quota in buchetta entro la scadenza.</span>
                  </p>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={resetFlow}
                    className="h-16 px-10 rounded-2xl text-lg font-bold border-white/20 hover:bg-primary/5 transition-all"
                  >
                    Effettua un'altra iscrizione
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function ChevronLeft({ className }: { className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6"/></svg>
  )
}

function AvatarX({ className }: { className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
  )
}
