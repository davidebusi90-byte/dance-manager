import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", user.id);
      }
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full animate-pulse delay-700" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <Card className="rounded-[2.5rem] glass border-white/10 shadow-2xl overflow-hidden">
          <CardHeader className="text-center p-8 pt-12 relative border-b border-white/5">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mx-auto w-20 h-20 mb-6 bg-gradient-to-br from-primary to-accent rounded-3xl p-4 flex items-center justify-center shadow-xl shadow-primary/20">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </motion.div>
            <CardTitle className="text-3xl font-display font-black tracking-tight uppercase mb-2">Dance Manager</CardTitle>
            <CardDescription className="text-muted-foreground font-medium">Accedi al tuo account</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 pb-10">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/10 px-6" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-white/10 px-6" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-14 rounded-2xl bg-primary text-lg font-bold shadow-xl shadow-primary/20 transition-all active:scale-95">
                {loading ? <Loader2 className="animate-spin" /> : <span>Accedi</span>}
              </Button>
            </form>

            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
              </div>
              <div className="relative px-3 bg-white/70 dark:bg-black/70 backdrop-blur-md rounded-full text-[10px] uppercase tracking-widest font-black text-muted-foreground/50">
                Oppure
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/enroll")}
              className="w-full h-14 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-black/40 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
              <span>Vai a Iscrizioni</span>
            </Button>
          </CardContent>
          <div className="bg-primary/5 p-4 text-center border-t border-white/5">
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/40">© 2026 Dance Manager • Premium Edition</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}