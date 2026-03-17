import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, User, Mail } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useUserRole } from "@/hooks/use-user-role";

export default function Settings() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    athletes: true,
    instructors: true
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);
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
    const fetchSettings = async () => {
      const { data, error } = await (supabase
        .from("system_settings" as any) as any)
        .select("email_notifications_athletes, email_notifications_instructors")
        .eq("id", "global")
        .maybeSingle();

      if (data) {
        setEmailSettings({
          athletes: (data as any).email_notifications_athletes,
          instructors: (data as any).email_notifications_instructors
        });
      }
    };

    checkAuth();
    fetchSettings();
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
    } catch (error: unknown) {
      toast({
        title: "Errore",
        description: (error instanceof Error ? error.message : String(error)),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo) {
      toast({ title: "Errore", description: "Inserisci un indirizzo email di destinazione", variant: "destructive" });
      return;
    }
    setTestingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-test-email", {
        body: { to: testEmailTo },
      });
      if (res.error) throw res.error;
      const result = res.data as { success: boolean; error?: string; id?: string };
      if (result.success) {
        toast({ title: "✅ Email inviata!", description: `Email di test inviata correttamente a ${testEmailTo}` });
      } else {
        toast({ title: "❌ Errore invio email", description: result.error || "Errore sconosciuto", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Errore durante il test", variant: "destructive" });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleUpdateEmailSetting = async (key: "athletes" | "instructors", value: boolean) => {
    setUpdatingSettings(true);
    const newSettings = { ...emailSettings, [key]: value };
    setEmailSettings(newSettings);

    try {
      const { error } = await (supabase
        .from("system_settings" as any) as any)
        .update({
          [`email_notifications_${key}`]: value
        })
        .eq("id", "global");

      if (error) throw error;

      toast({
        title: "Impostazioni aggiornate",
        description: `Notifiche email ${key === "athletes" ? "atleti" : "istruttori"} ${value ? "attivate" : "disattivate"}.`
      });
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Errore durante l'aggiornamento delle impostazioni",
        variant: "destructive"
      });
      // Revert local state on error
      setEmailSettings(emailSettings);
    } finally {
      setUpdatingSettings(false);
    }
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

        {role === "admin" && (
          <>

            {/* Email Notifications Settings */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Notifiche Email
                </CardTitle>
                <CardDescription>Gestisci l'invio automatico delle email durante l'iscrizione</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-athletes">Notifiche Atleti</Label>
                    <p className="text-sm text-muted-foreground">Invia email di conferma agli atleti iscritti</p>
                  </div>
                  <Switch
                    id="notify-athletes"
                    checked={emailSettings.athletes}
                    onCheckedChange={(checked) => handleUpdateEmailSetting("athletes", checked)}
                    disabled={updatingSettings}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-instructors">Notifiche Istruttori</Label>
                    <p className="text-sm text-muted-foreground">Invia email di conferma all'istruttore della coppia</p>
                  </div>
                  <Switch
                    id="notify-instructors"
                    checked={emailSettings.instructors}
                    onCheckedChange={(checked) => handleUpdateEmailSetting("instructors", checked)}
                    disabled={updatingSettings}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Test Email */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Test Invio Email
                </CardTitle>
                <CardDescription>Verifica che il sistema di notifiche email funzioni correttamente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testEmailTo">Indirizzo email destinatario</Label>
                  <Input
                    id="testEmailTo"
                    type="email"
                    placeholder="es. tua@email.com"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="w-full gap-2"
                  variant="outline"
                >
                  <Mail className="w-4 h-4" />
                  {testingEmail ? "Invio in corso..." : "Invia Email di Test"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
