import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Users, AlertTriangle, Clock, Trash2, FileSpreadsheet, CheckCircle, AlertCircle, Mail, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { isInstructorResponsibleForCoupleByResponsabili } from "@/lib/instructor-utils";
import CoupleDetailModal from "./CoupleDetailModal";
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

interface Competition {
  id: string;
  name: string;
  date: string;
  registration_deadline: string | null;
  late_fee_deadline: string | null;
}

interface EventType {
  id: string;
  event_name: string;
}

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  instructor_id?: string | null;
  responsabili?: string[] | null;
}


interface CompetitionEntry {
  id: string;
  couple_id: string;
  status: string;
  created_at: string;
  is_paid: boolean;
  couples: {
    id: string;
    category: string;
    class: string;
    disciplines?: string[];
    responsabili?: string[];
    athlete1_id: string;
    athlete2_id: string;
    athlete1?: Athlete;
    athlete2?: Athlete;
  };
  event_type_ids: string[];
}

interface Profile {
  id: string;
  user_id?: string;
  full_name: string;
}

interface CompetitionEntriesDetailProps {
  competition: Competition;
  athletes: Athlete[];
  profiles: Profile[];
  onClose: () => void;
}

export default function CompetitionEntriesDetail({
  competition,
  athletes,
  profiles,
  onClose
}: CompetitionEntriesDetailProps) {
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CompetitionEntry | null>(null);
  const { toast } = useToast();
  const { role, userId } = useUserRole();

  useEffect(() => {
    fetchEntries();
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
              responsabili
            ),
            athlete2:athletes!couples_athlete2_id_fkey (
              id,
              code,
              first_name,
              last_name,
              gender,
              instructor_id,
              responsabili
            )
          )
        `)
        .eq("competition_id", competition.id),
      supabase
        .from("competition_event_types")
        .select("id, event_name")
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
  const activeEntries = entries.filter(e => e.status === "registered" || e.status === "confirmed" || e.status === "pending");
  const paidEntries = activeEntries.filter(e => e.is_paid);
  const lateUnpaidEntries = activeEntries.filter(e => !e.is_paid && isLateEntry(e.created_at));
  const regularUnpaidEntries = activeEntries.filter(e => !e.is_paid && !isLateEntry(e.created_at));


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
        return {
          "Stato": statusLabel,
          "Categoria": c.category,
          "Classe": c.class,
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

  const renderEntryRow = (entry: CompetitionEntry, showLateFlag = false) => {
    const couple = entry.couples;
    if (!couple) return null;

    const athlete1 = getAthlete(entry, 1);
    const athlete2 = getAthlete(entry, 2);
    const isLate = isLateEntry(entry.created_at);

    const entryEventNames = (entry.event_type_ids || [])
      .map(id => eventTypes.find(et => et.id === id)?.event_name)
      .filter(Boolean);

    return (
      <tr
        key={entry.id}
        className={`${isLate && showLateFlag ? "bg-warning/10" : ""} ${role === "admin" ? "cursor-pointer hover:bg-muted/50" : ""} transition-colors`}
        onClick={() => role === "admin" && setSelectedEntry(entry)}
      >
        <td className="font-mono text-sm print:hidden">{athlete1?.code || "-"}</td>
        <td className="font-medium">
          {athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}
        </td>
        <td className="font-mono text-sm print:hidden">{athlete2?.code || "-"}</td>
        <td className="font-medium">
          {athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}
        </td>
        <td>
          <div>
            <div className="text-sm">{couple.category}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Classe {couple.class}</div>
          </div>
        </td>
        <td className="max-w-[200px] print:max-w-[400px]">
          <div className="flex flex-wrap gap-1">
            {entryEventNames.length > 0 ? (
              entryEventNames.map(name => (
                <Badge key={name!} variant="outline" className="text-[10px] py-1 h-auto min-h-[1.5rem] px-2 bg-primary/5 border-primary/20 whitespace-normal text-left print:border-none print:p-0 print:bg-transparent print:text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground italic text-xs">-</span>
            )}
          </div>
        </td>
        <td className="print:hidden">
          <div className="text-xs">
            {getCombinedResponsabili(entry).join(", ") || "-"}
          </div>
        </td>
        <td className="print:hidden">
          <div className="flex items-center gap-2">
            {entry.is_paid ? (
              <Badge className="bg-success text-success-foreground hover:bg-success/80">
                <CheckCircle className="w-3 h-3 mr-1" />
                Pagato
              </Badge>
            ) : isLate ? (
              <Badge variant="outline" className="border-warning text-warning">
                <Clock className="w-3 h-3 mr-1" />
                Mora
              </Badge>
            ) : (
              <Badge variant="secondary">Da Pagare</Badge>
            )}
          </div>
        </td>
        <td className="print:hidden">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={entry.is_paid}
              onCheckedChange={() => handlePaymentToggle(entry.id, entry.is_paid)}
              title="Segna come pagato"
              disabled={role !== "admin"}
            />
            {role === "admin" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10">
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
              {formatDate(competition.date)} • Scadenza: {formatDate(competition.registration_deadline)}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {role === "admin" && (
              <Button variant="outline" onClick={handleSendReport} disabled={isSendingReport} className="gap-2">
                <Mail className="w-4 h-4" />
                {isSendingReport ? "Invio in corso..." : "Invia Report Email"}
              </Button>
            )}
            <Button variant="outline" onClick={generateReport} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Genera Report Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Stampa / PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna iscrizione per questa competizione</p>
          ) : (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3 print:hidden">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{paidEntries.length}</p>
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Coppie Pagate</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{regularUnpaidEntries.length}</p>
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Da Pagare</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{lateUnpaidEntries.length}</p>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">In Ritardo (Mora)</p>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto print:overflow-visible">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="print:hidden">Cod. Cavaliere</th>
                      <th>Cavaliere</th>
                      <th className="print:hidden">Cod. Dama</th>
                      <th>Dama</th>
                      <th>Categoria / Classe</th>
                      <th>Gare Selezionate</th>
                      <th className="print:hidden">Responsabili</th>
                      <th className="print:hidden">Stato</th>
                      <th className="print:hidden">Pagato</th>
                      <th className="print:hidden"></th>
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
          )}
        </CardContent>
      </Card>

      <CoupleDetailModal
        entry={selectedEntry}
        eventTypes={eventTypes}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  );
}