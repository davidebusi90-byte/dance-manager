import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, X, Calendar, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompetitionsImport from "@/components/CompetitionsImport";
import CompetitionEntriesDetail from "./CompetitionEntriesDetail";

interface Competition {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string | null;
  registration_deadline: string | null;
  late_fee_deadline: string | null;
  description: string | null;
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

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          Competizioni ({competitions.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <CompetitionsImport onImportComplete={onRefresh} />
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
            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
              {competitions.map((competition) => {
                const deadlinePassed = isDeadlinePassed(competition.registration_deadline);
                return (
                  <div
                    key={competition.id}
                    className="p-4 rounded-lg border bg-card shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleCompetitionClick(competition)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg leading-tight">{competition.name}</h3>
                      {competition.registration_deadline && (
                        <span className={`status-badge ${deadlinePassed ? "status-badge-error" : "status-badge-success"} text-xs px-2 py-1`}>
                          {deadlinePassed ? "Scaduta" : "Aperta"}
                        </span>
                      )}
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
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data Competizione</th>
                    <th>Nome Competizione</th>
                    <th>Luogo</th>
                    <th>Scadenza Iscrizione</th>
                    <th>Iscrizione in ritardo</th>
                    <th>Stato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((competition) => {
                    const deadlinePassed = isDeadlinePassed(competition.registration_deadline);
                    return (
                      <tr
                        key={competition.id}
                        className="cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => handleCompetitionClick(competition)}
                      >
                        <td>
                          <div className="flex items-center gap-2">
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
                        <td>{formatDate(competition.registration_deadline)}</td>
                        <td>{formatDate(competition.late_fee_deadline)}</td>
                        <td>
                          {competition.registration_deadline && (
                            <span className={`status-badge ${deadlinePassed ? "status-badge-error" : "status-badge-success"}`}>
                              {deadlinePassed ? "Scaduta" : "Aperta"}
                            </span>
                          )}
                          {!competition.registration_deadline && (
                            <span className="status-badge status-badge-warning">Da definire</span>
                          )}
                        </td>
                        <td>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
