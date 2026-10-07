import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isInstructorResponsibleForCoupleByResponsabili } from "@/lib/instructor-utils";

interface GeneralStatsDashboardProps {
  competitions: any[];
  couples: any[];
  entries: any[];
  profiles: any[];
}

const isStrictlyResponsible = (couple: any, profile: any) => {
    return isInstructorResponsibleForCoupleByResponsabili(profile.full_name, couple.responsabili || []) ||
           (couple.athlete1 && isInstructorResponsibleForCoupleByResponsabili(profile.full_name, couple.athlete1.responsabili || [])) ||
           (couple.athlete2 && isInstructorResponsibleForCoupleByResponsabili(profile.full_name, couple.athlete2.responsabili || []));
};

export default function GeneralStatsDashboard({ competitions, couples, entries, profiles }: GeneralStatsDashboardProps) {
  const [selectedCompId, setSelectedCompId] = useState<string>("");

  // Get active competitions for the selector
  const activeCompetitions = useMemo(() => {
    return competitions.filter(c => !c.is_deleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [competitions]);

  // Set default selected competition
  useMemo(() => {
      if (activeCompetitions.length > 0 && !selectedCompId) {
          setSelectedCompId(activeCompetitions[0].id);
      }
  }, [activeCompetitions, selectedCompId]);

  const selectedComp = competitions.find(c => c.id === selectedCompId);
  const prevComp = selectedComp?.previous_competition_id ? competitions.find(c => c.id === selectedComp?.previous_competition_id) : null;

  // --- Chart Data: Enrollment Speed ---
  const enrollmentSpeedData = useMemo(() => {
    if (!selectedComp) return [];

    const getDaysBefore = (entryDateStr: string, compDateStr: string) => {
        const eDate = new Date(entryDateStr).getTime();
        const cDate = new Date(compDateStr).getTime();
        return Math.floor((cDate - eDate) / (1000 * 60 * 60 * 24));
    };

    // Current Comp entries
    const currentEntries = entries.filter(e => e.competition_id === selectedComp.id);
    const prevEntries = prevComp ? entries.filter(e => e.competition_id === prevComp.id) : [];

    // Map days before -> count
    const daysMap: Record<number, { current: number; prev: number }> = {};
    let maxDays = 0;

    currentEntries.forEach(e => {
        const days = getDaysBefore(e.created_at, selectedComp.date);
        if (days < 0) return; // exclude post-event enrollments if any
        if (!daysMap[days]) daysMap[days] = { current: 0, prev: 0 };
        daysMap[days].current += 1;
        if (days > maxDays) maxDays = days;
    });

    prevEntries.forEach(e => {
        if (!prevComp) return;
        const days = getDaysBefore(e.created_at, prevComp.date);
        if (days < 0) return;
        if (!daysMap[days]) daysMap[days] = { current: 0, prev: 0 };
        daysMap[days].prev += 1;
        if (days > maxDays) maxDays = days;
    });

    // Create cumulative data array
    const chartData = [];
    let cumulativeCurrent = 0;
    let cumulativePrev = 0;

    // We iterate from maxDays (furthest in the past) down to 0 (day of competition)
    for (let i = maxDays; i >= 0; i--) {
        if (daysMap[i]) {
            cumulativeCurrent += daysMap[i].current;
            cumulativePrev += daysMap[i].prev;
        }
        // Only push data points where there is activity or at regular intervals to avoid too many points?
        // Let's push every day for smoothness, or only when there's a change
        // For a "constellation" chart, pushing only on changes or daily is fine. Let's do daily.
        chartData.push({
            daysBefore: -i, // negative so time flows left to right (-30, -29, ..., 0)
            corrente: cumulativeCurrent,
            precedente: prevComp ? cumulativePrev : undefined,
        });
    }

    return chartData;
  }, [selectedComp, prevComp, entries]);


  // --- Instructor Ranking Data ---
  const instructorRanking = useMemo(() => {
    if (!selectedComp) return [];

    const currentEntries = entries.filter(e => e.competition_id === selectedComp.id);
    const prevEntries = prevComp ? entries.filter(e => e.competition_id === prevComp.id) : [];

    const counts: Record<string, { name: string; current: number; prev: number }> = {};

    profiles.forEach(p => {
        counts[p.id] = { name: p.full_name, current: 0, prev: 0 };
    });

    currentEntries.forEach(e => {
        const couple = couples.find(c => c.id === e.couple_id);
        if (!couple) return;
        const coupleInstructors = profiles.filter(p => isStrictlyResponsible(couple, p));
        coupleInstructors.forEach(instructor => {
            if (counts[instructor.id]) counts[instructor.id].current += 1;
        });
    });

    prevEntries.forEach(e => {
        const couple = couples.find(c => c.id === e.couple_id);
        if (!couple) return;
        const coupleInstructors = profiles.filter(p => isStrictlyResponsible(couple, p));
        coupleInstructors.forEach(instructor => {
            if (counts[instructor.id]) counts[instructor.id].prev += 1;
        });
    });

    return Object.values(counts).sort((a, b) => b.current - a.current);
  }, [selectedComp, prevComp, entries, couples, profiles]);

  if (!selectedComp) {
      return <div className="p-8 text-center text-muted-foreground">Seleziona una competizione per iniziare.</div>;
  }

  const currentYear = new Date(selectedComp.date).getFullYear();
  const prevYear = prevComp ? new Date(prevComp.date).getFullYear() : null;

  return (
    <div className="space-y-6">
        <Card className="border-none shadow-sm bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
            <CardContent className="p-6">
                <div className="space-y-2 max-w-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtro Competizione</label>
                    <Select value={selectedCompId} onValueChange={setSelectedCompId}>
                        <SelectTrigger><SelectValue placeholder="Seleziona competizione..." /></SelectTrigger>
                        <SelectContent>
                            {activeCompetitions.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name} ({new Date(c.date).getFullYear()})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
            <CardHeader>
                <CardTitle>Velocità d'Iscrizione (Andamento nel tempo)</CardTitle>
            </CardHeader>
            <CardContent>
                {enrollmentSpeedData.length > 0 ? (
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={enrollmentSpeedData} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis 
                                    dataKey="daysBefore" 
                                    tick={{ fontSize: 12 }} 
                                    label={{ value: "Giorni alla Gara", position: "insideBottom", offset: -10 }} 
                                />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                                    labelFormatter={(label) => `Giorni: ${label}`}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Line 
                                    name={`Edizione ${currentYear}`}
                                    type="monotone" 
                                    dataKey="corrente" 
                                    stroke="#0ea5e9" 
                                    strokeWidth={3} 
                                    dot={{ r: 4 }} 
                                    activeDot={{ r: 6 }} 
                                />
                                {prevComp && (
                                    <Line 
                                        name={`Edizione ${prevYear} (Storico)`}
                                        type="monotone" 
                                        dataKey="precedente" 
                                        stroke="#94a3b8" 
                                        strokeWidth={3} 
                                        strokeDasharray="5 5"
                                        dot={{ r: 4 }} 
                                        activeDot={{ r: 6 }} 
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">Nessun dato di iscrizione per questa gara.</div>
                )}
            </CardContent>
        </Card>

        <Card className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50">
            <CardHeader>
                <CardTitle>Classifica Istruttori</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-bold">Nome Istruttore</TableHead>
                                <TableHead className="font-bold text-right">Numero Coppie</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {instructorRanking.map((instructor, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{instructor.name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {instructor.current}
                                        {prevComp && (
                                            <span className="text-muted-foreground ml-2">
                                                ({instructor.prev})
                                            </span>
                                        )}
                                        {!prevComp && (
                                            <span className="text-muted-foreground ml-2 opacity-50">
                                                (-)
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
