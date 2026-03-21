import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Users, AlertTriangle, Clock, Trash2, FileSpreadsheet, CheckCircle, AlertCircle, Mail, Printer, Loader2 } from "lucide-react";
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
import CoupleDetailModal from "./CoupleDetailModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Info } from "lucide-react";
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
import { ChevronDown } from "lucide-react";

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
            athlete1:athletes!couples_athlete1_id_fkey (
              id,
              code,
              first_name,
              last_name,
              gender,
              instructor_id,
              responsabili,
              birth_date,
              discipline_info
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
              discipline_info
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

      // Filter for instructors: only show entries with their couples
      if (role === "instructor" && userId) {
        const currentUserProfile = profiles.find(p => p.user_id === userId);

        if (currentUserProfile) {
          filteredData = filteredData.filter((entry: any) => {
            const couple = entry.couples;
            if (!couple) return false;

            // Use couple's responsabili field directly
            return isInstructorResponsibleForCoupleByResponsabili(
              currentUserProfile.full_name,
              couple.responsabili || []
            );
          });
        } else {
          // If no profile found for instructor, show nothing
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

    return isInstructorResponsibleForCoupleByResponsabili(
      instructor.full_name,
      entry.couples?.responsabili || []
    );
  });

  const getAthlete = (entry: CompetitionEntry, athleteNum: 1 | 2) => {
    const couple = entry.couples;
    if (!couple) return null;

    let athlete1 = couple.athlete1;
    let athlete2 = couple.athlete2;

    // Ensure Male is in the First Position (Cavaliere)
    // If Athlete 2 is Male and Athlete 1 is NOT Male, Swap.
    if (athlete2?.gender === 'M' && athlete1?.gender !== 'M') {
      [athlete1, athlete2] = [athlete2, athlete1];
    } else if (athlete1?.gender === 'F' && athlete2?.gender === 'M') {
      // Double check explicit Female in pos 1
      [athlete1, athlete2] = [athlete2, athlete1];
    }

    return athleteNum === 1 ? athlete1 : athlete2;
  };

  const getCombinedResponsabili = (entry: CompetitionEntry): string[] => {
    // Use couple's responsabili field directly
    return entry.couples?.responsabili || [];
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const isLateEntry = (entryDate: string) => {
    if (!competition.late_fee_deadline) return false;
    return new Date(entryDate) > new Date(competition.late_fee_deadline);
  };

  // Categorize entries based on new logic
  // Paid -> Confermati e Pagati
  // Not Paid + Late -> Iscritte in ritardo (Mora)
  // Not Paid + Regular -> Confermati ma non pagati
  // Not Paid + Regular -> Confermati ma non pagati
  const sortEntriesByAge = (e1: CompetitionEntry, e2: CompetitionEntry) => {
    const ref = new Date();
    const getAge = (a?: Athlete) => (a?.birth_date ? getSportsAge(a.birth_date, ref) : 100);
    const min1 = Math.min(getAge(e1.couples.athlete1), getAge(e1.couples.athlete2));
    const min2 = Math.min(getAge(e2.couples.athlete1), getAge(e2.couples.athlete2));
    if (min1 !== min2) return min1 - min2;
    const max1 = Math.max(getAge(e1.couples.athlete1), getAge(e1.couples.athlete2));
    const max2 = Math.max(getAge(e2.couples.athlete1), getAge(e2.couples.athlete2));
    return max1 - max2;
  };

  const activeEntries = filteredEntries.filter(e => e.status === "registered" || e.status === "confirmed" || e.status === "pending").sort(sortEntriesByAge);
  const paidEntries = activeEntries.filter(e => e.is_paid);
  const lateUnpaidEntries = activeEntries.filter(e => !e.is_paid && isLateEntry(e.created_at));
  const regularUnpaidEntries = activeEntries.filter(e => !e.is_paid && !isLateEntry(e.created_at));

  const sortCouplesByAge = (c1: any, c2: any) => {
    const ref = new Date();
    const getAge = (birthDate?: string | null) => (birthDate ? getSportsAge(birthDate, ref) : 100);
    const a1_c1 = athletes.find(a => a.id === c1.athlete1_id);
    const a2_c1 = athletes.find(a => a.id === c1.athlete2_id);
    const a1_c2 = athletes.find(a => a.id === c2.athlete1_id);
    const a2_c2 = athletes.find(a => a.id === c2.athlete2_id);
    
    const min1 = Math.min(getAge(a1_c1?.birth_date), getAge(a2_c1?.birth_date));
    const min2 = Math.min(getAge(a1_c2?.birth_date), getAge(a2_c2?.birth_date));
    if (min1 !== min2) return min1 - min2;
    const max1 = Math.max(getAge(a1_c1?.birth_date), getAge(a2_c1?.birth_date));
    const max2 = Math.max(getAge(a1_c2?.birth_date), getAge(a2_c2?.birth_date));
    return max1 - max2;
  };

  const notRegisteredCouples = allCouples.filter(couple => {
    // Check if couple is already registered for this competition
    const isRegistered = entries.some(e => e.couple_id === couple.id);
    if (isRegistered) return false;

    // Filter for instructors if role is instructor
    if (role === "instructor" && userId) {
      const currentUserProfile = profiles.find(p => p.user_id === userId);
      if (currentUserProfile) {
        return isInstructorResponsibleForCoupleByResponsabili(
          currentUserProfile.full_name,
          couple.responsabili || []
        );
      }
      return false;
    }
    const hasAllowedEvent = eventTypes.some(et => isEventAllowedForCouple(et, couple));
    if (!hasAllowedEvent) return false;

    return true;
  }).sort(sortCouplesByAge);

  const filteredNotRegisteredCouples = notRegisteredCouples.filter(couple => {
    if (role !== "admin" || selectedInstructorId === "all") return true;

    const instructor = profiles.find(p => p.id === selectedInstructorId);
    if (!instructor) return true;

    return isInstructorResponsibleForCoupleByResponsabili(
      instructor.full_name,
      couple.responsabili || []
    );
  });


  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("competition_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'iscrizione",
        variant: "destructive",
      });
    } else {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({
        title: "Iscrizione eliminata",
      });
    }
  };

  const generateReport = () => {
    const wb = XLSX.utils.book_new();

    const getData = (entryList: CompetitionEntry[], statusLabel: string) => {
      return entryList.map(e => {
        const c = e.couples;
        const a1 = getAthlete(e, 1);
        const a2 = getAthlete(e, 2);
        
        // Derive best class for the couple from athletes
        const disciplines = ["latino", "standard", "combinata"];
        let bestClass = c.class;
        disciplines.forEach(d => {
          const class1 = a1?.discipline_info?.[d];
          const class2 = a2?.discipline_info?.[d];
          if (class1) bestClass = getBestClass(bestClass, class1);
          if (class2) bestClass = getBestClass(bestClass, class2);
        });

        // Last resort fallback for report
        if (bestClass === "D") {
          if (a1?.class && a1.class !== "D") bestClass = a1.class;
          if (a2?.class && a2.class !== "D") bestClass = bestClass === "D" ? a2.class : getBestClass(bestClass, a2.class);
        }

        return {
          "Stato": statusLabel,
          "Categoria": c.category,
          "Classe": bestClass,
          "Cavaliere": a1 ? `${a1.first_name} ${a1.last_name}` : "-",
          "Dama": a2 ? `${a2.first_name} ${a2.last_name}` : "-",
          "Codice Cav.": a1?.code || "-",
          "Codice Dama": a2?.code || "-",
          "Data Iscrizione": formatDate(e.created_at),
        };
      });
    };

    const allData = [
      ...getData(paidEntries, "Confermato e Pagato"),
      ...getData(lateUnpaidEntries, "Iscritto in Ritardo (Mora)"),
      ...getData(regularUnpaidEntries, "Confermato (Non Pagato)"),
    ];

    const ws = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, ws, "Iscrizioni");
    XLSX.writeFile(wb, `${competition.name}_Report.xlsx`);
  };

  const handleSendReport = async () => {
    setIsSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-competition-report', {
        body: { competitionId: competition.id }
      });

      if (error) throw error;

      toast({
        title: "Report inviato",
        description: "Le email sono state inviate ai responsabili.",
      });
    } catch (error) {
      console.error("Error sending report:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare il report.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const handlePaymentToggle = async (entryId: string, currentPaid: boolean) => {
    const { error } = await supabase
      .from("competition_entries")
      .update({ is_paid: !currentPaid })
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del pagamento",
        variant: "destructive",
      });
    } else {
      // Update local state
      setEntries(prev =>
        prev.map(e => e.id === entryId ? { ...e, is_paid: !currentPaid } : e)
      );
      toast({
        title: !currentPaid ? "Pagamento registrato" : "Pagamento rimosso",
      });
    }
  };

  const handlePdfComparison = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setComparingPdf(true);
    try {
      const pdfText = await extractTextFromPdf(file);
      const pdfCids = extractCidsFromText(pdfText);

      // App registered CIDs
      const appCidsWithNames: { cid: string; names: string }[] = [];
      entries.forEach(e => {
        const a1 = getAthlete(e, 1);
        const a2 = getAthlete(e, 2);
        if (a1?.code) appCidsWithNames.push({ cid: a1.code, names: `${a1.first_name} ${a1.last_name}` });
        if (a2?.code) appCidsWithNames.push({ cid: a2.code, names: `${a2.first_name} ${a2.last_name}` });
      });

      const appCidSet = new Set(appCidsWithNames.map(a => a.cid));
      const pdfCidSet = new Set(pdfCids);

      const missingInApp = pdfCids
        .filter(cid => !appCidSet.has(cid))
        .map(cid => ({ cid }));

      const extraInApp = appCidsWithNames.filter(a => !pdfCidSet.has(a.cid));
      const matches = pdfCids.filter(cid => appCidSet.has(cid));

      setComparisonResults({
        missingInApp,
        extraInApp,
        matches
      });
      setShowComparisonDialog(true);

      toast({
        title: "Confronto completato",
        description: `Trovati ${pdfCids.length} codici nel PDF.`,
      });
    } catch (error) {
      console.error("PDF Comparison error:", error);
      toast({
        title: "Errore",
        description: "Impossibile leggere il PDF per il confronto.",
        variant: "destructive",
      });
    } finally {
      setComparingPdf(false);
      // Reset input
      if (event.target) event.target.value = "";
    }
  };

  const renderEntryRow = (entry: CompetitionEntry, showLateFlag = false) => {
    const couple = entry.couples;
    if (!couple) return null;

    const athlete1 = getAthlete(entry, 1);
    const athlete2 = getAthlete(entry, 2);
    const isLate = isLateEntry(entry.created_at);

    // Determine the most appropriate class to display based on enrolled events
    const enrolledEventIds = entry.event_type_ids || [];
    const entryEvents = enrolledEventIds.map(id => eventTypes.find(et => et.id === id)).filter(Boolean);
    
    let displayClass = couple.class;

    if (entryEvents.length > 0) {
      // Check if all enrolled events belong to a single discipline
      const isLatinOnly = entryEvents.every(e => e?.event_name.toLowerCase().includes("latino") || e?.event_name.toLowerCase().includes("latini"));
      const isStandardOnly = entryEvents.every(e => e?.event_name.toLowerCase().includes("standard"));

      if (isLatinOnly) {
        const lat1 = athlete1?.discipline_info?.["latino"];
        const lat2 = athlete2?.discipline_info?.["latino"];
        const discClass = couple.discipline_info?.["latino"] || getBestClass(lat1, lat2);
        if (discClass && discClass !== "D") displayClass = discClass;
      } else if (isStandardOnly) {
        const std1 = athlete1?.discipline_info?.["standard"];
        const std2 = athlete2?.discipline_info?.["standard"];
        const discClass = couple.discipline_info?.["standard"] || getBestClass(std1, std2);
        if (discClass && discClass !== "D") displayClass = discClass;
      } else {
        // Multi-discipline competition: use the best class among enrolled disciplines
        let maxClass = "D";
        entryEvents.forEach(e => {
          const eff = getEffectiveClass(couple, e!.event_name);
          maxClass = getBestClass(maxClass, eff);
        });
        displayClass = maxClass;
      }
    } else {
      // Fallback: use couple's base class but check athletes' info
      const disciplines = ["latino", "standard", "combinata"];
      let bestClass = couple.class;
      disciplines.forEach(d => {
        const class1 = athlete1?.discipline_info?.[d];
        const class2 = athlete2?.discipline_info?.[d];
        if (class1) bestClass = getBestClass(bestClass, class1);
        if (class2) bestClass = getBestClass(bestClass, class2);
      });
      displayClass = bestClass;
    }

    const entryEventNames = enrolledEventIds
      .map(id => {
        const name = eventTypes.find(et => et.id === id)?.event_name;
        return name ? formatEventName(name) : null;
      })
      .filter(Boolean);

    const missingEventNames = eventTypes
      .filter(et => !enrolledEventIds.includes(et.id))
      .filter(et => isEventAllowedForCouple(et, couple))
      .map(et => formatEventName(et.event_name));

    return (
      <tr
        key={entry.id}
        className={`${isLate && showLateFlag ? "bg-warning/10" : ""} cursor-pointer hover:bg-muted/50 transition-colors print:break-inside-avoid break-inside-avoid`}
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        onClick={() => setSelectedEntry(entry)}
      >
        <td className="font-medium py-3 px-2 align-middle print:w-[35%] w-[35%]">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] lg:text-sm">{athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}</span>
              <span className="text-[9px] text-muted-foreground font-normal">({athlete1?.code || "-"})</span>
            </div>
            <span className="text-muted-foreground shrink-0 font-normal text-[10px]">&</span>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] lg:text-sm">{athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}</span>
              <span className="text-[9px] text-muted-foreground font-normal">({athlete2?.code || "-"})</span>
            </div>
          </div>
        </td>
        <td className="text-center print:w-[15%] w-[15%]">
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold">{couple.category}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Classe {displayClass}</span>
          </div>
        </td>
        <td className="max-w-[300px] print:max-w-none hidden md:table-cell print:table-cell print:w-[35%] w-[35%]">
          <div className="flex flex-col gap-0.5">
            {entryEventNames.map(name => (
              <div key={`enrolled-${name}`} className="text-[11px] py-0.5 px-2 bg-[#dcfce7] text-[#166534] rounded-md whitespace-nowrap border border-[#bbf7d0]">
                {formatEventName(name, getEffectiveClass(couple, name))}
              </div>
            ))}
            {missingEventNames.map(name => (
              <div key={`missing-${name}`} className="text-[11px] py-0.5 px-2 bg-[#fee2e2] text-[#991b1b] rounded-md whitespace-nowrap border border-[#fecaca] opacity-70">
                {formatEventName(name, getEffectiveClass(couple, name))}
              </div>
            ))}
            {entryEventNames.length === 0 && missingEventNames.length === 0 ? (
              <span className="text-muted-foreground italic text-xs">-</span>
            ) : null}
          </div>
        </td>
        <td className="print:table-cell hidden lg:table-cell print:w-[15%] w-[15%]">
          <div className="flex flex-col gap-1 py-1">
            {getCombinedResponsabili(entry).map((resp, idx) => (
              <span key={idx} className="text-[10px] leading-tight text-muted-foreground border-l-2 border-accent/20 pl-2 whitespace-nowrap font-medium">
                {resp}
              </span>
            )) || <span className="text-muted-foreground">-</span>}
          </div>
        </td>
        <td className="print:hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (role === "admin") {
                handlePaymentToggle(entry.id, entry.is_paid);
              }
            }}
            className={`
              flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 shadow-sm
              ${entry.is_paid
                ? "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0] hover:bg-[#bbf7d0]"
                : "bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa] hover:bg-[#fed7aa]"}
              ${role !== "admin" ? "cursor-default" : "cursor-pointer active:scale-95"}
            `}
          >
            {entry.is_paid ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Pagato
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                Da Pagare
              </>
            )}
          </button>
        </td>
        <td className="print:hidden">
          <div className="flex items-center justify-end">
            {role === "admin" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare questa iscrizione?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L'operazione è irreversibile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteEntry(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento iscrizioni...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="animate-fade-in print:shadow-none print:border-none print:m-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              {competition.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(competition.date)} • Scadenza: {formatDate(competition.late_fee_deadline || competition.registration_deadline)}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {/* Desktop Buttons */}
            <div className="hidden xl:flex items-center gap-2">
              {role === "admin" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSendReport}
                    disabled={isSendingReport}
                    className="gap-2 hover:scale-105 transition-all duration-300 shadow-sm"
                  >
                    <Mail className="w-4 h-4" />
                    {isSendingReport ? "Invio in corso..." : "Invia Report Email"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfComparison}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="gap-2 hover:scale-105 transition-all duration-300 shadow-sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={comparingPdf}
                    >
                      {comparingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {comparingPdf ? "Confronto..." : "Confronta con PDF"}
                    </Button>
                  </div>
                </>
              )}
              <Button variant="outline" onClick={generateReport} className="gap-2 hover:scale-105 transition-all duration-300 shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
                Genera Report Excel
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="gap-2 hover:scale-105 transition-all duration-300 shadow-sm">
                <Printer className="w-4 h-4" />
                Stampa / PDF
              </Button>
            </div>

            {/* Mobile/Tablet Dropdown */}
            <div className="xl:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    Azioni
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {role === "admin" && (
                    <>
                      <DropdownMenuItem onClick={handleSendReport} disabled={isSendingReport} className="gap-2">
                        <Mail className="w-4 h-4" />
                        {isSendingReport ? "Invio in corso..." : "Invia Report Email"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={comparingPdf} className="gap-2">
                        <Search className="w-4 h-4" />
                        Confronta con PDF
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={generateReport} className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Genera Report Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()} className="gap-2">
                    <Printer className="w-4 h-4" />
                    Stampa / PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        {role === "admin" && (
          <div className="px-6 pb-4 border-b print:hidden">
            <div className="flex items-center gap-4 max-w-sm">
              <label className="text-sm font-medium whitespace-nowrap">Filtra per Istruttore:</label>
              <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti gli istruttori" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom">
                  <SelectItem value="all">Tutti gli istruttori</SelectItem>
                  {instructors.map(instructor => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {instructor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna iscrizione per questa competizione</p>
          ) : (
            <div className="space-y-4">
              <Tabs defaultValue="iscritti" className="w-full print:hidden">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="iscritti">Iscritti ({filteredEntries.length})</TabsTrigger>
                  <TabsTrigger value="non-iscritti">Non Iscritti ({filteredNotRegisteredCouples.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="iscritti" className="space-y-4">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-3 gap-3 print:hidden">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/10">
                      <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-success/80" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-success/90">{paidEntries.length}</p>
                        <p className="text-xs font-semibold text-success/70 uppercase tracking-wide">Coppie Pagate</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/10">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-accent/80" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-accent/90">{regularUnpaidEntries.length}</p>
                        <p className="text-xs font-semibold text-accent/70 uppercase tracking-wide">Da Pagare</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/10">
                      <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-warning/80" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-700">{lateUnpaidEntries.length}</p>
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">In Ritardo (Mora)</p>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="data-table w-full border-collapse">
                      <thead className="print:table-header-group">
                        <tr>
                          <th className="print:w-[35%] w-[35%]">Atleti</th>
                          <th className="text-center print:w-[15%] w-[15%]">Categoria/Classe</th>
                          <th className="hidden md:table-cell print:table-cell print:w-[35%] w-[35%]">Gare</th>
                          <th className="hidden lg:table-cell print:table-cell print:w-[15%] w-[15%]">Responsabili</th>
                          <th className="print:hidden text-center">Stato</th>
                          <th className="print:hidden w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidEntries.map(entry => renderEntryRow(entry))}
                        {lateUnpaidEntries.map(entry => renderEntryRow(entry, true))}
                        {regularUnpaidEntries.map(entry => renderEntryRow(entry))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="non-iscritti" className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="data-table w-full border-collapse">
                      <thead className="print:table-header-group">
                        <tr>
                          <th className="print:w-[35%] w-[35%]">Atleti</th>
                          <th className="text-center print:w-[15%] w-[15%]">Categoria/Classe</th>
                          <th className="print:w-[35%] w-[35%]">Gare Selezionabili</th>
                          <th className="print:w-[15%] w-[15%]">Responsabili</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNotRegisteredCouples.map(couple => {
                          const a1 = athletes.find(a => a.id === couple.athlete1_id);
                          const a2 = athletes.find(a => a.id === couple.athlete2_id);
                          return (
                            <tr key={couple.id} className="print:break-inside-avoid break-inside-avoid">
                              <td className="font-medium py-3 px-2 align-middle">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-center flex-1 min-w-0">
                                    <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[10px]">{a1 ? `${a1.first_name} ${a1.last_name}` : "-"}</span>
                                    <span className="text-[8px] text-muted-foreground font-normal">({a1?.code || "-"})</span>
                                  </div>
                                  <span className="text-muted-foreground shrink-0 font-normal text-[9px]">&</span>
                                  <div className="flex flex-col items-center flex-1 min-w-0">
                                    <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[10px]">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</span>
                                    <span className="text-[8px] text-muted-foreground font-normal">({a2?.code || "-"})</span>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="flex flex-col items-center">
                                  <span className="text-sm">{couple.category}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Classe {couple.class}</span>
                                </div>
                              </td>
                              <td>
                                <div className="flex flex-col gap-0.5">
                                  {eventTypes
                                    .filter(et => isEventAllowedForCouple(et, couple))
                                    .map(et => (
                                      <div key={et.id} className="text-[11px] py-0.5 px-2 bg-slate-100 text-black rounded-md whitespace-nowrap border border-slate-200">
                                        {et.event_name}
                                      </div>
                                    )) || <span className="text-muted-foreground">-</span>}
                                </div>
                              </td>
                              <td>
                                <div className="flex flex-col gap-1 py-1">
                                  {couple.responsabili?.map((resp, idx) => (
                                    <span key={idx} className="text-[11px] leading-tight text-muted-foreground border-l-2 border-accent/20 pl-2 whitespace-nowrap">
                                      {resp}
                                    </span>
                                  )) || <span className="text-muted-foreground">-</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Print Only Section: Sequential Lists */}
              <div className="hidden print:block space-y-8">
                <div>
                  <h3 className="text-lg font-bold mb-4 border-b pb-2">Elenco Iscritti ({filteredEntries.length})</h3>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="data-table w-full border-collapse">
                      <thead className="print:table-header-group text-[10px]">
                        <tr>
                          <th className="w-[35%] text-left p-2">Atleti</th>
                          <th className="w-[15%] text-center p-2">Cat. / Classe</th>
                          <th className="w-[35%] text-left p-2">Gare Selezionate</th>
                          <th className="w-[15%] text-left p-2">Responsabili</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidEntries.map(entry => renderEntryRow(entry))}
                        {lateUnpaidEntries.map(entry => renderEntryRow(entry, true))}
                        {regularUnpaidEntries.map(entry => renderEntryRow(entry))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredNotRegisteredCouples.length > 0 && (
                  <div className="pt-8 print:break-before-page" style={{ breakBefore: 'page' }}>
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">Elenco Potenziali Coppie Non Iscritte ({filteredNotRegisteredCouples.length})</h3>
                    <div className="overflow-x-auto print:overflow-visible">
                    <table className="data-table w-full border-collapse">
                      <thead className="print:table-header-group text-[10px]">
                        <tr>
                          <th className="w-[35%] text-left p-2 border">Atleti</th>
                          <th className="w-[15%] text-center p-2 border">Cat. / Classe</th>
                          <th className="w-[35%] text-left p-2 border">Gare Selezionabili</th>
                          <th className="w-[15%] text-left p-2 border">Responsabili</th>
                        </tr>
                      </thead>
                        <tbody>
                          {filteredNotRegisteredCouples.map(couple => {
                            const a1 = athletes.find(a => a.id === couple.athlete1_id);
                            const a2 = athletes.find(a => a.id === couple.athlete2_id);
                            return (
                              <tr 
                                key={couple.id} 
                                className="print:break-inside-avoid break-inside-avoid"
                                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                              >
                                <td className="font-medium py-2 border px-2 print:w-[35%] w-[35%]">
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center flex-1 min-w-0">
                                      <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[10px] font-bold">{a1 ? `${a1.first_name} ${a1.last_name}` : "-"}</span>
                                      <span className="text-[9px] text-muted-foreground font-normal">({a1?.code || "-"})</span>
                                    </div>
                                    <span className="text-muted-foreground shrink-0 font-normal text-[9px]">&</span>
                                    <div className="flex flex-col items-center flex-1 min-w-0">
                                      <span className="whitespace-nowrap overflow-hidden text-ellipsis text-[10px] font-bold">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</span>
                                      <span className="text-[9px] text-muted-foreground font-normal">({a2?.code || "-"})</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center border px-2 print:w-[15%] w-[15%]">
                                  <div className="flex flex-col items-center">
                                    <div className="text-sm font-bold">{couple.category}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Classe {couple.class}</div>
                                  </div>
                                </td>
                                <td className="border px-2 print:w-[35%] w-[35%]">
                                  <div className="flex flex-wrap gap-1 py-1">
                                    {eventTypes
                                      .filter(et => isEventAllowedForCouple(et, couple))
                                      .map(et => (
                                        <div key={et.id} className="text-[9px] py-0.5 px-2 bg-[#f3f4f6] text-black border border-slate-200 rounded-md whitespace-nowrap">
                                          {et.event_name}
                                        </div>
                                      ))}
                                  </div>
                                </td>
                                <td className="text-xs border px-2 print:w-[15%] w-[15%]">
                                  <div className="flex flex-col gap-1">
                                    {couple.responsabili?.map((resp, idx) => (
                                      <span key={idx} className="whitespace-nowrap font-medium text-[10px] text-muted-foreground border-l-2 border-accent/20 pl-2">{resp}</span>
                                    )) || <span>-</span>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CoupleDetailModal
        entry={selectedEntry}
        eventTypes={eventTypes}
        onClose={() => setSelectedEntry(null)}
        onUpdate={fetchEntries}
      />

      <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-accent" />
              Risultati del Confronto PDF
            </DialogTitle>
            <DialogDescription>
              Analisi basata sui codici CID estratti dal PDF selezionato.
            </DialogDescription>
          </DialogHeader>

          {comparisonResults && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
                  <div className="text-2xl font-bold text-green-700">{comparisonResults.matches.length}</div>
                  <div className="text-[10px] text-green-600 uppercase font-bold">Corrispondenze</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                  <div className="text-2xl font-bold text-red-700">{comparisonResults.missingInApp.length}</div>
                  <div className="text-[10px] text-red-600 uppercase font-bold">Mancanti in App</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
                  <div className="text-2xl font-bold text-amber-700">{comparisonResults.extraInApp.length}</div>
                  <div className="text-[10px] text-amber-600 uppercase font-bold">Eccessi in App</div>
                </div>
              </div>

              {comparisonResults.missingInApp.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    CID nel PDF non presenti tra gli iscritti in App:
                  </h4>
                  <div className="bg-muted/30 p-2 rounded border text-xs grid grid-cols-4 gap-2">
                    {comparisonResults.missingInApp.map(m => (
                      <code key={m.cid} className="bg-white px-1 py-0.5 rounded border">{m.cid}</code>
                    ))}
                  </div>
                </div>
              )}

              {comparisonResults.extraInApp.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                    <Info className="w-4 h-4" />
                    Iscritti in App non rilevati nel testo del PDF:
                  </h4>
                  <div className="bg-muted/30 p-2 rounded border divide-y divide-border/50">
                    {comparisonResults.extraInApp.map(e => (
                      <div key={e.cid} className="flex justify-between py-1 text-xs px-2">
                        <span className="font-medium">{e.names}</span>
                        <code className="text-muted-foreground">{e.cid}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Nota: Se il PDF è un'immagine o ha formati non testuali complessi, alcuni codici potrebbero non essere rilevati correttamente.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowComparisonDialog(false)}>Chiudi</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}