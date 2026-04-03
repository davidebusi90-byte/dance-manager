import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Users, Calendar, UserMinus, UserCheck } from "lucide-react";
import { validateCoupleCategory, getSportsAge } from "@/lib/category-validation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { Athlete, Couple, Profile } from "@/types/dashboard";

interface CoupleAnomaly {
  couple: Couple;
  athlete1: Athlete;
  athlete2: Athlete;
  categoryIssue: string | null;
  certificateIssues: string[];
}

interface AthleteAnomaly {
  athlete: Athlete;
  issue: string;
  type: "duplicate" | "isolated" | "certificate";
}

export default function Anomalies() {
  const [coupleAnomalies, setCoupleAnomalies] = useState<CoupleAnomaly[]>([]);
  const [athleteAnomalies, setAthleteAnomalies] = useState<AthleteAnomaly[]>([]);
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
        supabase.from("athletes").select("*").eq("is_deleted", false),
        supabase.from("profiles").select("id, user_id, full_name"),
      ]);

      if (couplesRes.error) throw couplesRes.error;
      if (athletesRes.error) throw athletesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const rawAthletes = (athletesRes.data || []) as Athlete[];
      const rawCouples = (couplesRes.data || []) as Couple[];
      const rawProfiles = (profilesRes.data || []) as Profile[];

      const today = new Date();
      const foundCoupleAnomalies: CoupleAnomaly[] = [];
      const foundAthleteAnomalies: AthleteAnomaly[] = [];

      // 1. ATHLETE ANOMALIES
      // 1a. Duplicates (Same Name + Birth Date)
      const nameKeyMap = new Map<string, Athlete[]>();
      rawAthletes.forEach(a => {
        if (!a.birth_date) return;
        const key = `${a.first_name.trim().toLowerCase()}|${a.last_name.trim().toLowerCase()}|${a.birth_date}`;
        if (!nameKeyMap.has(key)) nameKeyMap.set(key, []);
        nameKeyMap.get(key)!.push(a);
      });

      nameKeyMap.forEach((athletes, key) => {
        if (athletes.length > 1) {
          athletes.forEach(a => {
            foundAthleteAnomalies.push({
              athlete: a,
              issue: `Sospetto duplicato: altri ${athletes.length - 1} atleti con stesso nome e data di nascita`,
              type: "duplicate"
            });
          });
        }
      });

      // 1b. Isolated (No Instructor)
      rawAthletes.forEach(a => {
        if (!a.instructor_id && (!a.responsabili || a.responsabili.length === 0)) {
          foundAthleteAnomalies.push({
            athlete: a,
            issue: "Atleta isolato: nessun istruttore o responsabile assegnato",
            type: "isolated"
          });
        }
      });

      // 1c. Athlete Certificates (Independent of couples)
      rawAthletes.forEach(a => {
        if (!a.medical_certificate_expiry) {
           foundAthleteAnomalies.push({ athlete: a, issue: "Certificato medico mancante", type: "certificate" });
        } else if (new Date(a.medical_certificate_expiry) < today) {
           foundAthleteAnomalies.push({ athlete: a, issue: `Certificato medico scaduto il ${new Date(a.medical_certificate_expiry).toLocaleDateString('it-IT')}`, type: "certificate" });
        }
      });

      // 2. COUPLE ANOMALIES
      const athletesMap = new Map(rawAthletes.map(a => [a.id, a]));
      for (const couple of rawCouples) {
        const athlete1 = athletesMap.get(couple.athlete1_id);
        const athlete2 = athletesMap.get(couple.athlete2_id);

        if (!athlete1 || !athlete2) continue;

        const validation = validateCoupleCategory({
          storedCategory: couple.category,
          athlete1BirthDateISO: athlete1.birth_date,
          athlete2BirthDateISO: athlete2.birth_date,
          onDate: today,
        });

        const categoryIssue = validation.ok ? null : (validation as { reason: string }).reason;
        const certificateIssues: string[] = [];

        const checkCert = (athlete: Athlete, label: string) => {
          if (!athlete.medical_certificate_expiry) {
            certificateIssues.push(`${label}: Certificato mancante`);
          } else if (new Date(athlete.medical_certificate_expiry) < today) {
            certificateIssues.push(`${label}: Certificato scaduto`);
          }
        };

        checkCert(athlete1, "Atleta 1");
        checkCert(athlete2, "Atleta 2");

        if (categoryIssue || certificateIssues.length > 0) {
          foundCoupleAnomalies.push({
            couple,
            athlete1,
            athlete2,
            categoryIssue,
            certificateIssues,
          });
        }
      }

      // Filter by role if not admin
      let finalCouples = foundCoupleAnomalies;
      let finalAthletes = foundAthleteAnomalies;

      if (role !== "admin" && role !== "supervisor") {
        const profile = rawProfiles.find(p => p.user_id === userId);
        if (profile) {
           finalCouples = foundCoupleAnomalies.filter(ca => ca.couple.instructor_id === profile.id);
           finalAthletes = foundAthleteAnomalies.filter(aa => aa.athlete.instructor_id === profile.id);
        } else {
           finalCouples = [];
           finalAthletes = [];
        }
      }

      setCoupleAnomalies(finalCouples);
      setAthleteAnomalies(finalAthletes);
    } catch (error: any) {
      console.error("fetchAnomalies error:", error);
      toast({ title: "Errore nel caricamento", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [role, userId, toast]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Caricamento...</div>;
  }

  const athleteDuplicates = athleteAnomalies.filter(a => a.type === "duplicate");
  const athleteIsolated = athleteAnomalies.filter(a => a.type === "isolated");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
               <AlertTriangle className="w-6 h-6 text-warning" />
               <h1 className="text-xl font-display font-bold">Integrità Dati & Anomalie</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive">{coupleAnomalies.length} Coppie</Badge>
            <Badge variant="outline">{athleteAnomalies.length} Atleti</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="couples" className="space-y-6">
          <TabsList className="bg-sky-50 p-1 border border-sky-100">
            <TabsTrigger value="couples">Anomalie Coppie ({coupleAnomalies.length})</TabsTrigger>
            <TabsTrigger value="athletes">Anomalie Atleti ({athleteAnomalies.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="couples" className="space-y-4">
            {coupleAnomalies.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">Tutte le coppie sono conformi.</div>
            ) : (
                coupleAnomalies.map((ca, i) => (
                    <Card key={i} className="border-l-4 border-l-destructive">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Users className="w-4 h-4 text-sky-600" />
                                {ca.athlete1.first_name} {ca.athlete1.last_name} & {ca.athlete2.first_name} {ca.athlete2.last_name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {ca.categoryIssue && <p className="text-destructive font-medium">⚠️ {ca.categoryIssue}</p>}
                            {ca.certificateIssues.map((ci, j) => <p key={j} className="text-orange-600">📋 {ci}</p>)}
                        </CardContent>
                    </Card>
                ))
            )}
          </TabsContent>

          <TabsContent value="athletes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="bg-orange-50/30 border-orange-200">
                  <CardHeader className="py-3">
                     <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-800">
                        <UserMinus className="w-4 h-4" />
                        Sospetti Duplicati ({athleteDuplicates.length})
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                     {athleteDuplicates.length === 0 ? <p className="text-xs text-muted-foreground">Nessun duplicato sospetto.</p> :
                        athleteDuplicates.map((a, i) => (
                           <div key={i} className="text-xs p-2 bg-white rounded border border-orange-100">
                              <strong>{a.athlete.first_name} {a.athlete.last_name}</strong> - CID: {a.athlete.code}
                              <p className="text-muted-foreground italic">{a.issue}</p>
                           </div>
                        ))
                     }
                  </CardContent>
               </Card>

               <Card className="bg-slate-50/30 border-slate-200">
                  <CardHeader className="py-3">
                     <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                        <UserCheck className="w-4 h-4" />
                        Atleti Isolati ({athleteIsolated.length})
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                     {athleteIsolated.length === 0 ? <p className="text-xs text-muted-foreground">Nessun atleta isolato.</p> :
                        athleteIsolated.map((a, i) => (
                           <div key={i} className="text-xs p-2 bg-white rounded border border-slate-100">
                              <strong>{a.athlete.first_name} {a.athlete.last_name}</strong> - CID: {a.athlete.code}
                           </div>
                        ))
                     }
                  </CardContent>
               </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}