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
import { validateCategoryMatch, formatCategoryDisplay, getSportsAge } from "@/lib/category-validation";

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

  const validCouples = useMemo(() => couples.filter(c => c.athlete1_id !== c.athlete2_id), [couples]);

  const athleteIdsInCouples = useMemo(() => new Set(
    validCouples.flatMap(c => [c.athlete1_id, c.athlete2_id])
  ), [validCouples]);

  const uniqueAthletes = useMemo(() => {
    const map = new Map<string, Athlete>();
    athletes.forEach(a => {
      if (!map.has(a.code)) {
        map.set(a.code, a);
      }
    });
    return Array.from(map.values());
  }, [athletes]);

  const sortedAthletes = useMemo(() => {
    const referenceDate = new Date();
    const getAge = (date: string | null) => {
      if (!date) return -1;
      const age = getSportsAge(date, referenceDate);
      return isNaN(age) ? -1 : age;
    };

    const athleteMap = new Map(uniqueAthletes.map(a => [a.id, a]));

    const coupledPairs = validCouples.map(couple => {
      const a1 = athleteMap.get(couple.athlete1_id);
      const a2 = athleteMap.get(couple.athlete2_id);
      if (!a1 || !a2) return null;

      const age1 = getAge(a1.birth_date);
      const age2 = getAge(a2.birth_date);
      const isA1Male = (a1.gender || "").toUpperCase() === 'M';
      const isA2Male = (a2.gender || "").toUpperCase() === 'M';

      let orderedPair: Athlete[] = [];
      if (isA1Male && !isA2Male) orderedPair = [a1, a2];
      else if (!isA1Male && isA2Male) orderedPair = [a2, a1];
      else orderedPair = [a1, a2];

      return {
        pair: orderedPair,
        sortKey: Math.min(age1, age2)
      };
    }).filter((x): x is { pair: Athlete[], sortKey: number } => x !== null);

    coupledPairs.sort((a, b) => a.sortKey - b.sortKey);
    const sortedCoupledAthletes = coupledPairs.flatMap(cp => cp.pair);

    const singleAthletes = uniqueAthletes.filter(a => !athleteIdsInCouples.has(a.id));
    const singleMales = singleAthletes.filter(a => (a.gender || "").toUpperCase() === 'M');
    const singleFemales = singleAthletes.filter(a => (a.gender || "").toUpperCase() !== 'M');

    const sortByAge = (a: Athlete, b: Athlete) => getAge(a.birth_date) - getAge(b.birth_date);
    singleMales.sort(sortByAge);
    singleFemales.sort(sortByAge);

    // Final deduplication by code to handle duplicate DB records with same code but different IDs
    const seen = new Set<string>();
    const deduped = [...sortedCoupledAthletes, ...singleMales, ...singleFemales].filter(a => {
      if (seen.has(a.code)) return false;
      seen.add(a.code);
      return true;
    });

    return deduped;
  }, [uniqueAthletes, validCouples, athleteIdsInCouples]);

  const filteredSortedAthletes = useMemo(() => {
    if (!searchQuery) return sortedAthletes;
    const words = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    return sortedAthletes.filter(a => {
      const first = (a.first_name || "").toLowerCase();
      const last = (a.last_name || "").toLowerCase();
      const code = (a.code || "").toLowerCase();
      return words.every(w => first.includes(w) || last.includes(w) || code.includes(w));
    });
  }, [sortedAthletes, searchQuery]);

  const registeredProfileNames = useMemo(() =>
    new Set(profiles.map(p => p.full_name.toLowerCase().trim())),
    [profiles]
  );

  return (
    <Card className="animate-fade-in shadow-xl border-primary/10">
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Lista Atleti ({athletes.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca atleta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/30 focus-visible:ring-primary/30"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredSortedAthletes.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 bg-muted/20 rounded-lg">Nessun atleta trovato</p>
        ) : (
          <div className="space-y-4">
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {filteredSortedAthletes.map((athlete) => {
                const certStatus = getCertificateStatus(athlete.medical_certificate_expiry);
                const categoryCheck = validateCategoryMatch({
                  storedCategory: athlete.category,
                  birthDateISO: athlete.birth_date,
                });
                const categoryDisplay = categoryCheck.ok ? formatCategoryDisplay(categoryCheck.expected) : athlete.category;
                const isOrphan = !athleteIdsInCouples.has(athlete.id);
                const isFemale = athlete.gender === 'F';
                const isMale = athlete.gender === 'M';

                let cardBg = "bg-card";
                if (isOrphan) {
                  if (isFemale) cardBg = "bg-[#FFD9B3]/20";
                  else if (isMale) cardBg = "bg-[#CCE5FF]/20";
                  else cardBg = "bg-warning/10";
                }

                return (
                  <div key={athlete.id} className={`p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md ${cardBg}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg text-primary/90">{athlete.first_name} {athlete.last_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{athlete.code}</p>
                      </div>
                      <div className={`status-badge ${certStatus.class} text-xs px-2 py-1 rounded-full font-semibold`}>
                        {certStatus.label}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-tight">Categoria</p>
                        <div className="flex items-center gap-1 font-medium">
                          <span className="truncate">{categoryDisplay}</span>
                          {!categoryCheck.ok && <span className="text-destructive font-black">!</span>}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-tight">Nascita</p>
                        <p className="font-medium">{formatDate(athlete.birth_date)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-tight mb-1">Responsabili</p>
                      <div className="text-sm flex flex-wrap gap-1">
                        {athlete.responsabili?.length ? athlete.responsabili.map((name, idx) => (
                          <span key={idx} className={registeredProfileNames.has(name.toLowerCase().trim()) ? "font-bold text-primary" : "text-muted-foreground"}>
                            {name}{idx < athlete.responsabili!.length - 1 ? "," : ""}
                          </span>
                        )) : <span className="text-muted-foreground/50 italic">Nessuno</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 text-left">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Codice</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Nome e Cognome</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Categoria</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Nascita</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Certificato</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Istruttori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredSortedAthletes.map((athlete) => {
                    const certStatus = getCertificateStatus(athlete.medical_certificate_expiry);
                    const categoryCheck = validateCategoryMatch({
                      storedCategory: athlete.category,
                      birthDateISO: athlete.birth_date,
                    });
                    const categoryDisplay = categoryCheck.ok ? formatCategoryDisplay(categoryCheck.expected) : athlete.category;
                    const isOrphan = !athleteIdsInCouples.has(athlete.id);
                    const isFemale = athlete.gender === 'F';
                    const isMale = athlete.gender === 'M';

                    let rowBg = "hover:bg-muted/80";
                    if (isOrphan) {
                      if (isFemale) rowBg = "bg-[#FFD9B3]/10 hover:bg-[#FFD9B3]";
                      else if (isMale) rowBg = "bg-[#CCE5FF]/10 hover:bg-[#CCE5FF]";
                      else rowBg = "bg-warning/5 hover:bg-warning/50";
                    }

                    return (
                      <tr key={athlete.id} className={`${rowBg} transition-colors duration-200`}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{athlete.code}</td>
                        <td className="px-4 py-3 font-semibold text-primary/80">{athlete.first_name} {athlete.last_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{categoryDisplay}</span>
                            {!categoryCheck.ok && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="w-4 h-4 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-black cursor-help">!</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{("reason" in categoryCheck && categoryCheck.reason) || "Errore categoria"}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(athlete.birth_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`status-badge ${certStatus.class} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase`}>
                            {certStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate">
                          {athlete.responsabili?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {athlete.responsabili.map((name, idx) => (
                                <span key={idx} className={registeredProfileNames.has(name.toLowerCase().trim()) ? "font-bold text-primary" : "text-muted-foreground text-xs"}>
                                  {name}{idx < athlete.responsabili!.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground/30 italic">-</span>}
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
