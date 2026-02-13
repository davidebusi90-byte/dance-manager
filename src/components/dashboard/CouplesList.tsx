import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, X, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCoupleCategory, getSportsAge } from "@/lib/category-validation";
import { getBestClass } from "@/lib/class-utils";
import { useMemo, useState } from "react";

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  responsabili: string[] | null;
  gender?: string | null;
}

interface Couple {
  id: string;
  category: string;
  class: string;
  disciplines: string[];
  athlete1_id: string;
  athlete2_id: string;
  discipline_info?: Record<string, string> | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface CouplesListProps {
  couples: Couple[];
  athletes: Athlete[];
  profiles: Profile[];
  onClose: () => void;
}

export default function CouplesList({ couples, athletes, profiles, onClose }: CouplesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const getAthlete = (id: string) => athletes.find(a => a.id === id);

  // Get class for discipline - uses discipline_info if available, otherwise falls back to main class
  const getClassForDiscipline = (couple: Couple, key: string) => {
    // Check for specific class in discipline_info
    if (couple.discipline_info && couple.discipline_info[key]) {
      return couple.discipline_info[key];
    }

    // Fall back to main class if the discipline is in the disciplines array
    const mappedKey = key === "show_dance_sa" || key === "show_dance_classic" ? "show_dance" : key;

    // SPECIAL RULE: For "Combinata", the class must be the highest among Standard, Latino, and Combinata itself
    if (key === "combinata" && couple.disciplines?.includes("combinata")) {
      const combClass = (couple.discipline_info && couple.discipline_info[key]) || couple.class || "D";
      const latClass = couple.discipline_info?.["latino"];
      const stdClass = couple.discipline_info?.["standard"];

      let resolvedClass = combClass;
      if (latClass) resolvedClass = getBestClass(resolvedClass, latClass);
      if (stdClass) resolvedClass = getBestClass(resolvedClass, stdClass);
      return resolvedClass;
    }

    if (couple.disciplines?.includes(mappedKey)) {
      return couple.class || "-";
    }

    return "-";
  };

  const getCombinedResponsabili = (athlete1?: Athlete, athlete2?: Athlete) => {
    const resps = new Set<string>();
    athlete1?.responsabili?.forEach(r => resps.add(r.trim()));
    athlete2?.responsabili?.forEach(r => resps.add(r.trim()));
    return Array.from(resps);
  };

  const registeredProfileNames = new Set(profiles.map(p => p.full_name.toLowerCase().trim()));

  const sortedCouples = useMemo(() => {
    const referenceDate = new Date();

    return [...couples]
      .filter(couple => {
        if (!searchQuery) return true;
        const a1 = getAthlete(couple.athlete1_id);
        const a2 = getAthlete(couple.athlete2_id);
        const query = searchQuery.toLowerCase();
        return (
          (a1 && (a1.first_name.toLowerCase().includes(query) || a1.last_name.toLowerCase().includes(query))) ||
          (a2 && (a2.first_name.toLowerCase().includes(query) || a2.last_name.toLowerCase().includes(query)))
        );
      })
      .sort((a, b) => {
        const athlete1A = getAthlete(a.athlete1_id);
        const athlete2A = getAthlete(a.athlete2_id);
        const athlete1B = getAthlete(b.athlete1_id);
        const athlete2B = getAthlete(b.athlete2_id);

        const getCoupleAgeInfo = (ath1?: Athlete, ath2?: Athlete) => {
          const age1 = ath1?.birth_date ? getSportsAge(ath1.birth_date, referenceDate) : null;
          const age2 = ath2?.birth_date ? getSportsAge(ath2.birth_date, referenceDate) : null;

          if (age1 === null && age2 === null) return null;

          const validAges = [age1, age2].filter((age): age is number => age !== null);
          return {
            primary: Math.max(...validAges),
            secondary: Math.min(...validAges)
          };
        };

        const ageInfoA = getCoupleAgeInfo(athlete1A, athlete2A);
        const ageInfoB = getCoupleAgeInfo(athlete1B, athlete2B);

        // Handle missing ages (put at the end)
        if (!ageInfoA && !ageInfoB) return 0;
        if (!ageInfoA) return 1;
        if (!ageInfoB) return -1;

        // Sort by primary age (older partner)
        if (ageInfoA.primary !== ageInfoB.primary) {
          return ageInfoA.primary - ageInfoB.primary;
        }

        // Secondary sort by younger partner
        return ageInfoA.secondary - ageInfoB.secondary;
      });
  }, [couples, athletes, searchQuery]);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-success" />
            Coppie Attive ({couples.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome ballerino/a..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {couples.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nessuna coppia attiva</p>
        ) : (
          <div className="space-y-4">
            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
              {sortedCouples.map((couple) => {
                let athlete1 = getAthlete(couple.athlete1_id);
                let athlete2 = getAthlete(couple.athlete2_id);

                // Swap logic (copied from desktop view)
                if (athlete2?.gender === 'M' && athlete1?.gender !== 'M') {
                  [athlete1, athlete2] = [athlete2, athlete1];
                } else if (athlete1?.gender === 'F' && athlete2?.gender === 'M') {
                  [athlete1, athlete2] = [athlete2, athlete1];
                }

                const responsabili = getCombinedResponsabili(athlete1, athlete2);
                const categoryCheck = validateCoupleCategory({
                  storedCategory: couple.category,
                  athlete1BirthDateISO: athlete1?.birth_date ?? null,
                  athlete2BirthDateISO: athlete2?.birth_date ?? null,
                });

                return (
                  <div key={couple.id} className="p-4 rounded-lg border bg-card shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground w-12">{athlete1?.code}</span>
                          <span className="font-medium">{athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground w-12">{athlete2?.code}</span>
                          <span className="font-medium">{athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 p-2 bg-muted/50 rounded flex justify-between items-center">
                      <span className="text-sm font-semibold">{couple.category}</span>
                      <div className="flex gap-2">
                        <div className="text-xs text-center">
                          <span className="block text-muted-foreground">LAT</span>
                          <span className="font-mono">{getClassForDiscipline(couple, "latino")}</span>
                        </div>
                        <div className="text-xs text-center">
                          <span className="block text-muted-foreground">STD</span>
                          <span className="font-mono">{getClassForDiscipline(couple, "standard")}</span>
                        </div>
                        <div className="text-xs text-center">
                          <span className="block text-muted-foreground">CMB</span>
                          <span className="font-mono">{getClassForDiscipline(couple, "combinata")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Resp: {responsabili.join(", ") || "-"}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Codice Cavaliere</th>
                    <th>Cavaliere</th>
                    <th>Codice Dama</th>
                    <th>Dama</th>
                    <th>Categoria</th>
                    <th>Danze Latino Americane</th>
                    <th>Danze Standard</th>
                    <th>Combinata 8/10 Danze</th>
                    <th>South America Showdance</th>
                    <th>Classic Showdance</th>
                    <th>Responsabili</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCouples.map((couple) => {
                    let athlete1 = getAthlete(couple.athlete1_id);
                    let athlete2 = getAthlete(couple.athlete2_id);

                    // Ensure Male is in the First Position (Cavaliere)
                    // If Athlete 2 is Male and Athlete 1 is NOT Male, Swap.
                    if (athlete2?.gender === 'M' && athlete1?.gender !== 'M') {
                      [athlete1, athlete2] = [athlete2, athlete1];
                    } else if (athlete1?.gender === 'F' && athlete2?.gender === 'M') {
                      // Double check explicit Female in pos 1
                      [athlete1, athlete2] = [athlete2, athlete1];
                    }


                    const responsabili = getCombinedResponsabili(athlete1, athlete2);

                    const categoryCheck = validateCoupleCategory({
                      storedCategory: couple.category,
                      athlete1BirthDateISO: athlete1?.birth_date ?? null,
                      athlete2BirthDateISO: athlete2?.birth_date ?? null,
                    });

                    return (
                      <tr key={couple.id}>
                        <td className="font-mono text-sm">{athlete1?.code || "-"}</td>
                        <td className="font-medium">
                          {athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "-"}
                        </td>
                        <td className="font-mono text-sm">{athlete2?.code || "-"}</td>
                        <td className="font-medium">
                          {athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "-"}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span>{couple.category}</span>
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
                        <td className="text-center">{getClassForDiscipline(couple, "latino")}</td>
                        <td className="text-center">{getClassForDiscipline(couple, "standard")}</td>
                        <td className="text-center">{getClassForDiscipline(couple, "combinata")}</td>
                        <td className="text-center">{getClassForDiscipline(couple, "show_dance_sa")}</td>
                        <td className="text-center">{getClassForDiscipline(couple, "show_dance_classic")}</td>
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
