import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useUserRole } from "@/hooks/use-user-role";
import { usePrivacyConsent } from "@/hooks/usePrivacyConsent";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, ShieldAlert, Settings as SettingsIcon, LogOut, Moon, Sun, Bell, Shield, Lock, User, Mail, Sparkles, Loader2 } from "lucide-react";
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";
import Layout from "@/components/layout/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

  const { hasConsented } = usePrivacyConsent('privacy_policy', '1.0');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  return (
    <Layout>
      <PrivacyConsentModal 
        isOpen={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)}
        isReviewMode={true}
      />
      <div className="min-h-[80vh] py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-display font-black tracking-tight uppercase flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <SettingsIcon className="w-6 h-6" />
              </div>
              Impostazioni
            </h1>
            <p className="text-muted-foreground font-medium mt-2">Gestisci il tuo profilo e le preferenze del sistema</p>
          </motion.div>

          <div className="grid gap-8">
            {/* Profile Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
                <CardHeader className="p-8">
                  <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    Profilo Utente
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email Account</Label>
                    <Input 
                      value={userEmail ?? ""} 
                      disabled 
                      className="h-14 rounded-2xl bg-black/5 dark:bg-white/5 border-white/10 px-6 font-medium cursor-not-allowed" 
                    />
                  </div>
                  
                  <div className="pt-8 border-t border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">Privacy & GDPR</h4>
                          <p className="text-xs text-muted-foreground">Stato della conformità legale</p>
                        </div>
                      </div>
                      <Badge variant={hasConsented ? "outline" : "destructive"} className={cn(
                        "rounded-full px-4 py-1 text-[10px] font-black tracking-widest uppercase",
                        hasConsented ? "bg-green-500/10 text-green-500 border-green-500/20" : "animate-pulse"
                      )}>
                        {hasConsented ? 'Conforme' : 'Azione Richiesta'}
                      </Badge>
                    </div>
                    
                    <div className={cn(
                      "p-6 rounded-[2rem] border transition-all duration-500 flex items-center justify-between gap-4",
                      hasConsented ? "bg-white/5 border-white/5" : "bg-sky-500/5 border-sky-500/20 shadow-xl shadow-sky-500/10"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                          hasConsented ? "bg-green-500/10 text-green-600" : "bg-sky-500/10 text-sky-500"
                        )}>
                          {hasConsented ? <CheckCircle2 className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                        </div>
                        <div>
                          <p className="font-display font-black text-sm uppercase tracking-tight">Informativa Privacy v1.0</p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {hasConsented ? 'Accettata correttamente' : 'In attesa di accettazione'}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant={hasConsented ? "ghost" : "default"}
                        onClick={() => setShowPrivacyModal(true)}
                        className="rounded-xl font-bold h-10 px-6"
                      >
                        {hasConsented ? 'Rivedi' : 'Accetta ora'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
                <CardHeader className="p-8">
                  <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                    <Lock className="w-5 h-5 text-accent" />
                    Sicurezza Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Nuova Password</Label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 px-6"
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Conferma</Label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 px-6"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={loading} 
                      className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-lg font-bold shadow-xl shadow-accent/20 transition-all active:scale-95"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Aggiorna Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {role === "admin" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-8"
              >
                {/* Email Notifications */}
                <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
                  <CardHeader className="p-8">
                    <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                      <Bell className="w-5 h-5 text-primary" />
                      Sistema Notifiche
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5">
                      <div className="space-y-1">
                        <Label className="font-bold text-lg leading-none">Email Atleti</Label>
                        <p className="text-xs text-muted-foreground">Invia conferma automatica agli atleti</p>
                      </div>
                      <Switch
                        checked={emailSettings.athletes}
                        onCheckedChange={(checked) => handleUpdateEmailSetting("athletes", checked)}
                        disabled={updatingSettings}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5">
                      <div className="space-y-1">
                        <Label className="font-bold text-lg leading-none">Email Istruttori</Label>
                        <p className="text-xs text-muted-foreground">Invia copia all'istruttore della coppia</p>
                      </div>
                      <Switch
                        checked={emailSettings.instructors}
                        onCheckedChange={(checked) => handleUpdateEmailSetting("instructors", checked)}
                        disabled={updatingSettings}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Email Diagnostic */}
                <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
                  <CardHeader className="p-8">
                    <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-accent" />
                      Diagnostica Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="space-y-2">
                       <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email Destinatario Test</Label>
                      <Input
                        type="email"
                        placeholder="tua@email.it"
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 px-6"
                      />
                    </div>
                    <Button
                      onClick={handleTestEmail}
                      disabled={testingEmail}
                      variant="outline"
                      className="w-full h-14 rounded-2xl gap-3 text-lg font-bold border-white/10 hover:bg-primary/5 transition-all active:scale-95"
                    >
                      {testingEmail ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mail className="w-6 h-6" />}
                      {testingEmail ? "Invio..." : "Invia Test Diagnostico"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
