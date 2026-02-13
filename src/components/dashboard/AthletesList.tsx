import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, X, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { validateCategoryMatch, formatCategoryDisplay, CategoryLabel, getSportsAge } from "@/lib/category-validation";

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  category: string;
  class: string;
  birth_date: string | null;
  medical_certificate_expiry: string | null;
  instructor_id: string | null;
  responsabili?: string[];
  gender?: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Couple {
  athlete1_id: string;
  athlete2_id: string;
}

interface AthletesListProps {
  athletes: Athlete[];
  couples: Couple[];
  profiles: Profile[];
  onClose: () => void;
}

export default function AthletesList({ athletes, couples, profiles, onClose }: AthletesListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const getCertificateStatus = (expiry: string | null) => {
    if (!expiry) return { status: "missing", label: "Mancante", class: "status-badge-warning" };
    const isExpired = new Date(expiry) < new Date();
    return isExpired
      ? { status: "expired", label: "Scaduto", class: "status-badge-error" }
      : { status: "valid", label: "Valido", class: "status-badge-success" };
  };

  // Pre-calculate coupled athletes set for quick lookup
  const athleteIdsInCouples = useMemo(() => new Set(
    couples.flatMap(c => [c.athlete1_id, c.athlete2_id])
  ), [couples]);

  const sortedAthletes = useMemo(() => {
    const referenceDate = new Date();
    const getAge = (date: string | null) => {
      if (!date) return -1;
      const age = getSportsAge(date, referenceDate);
      return isNaN(age) ? -1 : age;
    };

    // Helper to get athlete object
    const getAthlete = (id: string) => athletes.find(a => a.id === id);

    // 1. Process Couples
    const coupledPairs = couples.map(couple => {
      const a1 = getAthlete(couple.athlete1_id);
      const a2 = getAthlete(couple.athlete2_id);

      if (!a1 || !a2) return null;

      const age1 = getAge(a1.birth_date);
      const age2 = getAge(a2.birth_date);

      // Determination of "Male" and "Female" for ordering within couple using explicit Gender column
      const isA1Male = (a1.gender || "").toUpperCase() === 'M';
      const isA2Male = (a2.gender || "").toUpperCase() === 'M';

      let orderedPair: Athlete[] = [];
      if (isA1Male && !isA2Male) orderedPair = [a1, a2];
      else if (!isA1Male && isA2Male) orderedPair = [a2, a1];
      else orderedPair = [a1, a2]; // Keep original order if same gender or unknown

      // Sort criteria for couples: "dal più piccola al più grande" (Youngest to Oldest)
      // Use minimum age of the couple ensuring valid ages are prioritized?
      // If age is -1 (invalid), it puts them at the top. Let's keep strict sorting.
      const coupleMinAge = Math.min(age1, age2);

      return {
        pair: orderedPair,
        sortKey: coupleMinAge
      };
    }).filter((x): x is { pair: Athlete[], sortKey: number } => x !== null);

    // Sort couples by age (youngest to oldest)
    coupledPairs.sort((a, b) => a.sortKey - b.sortKey);

    // Flatten couples
    const sortedCoupledAthletes = coupledPairs.flatMap(cp => cp.pair);

    // 2. Process Singles
    const singleAthletes = athletes.filter(a => !athleteIdsInCouples.has(a.id));

    // Explicitly categorize by Gender column
    const singleMales = singleAthletes.filter(a => (a.gender || "").toUpperCase() === 'M');
    const singleFemales = singleAthletes.filter(a => (a.gender || "").toUpperCase() !== 'M');

    // Sort singles by age (ascending)
    singleMales.sort((a, b) => getAge(a.birth_date) - getAge(b.birth_date));
    singleFemales.sort((a, b) => getAge(a.birth_date) - getAge(b.birth_date));

    // Combine all: Couples -> Single Males -> Single Females
    return [...sortedCoupledAthletes, ...singleMales, ...singleFemales];
  }, [athletes, couples, athleteIdsInCouples]);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Lista Atleti ({athletes.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca atleta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {athletes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nessun atleta registrato</p>
        ) : (
          <div className="space-y-4">
            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
              {sortedAthletes
                .filter((athlete) =>
                  searchQuery === "" ||
                  athlete.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  athlete.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  athlete.code.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((athlete) => {
                  const certStatus = getCertificateStatus(athlete.medical_certificate_expiry);
                  const categoryCheck = validateCategoryMatch({
                    storedCategory: athlete.category,
                    birthDateISO: athlete.birth_date,
                  });
                  const categoryDisplay = categoryCheck.ok
                    ? formatCategoryDisplay(categoryCheck.expected)
                    : athlete.category;

                  const responsabili = athlete.responsabili || [];
                  const registeredProfileNames = new Set(profiles.map(p => p.full_name.toLowerCase().trim()));

                  const isOrphan = !athleteIdsInCouples.has(athlete.id);
                  const isFemale = athlete.gender === 'F';
                  const isMale = athlete.gender === 'M';

                  let cardColorClass = "";
                  if (isOrphan) {
                    if (isFemale) cardColorClass = "bg-[#FFD9B3] placeholder-opacity-10"; // Using bg color for whole card if orphan
                    else if (isMale) cardColorClass = "bg-[#CCE5FF] placeholder-opacity-10";
                    else cardColorClass = "bg-warning/10";
                  } else {
                    cardColorClass = "bg-card";
                  }

                  return (
                    <div key={athlete.id} className={`p-4 rounded-lg border shadow-sm ${cardColorClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-lg">{athlete.first_name} {athlete.last_name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{athlete.code}</p>
                        </div>
                        <div className={`status-badge ${certStatus.class} text-xs px-2 py-1`}>
                          {certStatus.label}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground text-xs">Categoria</p>
                          <div className="flex items-center gap-1">
                            <span>{categoryDisplay}</span>
                            {categoryCheck.ok ? null : (
                              <span className="text-warning text-xs font-bold">?!</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Nascita</p>
                          <p>{formatDate(athlete.birth_date)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Scadenza Cert.</p>
                          <p>{formatDate(athlete.medical_certificate_expiry)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Responsabili</p>
                        <div className="text-sm">
                          {responsabili.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {responsabili.map((name, idx) => {
                                const isRegistered = registeredProfileNames.has(name.toLowerCase().trim());
                                return (
                                  <span key={idx} className={isRegistered ? "font-bold text-primary" : ""}>
                                    {name}{idx < responsabili.length - 1 ? ", " : ""}
                                  </span>
                                );
                              })}
                            </div>
                          ) : "-"}
                        </div>
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
                    <th>Codice</th>
                    <th>Nome e Cognome</th>
                    <th>Categoria</th>
                    <th>Data di Nascita</th>
                    <th>Scadenza Certificato</th>
                    <th>Istruttori</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAthletes
                    .filter((athlete) =>
                      searchQuery === "" ||
                      athlete.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      athlete.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      athlete.code.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((athlete) => {
                      const certStatus = getCertificateStatus(athlete.medical_certificate_expiry);
                      const categoryCheck = validateCategoryMatch({
                        storedCategory: athlete.category,
                        birthDateISO: athlete.birth_date,
                      });
                      const categoryDisplay = categoryCheck.ok
                        ? formatCategoryDisplay(categoryCheck.expected)
                        : athlete.category;

                      const responsabili = athlete.responsabili || [];
                      const registeredProfileNames = new Set(profiles.map(p => p.full_name.toLowerCase().trim()));

                      const isOrphan = !athleteIdsInCouples.has(athlete.id);
                      const isFemale = athlete.gender === 'F';
                      const isMale = athlete.gender === 'M';

                      let rowColor = "";
                      if (isOrphan) {
                        if (isFemale) rowColor = "bg-[#FFD9B3] hover:bg-[#FFE0C2]";
                        else if (isMale) rowColor = "bg-[#CCE5FF] hover:bg-[#D6EAFF]";
                        else rowColor = "bg-warning/10 hover:bg-warning/20";
                      } else {
                        rowColor = "hover:bg-gray-800";
                      }

                      return (
                        <tr key={athlete.id} className={`${rowColor} transition-colors duration-300`}>
                          <td className="font-mono text-sm">{athlete.code}</td>
                          <td className="font-medium">{athlete.first_name} {athlete.last_name}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span>{categoryDisplay}</span>
                              {categoryCheck.ok ? null : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="status-badge status-badge-warning cursor-help"
                                    >
                                      Cat.?
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{"reason" in categoryCheck ? categoryCheck.reason : "Errore non specificato"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td>{formatDate(athlete.birth_date)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span>{formatDate(athlete.medical_certificate_expiry)}</span>
                              <span className={`status-badge ${certStatus.class}`}>
                                {certStatus.label}
                              </span>
                            </div>
                          </td>
                          <td className="text-sm">
                            {responsabili.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {responsabili.map((name, idx) => {
                                  const isRegistered = registeredProfileNames.has(name.toLowerCase().trim());
                                  return (
                                    <span key={idx} className={isRegistered ? "font-bold text-primary" : ""}>
                                      {name}{idx < responsabili.length - 1 ? ", " : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : "-"}
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
