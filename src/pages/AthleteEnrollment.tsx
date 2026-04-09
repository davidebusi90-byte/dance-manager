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
import { Search, User, Users, Trophy, Calendar, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronLeft, ChevronRight, Check, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSportsAge } from "@/lib/category-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/use-user-role";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Layout from "@/components/layout/Layout";
import { 
  isEventAllowedForCouple, 
  formatEventName
} from "@/lib/enrollment-utils";

interface EventType {
  id: string;
  competition_id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

export default function AthleteEnrollment({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [cidCode, setCidCode] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
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

  useEffect(() => {
    if (step === "cid") {
      const timer = setTimeout(() => {
        cidInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl && step === "cid") {
      setCidCode(codeFromUrl);
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

      const isPrivileged = userRole === "admin" || userRole === "supervisor" || userRole === "instructor";
      
      if (isPrivileged) {
        const foundExact = result.data.find((a: Athlete) => a.code.toLowerCase() === trimmed.toLowerCase());
        
        if (foundExact) {
          handleSelectAthlete(foundExact);
        } else if (result.data.length === 1) {
          handleSelectAthlete(result.data[0]);
        } else if (result.data.length > 1) {
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
            setSearchResults(deduplicated);
          }
        } else {
          toast({ title: "Atleta non trovato", variant: "destructive" });
        }
      } else {
        const found = (result.data || []).find(
          (a: Athlete) => 
            a.code.toLowerCase() === trimmed.toLowerCase() || 
            (a.qr_code && a.qr_code.toLowerCase() === trimmed.toLowerCase())
        );
        if (found) {
          handleSelectAthlete(found);
        } else {
          toast({ title: "Codice CID non trovato", variant: "destructive" });
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
      if (!result.error) {
        const couplesData = (result.data as Couple[]) || [];
        setCouples(couplesData);
        if (couplesData.length === 1) selectCouple(couplesData[0]);
      }
    } catch (err) { console.error(err); }
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
      if (!result.error) {
        setCompetitions(result.competitions || []);
        setExistingEntries(new Set(result.existingEntries || []));
        setEventTypes(result.eventTypes || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const selectCouple = async (couple: Couple) => {
    setSelectedCouple(couple);
    await fetchCompetitionsAndEntries(couple.id);
  };

  const isCompetitionAllowed = (competition: Competition, couple: Couple) => {
    const compEvents = eventTypes.filter(et => et.competition_id === competition.id);
    if (compEvents.length === 0) return false;
    return compEvents.some(et => isEventAllowedForCouple(et, couple));
  };

  const isDeadlinePassed = (competition: Competition) => {
    const deadline = competition.late_fee_deadline || competition.registration_deadline;
    if (!deadline) return false;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(23, 59, 59, 999);
    return now > deadlineDate;
  };

  const toggleExpansion = (competitionId: string) => {
    setExpandedCompetitions(prev => {
      const next = new Set(prev);
      if (next.has(competitionId)) next.delete(competitionId);
      else next.add(competitionId);
      return next;
    });
  };

  const toggleRace = (competitionId: string, eventTypeId: string) => {
    setSelectedRaces(prev => {
      const current = prev[competitionId] || [];
      const nextRaces = current.includes(eventTypeId)
        ? current.filter(id => id !== eventTypeId)
        : [...current, eventTypeId];

      const newSelectedRaces = { ...prev, [competitionId]: nextRaces };

      setSelectedCompetitions(prevComps => {
        const nextComps = new Set(prevComps);
        if (nextRaces.length > 0) nextComps.add(competitionId);
        else nextComps.delete(competitionId);
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
    setSelectedCompetitions(new Set());
    setSelectedRaces({});
    setStep("cid");
  };

  const handleSubmit = async () => {
    if (userRole === "instructor" || userRole === "supervisor") return;
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
          entries: Array.from(selectedCompetitions).map(compId => ({
            competition_id: compId,
            event_type_ids: selectedRaces[compId] || []
          })),
        }),
      });

      if (response.ok) {
        setStep("success");
        toast({ title: "Iscrizione completata!" });
      } else {
        toast({ title: "Errore durante l'iscrizione", variant: "destructive" });
      }
    } catch (err) { console.error(err); }
    setSubmitting(false);
  };

  const content = (
    <div className={isEmbedded ? "max-w-2xl mx-auto" : "min-h-[80vh] py-8 container mx-auto px-4 max-w-2xl"}>
      {!isEmbedded && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
           <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-accent rounded-[2rem] p-5 flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <h1 className="text-4xl font-display font-black tracking-tight mb-3">Iscrizione Gara</h1>
            <p className="text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">
              Gestione iscrizioni semplificata. Supporto: <a href="mailto:ufficiogare@ritmodanza.net" className="text-primary hover:underline font-semibold">ufficiogare@ritmodanza.net</a>
            </p>
        </motion.div>
      )}

      {userRole === "instructor" && (
         <Alert className="mb-6 border-amber-500/30 bg-amber-500/5 text-amber-600 rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Sola Lettura</AlertTitle>
            <AlertDescription>Gli istruttori possono visualizzare ma non creare iscrizioni.</AlertDescription>
         </Alert>
      )}

      {/* Step Indicator */}
      <div className="flex justify-center mb-12">
        <div className="flex items-center gap-2 p-2 bg-white/50 dark:bg-white/5 rounded-full border border-white/10 shadow-xl">
          {[
            { id: "cid", icon: User },
            { id: "enrollment", icon: Trophy },
            { id: "success", icon: CheckCircle }
          ].map((s, i) => {
            const isActive = step === s.id || (step === "enrollment" && s.id === "enrollment") || (step === "couple" && s.id === "enrollment");
            const isCompleted = step === "success" || (i === 0 && (step === "enrollment" || step === "couple"));
            return (
              <div key={s.id} className="flex items-center">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300", 
                  isActive ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : isCompleted ? "bg-primary/20 text-primary" : "bg-neutral-200 dark:bg-neutral-800 text-muted-foreground opacity-50")}>
                  <s.icon className="w-5 h-5" />
                </div>
                {i < 2 && <div className={cn("w-8 h-1 mx-2 rounded-full", isCompleted ? "bg-primary/30" : "bg-neutral-200 dark:bg-neutral-800")} />}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "cid" && (
          <motion.div key="cid" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="rounded-[2rem] shadow-2xl border-white/10 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm overflow-hidden">
               <CardHeader className="p-8">
                  <CardTitle className="text-2xl font-display font-bold flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    {userRole === "admin" ? "Ricerca Atleta" : "Accesso Portale"}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 pt-0 space-y-6">
                  <div className="flex gap-3">
                    <Input ref={cidInputRef} placeholder="Cerca Nome o CID..." value={cidCode} onChange={(e) => setCidCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCidLookup()} className="h-14 rounded-2xl bg-white dark:bg-black/20 text-lg px-6" />
                    <Button onClick={handleCidLookup} disabled={loading} className="w-14 h-14 rounded-2xl"><Search /></Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="rounded-2xl overflow-hidden glass border-white/10 divide-y divide-white/5">
                      {searchResults.map(a => (
                        <button key={a.id} onClick={() => handleSelectAthlete(a)} className="w-full text-left p-4 hover:bg-primary/5 flex justify-between items-center group">
                          <div>
                            <p className="font-bold group-hover:text-primary transition-colors">{a.first_name} {a.last_name}</p>
                            <p className="text-xs text-muted-foreground">CID: {a.code} • {a.category} {a.class}</p>
                          </div>
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  )}
               </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "enrollment" && athlete && (
           <motion.div key="enrollment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              {!selectedCouple ? (
                <div className="grid gap-4">
                  {couples.map(couple => {
                    const partner = couple.athlete1.id === athlete.id ? couple.athlete2 : couple.athlete1;
                    return (
                      <button key={couple.id} onClick={() => selectCouple(couple)} className="w-full text-left p-6 rounded-3xl glass border-white/10 hover:border-primary/30 transition-all flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">{partner.first_name[0]}{partner.last_name[0]}</div>
                        <div className="flex-1">
                          <p className="font-bold text-lg">{partner.first_name} {partner.last_name}</p>
                          <p className="text-xs text-muted-foreground">{couple.category} • {couple.class}</p>
                        </div>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    );
                  })}
                  <Button variant="ghost" onClick={resetFlow} className="w-full rounded-2xl">Cambia atleta</Button>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="rounded-3xl glass border-white/10 p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white"><Users /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-primary">Coppia Selezionata</p>
                          <p className="font-black text-xl">{selectedCouple.athlete1.id === athlete.id ? selectedCouple.athlete2.full_name : selectedCouple.athlete1.full_name}</p>
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => setSelectedCouple(null)} className="rounded-xl">Cambia</Button>
                   </div>
                   <div className="space-y-4">
                      {competitions.filter(c => isCompetitionAllowed(c, selectedCouple)).map(comp => (
                        <div key={comp.id} className={cn("rounded-[2rem] border p-1 transition-all", selectedCompetitions.has(comp.id) ? "border-primary bg-primary/5" : "glass border-white/10")}>
                           <div className="p-6 flex items-center gap-4 cursor-pointer" onClick={() => toggleExpansion(comp.id)}>
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", selectedCompetitions.has(comp.id) ? "bg-primary text-white" : "bg-neutral-200 dark:bg-white/10")}><Trophy /></div>
                              <div className="flex-1">
                                <p className="font-bold text-lg">{comp.name}</p>
                                <p className="text-xs text-muted-foreground">{new Date(comp.date).toLocaleDateString()}</p>
                              </div>
                              <ChevronDown className={cn("transition-transform", expandedCompetitions.has(comp.id) && "rotate-180")} />
                           </div>
                           {expandedCompetitions.has(comp.id) && (
                             <div className="p-6 pt-0 grid sm:grid-cols-2 gap-2">
                               {eventTypes.filter(et => et.competition_id === comp.id && isEventAllowedForCouple(et, selectedCouple)).map(et => (
                                 <button key={et.id} onClick={() => toggleRace(comp.id, et.id)} className={cn("p-4 rounded-2xl border text-sm font-bold flex items-center gap-3", (selectedRaces[comp.id] || []).includes(et.id) ? "bg-primary text-white border-transparent" : "bg-white/40 dark:bg-white/5 border-white/10")}>
                                    <Checkbox checked={(selectedRaces[comp.id] || []).includes(et.id)} />
                                    {formatEventName(et.event_name)}
                                 </button>
                               ))}
                             </div>
                           )}
                        </div>
                      ))}
                   </div>
                   <Button size="lg" onClick={handleSubmit} disabled={selectedCompetitions.size === 0 || submitting} className="w-full h-16 rounded-3xl text-xl font-black uppercase shadow-xl transition-all active:scale-95">
                      {submitting ? <Loader2 className="animate-spin" /> : `Iscriviti (${selectedCompetitions.size})`}
                   </Button>
                </div>
              )}
           </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-12 glass rounded-[3rem] border-white/10 shadow-2xl">
             <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/20"><Check className="w-12 h-12 text-white stroke-[3px]" /></div>
             <h2 className="text-4xl font-black mb-4">Iscrizione Inviata!</h2>
             <p className="text-muted-foreground mb-8">Abbiamo ricevuto i tuoi dati. Consegna la quota in buchetta entro la scadenza.</p>
             <Button size="lg" onClick={resetFlow} className="rounded-2xl px-10 h-14">Nuova Iscrizione</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return isEmbedded ? content : <Layout>{content}</Layout>;
}
