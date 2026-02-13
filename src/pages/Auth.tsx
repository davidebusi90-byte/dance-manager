import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthMode = "login" | "signup" | "otp_request" | "otp_verify" | "reset_request" | "reset_password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isInstructor, setIsInstructor] = useState(false);
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

      // Check for registration mode
      const registerMode = hashParams.get("register") || new URLSearchParams(window.location.search).get("register");
      if (registerMode === "instructor") {
        setMode("signup");
        setIsInstructor(true);
      }
    };

    checkRecoverySession();

    // Listen for auth state changes (recovery session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        navigate("/dashboard");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, is_instructor_request: isInstructor },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Registrazione completata!",
          description: isInstructor
            ? "La tua richiesta come istruttore è in attesa di approvazione da parte di un amministratore."
            : "Ora puoi accedere."
        });
        setMode("login");
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
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Accedi al tuo account";
      case "signup": return "Crea un nuovo account istruttore";
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
      case "signup": return "Registrati";
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center relative">
          {showBackButton && (
            <button
              type="button"
              onClick={handleBackToLogin}
              className="absolute left-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Dance Manager Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-display">Dance Manager</CardTitle>
          <CardDescription>{getTitle()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === "signup"}
                />
              </div>
            )}

            {(mode === "login" || mode === "signup" || mode === "otp_request" || mode === "reset_request") && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            {mode === "otp_verify" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Abbiamo inviato un codice a 6 cifre a <strong>{email}</strong>
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    value={otpCode}
                    onChange={setOtpCode}
                    maxLength={6}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("reset_request")}
                    className="text-sm text-accent hover:underline"
                  >
                    Password dimenticata?
                  </button>
                )}
              </div>
            )}

            {mode === "signup" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="instructor"
                  checked={isInstructor}
                  onCheckedChange={(checked) => setIsInstructor(checked === true)}
                />
                <Label htmlFor="instructor" className="text-sm cursor-pointer">
                  Sono un istruttore
                </Label>
              </div>
            )}

            {mode === "reset_password" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Nuova Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </>
            )}

            {mode === "reset_request" && (
              <p className="text-sm text-muted-foreground">
                Inserisci la tua email e ti invieremo un link per reimpostare la password.
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (mode === "otp_verify" && otpCode.length !== 6)}
            >
              {getButtonText()}
            </Button>
          </form>

          {(mode === "login" || mode === "signup") && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? "Non hai un account?" : "Hai già un account?"}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-accent hover:underline font-medium"
              >
                {mode === "login" ? "Registrati" : "Accedi"}
              </button>
            </p>
          )}

          {mode === "otp_verify" && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Non hai ricevuto il codice?{" "}
              <button
                onClick={() => setMode("otp_request")}
                className="text-accent hover:underline font-medium"
              >
                Invia di nuovo
              </button>
            </p>
          )}

          {mode === "reset_request" && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Preferisci accedere con un codice?{" "}
              <button
                onClick={() => setMode("otp_request")}
                className="text-accent hover:underline font-medium"
              >
                Accedi con OTP
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}