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
  const athleteMap = useMemo(() => new Map(athletes.map(a => [a.id, a])), [athletes]);

  const getClassForDiscipline = (couple: Couple, key: string) => {
    if (couple.discipline_info && couple.discipline_info[key]) return couple.discipline_info[key];
    const mappedKey = key === "show_dance_sa" || key === "show_dance_classic" ? "show_dance" : key;

    if (key === "combinata" && couple.disciplines?.includes("combinata")) {
      const combClass = (couple.discipline_info && couple.discipline_info[key]) || couple.class || "D";
      const latClass = couple.discipline_info?.["latino"];
      const stdClass = couple.discipline_info?.["standard"];
      let resolvedClass = combClass;
      if (latClass) resolvedClass = getBestClass(resolvedClass, latClass);
      if (stdClass) resolvedClass = getBestClass(resolvedClass, stdClass);
      return resolvedClass;
    }

    return couple.disciplines?.includes(mappedKey) ? (couple.class || "-") : "-";
  };

  const registeredProfileNames = useMemo(() =>
    new Set(profiles.map(p => p.full_name.toLowerCase().trim())),
    [profiles]
  );

  const sortedFilteredCouples = useMemo(() => {
    const referenceDate = new Date();
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    const filtered = couples.filter(couple => {
      if (queryWords.length === 0) return true;
      const a1 = athleteMap.get(couple.athlete1_id);
      const a2 = athleteMap.get(couple.athlete2_id);
      const searchable = [
        a1?.first_name, a1?.last_name, a1?.code,
        a2?.first_name, a2?.last_name, a2?.code
      ].map(s => (s || "").toLowerCase());
      return queryWords.every(word => searchable.some(s => s.includes(word)));
    });

    return filtered.sort((a, b) => {
      const getAgeInfo = (ath1Id: string, ath2Id: string) => {
        const ath1 = athleteMap.get(ath1Id);
        const ath2 = athleteMap.get(ath2Id);
        const age1 = ath1?.birth_date ? getSportsAge(ath1.birth_date, referenceDate) : null;
        const age2 = ath2?.birth_date ? getSportsAge(ath2.birth_date, referenceDate) : null;
        if (age1 === null && age2 === null) return null;
        const validAges = [age1, age2].filter((age): age is number => age !== null);
        return { primary: Math.max(...validAges), secondary: Math.min(...validAges) };
      };

      const ageA = getAgeInfo(a.athlete1_id, a.athlete2_id);
      const ageB = getAgeInfo(b.athlete1_id, b.athlete2_id);
      if (!ageA && !ageB) return 0;
      if (!ageA) return 1;
      if (!ageB) return -1;
      return ageA.primary !== ageB.primary ? ageA.primary - ageB.primary : ageA.secondary - ageB.secondary;
    });
  }, [couples, athleteMap, searchQuery]);

  return (
    <Card className="animate-fade-in shadow-xl border-success/10">
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-success" />
            Coppie Attive ({couples.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome ballerino/a..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/30 focus-visible:ring-success/30"
          />
        </div>
      </CardHeader>
      <CardContent>
        {sortedFilteredCouples.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 bg-muted/20 rounded-lg">Nessuna coppia trovata</p>
        ) : (
          <div className="space-y-4">
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {sortedFilteredCouples.map((couple) => {
                let a1 = athleteMap.get(couple.athlete1_id);
                let a2 = athleteMap.get(couple.athlete2_id);
                if ((a2?.gender === 'M' && a1?.gender !== 'M') || (a1?.gender === 'F' && a2?.gender === 'M')) {
                  [a1, a2] = [a2, a1];
                }
                const resps = Array.from(new Set([...(a1?.responsabili || []), ...(a2?.responsabili || [])].map(r => r.trim())));

                return (
                  <div key={couple.id} className="p-4 rounded-xl border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg">
                        <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50 uppercase">CAV</span>
                        <span className="font-bold text-sm text-primary/80">{a1 ? `${a1.first_name} ${a1.last_name}` : "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg">
                        <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50 uppercase">DAM</span>
                        <span className="font-bold text-sm text-primary/80">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="col-span-3 bg-success/5 p-2 rounded-lg border border-success/10 mb-1">
                        <p className="text-[10px] uppercase font-bold text-success/70 tracking-tight">Categoria Selezionata</p>
                        <p className="font-bold text-success/90">{couple.category}</p>
                      </div>
                      <div className="text-center p-1.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="block text-[8px] font-black text-muted-foreground uppercase mb-0.5">Latino</span>
                        <span className="font-mono text-xs font-bold">{getClassForDiscipline(couple, "latino")}</span>
                      </div>
                      <div className="text-center p-1.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="block text-[8px] font-black text-muted-foreground uppercase mb-0.5">Standard</span>
                        <span className="font-mono text-xs font-bold">{getClassForDiscipline(couple, "standard")}</span>
                      </div>
                      <div className="text-center p-1.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="block text-[8px] font-black text-muted-foreground uppercase mb-0.5">Combinata</span>
                        <span className="font-mono text-xs font-bold">{getClassForDiscipline(couple, "combinata")}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight mb-1">Responsabili Uniti</p>
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        {resps.length ? resps.map((name, idx) => (
                          <span key={idx} className={registeredProfileNames.has(name.toLowerCase().trim()) ? "font-bold text-primary" : "text-muted-foreground/70"}>
                            {name}{idx < resps.length - 1 ? "," : ""}
                          </span>
                        )) : <span className="italic text-muted-foreground/30">Nessuno</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-teal-100 border-b border-teal-200 text-left">
                  <tr>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Cav. Cod.</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Cavaliere</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Dam. Cod.</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Dama</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700 text-center min-w-[120px]">Categoria</th>
                    <th className="px-2 py-3 font-bold uppercase tracking-wider text-teal-700 text-center">LAT</th>
                    <th className="px-2 py-3 font-bold uppercase tracking-wider text-teal-700 text-center">STD</th>
                    <th className="px-2 py-3 font-bold uppercase tracking-wider text-teal-700 text-center">CMB</th>
                    <th className="px-2 py-3 font-bold uppercase tracking-wider text-teal-700 text-center">SA</th>
                    <th className="px-2 py-3 font-bold uppercase tracking-wider text-teal-700 text-center">CL</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Responsabili</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedFilteredCouples.map((couple) => {
                    let a1 = athleteMap.get(couple.athlete1_id);
                    let a2 = athleteMap.get(couple.athlete2_id);
                    if ((a2?.gender === 'M' && a1?.gender !== 'M') || (a1?.gender === 'F' && a2?.gender === 'M')) {
                      [a1, a2] = [a2, a1];
                    }
                    const resps = Array.from(new Set([...(a1?.responsabili || []), ...(a2?.responsabili || [])].map(r => r.trim())));
                    const categoryCheck = validateCoupleCategory({
                      storedCategory: couple.category,
                      athlete1BirthDateISO: a1?.birth_date ?? null,
                      athlete2BirthDateISO: a2?.birth_date ?? null,
                    });

                    return (
                      <tr key={couple.id} className="hover:bg-muted/80 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a1?.code || "-"}</td>
                        <td className="px-3 py-2.5 font-bold text-primary/80">{a1 ? `${a1.first_name} ${a1.last_name}` : "-"}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a2?.code || "-"}</td>
                        <td className="px-3 py-2.5 font-bold text-primary/80">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold">{couple.category}</span>
                            {!categoryCheck.ok && (
                              <Tooltip>
                                <TooltipTrigger><span className="w-3.5 h-3.5 rounded-full bg-warning/20 text-warning-foreground flex items-center justify-center text-[8px] font-black cursor-help">!</span></TooltipTrigger>
                                <TooltipContent className="text-[10px]"><p>{("reason" in categoryCheck && categoryCheck.reason) || "Errore cat."}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{getClassForDiscipline(couple, "latino")}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{getClassForDiscipline(couple, "standard")}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{getClassForDiscipline(couple, "combinata")}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{getClassForDiscipline(couple, "show_dance_sa")}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{getClassForDiscipline(couple, "show_dance_classic")}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-y-0.5">
                            {Array.from({ length: Math.ceil(resps.length / 2) }, (_, i) =>
                              resps.slice(i * 2, i * 2 + 2)
                            ).map((pair, rowIdx) => (
                              <div key={rowIdx} className="flex gap-x-1">
                                {pair.map((name, idx) => {
                                  const globalIdx = rowIdx * 2 + idx;
                                  return (
                                    <span key={idx} className={registeredProfileNames.has(name.toLowerCase().trim()) ? "font-black text-primary" : "text-muted-foreground/60"}>
                                      {name}{globalIdx < resps.length - 1 ? "," : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
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
      </CardContent>
    </Card>
  );
}
