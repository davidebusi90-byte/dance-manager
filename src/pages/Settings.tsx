import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, User, RefreshCw } from "lucide-react";
import { importCompetitors, importCompetitions } from "@/lib/import-utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useUserRole } from "@/hooks/use-user-role";

export default function Settings() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { role, userId } = useUserRole();
  const { refresh } = useDashboardData(role, userId);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserEmail(session.user.email ?? null);
    };
    checkAuth();
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non corrispondono",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password aggiornata!",
        description: "La tua password è stata modificata con successo."
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Import Athletes
      try {
        const resp = await fetch("/files/Competitori_ok.xls");
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          const result = await importCompetitors(blob);
          if (result.success) {
            toast({ title: "Import Atleti", description: `Processati: ${result.count}` });
          } else {
            console.error("Import atleti failed:", result.message);
            toast({ title: "Errore Import Atleti", description: result.message || "Errore sconosciuto", variant: "destructive" });
          }
        }
      } catch (e) {
        console.error("Auto-import athletes error", e);
      }

      // Import Competitions
      try {
        const resp = await fetch(`/files/Competizioni.xlsx?t=${new Date().getTime()}`);
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          const result = await importCompetitions(blob);
          if (result.success) {
            toast({ title: "Import Competizioni", description: `Nuove: ${result.created}, Aggiornate: ${result.updated}` });
          } else {
            console.error("Auto-import competitions failed:", result.message);
            toast({ title: "Errore Import Competizioni", description: result.message || "Errore sconosciuto", variant: "destructive" });
          }
        }
      } catch (e: any) {
        console.error("Auto-import competitions error", e);
        toast({ title: "Errore Import Competizioni", description: e.message || "Errore di rete", variant: "destructive" });
      }
    } catch (globalError) {
      console.error("Global auto-import error", globalError);
    }

    await refresh();
    setRefreshing(false);
    toast({
      title: "Sistema aggiornato",
      description: "Dati ricaricati e sincronizzati con i file Excel locali.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Impostazioni</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profilo
            </CardTitle>
            <CardDescription>Informazioni del tuo account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={userEmail ?? ""} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambia Password
            </CardTitle>
            <CardDescription>Aggiorna la password del tuo account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nuova Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimo 6 caratteri"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Ripeti la nuova password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Aggiornamento..." : "Aggiorna Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Excel Sync - Admin Only */}
        {role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Sincronizzazione
              </CardTitle>
              <CardDescription>Sincronizza i dati con i file Excel locali</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full gap-2 bg-green-100 border-green-300 text-green-700 hover:bg-green-200 hover:border-green-400"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                Sincronizza Excel
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
