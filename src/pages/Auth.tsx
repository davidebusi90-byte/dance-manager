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

  // Check for password recovery session on mount
  useEffect(() => {
    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // Check URL hash for recovery token (Supabase redirects with hash params)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");

      if (type === "recovery" && session) {
        setMode("reset_password");
      }


    };

    checkRecoverySession();

    // Listen for auth state changes (recovery session)
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
        
        // Update last_login_at for GDPR compliance
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", user.id);
        }
        
        navigate("/dashboard");
      } else if (mode === "otp_request") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
          },
        });
        if (error) throw error;
        toast({
          title: "Codice inviato!",
          description: "Controlla la tua email per il codice di accesso."
        });
        setMode("otp_verify");
      } else if (mode === "otp_verify") {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "email",
        });
        if (error) throw error;

        // Update last_login_at for GDPR compliance
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
        toast({
          title: "Email inviata!",
          description: "Controlla la tua email per il link di reset password."
        });
      } else if (mode === "reset_password") {
        if (password !== confirmPassword) {
          toast({
            title: "Errore",
            description: "Le password non corrispondono",
            variant: "destructive"
          });
          return;
        }
        if (password.length < 6) {
          toast({
            title: "Errore",
            description: "La password deve essere di almeno 6 caratteri",
            variant: "destructive"
          });
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast({
          title: "Password aggiornata!",
          description: "Ora puoi accedere con la nuova password."
        });
        // Clear the hash and redirect to login
        window.history.replaceState(null, "", window.location.pathname);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error: unknown) {
      toast({ title: "Errore", description: (error instanceof Error ? error.message : String(error)), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Accedi al tuo account";
      case "otp_request": return "Accedi con codice temporaneo";
      case "otp_verify": return "Inserisci il codice ricevuto";
      case "reset_request": return "Recupera la tua password";
      case "reset_password": return "Imposta la nuova password";
    }
  };

  const getButtonText = () => {
    if (loading) return "Caricamento...";
    switch (mode) {
      case "login": return "Accedi";
      case "otp_request": return "Invia codice";
      case "otp_verify": return "Verifica codice";
      case "reset_request": return "Invia link reset";
      case "reset_password": return "Salva nuova password";
    }
  };

  const handleBackToLogin = () => {
    setMode("login");
    setOtpCode("");
    setPassword("");
    setConfirmPassword("");
  };

  const showBackButton = mode === "otp_request" || mode === "otp_verify" || mode === "reset_request";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full animate-pulse delay-700" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="rounded-[2.5rem] glass border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden">
          <CardHeader className="text-center p-8 pt-12 relative">
            <AnimatePresence>
              {showBackButton && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  type="button"
                  onClick={handleBackToLogin}
                  className="absolute left-6 top-6 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all active:scale-90"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
            
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-24 h-24 mb-8 bg-gradient-to-br from-primary to-accent rounded-[2rem] p-5 flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500"
            >
              <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain brightness-0 invert" />
            </motion.div>
            
            <CardTitle className="text-3xl font-display font-black tracking-tight uppercase mb-2">Dance Manager</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">{getTitle()}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 pt-0">
            <form onSubmit={handleAuth} className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {(mode === "login" || mode === "otp_request" || mode === "reset_request") && (
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 px-6 text-lg focus:ring-primary/20 transition-all"
                        placeholder="nome@esempio.it"
                      />
                    </div>
                  )}

                  {mode === "otp_verify" && (
                    <div className="space-y-6">
                      <p className="text-sm text-muted-foreground font-medium text-center">
                        Codice inviato a <strong className="text-foreground">{email}</strong>
                      </p>
                      <div className="flex justify-center">
                        <InputOTP
                          value={otpCode}
                          onChange={setOtpCode}
                          maxLength={6}
                        >
                          <InputOTPGroup className="gap-2">
                            {[0, 1, 2, 3, 4, 5].map((idx) => (
                              <InputOTPSlot 
                                key={idx} 
                                index={idx} 
                                className="w-12 h-14 rounded-xl border-white/20 bg-white/50 dark:bg-black/20 text-xl font-bold shadow-sm" 
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                  )}

                  {mode === "login" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Password</Label>
                        <button
                          type="button"
                          onClick={() => setMode("reset_request")}
                          className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          Dimenticata?
                        </button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/20 px-6 text-lg focus:ring-primary/20 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {mode === "reset_password" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">Nuova Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-14 rounded-2xl"
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
                          className="h-14 rounded-2xl"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <Button
                type="submit"
                disabled={loading || (mode === "otp_verify" && otpCode.length !== 6)}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-lg font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 group"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {getButtonText()}
                    <Sparkles className="w-4 h-4 group-hover:scale-125 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              {mode === "login" && (
                <button
                  onClick={() => setMode("otp_request")}
                  className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Oppure accedi con codice via email
                </button>
              )}
              
              {mode === "otp_verify" && (
                <p className="text-sm text-muted-foreground font-medium">
                  Non hai ricevuto nulla?{" "}
                  <button
                    onClick={() => setMode("otp_request")}
                    className="text-primary hover:underline font-bold"
                  >
                    Riprova
                  </button>
                </p>
              )}
            </div>
          </CardContent>
          
          <div className="bg-primary/5 p-4 text-center border-t border-white/5">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/40">
              © 2026 Dance Manager • Premium Professional Edition
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}