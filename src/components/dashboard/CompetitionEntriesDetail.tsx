import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Users, AlertTriangle, Clock, Trash2, FileSpreadsheet, CheckCircle, AlertCircle, Mail, Printer, Loader2, ChevronDown, Search, Info, Filter } from "lucide-react";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
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
import { getSportsAge, getCategorySortRank } from "@/lib/category-validation";
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
  const [filterClass, setFilterClass] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStandard, setFilterStandard] = useState("all");
  const [filterLatini, setFilterLatini] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const uniqueCategories = useMemo(() => Array.from(new Set(allCouples.map(c => c.category))).filter(Boolean).sort(), [allCouples]);
  const uniqueClasses = useMemo(() => Array.from(new Set(allCouples.map(c => c.class || "-"))).filter(Boolean).sort(), [allCouples]);
  const uniqueStandard = useMemo(() => Array.from(new Set(allCouples.map(c => resolveDisciplineClass("standard", c.athlete1, c.athlete2, c)))).filter(Boolean).sort(), [allCouples]);
  const uniqueLatini = useMemo(() => Array.from(new Set(allCouples.map(c => resolveDisciplineClass("latino", c.athlete1, c.athlete2, c)))).filter(Boolean).sort(), [allCouples]);

  const filteredEntries = entries.filter(entry => {
    if (selectedInstructorId !== "all") {
      const instructor = profiles.find(p => p.id === selectedInstructorId);
      if (instructor && !isInstructorResponsibleForCoupleByResponsabili(instructor.full_name, entry.couples?.responsabili || [])) {
        return false;
      }
    }
    
    if (filterCategory !== "all" && entry.couples?.category !== filterCategory) return false;
    if (filterClass !== "all" && (entry.couples?.class || "-") !== filterClass) return false;
    if (filterStandard !== "all" && resolveDisciplineClass("standard", entry.couples?.athlete1, entry.couples?.athlete2, entry.couples) !== filterStandard) return false;
    if (filterLatini !== "all" && resolveDisciplineClass("latino", entry.couples?.athlete1, entry.couples?.athlete2, entry.couples) !== filterLatini) return false;

    if (searchQuery) {
      const a1 = entry.couples?.athlete1;
      const a2 = entry.couples?.athlete2;
      const q = searchQuery.toLowerCase();
      const searchString = `${a1?.first_name || ""} ${a1?.last_name || ""} ${a1?.code || ""} ${a2?.first_name || ""} ${a2?.last_name || ""} ${a2?.code || ""}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    
    return true;
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

  const sortEntriesByCategory = (e1: CompetitionEntry, e2: CompetitionEntry) => {
    const rank1 = getCategorySortRank(e1.couples?.category || "");
    const rank2 = getCategorySortRank(e2.couples?.category || "");
    if (rank1 !== rank2) return rank1 - rank2;

    const name1 = `${e1.couples?.athlete1?.last_name || ""} ${e1.couples?.athlete1?.first_name || ""}`.toLowerCase();
    const name2 = `${e2.couples?.athlete1?.last_name || ""} ${e2.couples?.athlete1?.first_name || ""}`.toLowerCase();
    return name1.localeCompare(name2);
  };

  const activeEntries = filteredEntries.filter(e => e.status !== "cancelled" && e.couples).sort(sortEntriesByCategory);
  const paidEntries = activeEntries.filter(e => e.is_paid);
  const lateUnpaidEntries = activeEntries.filter(e => !e.is_paid && isLateEntry(e.created_at));
  const regularUnpaidEntries = activeEntries.filter(e => !e.is_paid && !isLateEntry(e.created_at));

  const enrolledCoupleIds = new Set(activeEntries.map(e => e.couple_id));
  
  const checkCoupleVisibility = (couple: Couple) => {
    if (role === "instructor" && userId) {
      const currentUserProfile = profiles.find(p => p.user_id === userId);
      if (!currentUserProfile || !isInstructorResponsibleForCoupleByResponsabili(currentUserProfile.full_name, couple.responsabili || [])) {
        return false;
      }
    }
    
    if (selectedInstructorId !== "all") {
      const instructor = profiles.find(p => p.id === selectedInstructorId);
      if (instructor && !isInstructorResponsibleForCoupleByResponsabili(instructor.full_name, couple.responsabili || [])) {
        return false;
      }
    }
    return true;
  };

  const visibleUnenrolledCouples = allCouples.filter(couple => {
    if (!checkCoupleVisibility(couple)) return false;
    if (enrolledCoupleIds.has(couple.id)) return false;
    
    if (filterCategory !== "all" && couple.category !== filterCategory) return false;
    if (filterClass !== "all" && (couple.class || "-") !== filterClass) return false;
    if (filterStandard !== "all" && resolveDisciplineClass("standard", couple.athlete1, couple.athlete2, couple) !== filterStandard) return false;
    if (filterLatini !== "all" && resolveDisciplineClass("latino", couple.athlete1, couple.athlete2, couple) !== filterLatini) return false;
    
    if (searchQuery) {
      const a1 = couple.athlete1;
      const a2 = couple.athlete2;
      const q = searchQuery.toLowerCase();
      const searchString = `${a1?.first_name || ""} ${a1?.last_name || ""} ${a1?.code || ""} ${a2?.first_name || ""} ${a2?.last_name || ""} ${a2?.code || ""}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    
    return true;
  });

  const sortCouples = (a: Couple, b: Couple) => {
    const rank1 = getCategorySortRank(a.category);
    const rank2 = getCategorySortRank(b.category);
    if (rank1 !== rank2) return rank1 - rank2;
    const name1 = `${a.athlete1?.last_name || ""} ${a.athlete1?.first_name || ""}`.toLowerCase();
    const name2 = `${b.athlete1?.last_name || ""} ${b.athlete1?.first_name || ""}`.toLowerCase();
    return name1.localeCompare(name2);
  };

  const unenrolledCouples = visibleUnenrolledCouples.filter(couple => eventTypes.some(et => isEventAllowedForCouple(et, couple))).sort(sortCouples);
  const ineligibleCouples = visibleUnenrolledCouples.filter(couple => !eventTypes.some(et => isEventAllowedForCouple(et, couple))).sort(sortCouples);

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase.from("competition_entries").delete().eq("id", entryId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'iscrizione", variant: "destructive" });
    } else {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Iscrizione eliminata" });
    }
  };

  const generatePdfReport = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      const img = new Image();
      img.src = '/logo.png';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const addHeaderFooter = (doc: jsPDF) => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          
          doc.addImage(img, 'PNG', 14, 10, 30, 30);
          
          doc.setFontSize(24);
          doc.setTextColor(218, 165, 32);
          doc.text("Competition Entry", pageWidth / 2, 22, { align: "center" });
          
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text(competition.name, 14, 50);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          
          const startDateStr = new Date(competition.date).toLocaleDateString("it-IT");
          const endDateStr = competition.end_date ? new Date(competition.end_date).toLocaleDateString("it-IT") : '';
          const locationStr = competition.location || '';
          const dateLocText = [startDateStr, endDateStr, locationStr].filter(Boolean).join(" - ");
          
          doc.text(dateLocText, 14, 55);
          doc.text("Email: ufficiogare@ritmodanza.net", 14, 60);
          
          doc.setLineWidth(0.5);
          doc.line(14, 65, pageWidth - 14, 65);

          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          const printDate = new Date().toLocaleString("it-IT");
          doc.text(`Stampato il: ${printDate}`, 14, pageHeight - 10);
          doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
        }
      };

      let startY = 75;

      const writeGroup = (title: string, list: any[], type: "entry" | "unenrolled" | "ineligible") => {
        if (list.length === 0) return;
        
        if (startY !== 75) {
          doc.addPage();
          startY = 75;
        }
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        
        doc.text(title, 14, startY);
        startY += 10;
        
        list.forEach(item => {
          if (startY > pageHeight - 20) {
            doc.addPage();
            startY = 75;
          }

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          
          let coupleText = "";
          let eventsText: string[] = [];
          
          if (type === "entry") {
            const e = item as CompetitionEntry;
            const a1 = getAthleteForPos(e, 1);
            const a2 = getAthleteForPos(e, 2);
            const a1Name = a1 ? `${a1.first_name} ${a1.last_name}` : "-";
            const a2Name = a2 ? `${a2.first_name} ${a2.last_name}` : "-";
            
            coupleText = `${a1Name} & ${a2Name}`;
            
            eventsText = (e.event_type_ids || []).map(id => {
              const name = eventTypes.find(et => et.id === id)?.event_name;
              if (!name) return "";
              const effClass = getEffectiveClass(e.couples, name);
              return `    ${formatEventName(name, effClass, e.couples.category)}`;
            }).filter(Boolean);
            
          } else {
            const c = item as Couple;
            const a1 = c.athlete1;
            const a2 = c.athlete2;
            const a1Name = a1 ? `${a1.first_name} ${a1.last_name}` : "-";
            const a2Name = a2 ? `${a2.first_name} ${a2.last_name}` : "-";
            
            if (type === "unenrolled") {
                const eligibleEventNames = eventTypes
                  .filter(et => isEventAllowedForCouple(et, c))
                  .map(et => {
                    const effClass = getEffectiveClass(c, et.event_name);
                    return `    ${formatEventName(et.event_name, effClass, c.category)}`;
                  });
                coupleText = `${a1Name} & ${a2Name}`;
                eventsText = eligibleEventNames;
            } else {
                coupleText = `${a1Name} & ${a2Name}`;
                eventsText = ["    Nessuna gara idonea trovata per questa competizione."];
            }
          }

          doc.text(coupleText, 14, startY);
          startY += 6;
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          eventsText.forEach(evt => {
             if (startY > pageHeight - 15) {
                doc.addPage();
                startY = 75;
             }
             doc.text(evt, 14, startY);
             startY += 5;
          });
          
          startY += 4;
        });
        
        startY += 10;
      };

      writeGroup("ISCRITTI PAGATI", paidEntries, "entry");
      writeGroup("ISCRITTI DA PAGARE", [...regularUnpaidEntries, ...lateUnpaidEntries], "entry");
      writeGroup("DA ISCRIVERE", unenrolledCouples, "unenrolled");
      writeGroup("NON IDONEI", ineligibleCouples, "ineligible");

      addHeaderFooter(doc);

      doc.save(`${competition.name}_Report.pdf`);
      
      toast({ 
        title: "Download completato", 
        description: "Il report PDF è stato scaricato con successo sul tuo dispositivo." 
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Errore", description: "Impossibile generare il PDF", variant: "destructive" });
    }
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

    const unselectedEventNames = eventTypes
      .filter(et => isEventAllowedForCouple(et, couple) && !(entry.event_type_ids || []).includes(et.id))
      .map(et => {
        const effClass = getEffectiveClass(couple, et.event_name);
        return formatEventName(et.event_name, effClass, couple.category);
      });

    return (
      <tr key={entry.id} className={cn("cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5", showLateFlag && "bg-amber-500/5")} onClick={() => setSelectedEntry(entry)}>
        <td className="py-4 px-3 w-[35%]"><div className="flex items-center gap-3">{renderAthleteName(a1)}<span className="text-muted-foreground opacity-30 text-[10px]">&</span>{renderAthleteName(a2)}</div></td>
        <td className="text-center w-[20%]"><div className="flex flex-col items-center"><span className="text-sm font-black tracking-tight">{couple.category}</span><span className="text-[9px] text-muted-foreground font-black uppercase opacity-60">ST: {stClass} • LA: {laClass}</span></div></td>
        <td className="w-[30%] min-w-[200px]"><div className="flex flex-wrap gap-1">
          {entryEventNames.map(name => (
             <Badge key={name} className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] font-bold uppercase rounded-lg px-2 py-0.5">{name}</Badge>
          ))}
          {unselectedEventNames.map(name => (
             <Badge key={`uns-${name}`} className="bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-white/5 dark:text-white/40 dark:border-white/10 text-[10px] font-bold uppercase rounded-lg px-2 py-0.5">{name}</Badge>
          ))}
          {entry.event_type_ids?.length === 0 && unselectedEventNames.length === 0 && <span className="text-muted-foreground italic text-xs">Nessuna gara selezionata</span>}
        </div></td>
        <td className="w-[15%] min-w-[120px]"><div className="flex flex-col gap-1">{couple.responsabili?.map(r => <span key={r} className="text-[10px] text-muted-foreground font-bold border-l-2 border-primary/20 pl-2">{r}</span>)}</div></td>
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
              <Button variant="outline" onClick={generatePdfReport} className="rounded-xl border-white/10 hover:bg-primary/5 font-bold"><Printer className="mr-2 w-4 h-4" /> Stampa / PDF</Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-12 h-12 hover:bg-red-500/10 hover:text-red-500"><X /></Button>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="mx-8 mt-8 relative flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                   placeholder="Cerca atleti per nome, cognome o CID..." 
                   className="w-full pl-12 h-14 bg-neutral-100/50 dark:bg-white/5 border-neutral-200 dark:border-white/10 rounded-2xl text-lg font-medium"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                   <Button variant="ghost" size="icon" onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 hover:bg-neutral-200 dark:hover:bg-white/10">
                      <X className="w-4 h-4" />
                   </Button>
                )}
              </div>
              <Button
                  variant={showFilters ? "default" : "outline"}
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn("h-14 px-6 rounded-2xl font-bold border-neutral-200 dark:border-white/10 shrink-0", showFilters ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-neutral-100/50 dark:bg-white/5")}
                >
                  <Filter className="w-5 h-5 mr-2" />
                  Filtri
              </Button>
           </div>

           {showFilters && (
              <div className="mx-8 mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-neutral-100/50 dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 animate-in fade-in slide-in-from-top-2">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Istruttore</label>
                   <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                     <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 font-medium">
                       <SelectValue placeholder="Tutti" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">Tutti</SelectItem>
                       {instructors.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Categoria</label>
                   <Select value={filterCategory} onValueChange={setFilterCategory}>
                     <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 font-medium">
                       <SelectValue placeholder="Tutte" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">Tutte</SelectItem>
                       {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Classe</label>
                   <Select value={filterClass} onValueChange={setFilterClass}>
                     <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 font-medium">
                       <SelectValue placeholder="Tutte" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">Tutte</SelectItem>
                       {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Standard</label>
                   <Select value={filterStandard} onValueChange={setFilterStandard}>
                     <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 font-medium">
                       <SelectValue placeholder="Tutte" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">Tutte</SelectItem>
                       {uniqueStandard.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Latini</label>
                   <Select value={filterLatini} onValueChange={setFilterLatini}>
                     <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 font-medium">
                       <SelectValue placeholder="Tutte" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">Tutte</SelectItem>
                       {uniqueLatini.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
              </div>
           )}

           <Tabs defaultValue="iscritti">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mx-8 mt-8 gap-4">
                 <TabsList className="bg-neutral-100 dark:bg-black/20 p-2 rounded-2xl flex flex-wrap gap-2 h-auto min-h-10">
                    <TabsTrigger value="iscritti" className="rounded-xl font-bold py-2">ISCRITTI ({filteredEntries.length})</TabsTrigger>
                    <TabsTrigger value="non-iscritti" className="rounded-xl font-bold py-2">DA ISCRIVERE ({unenrolledCouples.length})</TabsTrigger>
                    <TabsTrigger value="ineligible" className="rounded-xl font-bold py-2">NON IDONEE ({ineligibleCouples.length})</TabsTrigger>
                 </TabsList>
              </div>
              <TabsContent value="iscritti" className="p-8 pt-4">
                 <div className="overflow-x-auto rounded-lg border border-neutral-200/50 dark:border-white/5">
                   <table className="w-full text-left min-w-[800px]">
                      <thead><tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 border-b border-neutral-100 dark:border-white/5"><th className="pb-4 px-3 min-w-[200px]">Atleti</th><th className="pb-4 text-center min-w-[120px]">Cat / Classe</th><th className="pb-4 min-w-[200px]">Gare</th><th className="pb-4 min-w-[120px]">Istruttori</th><th className="pb-4 text-center">Pagamento</th></tr></thead>
                      <tbody>{activeEntries.map(e => renderEntryRow(e, isLateEntry(e.created_at)))}</tbody>
                   </table>
                 </div>
              </TabsContent>
              <TabsContent value="non-iscritti" className="p-8 pt-4">
                 <div className="overflow-x-auto rounded-lg border border-neutral-200/50 dark:border-white/5">
                   <table className="w-full text-left min-w-[800px]">
                      <thead>
                          <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 border-b border-neutral-100 dark:border-white/5">
                            <th className="pb-4 px-3 min-w-[200px]">Atleti</th>
                            <th className="pb-4 text-center min-w-[120px]">Cat / Classe</th>
                            <th className="pb-4 min-w-[200px]">Gare</th>
                            <th className="pb-4 min-w-[120px]">Istruttori</th>
                         </tr>
                      </thead>
                      <tbody>
                         {unenrolledCouples.map(couple => {
                            const a1 = couple.athlete1;
                            const a2 = couple.athlete2;
                            const eligibleEventNames = eventTypes
                              .filter(et => isEventAllowedForCouple(et, couple))
                              .map(et => {
                                const effClass = getEffectiveClass(couple, et.event_name);
                                return formatEventName(et.event_name, effClass, couple.category);
                              });

                            return (
                               <tr key={couple.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5">
                                  <td className="py-4 px-3 w-[35%]"><div className="flex items-center gap-3">{renderAthleteName(a1)}<span className="text-muted-foreground opacity-30 text-[10px]">&</span>{renderAthleteName(a2)}</div></td>
                                  <td className="text-center w-[20%]"><div className="flex flex-col items-center"><span className="text-sm font-black tracking-tight">{couple.category}</span><span className="text-[9px] text-muted-foreground font-black uppercase opacity-60">CLASSE {couple.class}</span></div></td>
                                  <td className="w-[30%] min-w-[200px]"><div className="flex flex-wrap gap-1">
                                    {eligibleEventNames.map(name => (
                                      <Badge key={name} className="bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-white/5 dark:text-white/40 dark:border-white/10 text-[10px] font-bold uppercase rounded-lg px-2 py-0.5">{name}</Badge>
                                    ))}
                                    {eligibleEventNames.length === 0 && <span className="text-muted-foreground italic text-xs">Nessuna gara idonea</span>}
                                  </div></td>
                                  <td className="w-[15%] min-w-[120px]"><div className="flex flex-col gap-1">{couple.responsabili?.map(r => <span key={r} className="text-[10px] text-muted-foreground font-bold border-l-2 border-primary/20 pl-2">{r}</span>)}</div></td>
                               </tr>
                            );
                         })}
                         {unenrolledCouples.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-muted-foreground italic">Nessuna coppia da iscrivere.</td></tr>
                         )}
                      </tbody>
                   </table>
                 </div>
              </TabsContent>
              <TabsContent value="ineligible" className="p-8 pt-4">
                 <div className="overflow-x-auto rounded-lg border border-neutral-200/50 dark:border-white/5">
                   <table className="w-full text-left min-w-[700px]">
                      <thead>
                         <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 border-b border-neutral-100 dark:border-white/5">
                            <th className="pb-4 px-3 min-w-[200px]">Atleti</th>
                            <th className="pb-4 text-center min-w-[120px]">Cat / Classe</th>
                            <th className="pb-4 min-w-[120px]">Istruttori</th>
                         </tr>
                      </thead>
                      <tbody>
                         {ineligibleCouples.map(couple => {
                            const a1 = couple.athlete1;
                            const a2 = couple.athlete2;
                            return (
                               <tr key={couple.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5 opacity-50">
                                  <td className="py-4 px-3 w-[35%]"><div className="flex items-center gap-3">{renderAthleteName(a1)}<span className="text-muted-foreground opacity-30 text-[10px]">&</span>{renderAthleteName(a2)}</div></td>
                                  <td className="text-center w-[20%]"><div className="flex flex-col items-center"><span className="text-sm font-black tracking-tight">{couple.category}</span><span className="text-[9px] text-muted-foreground font-black uppercase opacity-60">CLASSE {couple.class}</span></div></td>
                                  <td className="w-[15%] min-w-[120px]"><div className="flex flex-col gap-1">{couple.responsabili?.map(r => <span key={r} className="text-[10px] text-muted-foreground font-bold border-l-2 border-primary/20 pl-2">{r}</span>)}</div></td>
                               </tr>
                            );
                         })}
                         {ineligibleCouples.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-8 text-muted-foreground italic">Tutte le coppie sono idonee per questa gara.</td></tr>
                         )}
                      </tbody>
                   </table>
                 </div>
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