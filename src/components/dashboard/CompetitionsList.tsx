import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, X, Calendar, MapPin, ChevronRight, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompetitionsImport from "@/components/CompetitionsImport";
import CompetitionEntriesDetail from "./CompetitionEntriesDetail";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Competition {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  registration_deadline: string | null;
  late_fee_deadline: string | null;
  description: string | null;
  is_completed?: boolean;
}

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  instructor_id?: string | null;
  responsabili?: string[] | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface CompetitionsListProps {
  competitions: Competition[];
  athletes?: Athlete[];
  profiles?: Profile[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function CompetitionsList({ competitions, athletes = [], profiles = [], onClose, onRefresh }: CompetitionsListProps) {
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);
  const [competitionToComplete, setCompetitionToComplete] = useState<Competition | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const { role } = useUserRole();
  const { toast } = useToast();

  const activeCompetitions = competitions.filter(c => !c.is_completed);
  const completedCompetitions = competitions.filter(c => c.is_completed);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const isDeadlinePassed = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleCompetitionClick = (competition: Competition) => {
    setSelectedCompetition(competition);
  };

  const handleDeleteClick = async (e: React.MouseEvent, competition: Competition) => {
    e.stopPropagation();
    try {
      const { count, error } = await supabase
        .from("competition_entries")
        .select("*", { count: 'exact', head: true })
        .eq("competition_id", competition.id);

      if (error) throw error;

      setParticipantCount(count || 0);
      setCompetitionToDelete(competition);
    } catch (error) {
      console.error("Error checking registrations:", error);
      toast({
        title: "Errore",
        description: "Impossibile verificare le iscrizioni",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!competitionToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("competitions")
        .update({ is_deleted: true } as any)
        .eq("id", competitionToDelete.id);

      if (error) throw error;

      toast({
        title: "Competizione eliminata",
        description: "La competizione è stata rimossa correttamente",
      });
      onRefresh();
    } catch (error) {
      console.error("Error deleting competition:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la competizione",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setCompetitionToDelete(null);
    }
  };

  const handleCompleteClick = async (e: React.MouseEvent, competition: Competition) => {
    e.stopPropagation();
    setCompetitionToComplete(competition);
  };

  const handleConfirmComplete = async () => {
    if (!competitionToComplete) return;

    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from("competitions")
        .update({ is_completed: true } as any)
        .eq("id", competitionToComplete.id);

      if (error) throw error;

      toast({
        title: "Competizione completata",
        description: "La competizione è stata spostata nelle gare completate",
      });
      onRefresh();
    } catch (error) {
      console.error("Error completing competition:", error);
      toast({
        title: "Errore",
        description: "Impossibile completare la competizione",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
      setCompetitionToComplete(null);
    }
  };

  // Show detail view if a competition is selected
  if (selectedCompetition) {
    return (
      <CompetitionEntriesDetail
        competition={selectedCompetition}
        athletes={athletes}
        profiles={profiles}
        onClose={() => setSelectedCompetition(null)}
      />
    );
  }

  const renderCompetitionsToCards = (comps: Competition[], isCompletedSection: boolean) => {
    if (comps.length === 0) {
      return (
        <div className="text-center py-4 bg-muted/20 rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">
            {isCompletedSection ? "Nessuna competizione completata" : "Nessuna competizione attiva"}
          </p>
        </div>
      );
    }

    return comps.map((competition) => {
      const deadlinePassed = isDeadlinePassed(competition.registration_deadline);
      return (
        <div
          key={competition.id}
          className={`p-4 rounded-lg border bg-card shadow-sm cursor-pointer transition-colors ${isCompletedSection ? "opacity-75 hover:opacity-100 hover:bg-muted/50" : "hover:bg-muted/50"
            }`}
          onClick={() => handleCompetitionClick(competition)}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight">{competition.name}</h3>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {!isCompletedSection && competition.registration_deadline && (
                <span className={`status-badge ${deadlinePassed ? "status-badge-error" : "status-badge-success"} text-xs px-2 py-1`}>
                  {deadlinePassed ? "Scaduta" : "Aperta"}
                </span>
              )}
              {isCompletedSection && (
                <span className="status-badge status-badge-success text-xs px-2 py-1">
                  Completata
                </span>
              )}
              {role === "admin" && !isCompletedSection && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                  onClick={(e) => handleCompleteClick(e, competition)}
                  title="Sposta nelle completate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                </Button>
              )}
              {role === "admin" && isCompletedSection && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                  onClick={(e) => handleDeleteClick(e, competition)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(competition.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{competition.location || "-"}</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
            Scadenza: {formatDate(competition.registration_deadline)}
          </div>
        </div>
      );
    });
  };

  const renderCompetitionsToTable = (comps: Competition[], isCompletedSection: boolean) => {
    if (comps.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="text-center py-4 text-muted-foreground">
            {isCompletedSection ? "Nessuna competizione completata" : "Nessuna competizione attiva"}
          </td>
        </tr>
      );
    }

    return comps.map((competition) => {
      const deadlinePassed = isDeadlinePassed(competition.registration_deadline);
      return (
        <tr
          key={competition.id}
          className={`cursor-pointer transition-colors ${isCompletedSection ? "opacity-75 hover:opacity-100 hover:bg-secondary/50" : "hover:bg-secondary/50"
            }`}
          onClick={() => handleCompetitionClick(competition)}
        >
          <td className="px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {formatDate(competition.date)}
              {competition.end_date && competition.end_date !== competition.date && (
                <span className="text-muted-foreground">
                  - {formatDate(competition.end_date)}
                </span>
              )}
            </div>
          </td>
          <td className="font-medium">{competition.name}</td>
          <td>
            {competition.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                {competition.location}
              </div>
            )}
            {!competition.location && "-"}
          </td>
          <td className="px-4 py-3 text-center">{formatDate(competition.registration_deadline)}</td>
          <td className="px-4 py-3 text-center">{formatDate(competition.late_fee_deadline)}</td>
          <td>
            {!isCompletedSection && competition.registration_deadline && (
              <span className={`status-badge ${deadlinePassed ? "status-badge-error" : "status-badge-success"}`}>
                {deadlinePassed ? "Scaduta" : "Aperta"}
              </span>
            )}
            {!isCompletedSection && !competition.registration_deadline && (
              <span className="status-badge status-badge-warning">Da definire</span>
            )}
            {isCompletedSection && (
              <span className="status-badge status-badge-success">
                Completata
              </span>
            )}
          </td>
          <td onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {role === "admin" && !isCompletedSection && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                  onClick={(e) => handleCompleteClick(e, competition)}
                  title="Sposta nelle completate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                </Button>
              )}
              {role === "admin" && isCompletedSection && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                  onClick={(e) => handleDeleteClick(e, competition)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          Competizioni ({activeCompetitions.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          {role === "admin" && <CompetitionsImport onImportComplete={onRefresh} />}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {competitions.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nessuna competizione registrata</p>
            <p className="text-sm text-muted-foreground mt-2">
              Importa le competizioni usando il pulsante "Importa Competizioni"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Tab-like buttons for sections (optional, for better UX) */}
            <div className="flex space-x-2 border-b mb-4 pb-2">
              <button
                className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${!showCompleted ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                onClick={() => setShowCompleted(false)}
              >
                Gare Attive ({activeCompetitions.length})
              </button>
              {role === "admin" && (
                <button
                  className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${showCompleted ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                  onClick={() => setShowCompleted(true)}
                >
                  Gare Completate ({completedCompetitions.length})
                </button>
              )}
            </div>

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
              {!showCompleted ? renderCompetitionsToCards(activeCompetitions, false) : renderCompetitionsToCards(completedCompetitions, true)}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-orange-50 border-b border-orange-200 text-left">
                  <tr>
                    <th className="px-4 py-3 text-center font-medium text-orange-700 bg-orange-50">Data Competizione</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-700 bg-orange-50">Nome Competizione</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-700 bg-orange-50">Luogo</th>
                    <th className="px-4 py-3 text-center font-medium text-orange-700 bg-orange-50">Scadenza Iscrizione</th>
                    <th className="px-4 py-3 text-center font-medium text-orange-700 bg-orange-50">Iscrizione in ritardo</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-700 bg-orange-50">Stato</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-700 bg-orange-50"></th>
                  </tr>
                </thead>
                <tbody>
                  {!showCompleted ? renderCompetitionsToTable(activeCompetitions, false) : renderCompetitionsToTable(completedCompetitions, true)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!competitionToDelete} onOpenChange={(open) => !open && setCompetitionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {participantCount > 0 && <AlertTriangle className="w-5 h-5 text-warning" />}
              {participantCount > 0 ? "Attenzione: Coppie Iscritte" : "Conferma Eliminazione"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {participantCount > 0 ? (
                <>
                  Ci sono <strong>{participantCount}</strong> coppie iscritte a questa gara.
                  Cancellando la competizione, verranno rimosse anche tutte le iscrizioni associate.
                  <br /><br />
                  Sei sicuro di volerla cancellare?
                </>
              ) : (
                "Sei sicuro di voler eliminare questa competizione? L'azione è irreversibile."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminazione..." : "Sì, elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Completing a Competition */}
      <AlertDialog open={!!competitionToComplete} onOpenChange={(open) => !open && setCompetitionToComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Spostamento</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler spostare "{competitionToComplete?.name}" nelle gare completate?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={isCompleting}
            >
              {isCompleting ? "Spostamento..." : "Sì, sposta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
