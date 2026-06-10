import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "otp_request" | "otp_verify" | "reset_request" | "reset_password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");

      if (type === "recovery" && session) {
        setMode("reset_password");
      }
    };
    checkRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset_password");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", user.id);
        }
        navigate("/dashboard");
      } else if (mode === "otp_request") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        toast({ title: "Codice inviato!", description: "Controlla la tua email." });
        setMode("otp_verify");
      } else if (mode === "otp_verify") {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "email",
        });
        if (error) throw error;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", user.id);
        }
        toast({ title: "Accesso effettuato!" });
        navigate("/dashboard");
      } else if (mode === "reset_request") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast({ title: "Email inviata!", description: "Controlla la tua email per il link di reset." });
      } else if (mode === "reset_password") {
        if (password !== confirmPassword) {
          toast({ title: "Errore", description: "Le password non corrispondono", variant: "destructive" });
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast({ title: "Password aggiornata!", description: "Ora puoi accedere." });
        window.history.replaceState(null, "", window.location.pathname);
        setMode("login");
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Accedi al tuo account";
      case "otp_request": return "Email Magic Code";
      case "otp_verify": return "Verifica Codice";
      case "reset_request": return "Recupero Password";
      case "reset_password": return "Nuova Password";
    }
  };

  const getButtonText = () => {
    if (loading) return "Caricamento...";
    switch (mode) {
      case "login": return "Accedi";
      case "otp_request": return "Invia codice";
      case "otp_verify": return "Verifica codice";
      case "reset_request": return "Invia link";
      case "reset_password": return "Salva password";
    }
  };

  const handleBackToLogin = () => {
    setMode("login");
    setOtpCode("");
    setPassword("");
    setConfirmPassword("");
  };

  const showBackButton = mode !== "login";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full animate-pulse delay-700" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
          <CardHeader className="text-center p-8 pt-12 relative border-b border-white/5">
            <AnimatePresence>
              {showBackButton && (
                <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onClick={handleBackToLogin} className="absolute left-6 top-6 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mx-auto w-20 h-20 mb-6 bg-gradient-to-br from-primary to-accent rounded-3xl p-4 flex items-center justify-center shadow-xl shadow-primary/20">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </motion.div>
            <CardTitle className="text-3xl font-display font-black tracking-tight uppercase mb-2">Dance Manager</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">{getTitle()}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 pb-10">
            <form onSubmit={handleAuth} className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div key={mode} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  {(mode === "login" || mode === "otp_request" || mode === "reset_request") && (
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/10 px-6" />
                    </div>
                  )}
                  {mode === "login" && (
                    <div className="space-y-2">
                       <div className="flex justify-between ml-1"><Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Password</Label>
                       <button type="button" onClick={() => setMode("reset_request")} className="text-xs font-bold text-primary">Dimenticata?</button></div>
                       <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/10 px-6" />
                    </div>
                  )}
                  {mode === "otp_verify" && (
                     <div className="flex justify-center py-4">
                        <InputOTP value={otpCode} onChange={setOtpCode} maxLength={6}>
                           <InputOTPGroup className="gap-2">
                              {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} className="w-12 h-14 rounded-xl border-white/20 bg-white/50 dark:bg-black/20 text-xl font-bold" />)}
                           </InputOTPGroup>
                        </InputOTP>
                     </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <Button type="submit" disabled={loading} className="w-full h-14 rounded-2xl bg-primary text-lg font-bold shadow-xl shadow-primary/20 transition-all active:scale-95">
                {loading ? <Loader2 className="animate-spin" /> : <span>{getButtonText()}</span>}
              </Button>
            </form>
            {mode === "login" && (
              <button onClick={() => setMode("otp_request")} className="mt-6 w-full text-sm font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Accedi con codice temporaneo
              </button>
            )}
          </CardContent>
          <div className="bg-primary/5 p-4 text-center border-t border-white/5">
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/40">© 2026 Dance Manager • Premium Edition</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}