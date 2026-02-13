import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Users, Calendar } from "lucide-react";
import { validateCoupleCategory, getSportsAge } from "@/lib/category-validation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import { useUserRole } from "@/hooks/use-user-role";

interface Athlete {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  category: string;
  birth_date: string | null;
  medical_certificate_expiry: string | null;
  responsabili: string[] | null;
  gender?: string | null;
}

interface Couple {
  id: string;
  category: string;
  class: string;
  athlete1_id: string;
  athlete2_id: string;
  is_active: boolean;
}

interface Profile {
  id: string;
  full_name: string;
}

interface CoupleAnomaly {
  couple: Couple;
  athlete1: Athlete;
  athlete2: Athlete;
  categoryIssue: string | null;
  certificateIssues: string[];
}

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState<CoupleAnomaly[]>([]);
  const [orphanAthletes, setOrphanAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, userId } = useUserRole();

  const fetchAnomalies = useCallback(async () => {
    if (role === "loading") return;

    setLoading(true);
    try {
      const [couplesRes, athletesRes, profilesRes] = await Promise.all([
        supabase.from("couples").select("*").eq("is_active", true),
        supabase.from("athletes").select("*"),
        supabase.from("profiles").select("id, user_id, full_name"),
      ]);

      if (couplesRes.error) throw couplesRes.error;
      if (athletesRes.error) throw athletesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const rawAthletes = athletesRes.data || [];
      const rawCouples = (couplesRes.data as any) || [];

      let fetchedAthletes = [...rawAthletes];
      let fetchedCouples = [...rawCouples];

      if (role !== "admin") {
        const currentUserProfile = (profilesRes.data as any[]).find(p => p.user_id === userId);
        if (currentUserProfile) {
          const titles = ["maestro", "maestra", "m.", "prof.", "prof", "istruttore"];
          const normalize = (s: string) =>
            s.toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 1 && !titles.includes(w));

          const instructorParts = normalize(currentUserProfile.full_name);

          fetchedAthletes = rawAthletes.filter(athlete => {
            if (athlete.instructor_id === currentUserProfile.id) return true;
            const respsJoint = (athlete.responsabili || []).join(" ");
            const respParts = normalize(respsJoint);
            if (instructorParts.length === 0 || respParts.length === 0) return false;
            const common = instructorParts.filter(p => respParts.includes(p));
            const minRequired = Math.min(instructorParts.length, respParts.length, 2);
            return common.length >= minRequired;
          });

          const myAthleteIds = new Set(fetchedAthletes.map(a => a.id));
          fetchedCouples = rawCouples.filter(couple =>
            myAthleteIds.has(couple.athlete1_id) ||
            myAthleteIds.has(couple.athlete2_id) ||
            couple.instructor_id === currentUserProfile.id
          );
        } else {
          fetchedAthletes = [];
          fetchedCouples = [];
        }
      }

      // La mappa deve contenere TUTTI gli atleti per il lookup dei partner
      const athletesMap = new Map(rawAthletes.map(a => [a.id, a]));
      const today = new Date();
      const foundAnomalies: CoupleAnomaly[] = [];

      for (const couple of fetchedCouples) {
        const athlete1 = athletesMap.get(couple.athlete1_id);
        const athlete2 = athletesMap.get(couple.athlete2_id);

        if (!athlete1 || !athlete2) continue;

        // Check category validation
        const validation = validateCoupleCategory({
          storedCategory: couple.category,
          athlete1BirthDateISO: athlete1.birth_date,
          athlete2BirthDateISO: athlete2.birth_date,
          onDate: today,
        });

        const categoryIssue = validation.ok ? null : (validation as any).reason;

        // Check certificate issues
        const certificateIssues: string[] = [];

        const checkCertificate = (athlete: Athlete, label: string) => {
          if (!athlete.medical_certificate_expiry) {
            certificateIssues.push(`${label}: Certificato mancante`);
          } else if (new Date(athlete.medical_certificate_expiry) < today) {
            certificateIssues.push(`${label}: Certificato scaduto il ${formatDateStr(athlete.medical_certificate_expiry)}`);
          }
        };

        checkCertificate(athlete1, `${athlete1.first_name} ${athlete1.last_name}`);
        checkCertificate(athlete2, `${athlete2.first_name} ${athlete2.last_name}`);

        if (categoryIssue || certificateIssues.length > 0) {
          foundAnomalies.push({
            couple,
            athlete1,
            athlete2,
            categoryIssue,
            certificateIssues,
          });
        }
      }

      // Detect orphan athletes (those not in any active couple)
      const athleteIdsInCouples = new Set();
      for (const couple of fetchedCouples) {
        athleteIdsInCouples.add(couple.athlete1_id);
        athleteIdsInCouples.add(couple.athlete2_id);
      }

      const orphans = fetchedAthletes
        .filter(a => !athleteIdsInCouples.has(a.id))
        .sort((a, b) => {
          // 1. Raggruppa per Genere: Prima Maschi ('M'), Poi Femmine (Altro)
          const isAMale = (a.gender || "").toUpperCase() === 'M';
          const isBMale = (b.gender || "").toUpperCase() === 'M';

          if (isAMale && !isBMale) return -1;
          if (!isAMale && isBMale) return 1;

          // 2. Ordina per Età (dal più giovane al più vecchio)
          // Nota: getTime() decrescente = più giovane (data recente) - meno giovane (data passata) -> positivi primi?
          // No: b - a -> Decrescente.
          // 2020 (b) - 2000 (a) = + -> b viene dopo a.
          // Quindi a (Old) prima di b (Young).
          // Se vogliamo Youngest -> Oldest (Ascendente):
          // a - b. 2000 - 2020 = - -> a prima di b.
          // Ma new Date() su stringhe vuote può dare NaN.

          const timeA = a.birth_date ? new Date(a.birth_date).getTime() : 0;
          const timeB = b.birth_date ? new Date(b.birth_date).getTime() : 0;

          // Se 0 (invalid), mettili in fondo? O cima?
          if (timeA === 0) return 1;
          if (timeB === 0) return -1;

          // Youngest (Maximum Timestamp) -> Oldest (Minimum Timestamp)
          // b - a: 2025 - 2000 > 0 -> b dopo a. Ordine: Oldest, Youngest.
          // Se vogliamo Youngest First: 2025 prima di 2000.
          // b > a -> return -1.
          return timeB - timeA; // Descending timestamp = Ascending Age (Youngest first?? No wait)
          // Timestamp: 2025 (Young) > 2000 (Old).
          // Descending (b - a): 2025 - 2000 = + . b comes after a.  => Oldest, Youngest.
          // Ascending (a - b): 2000 - 2025 = - . a comes before b. => Oldest, Youngest.

          // Wait. Youngest person has LARGEST timestamp.
          // To put Youngest FIRST:
          // We want Larger Timestamp FIRST.
          // So Descending Order of Timestamp.
          // b - a.
          // If b=2025, a=2000. b-a > 0. b comes after a? 
          // sort(a,b): result > 0 -> b comes first. result < 0 -> a comes first.
          // No. result > 0 -> a comes AFTER b (b comes first).
          // Let's verify: [2, 1].sort((a,b) => a-b). 2-1=1. Result > 0. a(2) after b(1). Result: [1, 2]. (Ascending).

          // We want Youngest (Large Timestamp) First.
          // So we want Descending Timestamp.
          // b - a.
          // If b (2025) - a (2000) > 0. a comes last. b comes first. Correct.
          // So b - a IS Youngest First.
        });

      // Sort anomalies by age of the youngest in the couple
      const sortedAnomalies = foundAnomalies.sort((a, b) => {
        const getMinDate = (an: CoupleAnomaly) => {
          const d1 = an.athlete1.birth_date ? new Date(an.athlete1.birth_date).getTime() : 0;
          const d2 = an.athlete2.birth_date ? new Date(an.athlete2.birth_date).getTime() : 0;
          return Math.max(d1, d2); // max time = youngest
        };
        return getMinDate(b) - getMinDate(a);
      });

      setAnomalies(sortedAnomalies);
      setOrphanAthletes(orphans);
    } catch (error: any) {
      console.error("fetchAnomalies error:", error);
      toast({
        title: "Errore nel caricamento",
        description: error.message || "Si è verificato un errore nel caricamento delle anomalie.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [role, userId, toast]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      if (role !== null) fetchAnomalies();
    };

    checkAuth();
  }, [navigate, role, fetchAnomalies]);



  const formatDateStr = (date: string) => {
    return new Date(date).toLocaleDateString("it-IT");
  };

  const categoryAnomalies = anomalies.filter(a => a.categoryIssue);
  const certificateAnomalies = anomalies.filter(a => a.certificateIssues.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Torna alla dashboard">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <h1 className="text-xl font-display font-bold">Anomalie</h1>
          </div>
          <div className="flex gap-2 ml-2">
            <Badge variant="destructive">
              {anomalies.length} anomalie coppie
            </Badge>
            <Badge variant="outline">
              {orphanAthletes.length} atleti senza partner
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {anomalies.length === 0 && orphanAthletes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nessuna anomalia trovata</h3>
              <p className="text-muted-foreground">
                Tutte le coppie attive sono in regola! 🎉
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">
                Tutte ({anomalies.length})
              </TabsTrigger>
              <TabsTrigger value="category">
                Categoria/Età ({categoryAnomalies.length})
              </TabsTrigger>
              <TabsTrigger value="certificates">
                Certificati ({certificateAnomalies.length})
              </TabsTrigger>
              <TabsTrigger value="orphans">
                Senza Partner ({orphanAthletes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <AnomaliesList anomalies={anomalies} />
            </TabsContent>

            <TabsContent value="category">
              <AnomaliesList anomalies={categoryAnomalies} showOnlyCategory />
            </TabsContent>

            <TabsContent value="certificates">
              <AnomaliesList anomalies={certificateAnomalies} showOnlyCertificates />
            </TabsContent>

            <TabsContent value="orphans">
              <OrphansList athletes={orphanAthletes} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function AnomaliesList({
  anomalies,
  showOnlyCategory = false,
  showOnlyCertificates = false
}: {
  anomalies: CoupleAnomaly[];
  showOnlyCategory?: boolean;
  showOnlyCertificates?: boolean;
}) {
  const formatDate = (date: string | null) => {
    if (!date) return "N/D";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return "N/D";
    return getSportsAge(birthDate, new Date());
  };

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <Card key={anomaly.couple.id} className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {(() => {
                  // Ensure Male is shown first
                  let first = anomaly.athlete1;
                  let second = anomaly.athlete2;
                  if (first.gender === "F" || second.gender === "M") {
                    [first, second] = [anomaly.athlete2, anomaly.athlete1];
                  }
                  return `${first.first_name} ${first.last_name} & ${second.first_name} ${second.last_name}`;
                })()}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{anomaly.couple.category}</Badge>
                <Badge variant="secondary">{anomaly.couple.class}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Athletes info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-background rounded-lg border">
                <p className="font-medium">{anomaly.athlete1.first_name} {anomaly.athlete1.last_name}</p>
                <p className="text-muted-foreground">
                  Nato: {formatDate(anomaly.athlete1.birth_date)} ({getAge(anomaly.athlete1.birth_date)} anni)
                </p>
                <p className="text-muted-foreground">
                  Certificato: {formatDate(anomaly.athlete1.medical_certificate_expiry)}
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="font-medium">{anomaly.athlete2.first_name} {anomaly.athlete2.last_name}</p>
                <p className="text-muted-foreground">
                  Nato: {formatDate(anomaly.athlete2.birth_date)} ({getAge(anomaly.athlete2.birth_date)} anni)
                </p>
                <p className="text-muted-foreground">
                  Certificato: {formatDate(anomaly.athlete2.medical_certificate_expiry)}
                </p>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              {!showOnlyCertificates && anomaly.categoryIssue && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <Users className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-destructive text-sm">Problema Categoria/Età</p>
                    <p className="text-sm text-muted-foreground">{anomaly.categoryIssue}</p>
                  </div>
                </div>
              )}

              {!showOnlyCategory && anomaly.certificateIssues.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <Calendar className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-warning text-sm">Problemi Certificati</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {anomaly.certificateIssues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrphansList({ athletes }: { athletes: Athlete[] }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {athletes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Tutti gli atleti hanno un partner assegnato.
        </Card>
      ) : (
        athletes.map((athlete) => {
          // Colori pastello: Azzurro per Maschi, Arancione per Femmine
          const isFemale = athlete.gender === 'F';
          const isMale = athlete.gender === 'M';
          const bgColorClass = isFemale
            ? "bg-[#FFD9B3] hover:bg-[#FFE0C2] border-[#FFB366]/50 transition-colors duration-300"
            : isMale
              ? "bg-[#CCE5FF] hover:bg-[#D6EAFF] border-[#99CCFF]/50 transition-colors duration-300"
              : "bg-warning/10 hover:bg-warning/20 border-warning/30 transition-colors duration-300";

          return (
            <Card key={athlete.id} className={bgColorClass}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{athlete.first_name} {athlete.last_name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{athlete.code}</Badge>
                    <Badge variant="secondary">{athlete.category}</Badge>
                    {athlete.birth_date && (
                      <Badge variant="outline" className="font-mono">
                        {new Date(athlete.birth_date).toLocaleDateString("it-IT")}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                  Assegna Partner
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}