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
import { CheckCircle2, ShieldCheck, ShieldAlert, Settings as SettingsIcon, LogOut, Moon, Sun, Bell, Shield, Lock, User, Mail, Sparkles, Loader2, ArrowLeft, DatabaseBackup, Clock, AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";
import Layout from "@/components/layout/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    athletes: true,
    instructors: true
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // --- Stato dashboard anonimizzazione ---
  const RETENTION_DAYS = 90; // giorni prima dell'anonimizzazione
  const [softDeletedAthletes, setSoftDeletedAthletes] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    deleted_at: string;
    daysLeft: number;
    pct: number; // % tempo consumato (0=appena eliminato, 100=già scaduto)
  }>>([]);
  const [loadingAnon, setLoadingAnon] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { role, userId, userEmail } = useUserRole();
  const { refresh } = useDashboardData(role, userId);

  useEffect(() => {
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

    if (userId) {
      fetchSettings();
    }
  }, [userId]);

  // Fetch atleti soft-deleted con countdown anonimizzazione (solo admin)
  useEffect(() => {
    if (role !== 'admin') return;
    const fetchSoftDeleted = async () => {
      setLoadingAnon(true);
      try {
        const { data, error } = await (supabase
          .from('athletes' as any) as any)
          .select('id, first_name, last_name, deleted_at')
          .eq('is_deleted', true)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: true });

        if (error) throw error;

        const now = new Date();
        const enriched = ((data || []) as any[]).map((a: any) => {
          const deletedAt = new Date(a.deleted_at);
          const msSinceDelete = now.getTime() - deletedAt.getTime();
          const daysSinceDelete = msSinceDelete / (1000 * 60 * 60 * 24);
          const daysLeft = Math.max(0, Math.ceil(RETENTION_DAYS - daysSinceDelete));
          const pct = Math.min(100, Math.round((daysSinceDelete / RETENTION_DAYS) * 100));
          return { ...a, daysLeft, pct };
        });

        setSoftDeletedAthletes(enriched);
      } catch (_) {
        // silenzioso
      } finally {
        setLoadingAnon(false);
      }
    };
    fetchSoftDeleted();
  }, [role]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleTestEmail = async () => {
    if (!testEmailTo) {
      toast({ title: "Errore", description: "Inserisci un indirizzo email di destinazione", variant: "destructive" });
      return;
    }
    setTestingEmail(true);
    try {
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
      <div className="min-h-[80vh] py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h1 className="text-4xl font-display font-black tracking-tight uppercase flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <SettingsIcon className="w-6 h-6" />
                </div>
                Impostazioni
              </h1>
              <p className="text-muted-foreground font-medium mt-2">Gestisci il tuo profilo e le preferenze del sistema</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full h-12 w-12 hover:bg-primary/5">
              <ArrowLeft className="w-6 h-6" />
            </Button>
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
                      <PrivacyConsentModal 
                        isOpen={showPrivacyModal} 
                        onClose={() => setShowPrivacyModal(false)}
                        isReviewMode={true}
                      />
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

            {/* Security - Only Admin can change password */}
            {role === "admin" && (
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
            )}

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

            {/* Anonymization Dashboard - Admin only */}
            {role === 'admin' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
                  <CardHeader className="p-8">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-display font-bold flex items-center gap-3">
                        <DatabaseBackup className="w-5 h-5 text-orange-400" />
                        Protezione Dati — Anonimizzazione
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {loadingAnon && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {!loadingAnon && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-4 py-1 text-[10px] font-black tracking-widest uppercase",
                              softDeletedAthletes.filter(a => a.daysLeft < 14).length > 0
                                ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                                : softDeletedAthletes.length > 0
                                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  : "bg-green-500/10 text-green-500 border-green-500/20"
                            )}
                          >
                            {softDeletedAthletes.filter(a => a.daysLeft < 14).length > 0
                              ? `${softDeletedAthletes.filter(a => a.daysLeft < 14).length} Urgenti`
                              : softDeletedAthletes.length > 0
                                ? `${softDeletedAthletes.length} In attesa`
                                : 'Nessuno'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="mt-2 text-sm">
                      Gli atleti eliminati vengono anonimizzati dopo <strong>90 giorni</strong> per conformità GDPR.
                      I dati delle iscrizioni alle gare vengono preservati.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                    {loadingAnon ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mr-3" />
                        Caricamento...
                      </div>
                    ) : softDeletedAthletes.length === 0 ? (
                      <div className="flex items-center gap-4 p-6 rounded-3xl bg-green-500/5 border border-green-500/10">
                        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                          <CheckCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-green-500">Nessun atleta in attesa di anonimizzazione</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Tutti i dati sono protetti e nessuna scadenza è imminente.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {softDeletedAthletes.map((atleta) => {
                          const isUrgent = atleta.daysLeft < 14;
                          const isExpired = atleta.daysLeft === 0;
                          return (
                            <div
                              key={atleta.id}
                              className={cn(
                                "p-5 rounded-3xl border transition-all",
                                isExpired
                                  ? "bg-red-500/10 border-red-500/20"
                                  : isUrgent
                                    ? "bg-orange-500/5 border-orange-500/20"
                                    : "bg-white/5 border-white/5"
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center",
                                    isExpired ? "bg-red-500/20 text-red-400"
                                      : isUrgent ? "bg-orange-500/20 text-orange-400"
                                        : "bg-white/10 text-muted-foreground"
                                  )}>
                                    {isExpired || isUrgent
                                      ? <AlertTriangle className="w-4 h-4" />
                                      : <Trash2 className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">
                                      {atleta.first_name} {atleta.last_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Eliminato il {new Date(atleta.deleted_at).toLocaleDateString('it-IT')}
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full text-[10px] font-black tracking-widest uppercase px-3 py-0.5",
                                    isExpired
                                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                                      : isUrgent
                                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                        : "bg-white/5 text-muted-foreground border-white/10"
                                  )}
                                >
                                  {isExpired ? 'Scaduto' : `${atleta.daysLeft}gg`}
                                </Badge>
                              </div>
                              <div className="space-y-1.5">
                                <Progress
                                  value={atleta.pct}
                                  className={cn(
                                    "h-2 rounded-full",
                                    isExpired ? "[&>div]:bg-red-500"
                                      : isUrgent ? "[&>div]:bg-orange-400"
                                        : "[&>div]:bg-primary/60"
                                  )}
                                />
                                <p className="text-[10px] text-muted-foreground text-right">
                                  {atleta.pct}% del periodo di retention consumato
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Session Management - For all users */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="rounded-[2.5rem] glass border-red-500/20 shadow-2xl overflow-hidden mb-12">
                <CardHeader className="p-8">
                  <CardTitle className="text-xl font-display font-bold flex items-center gap-3 text-red-500">
                    <LogOut className="w-5 h-5" />
                    Gestione Sessione
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-red-500/5 border border-red-500/10">
                    <div>
                      <p className="font-bold text-lg">Disconnetti Account</p>
                      <p className="text-sm text-muted-foreground">Termina la sessione corrente su questo dispositivo</p>
                    </div>
                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
                    >
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
