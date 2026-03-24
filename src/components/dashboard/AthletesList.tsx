import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, X, Mail, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { validateCategoryMatch, formatCategoryDisplay, getSportsAge } from "@/lib/category-validation";
import AthleteDetailModal from "./AthleteDetailModal";

import { Athlete, Couple, Profile } from "@/types/dashboard";
import { isCidAndCategorySwapped } from "@/lib/athlete-utils";

interface AthletesListProps {
  athletes: Athlete[];
  deactivatedAthletes?: Athlete[];
  allAthletes: Athlete[];
  couples: Couple[];
  profiles: Profile[];
  lastSyncTime?: Date | null;
  onClose: () => void;
}

export default function AthletesList({ athletes, deactivatedAthletes = [], allAthletes, couples, profiles, lastSyncTime, onClose }: AthletesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);

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
        sortKey: Math.min(age1, age2),
        secondarySortKey: Math.max(age1, age2)
      };
    }).filter((x): x is { pair: Athlete[], sortKey: number, secondarySortKey: number } => x !== null);

    coupledPairs.sort((a, b) => a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.secondarySortKey - b.secondarySortKey);
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
          <div className="flex flex-row items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Lista Atleti ({athletes.length})
            </CardTitle>
            {lastSyncTime && (
              <div className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                Sincronizzato: {new Intl.DateTimeFormat('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }).format(lastSyncTime)}
              </div>
            )}
          </div>
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

                // Apply swap heuristic for display
                const isSwapped = isCidAndCategorySwapped(athlete.code, athlete.category);
                const displayCode = isSwapped ? athlete.category : athlete.code;
                const rawCategory = isSwapped ? athlete.code : athlete.category;

                const categoryCheck = validateCategoryMatch({
                  storedCategory: rawCategory,
                  birthDateISO: athlete.birth_date,
                  couples: couples,
                  athleteId: athlete.id
                });
                const categoryDisplay = formatCategoryDisplay(categoryCheck.ok ? categoryCheck.expected : rawCategory);
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
                  <div 
                    key={athlete.id} 
                    onClick={() => setSelectedAthlete(athlete)}
                    className={`p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98] ${cardBg}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg text-primary/90">{athlete.first_name} {athlete.last_name}</p>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <p className="text-xs font-mono text-muted-foreground">{displayCode}</p>
                          {athlete.email && (
                            <a href={`mailto:${athlete.email}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {athlete.email}
                            </a>
                          )}
                        </div>
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
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Email</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Categoria</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Nascita</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Certificato</th>
                    <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-gray-700">Istruttori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredSortedAthletes.map((athlete) => {
                    const certStatus = getCertificateStatus(athlete.medical_certificate_expiry);

                    // Apply swap heuristic for display
                    const isSwapped = isCidAndCategorySwapped(athlete.code, athlete.category);
                    const displayCode = isSwapped ? athlete.category : athlete.code;
                    const rawCategory = isSwapped ? athlete.code : athlete.category;

                    const categoryCheck = validateCategoryMatch({
                      storedCategory: rawCategory,
                      birthDateISO: athlete.birth_date,
                      couples: couples,
                      athleteId: athlete.id
                    });
                    const categoryDisplay = formatCategoryDisplay(categoryCheck.ok ? categoryCheck.expected : rawCategory);
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
                      <tr 
                        key={athlete.id} 
                        onClick={() => setSelectedAthlete(athlete)}
                        className={`${rowBg} transition-colors duration-200 cursor-pointer group`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{displayCode}</td>
                        <td className="px-4 py-3 font-semibold text-primary/80">{athlete.first_name} {athlete.last_name}</td>
                        <td className="px-4 py-3">
                          {athlete.email ? (
                            <a href={`mailto:${athlete.email}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[150px]" title={athlete.email}>
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{athlete.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30 italic text-xs">-</span>
                          )}
                        </td>
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

        {deactivatedAthletes.length > 0 && (
          <div className="mt-8 pt-6 border-t border-dashed">
            <Button
              variant="outline"
              className="w-full flex items-center justify-between text-muted-foreground hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/50"
              onClick={() => setShowDeactivated(!showDeactivated)}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 opacity-50" />
                <span>Atleti Disattivati ({deactivatedAthletes.length})</span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded ml-2 uppercase tracking-wider font-bold">Inattivi</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${showDeactivated ? "rotate-90" : ""}`} />
            </Button>

            {showDeactivated && (
              <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="overflow-x-auto rounded-lg border border-orange-100 bg-orange-50/10">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-orange-50/50 text-orange-800 uppercase text-[10px] font-bold border-b border-orange-100">
                      <tr>
                        <th className="px-4 py-2">Codice</th>
                        <th className="px-4 py-2">Nome e Cognome</th>
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Categoria</th>
                        <th className="px-4 py-2">Nascita</th>
                        <th className="px-4 py-2">Certificato</th>
                        <th className="px-4 py-2">Istruttori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100/50">
                      {deactivatedAthletes.map((a) => {
                        const certStatus = getCertificateStatus(a.medical_certificate_expiry);
                        
                        // Apply swap heuristic for display
                        const isSwapped = isCidAndCategorySwapped(a.code, a.category);
                        const displayCode = isSwapped ? a.category : a.code;
                        const rawCategory = isSwapped ? a.code : a.category;

                        const categoryCheck = validateCategoryMatch({
                          storedCategory: rawCategory,
                          birthDateISO: a.birth_date,
                          couples: couples,
                          athleteId: a.id
                        });
                        const categoryDisplay = formatCategoryDisplay(categoryCheck.ok ? categoryCheck.expected : rawCategory);

                        return (
                          <tr key={a.id} className="text-muted-foreground/70 odd:bg-orange-50/5 hover:bg-orange-50/20 transition-colors">
                            <td className="px-4 py-2 font-mono text-[10px]">{displayCode}</td>
                            <td className="px-4 py-2 font-semibold">{a.first_name} {a.last_name}</td>
                            <td className="px-4 py-2">
                              {a.email ? (
                                <div className="flex items-center gap-1 truncate max-w-[120px]" title={a.email}>
                                  <Mail className="w-3 h-3 shrink-0 opacity-50" />
                                  <span className="truncate">{a.email}</span>
                                </div>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <span>{categoryDisplay}</span>
                                {!categoryCheck.ok && <span className="text-destructive font-black">!</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2">{formatDate(a.birth_date)}</td>
                            <td className="px-4 py-2">
                              <span className={`status-badge ${certStatus.class} text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase opacity-80`}>
                                {certStatus.label}
                              </span>
                            </td>
                            <td className="px-4 py-2 max-w-[150px] truncate">
                              {a.responsabili?.length ? (
                                <span className="text-[10px]">{a.responsabili.join(", ")}</span>
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
          </div>
        )}
      </CardContent>
      <AthleteDetailModal 
        athlete={selectedAthlete} 
        allAthletes={allAthletes}
        couples={couples}
        onClose={() => setSelectedAthlete(null)} 
      />
    </Card>
  );
}
