import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Users, AlertTriangle, Clock, Trash2, FileSpreadsheet, CheckCircle, AlertCircle, Mail, Printer, Loader2, ChevronDown, Search, Info } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isInstructorResponsibleForCoupleByResponsabili } from "@/lib/instructor-utils";
import { getSportsAge } from "@/lib/category-validation";
import { 
  isEventAllowedForCouple,
  getEffectClassForCouple as getEffectiveClass,
  formatEventName
} from "@/lib/enrollment-utils";
import { extractTextFromPdf, extractCidsFromText } from "@/lib/pdf-utils";
import { getBestClass } from "@/lib/class-utils";
import { resolveDisciplineClass } from "@/lib/discipline-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import CoupleDetailModal from "./CoupleDetailModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Athlete, Couple, Profile, Competition } from "@/types/dashboard";

interface EventType {
  id: string;
  event_name: string;
  allowed_classes: string[];
  min_age: number | null;
  max_age: number | null;
}

interface CompetitionEntry {
  id: string;
  couple_id: string;
  status: string;
  created_at: string;
  is_paid: boolean;
  couples: Couple;
  event_type_ids: string[];
}

interface CompetitionEntriesDetailProps {
  competition: Competition;
  athletes: Athlete[];
  allCouples: Couple[];
  profiles: Profile[];
  onClose: () => void;
}

export default function CompetitionEntriesDetail({
  competition,
  athletes,
  allCouples,
  profiles,
  onClose
}: CompetitionEntriesDetailProps) {
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CompetitionEntry | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>("all");
  const { toast } = useToast();
  const { role, userId } = useUserRole();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparingPdf, setComparingPdf] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<{
    missingInApp: { cid: string; names?: string }[];
    extraInApp: { cid: string; names: string }[];
    matches: string[];
  } | null>(null);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id, role, userId, athletes]);

  const fetchEntries = async () => {
    setLoading(true);
    const [entriesRes, eventTypesRes] = await Promise.all([
      supabase
        .from("competition_entries")
        .select(`
          id,
          couple_id,
          status,
          created_at,
          is_paid,
          event_type_ids,
          couples (
            id,
            category,
            class,
            disciplines,
            responsabili,
            athlete1_id,
            athlete2_id,
            discipline_info,
            athlete1:athletes!couples_athlete1_id_fkey (
              id,
              code,
              first_name,
              last_name,
              gender,
              instructor_id,
              responsabili,
              birth_date,
              discipline_info,
              medical_certificate_expiry
            ),
            athlete2:athletes!couples_athlete2_id_fkey (
              id,
              code,
              first_name,
              last_name,
              gender,
              instructor_id,
              responsabili,
              birth_date,
              discipline_info,
              medical_certificate_expiry
            )
          )
        `)
        .eq("competition_id", competition.id),
      supabase
        .from("competition_event_types")
        .select("id, event_name, allowed_classes, min_age, max_age")
        .eq("competition_id", competition.id)
    ]);

    if (entriesRes.error) {
      console.error("Error fetching entries:", entriesRes.error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le iscrizioni",
        variant: "destructive",
      });
      setEntries([]);
    } else {
      let filteredData = (entriesRes.data as any) || [];
      if (role === "instructor" && userId) {
        const currentUserProfile = profiles.find(p => p.user_id === userId);
        if (currentUserProfile) {
          filteredData = filteredData.filter((entry: any) => {
            const couple = entry.couples;
            return isInstructorResponsibleForCoupleByResponsabili(currentUserProfile.full_name, couple?.responsabili || []);
          });
        } else {
          filteredData = [];
        }
      }
      setEntries(filteredData);
    }

    if (eventTypesRes.data) {
      setEventTypes(eventTypesRes.data);
    }
    setLoading(false);
  };

  const instructors = profiles.filter(p => !!p.full_name).sort((a, b) => a.full_name.localeCompare(b.full_name));

  const filteredEntries = entries.filter(entry => {
    if (role !== "admin" || selectedInstructorId === "all") return true;
    const instructor = profiles.find(p => p.id === selectedInstructorId);
    if (!instructor) return true;
    return isInstructorResponsibleForCoupleByResponsabili(instructor.full_name, entry.couples?.responsabili || []);
  });

  const getAthleteForPos = (entry: CompetitionEntry, athleteNum: 1 | 2) => {
    const couple = entry.couples;
    if (!couple) return null;
    let a1 = couple.athlete1;
    let a2 = couple.athlete2;
    if (a2?.gender === 'M' && a1?.gender !== 'M') [a1, a2] = [a2, a1];
    return athleteNum === 1 ? a1 : a2;
  };

  const isLateEntry = (entryDate: string) => {
    if (!competition.late_fee_deadline) return false;
    return new Date(entryDate) > new Date(competition.late_fee_deadline);
  };

  const sortEntriesByAge = (e1: CompetitionEntry, e2: CompetitionEntry) => {
    const ref = new Date();
    const getAge = (a?: Athlete) => (a?.birth_date ? getSportsAge(a.birth_date, ref) : 100);
    const min1 = Math.min(getAge(e1.couples.athlete1), getAge(e1.couples.athlete2));
    const min2 = Math.min(getAge(e2.couples.athlete1), getAge(e2.couples.athlete2));
    if (min1 !== min2) return min1 - min2;
    return Math.max(getAge(e1.couples.athlete1), getAge(e1.couples.athlete2)) - Math.max(getAge(e2.couples.athlete1), getAge(e2.couples.athlete2));
  };

  const activeEntries = filteredEntries.filter(e => e.status !== "cancelled").sort(sortEntriesByAge);
  const paidEntries = activeEntries.filter(e => e.is_paid);
  const lateUnpaidEntries = activeEntries.filter(e => !e.is_paid && isLateEntry(e.created_at));
  const regularUnpaidEntries = activeEntries.filter(e => !e.is_paid && !isLateEntry(e.created_at));

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase.from("competition_entries").delete().eq("id", entryId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'iscrizione", variant: "destructive" });
    } else {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Iscrizione eliminata" });
    }
  };

  const generateReport = () => {
    const wb = XLSX.utils.book_new();
    const getData = (list: CompetitionEntry[], status: string) => list.map(e => {
      const c = e.couples;
      const a1 = getAthleteForPos(e, 1);
      const a2 = getAthleteForPos(e, 2);
      return {
        "Stato": status,
        "Categoria": c.category,
        "Classe": c.class,
        "Cavaliere": a1 ? `${a1.first_name} ${a1.last_name}` : "-",
        "Dama": a2 ? `${a2.first_name} ${a2.last_name}` : "-",
        "CID Cav.": a1?.code || "-",
        "CID Dama": a2?.code || "-",
        "Data Iscrizione": new Date(e.created_at).toLocaleDateString("it-IT"),
      };
    });
    const allData = [...getData(paidEntries, "Pagato"), ...getData(lateUnpaidEntries, "In Ritardo"), ...getData(regularUnpaidEntries, "Confermato")];
    const ws = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, ws, "Iscrizioni");
    XLSX.writeFile(wb, `${competition.name}_Report.xlsx`);
  };

  const handleSendReport = async () => {
    setIsSendingReport(true);
    try {
      const { error } = await supabase.functions.invoke('send-competition-report', { body: { competitionId: competition.id } });
      if (error) throw error;
      toast({ title: "Report inviato correttamente" });
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile inviare il report", variant: "destructive" });
    } finally { setIsSendingReport(false); }
  };

  const handlePaymentToggle = async (entryId: string, currentPaid: boolean) => {
    const { error } = await supabase.from("competition_entries").update({ is_paid: !currentPaid }).eq("id", entryId);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, is_paid: !currentPaid } : e));
      toast({ title: !currentPaid ? "Pagamento registrato" : "Pagamento rimosso" });
    }
  };

  const handlePdfComparison = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setComparingPdf(true);
    try {
      const pdfText = await extractTextFromPdf(file);
      const pdfCids = extractCidsFromText(pdfText);
      const appCids: { cid: string; names: string }[] = [];
      entries.forEach(e => {
        const a1 = getAthleteForPos(e, 1);
        const a2 = getAthleteForPos(e, 2);
        if (a1?.code) appCids.push({ cid: a1.code, names: `${a1.first_name} ${a1.last_name}` });
        if (a2?.code) appCids.push({ cid: a2.code, names: `${a2.first_name} ${a2.last_name}` });
      });
      const appCidSet = new Set(appCids.map(a => a.cid));
      const pdfCidSet = new Set(pdfCids);
      setComparisonResults({
        missingInApp: pdfCids.filter(cid => !appCidSet.has(cid)).map(cid => ({ cid })),
        extraInApp: appCids.filter(a => !pdfCidSet.has(a.cid)),
        matches: pdfCids.filter(cid => appCidSet.has(cid))
      });
      setShowComparisonDialog(true);
    } catch (err) { console.error(err); } finally { setComparingPdf(false); }
  };

  const renderAthleteName = (athlete: any) => {
    if (!athlete) return "-";
    const expiry = athlete.medical_certificate_expiry;
    const isExpired = expiry && new Date(expiry) < new Date();
    const isMissing = !expiry;
    
    return (
      <div className="flex flex-col items-center flex-1 min-w-0">
        <div className="flex items-center gap-1.5 max-w-full">
          <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] lg:text-sm font-bold">
            {athlete.first_name} {athlete.last_name}
          </span>
          {(isExpired || isMissing) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help animate-pulse" />
                </TooltipTrigger>
                <TooltipContent className="bg-amber-600 text-white border-none rounded-xl">
                  <p className="text-xs font-bold">{isMissing ? "Certificato Mancante" : `Scaduto: ${new Date(expiry).toLocaleDateString()}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground font-medium opacity-60">CID: {athlete.code}</span>
      </div>
    );
  };

  const renderEntryRow = (entry: CompetitionEntry, showLateFlag = false) => {
    const couple = entry.couples;
    if (!couple) return null;
    const a1 = getAthleteForPos(entry, 1);
    const a2 = getAthleteForPos(entry, 2);
    const stClass = resolveDisciplineClass("standard", a1, a2, couple);
    const laClass = resolveDisciplineClass("latino", a1, a2, couple);
    
    const entryEventNames = (entry.event_type_ids || []).map(id => {
      const name = eventTypes.find(et => et.id === id)?.event_name;
      if (!name) return null;
      const effClass = getEffectiveClass(couple, name);
      return formatEventName(name, effClass, couple.category);
    }).filter(Boolean);

    return (
      <tr key={entry.id} className={cn("cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5", showLateFlag && "bg-amber-500/5")} onClick={() => setSelectedEntry(entry)}>
        <td className="py-4 px-3 w-[35%]"><div className="flex items-center gap-3">{renderAthleteName(a1)}<span className="text-muted-foreground opacity-30 text-[10px]">&</span>{renderAthleteName(a2)}</div></td>
        <td className="text-center w-[20%]"><div className="flex flex-col items-center"><span className="text-sm font-black tracking-tight">{couple.category}</span><span className="text-[9px] text-muted-foreground font-black uppercase opacity-60">ST: {stClass} • LA: {laClass}</span></div></td>
        <td className="w-[30%] hidden md:table-cell"><div className="flex flex-wrap gap-1">
          {entryEventNames.map(name => (
             <Badge key={name} className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] font-bold uppercase rounded-lg px-2 py-0.5">{name}</Badge>
          ))}
          {entry.event_type_ids?.length === 0 && <span className="text-muted-foreground italic text-xs">Nessuna gara selezionata</span>}
        </div></td>
        <td className="w-[15%] hidden lg:table-cell"><div className="flex flex-col gap-1">{couple.responsabili?.map(r => <span key={r} className="text-[10px] text-muted-foreground font-bold border-l-2 border-primary/20 pl-2">{r}</span>)}</div></td>
        <td className="text-center pr-3"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (role === "admin") handlePaymentToggle(entry.id, entry.is_paid); }} className={cn("rounded-full px-4 font-black text-[10px] uppercase h-8", entry.is_paid ? "bg-green-500 text-white hover:bg-green-600" : "bg-amber-500 text-white hover:bg-amber-600")}>
          {entry.is_paid ? "PAGATO" : isLateEntry(entry.created_at) ? "DA PAGARE (MORA)" : "DA PAGARE"}
        </Button></td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between">
           <div><CardTitle className="text-2xl font-display font-black tracking-tighter uppercase flex items-center gap-3"><Trophy className="text-primary" /> {competition.name}</CardTitle>
           <p className="text-muted-foreground font-medium mt-1">Status: {new Date(competition.date).toLocaleDateString("it-IT")} • {entries.length} Iscrizioni</p></div>
           <div className="flex items-center gap-3">
              <Button variant="outline" onClick={generateReport} className="rounded-xl border-white/10 hover:bg-primary/5 font-bold"><FileSpreadsheet className="mr-2" /> Report</Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-12 h-12 hover:bg-red-500/10 hover:text-red-500"><X /></Button>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <Tabs defaultValue="iscritti">
              <TabsList className="bg-neutral-100 dark:bg-black/20 p-2 mx-8 mt-8 rounded-2xl">
                 <TabsTrigger value="iscritti" className="rounded-xl font-bold py-2">ISCRITTI ({filteredEntries.length})</TabsTrigger>
                 <TabsTrigger value="non-iscritti" className="rounded-xl font-bold py-2">DA ISCRIVERE</TabsTrigger>
              </TabsList>
              <TabsContent value="iscritti" className="p-8 pt-4">
                 <table className="w-full text-left">
                    <thead><tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 border-b border-neutral-100 dark:border-white/5"><th className="pb-4 px-3">Atleti</th><th className="pb-4 text-center">Cat / Classe</th><th className="pb-4 hidden md:table-cell">Gare</th><th className="pb-4 hidden lg:table-cell">Istruttori</th><th className="pb-4 text-center">Pagamento</th></tr></thead>
                    <tbody>{activeEntries.map(e => renderEntryRow(e, isLateEntry(e.created_at)))}</tbody>
                 </table>
              </TabsContent>
           </Tabs>
        </CardContent>
      </Card>

      <CoupleDetailModal entry={selectedEntry} eventTypes={eventTypes} onClose={() => setSelectedEntry(null)} onUpdate={fetchEntries} />
      
      <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
         <DialogContent className="rounded-[2rem] glass border-white/10 max-w-2xl">
            <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter">Analisi PDF</DialogTitle></DialogHeader>
            {comparisonResults && (
               <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="p-6 rounded-3xl bg-green-500/10 text-green-600 border border-green-500/20 text-center"><p className="text-3xl font-black">{comparisonResults.matches.length}</p><p className="text-[10px] uppercase font-bold">Ok</p></div>
                  <div className="p-6 rounded-3xl bg-red-500/10 text-red-600 border border-red-500/20 text-center"><p className="text-3xl font-black">{comparisonResults.missingInApp.length}</p><p className="text-[10px] uppercase font-bold">Mancanti</p></div>
                  <div className="p-6 rounded-3xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-center"><p className="text-3xl font-black">{comparisonResults.extraInApp.length}</p><p className="text-[10px] uppercase font-bold">Extra</p></div>
               </div>
            )}
         </DialogContent>
      </Dialog>
    </div>
  );
}