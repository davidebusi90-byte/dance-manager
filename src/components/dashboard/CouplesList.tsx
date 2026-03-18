import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, X, Search, Mail } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCoupleCategory, getSportsAge, CATEGORY_RULES, normalizeCategory } from "@/lib/category-validation";
import { getBestClass } from "@/lib/class-utils";
import { useMemo, useState } from "react";

import { Athlete, Couple, Profile } from "@/types/dashboard";

interface CouplesListProps {
  couples: Couple[];
  athletes: Athlete[];
  profiles: Profile[];
  onClose: () => void;
}

const getCategoryLabel = (category: string) => {
  const norm = normalizeCategory(category);
  const rule = CATEGORY_RULES.find(r => 
    r.displayCode.replace("/", "") === norm || 
    r.label.toLowerCase().replace(/\s+/g, "") === norm
  );
  return rule ? rule.label : null;
};

export default function CouplesList({ couples, athletes, profiles, onClose }: CouplesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const athleteMap = useMemo(() => new Map(athletes.map(a => [a.id, a])), [athletes]);

  const getClassForDiscipline = (couple: Couple, key: string) => {
    const a1 = athleteMap.get(couple.athlete1_id);
    const a2 = athleteMap.get(couple.athlete2_id);
    
    // Get class for this discipline from both athletes
    const class1 = a1 && 'discipline_info' in a1 ? (a1 as any).discipline_info?.[key] : null;
    const class2 = a2 && 'discipline_info' in a2 ? (a2 as any).discipline_info?.[key] : null;
    
    // Fallback to couple record if athlete info is missing
    const coupleClass = couple.discipline_info && couple.discipline_info[key] 
      ? couple.discipline_info[key] 
      : (couple.disciplines?.includes(key === "show_dance_sa" || key === "show_dance_classic" ? "show_dance" : key) ? couple.class : "-");

    // special handling for combinata
    if (key === "combinata") {
      let resolved = class1 || class2 || coupleClass || "D";
      if (class1) resolved = getBestClass(resolved, class1);
      if (class2) resolved = getBestClass(resolved, class2);
      return resolved === "-" ? "D" : resolved;
    }

    // Pick best class between athlete 1, athlete 2, and the couple record
    let finalClass = coupleClass;
    if (class1 && class1 !== "-") finalClass = finalClass === "-" ? class1 : getBestClass(finalClass, class1);
    if (class2 && class2 !== "-") finalClass = finalClass === "-" ? class2 : getBestClass(finalClass, class2);
    
    // LAST RESORT FALLBACK: If we still don't have a class for this discipline, 
    // but the athletes have a general 'class' saved, use that.
    if (finalClass === "-") {
      if (a1 && (a1 as any).class && (a1 as any).class !== "D") finalClass = (a1 as any).class;
      if (a2 && (a2 as any).class && (a2 as any).class !== "D") finalClass = finalClass === "-" ? (a2 as any).class : getBestClass(finalClass, (a2 as any).class);
    }
    
    return finalClass || "-";
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
        return { primary: Math.min(...validAges), secondary: Math.max(...validAges) };
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
                    <div className="space-y-4 mb-4">
                      <div className="flex items-center justify-between bg-muted/10 p-2 rounded-lg gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50 uppercase">CAV</span>
                          <span className="font-bold text-sm text-primary/80">{a1 ? `${a1.first_name} ${a1.last_name}` : "-"}</span>
                        </div>
                        {a1?.email && (
                          <a href={`mailto:${a1.email}`} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0">
                            <Mail className="w-3 h-3" />
                            Email
                          </a>
                        )}
                      </div>
                      <div className="flex items-center justify-between bg-muted/10 p-2 rounded-lg gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50 uppercase">DAM</span>
                          <span className="font-bold text-sm text-primary/80">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</span>
                        </div>
                        {a2?.email && (
                          <a href={`mailto:${a2.email}`} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0">
                            <Mail className="w-3 h-3" />
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex-1 min-w-[120px] flex items-center gap-2 bg-success/5 px-3 py-2 rounded-lg border border-success/10">
                        <p className="text-[10px] uppercase font-bold text-success/70 tracking-tight shrink-0">Categoria:</p>
                        <p className="font-bold text-success/90">
                          {couple.category}
                          {getCategoryLabel(couple.category) && ` (${getCategoryLabel(couple.category)})`}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-1.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="block text-[8px] font-black text-muted-foreground uppercase mb-0.5">Latini</span>
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
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight mb-1">Responsabili</p>
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
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Cav. Email</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Dam. Cod.</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Dama</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-teal-700">Dam. Email</th>
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
                        <td className="px-3 py-2.5">
                          {a1?.email ? (
                            <a href={`mailto:${a1.email}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[120px]" title={a1.email}>
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{a1.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30 italic text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a2?.code || "-"}</td>
                        <td className="px-3 py-2.5 font-bold text-primary/80">{a2 ? `${a2.first_name} ${a2.last_name}` : "-"}</td>
                        <td className="px-3 py-2.5">
                          {a2?.email ? (
                            <a href={`mailto:${a2.email}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[120px]" title={a2.email}>
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{a2.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30 italic text-xs">-</span>
                          )}
                        </td>
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
