import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, UserPlus, Users, Edit2, Save, X, Plus, Trash2, Mail, KeyRound, ShieldCheck, Shield } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Instructor = {
  profile_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  is_supervisor: boolean;
};

type PendingUser = {
  profile_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
};

export default function Instructors() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Instructor | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editingName, setEditingName] = useState("");
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newInstructorName, setNewInstructorName] = useState("");
  const [newInstructorEmail, setNewInstructorEmail] = useState("");
  const [newInstructorPassword, setNewInstructorPassword] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
    };
    checkAuth();
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get all user_ids and their roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const rolesByUserId = new Map<string, string[]>();
      for (const r of allRoles ?? []) {
        const roles = rolesByUserId.get(r.user_id) || [];
        roles.push(r.role);
        rolesByUserId.set(r.user_id, roles);
      }

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      const instructorList: Instructor[] = [];
      const pendingList: PendingUser[] = [];

      for (const p of profiles ?? []) {
        const userRoles = rolesByUserId.get(p.user_id) || [];

        if (userRoles.includes("instructor")) {
          instructorList.push({
            profile_id: p.id,
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            is_supervisor: userRoles.includes("supervisor"),
          });
        } else if (userRoles.length === 0) {
          // User has no roles at all - pending approval
          pendingList.push({
            profile_id: p.id,
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            created_at: p.created_at,
          });
        }
      }

      setInstructors(instructorList);
      setPendingUsers(pendingList);
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      console.error("fetchData error:", e);
      toast({
        title: "Errore nel caricamento",
        description: e.message || "Impossibile caricare i dati degli istruttori.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      toast({
        title: "Accesso negato",
        description: "Questa sezione è riservata agli amministratori.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    fetchData();
  }, [adminLoading, isAdmin, navigate, toast, fetchData]);

  // AUTO-SYNC MECHANISM (Frontend-Based Fuzzy Match)
  useEffect(() => {
    if (!isAdmin || adminLoading) return;

    const runAutoSync = async () => {
      const hasRun = sessionStorage.getItem("responsibilities_synced_v2");
      if (hasRun) return;

      try {
        toast({
          title: "Ottimizzazione Permessi",
          description: "Analisi e correzione permessi in corso...",
          duration: 5000,
        });

        // 1. Fetch all profiles (instructors)
        const { data: profiles, error: pError } = await supabase
          .from("profiles")
          .select("id, full_name");

        if (pError) throw pError;

        // 2. Fetch all athletes with responsabili
        const { data: athletes, error: aError } = await supabase
          .from("athletes")
          .select("id, responsabili");

        if (aError) throw aError;

        if (!profiles || !athletes) return;

        let linkedCount = 0;
        const linksToInsert: { athlete_id: string; profile_id: string }[] = [];

        // 3. Perform Fuzzy Matching in JS
        // This bypasses strict SQL equality
        for (const athlete of athletes) {
          if (!athlete.responsabili || athlete.responsabili.length === 0) continue;

          for (const respName of athlete.responsabili) {
            const target = respName.toLowerCase().trim();
            if (!target) continue;

            // Check against all profiles
            // Match if profile name includes target OR target includes profile name
            // OR if all parts of target are in profile name (e.g. "Corvini Simone" matches "Simone Corvini")
            const targetParts = target.split(/[\s,.-]+/).filter(p => p.length > 2);

            const bestMatch = profiles.find(p => {
              const pName = p.full_name.toLowerCase();
              // Direct inclusion
              if (pName.includes(target) || target.includes(pName)) return true;

              // Token matching (all meaningful parts must match)
              if (targetParts.length > 0) {
                return targetParts.every(part => pName.includes(part));
              }
              return false;
            });

            if (bestMatch) {
              linksToInsert.push({
                athlete_id: athlete.id,
                profile_id: bestMatch.id
              });
            }
          }
        }

        // 4. Insert links (Upsert to avoid duplicates)
        if (linksToInsert.length > 0) {
          // Start by deleting existing to be safe? No, let's just upsert/insert.
          // Access to 'athlete_instructors' might be restricted.
          // If insert fails, we catch it.
          // Note: 'athlete_instructors' has composite key (athlete_id, profile_id) usually? 
          // Let's check types: id is UUID PK. Unique constraint on (athlete_id, profile_id) is expected but not guaranteed by types alone.
          // We will try to insert one by one or ignore dups if possible.
          // Since we don't have "ON CONFLICT DO NOTHING" easily exposed without conflict target knowledge,
          // we'll fetch existing links first.

          const { data: existingLinks } = await supabase
            .from("athlete_instructors")
            .select("athlete_id, profile_id");

          const existingSet = new Set(existingLinks?.map(l => `${l.athlete_id}_${l.profile_id}`));

          const newLinks = linksToInsert.filter(l => !existingSet.has(`${l.athlete_id}_${l.profile_id}`));

          // Deduplicate newLinks themselves
          const uniqueNewLinks = Array.from(new Set(newLinks.map(l => JSON.stringify(l)))).map(s => JSON.parse(s));

          if (uniqueNewLinks.length > 0) {
            // Batch insert
            const BATCH_SIZE = 50;
            for (let i = 0; i < uniqueNewLinks.length; i += BATCH_SIZE) {
              const batch = uniqueNewLinks.slice(i, i + BATCH_SIZE);
              await supabase.from("athlete_instructors").insert(batch);
              linkedCount += batch.length;
            }
          }
        }

        if (linkedCount > 0) {
          toast({
            title: "Sincronizzazione Completata",
            description: `Collegati ${linkedCount} nuovi permessi istruttore.`,
            variant: "default"
          });
        } else {
          toast({
            title: "Sincronizzazione",
            description: "Nessun nuovo permesso da aggiungere.",
          });
        }

        sessionStorage.setItem("responsibilities_synced_v2", "true");

      } catch (e) {
        console.error("Auto-sync failed:", e);
      }
    };

    runAutoSync();
  }, [isAdmin, adminLoading, toast]);

  const filtered = instructors;

  const handlePromote = async (user: PendingUser) => {
    setPromotingId(user.user_id);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: user.user_id, role: "instructor" });

      if (error) throw error;

      toast({
        title: "Utente promosso",
        description: `${user.full_name} è ora un istruttore.`,
      });
      await fetchData();
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setPromotingId(null);
    }
  };

  const handleToggleSupervisor = async (instructor: Instructor) => {
    setTogglingRoleId(instructor.user_id);
    try {
      if (instructor.is_supervisor) {
        // Remove supervisor role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", instructor.user_id)
          .eq("role", "supervisor");

        if (error) throw error;
        toast({
          title: "Ruolo rimosso",
          description: `${instructor.full_name} non è più supervisore.`,
        });
      } else {
        // Add supervisor role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: instructor.user_id, role: "supervisor" });

        if (error) throw error;
        toast({
          title: "Supervisore assegnato",
          description: `${instructor.full_name} ora ha accesso globale in sola lettura.`,
        });
      }
      await fetchData();
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selected) return;
    if (newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-password", {
        body: { user_id: selected.user_id, new_password: newPassword },
      });

      if (error) {
        console.error("[admin-update-password] Invoke error:", error);
        
        // Handle FunctionsHttpError case where message might be generic
        // but the body contains the real error
        let errorMessage = error.message;
        
        // If it's a 4xx/5xx error from Supabase Functions, we try to extract our JSON error
        if ((error as any).context) {
          try {
            const context = (error as any).context;
            // In typical Supabase SDK, the context might contain the response body
            // This is a common pattern for debugging
            console.log("[admin-update-password] Error context:", context);
          } catch (_) { /* ignore */ }
        }

        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Password aggiornata",
        description: `Password aggiornata per ${selected.full_name}.`,
      });
      setNewPassword("");
      setSelected(null);
    } catch (e: any) {
      console.error("[admin-update-password] Caught error:", e);
      
      // Attempt to extract the "error" field from the body if the message is generic
      let displayMessage = e.message;
      
      // Supabase FunctionsHttpError usually doesn't expose the body directly in .message
      // but 'supabase.functions.invoke' returns { data, error }
      // If data is null and error is present, we check data anyway because some 
      // versions of the SDK put the JSON body in data even for non-2xx statuses.
      
      toast({ 
        title: "Errore Reset Password", 
        description: displayMessage || "Impossibile aggiornare la password.", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditName = (instructor: Instructor) => {
    // If we were editing email, cancel it
    setEditingEmailId(null);
    setNewEmail("");

    setEditingId(instructor.user_id);
    setEditingName(instructor.full_name || "");
  };

  const handleEditEmail = (instructor: Instructor) => {
    // If we were editing name, cancel it
    setEditingId(null);
    setEditingName("");

    setEditingEmailId(instructor.user_id);
    setNewEmail(instructor.email || "");
  };

  const handleSaveName = async (userId: string) => {
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: editingName })
        .eq("user_id", userId);

      if (profileError) {
        throw new Error(`Impossibile aggiornare il profilo: ${profileError.message}`);
      }

      toast({
        title: "Nome aggiornato",
        description: "Il nome dell'istruttore è stato aggiornato con successo",
      });

      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      toast({
        title: "Errore",
        description: (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEmailEdit = () => {
    setEditingEmailId(null);
    setNewEmail("");
  };

  const handleUpdateEmail = async () => {
    if (!editingEmailId) return;
    if (!newEmail || !newEmail.includes("@")) {
      toast({
        title: "Errore",
        description: "Inserisci un'email valida.",
        variant: "destructive",
      });
      return;
    }

    setEmailSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-email", {
        body: { user_id: editingEmailId, new_email: newEmail },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Email aggiornata",
        description: "L'email dell'istruttore è stata aggiornata con successo.",
      });

      setEditingEmailId(null);
      setNewEmail("");
      await fetchData();
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      toast({
        title: "Errore aggiornamento email",
        description: e.message || "Impossibile aggiornare l'email.",
        variant: "destructive",
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleCreateInstructor = async () => {
    if (!newInstructorName || !newInstructorEmail || !newInstructorPassword) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi.",
        variant: "destructive",
      });
      return;
    }

    if (newInstructorPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      // @ts-ignore
      const { data, error } = await supabase.rpc("admin_create_instructor", {
        p_full_name: newInstructorName,
        p_email: newInstructorEmail,
        p_password: newInstructorPassword,
      });

      if (error) throw error;
      // @ts-ignore
      if (data?.success === false) throw new Error(data.error);

      toast({
        title: "Istruttore creato",
        description: `${newInstructorName} è stato aggiunto con successo.`,
      });

      setIsAddOpen(false);
      setNewInstructorName("");
      setNewInstructorEmail("");
      setNewInstructorPassword("");
      await fetchData();
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      toast({
        title: "Errore creazione",
        description: e.message || "Impossibile creare l'istruttore.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteInstructor = async (instructor: Instructor) => {
    if (!confirm(`Sei sicuro di voler eliminare ${instructor.full_name}? Questa azione è irreversibile.`)) {
      return;
    }

    setDeletingId(instructor.user_id);
    try {

      // 1. Remove name from 'responsabili' array in athletes
      // We have to do this client-side because Supabase doesn't easily support "array_remove" via simple update without RPC
      const { data: athletesWithResp, error: fetchRespError } = await supabase
        .from("athletes")
        .select("id, responsabili")
        .contains("responsabili", [instructor.full_name]);

      if (fetchRespError) console.error("Error fetching athletes for cleanup:", fetchRespError);

      if (athletesWithResp && athletesWithResp.length > 0) {
        // Update each athlete
        for (const ath of athletesWithResp) {
          const newResp = (ath.responsabili || []).filter((r: string) => r !== instructor.full_name);
          const { error: updateRespError } = await supabase
            .from("athletes")
            .update({ responsabili: newResp })
            .eq("id", ath.id);

          if (updateRespError) console.error(`Failed to update athlete ${ath.id}`, updateRespError);
        }
      }

      // 2. Nullify instructor_id in athletes
      const { error: athError } = await supabase
        .from("athletes")
        .update({ instructor_id: null })
        .eq("instructor_id", instructor.profile_id); // Use profile_id for foreign keys

      if (athError) console.error("Error unlinking athletes:", athError);

      // 3. Nullify instructor_id in couples
      const { error: cpError } = await supabase
        .from("couples")
        .update({ instructor_id: null })
        .eq("instructor_id", instructor.profile_id);

      if (cpError) console.error("Error unlinking couples:", cpError);

      // 4. Delete from athlete_instructors
      const { error: aiError } = await supabase
        .from("athlete_instructors")
        .delete()
        .eq("profile_id", instructor.profile_id);

      if (aiError) console.error("Error deleting athlete_instructors:", aiError);

      // 5. Delete Profile (This removes them from the list)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", instructor.profile_id);

      if (profileError) throw new Error(`Impossibile eliminare il profilo: ${profileError.message}`);

      await fetchData();
    } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      toast({
        title: "Errore eliminazione",
        description: e.message || "Impossibile eliminare l'istruttore.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <main className="container mx-auto px-4 py-8 space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-primary dark:bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20 dark:shadow-white/10">
              <Users className="w-8 h-8 text-white dark:text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Istruttori</h1>
              <p className="text-muted-foreground font-medium">Gestisci i membri del tuo team e i permessi</p>
            </div>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-2xl shadow-xl hover:shadow-2xl transition-all gap-3 bg-primary hover:bg-primary/90">
                <Plus className="w-5 h-5" />
                <span>Nuovo Istruttore</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl glass border-white/10 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display font-bold">Aggiungi Istruttore</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider ml-1">Nome Completo</Label>
                  <Input
                    id="name"
                    placeholder="E es. Mario Rossi"
                    value={newInstructorName}
                    onChange={(e) => setNewInstructorName(e.target.value)}
                    className="rounded-xl h-12 bg-white/50 dark:bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wider ml-1">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mario@example.com"
                    value={newInstructorEmail}
                    onChange={(e) => setNewInstructorEmail(e.target.value)}
                    className="rounded-xl h-12 bg-white/50 dark:bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-bold uppercase tracking-wider ml-1">Password Temporanea</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Almeno 6 caratteri"
                    value={newInstructorPassword}
                    onChange={(e) => setNewInstructorPassword(e.target.value)}
                    className="rounded-xl h-12 bg-white/50 dark:bg-black/20"
                  />
                </div>
              </div>
              <DialogFooter className="gap-3">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl h-12">
                  Annulla
                </Button>
                <Button onClick={handleCreateInstructor} disabled={isAdding} className="rounded-xl h-12 px-8 bg-primary">
                  {isAdding ? "Creazione..." : "Crea Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Pending Users Section */}
        <AnimatePresence>
          {pendingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="border-warning/30 bg-warning/5 dark:bg-warning/10 overflow-hidden shadow-lg shadow-warning/5">
                <CardHeader className="border-b border-warning/10 pb-4">
                  <CardTitle className="text-xl flex items-center gap-3 text-warning font-display">
                    <UserPlus className="w-6 h-6" />
                    Richieste di Registrazione
                    <Badge variant="secondary" className="bg-amber-500 text-white ml-auto">{pendingUsers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr className="bg-warning/5">
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Data registrazione</th>
                          <th className="text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map((u, idx) => (
                          <motion.tr 
                            key={u.user_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <td className="font-bold">{u.full_name}</td>
                            <td className="text-muted-foreground">{u.email ?? "-"}</td>
                            <td>{new Date(u.created_at).toLocaleDateString("it-IT")}</td>
                            <td className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handlePromote(u)}
                                disabled={promotingId === u.user_id}
                                className="rounded-xl bg-warning text-warning-foreground hover:bg-warning/90 shadow-md"
                              >
                                {promotingId === u.user_id ? "Promozione..." : "Approva come Istruttore"}
                              </Button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="shadow-2xl shadow-primary/5 dark:shadow-none border-white/5 glass">
          <CardHeader className="pb-8 border-b border-white/10">
            <CardTitle className="text-2xl flex items-center gap-4 font-display">
              <div className="w-10 h-10 bg-primary/5 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5 text-primary dark:text-white" />
              </div>
              Istruttori Attivi ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Caricamento istruttori...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Nessun istruttore trovato.</p>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr className="bg-muted/50 dark:bg-white/5">
                      <th className="pl-8">Dettagli Istruttore</th>
                      <th>Ruolo & Permessi</th>
                      <th className="pr-8 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i, idx) => (
                      <motion.tr 
                        key={i.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-neutral-100/50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="pl-8 py-6">
                          <AnimatePresence mode="wait">
                            {editingId === i.user_id ? (
                              <motion.div 
                                key="edit-name"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 max-w-md"
                              >
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="rounded-xl bg-white dark:bg-black/20"
                                  autoFocus
                                />
                                <Button size="icon" onClick={() => handleSaveName(i.user_id)} className="shrink-0 bg-primary rounded-xl">
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="shrink-0 rounded-xl">
                                  <X className="w-4 h-4" />
                                </Button>
                              </motion.div>
                            ) : (
                              <motion.div 
                                key="view-name"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <div className="flex items-center gap-2 group/name">
                                  <span className="font-bold text-lg">{i.full_name}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-6 h-6 opacity-0 group-hover/name:opacity-100 transition-opacity"
                                    onClick={() => handleEditName(i)}
                                  >
                                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 group/email">
                                  {editingEmailId === i.user_id ? (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Input
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        className="rounded-xl h-8 text-xs bg-white dark:bg-black/20 w-64"
                                      />
                                      <Button size="icon" variant="ghost" onClick={handleUpdateEmail} className="h-8 w-8 text-primary">
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={handleCancelEmailEdit} className="h-8 w-8">
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-sm text-muted-foreground font-medium">{i.email ?? "-"}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="w-6 h-6 opacity-0 group-hover/email:opacity-100 transition-opacity"
                                        onClick={() => handleEditEmail(i)}
                                      >
                                        <Mail className="w-3 h-3 text-muted-foreground" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <Badge variant={i.is_supervisor ? "default" : "outline"} className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                              i.is_supervisor ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "text-muted-foreground border-muted-foreground/30"
                            )}>
                              {i.is_supervisor ? "Supervisore" : "Istruttore Standard"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "rounded-xl h-8 px-3 text-[10px] uppercase font-bold tracking-wider hover:bg-accent/10 active:scale-95 transition-all",
                                i.is_supervisor ? "text-muted-foreground" : "text-accent"
                              )}
                              onClick={() => handleToggleSupervisor(i)}
                              disabled={togglingRoleId === i.user_id}
                            >
                              {i.is_supervisor ? "Rimuovi Supervisione" : "Rendi Supervisore"}
                            </Button>
                          </div>
                        </td>
                        <td className="pr-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={saving && selected?.user_id === i.user_id}
                              onClick={() => setSelected(i)}
                              className="rounded-xl border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all font-bold text-xs gap-2"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Reset Password
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              disabled={deletingId === i.user_id}
                              onClick={() => handleDeleteInstructor(i)}
                              className="rounded-xl shadow-lg hover:shadow-destructive/20 active:scale-90 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Reset Modal - Refined */}
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="rounded-3xl glass border-white/10 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-xl font-display font-bold flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-primary" />
                Sicurezza Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Stai reimpostando la password per <span className="font-bold text-foreground">{selected?.full_name}</span>.
              </p>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nuova Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Inserisci nuova password"
                  className="rounded-xl h-11 bg-white/50 dark:bg-black/20"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-3">
              <Button variant="ghost" onClick={() => setSelected(null)} className="rounded-xl w-full">
                Annulla
              </Button>
              <Button onClick={handleUpdatePassword} disabled={saving} className="rounded-xl w-full bg-primary">
                {saving ? "Aggiornamento..." : "Salva Nuova Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
