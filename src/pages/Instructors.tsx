import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Search, ShieldAlert, UserPlus, Users, Edit2, Save, X, Plus, Trash2, Mail, KeyRound, ShieldCheck, Shield } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Badge } from "@/components/ui/badge";

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
  const [search, setSearch] = useState("");
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
    } catch (e: any) {
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return instructors;
    return instructors.filter((i) =>
      `${i.full_name} ${i.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [instructors, search]);

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
    } catch (e: any) {
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
    } catch (e: any) {
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
      // Verify we have a valid session before calling the function
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[admin-update-password] Session:", sessionData?.session ? "Active" : "Missing");

      const { data, error } = await supabase.functions.invoke("admin-update-password", {
        body: { user_id: selected.user_id, new_password: newPassword },
      });

      // Log full error for diagnostics
      if (error) {
        console.error("[admin-update-password] Invoke error:", error);
        console.error("[admin-update-password] Error context:", (error as any)?.context);
        // Try to read actual error body
        const errorBody = (error as any)?.context;
        if (errorBody && typeof errorBody.json === "function") {
          try {
            const bodyJson = await errorBody.json();
            console.error("[admin-update-password] Error body JSON:", bodyJson);
          } catch (_) { /* ignore */ }
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Password aggiornata",
        description: `Password aggiornata per ${selected.full_name}.`,
      });
      setNewPassword("");
      setSelected(null);
    } catch (e: any) {
      console.error("[admin-update-password] Caught error:", e);
      toast({ title: "Errore", description: e.message, variant: "destructive" });
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
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
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
    } catch (e: any) {
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
      const { data, error } = await supabase.rpc("admin_create_instructor", {
        p_full_name: newInstructorName,
        p_email: newInstructorEmail,
        p_password: newInstructorPassword,
      });

      if (error) throw error;
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
            aria-label="Torna alla dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-xl font-display font-bold">Istruttori</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Istruttore
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuovo Istruttore</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      placeholder="Mario Rossi"
                      value={newInstructorName}
                      onChange={(e) => setNewInstructorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario@example.com"
                      value={newInstructorEmail}
                      onChange={(e) => setNewInstructorEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimo 6 caratteri"
                      value={newInstructorPassword}
                      onChange={(e) => setNewInstructorPassword(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={handleCreateInstructor} disabled={isAdding}>
                    {isAdding ? "Creazione..." : "Crea Istruttore"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Pending Users Section */}
        {pendingUsers.length > 0 && (
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-warning" />
                Utenti in attesa di approvazione
                <Badge variant="secondary">{pendingUsers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Data registrazione</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((u) => (
                      <tr key={u.user_id}>
                        <td className="font-medium">{u.full_name}</td>
                        <td>{u.email ?? "-"}</td>
                        <td>{new Date(u.created_at).toLocaleDateString("it-IT")}</td>
                        <td>
                          <Button
                            size="sm"
                            onClick={() => handlePromote(u)}
                            disabled={promotingId === u.user_id}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {promotingId === u.user_id ? "Promozione..." : "Promuovi a Istruttore"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 bg-accent/10 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              Elenco istruttori ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Caricamento...</div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground">Nessun istruttore trovato.</div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i) => (
                      <tr key={i.user_id}>
                        <td>
                          {editingId === i.user_id ? (
                            <div className="space-y-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Nome completo"
                                className="max-w-md"
                              />
                              <p className="text-xs text-muted-foreground">
                                Modifica il nome completo dell'istruttore
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{i.full_name}</div>
                              {editingEmailId === i.user_id ? (
                                <div className="space-y-1 mt-1">
                                  <Input
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Nuova email"
                                    className="max-w-md h-8 text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">{i.email ?? "-"}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {editingId === i.user_id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveName(i.user_id)}
                                  className="text-success hover:bg-success/10"
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Salva
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Annulla
                                </Button>
                              </>
                            ) : editingEmailId === i.user_id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleUpdateEmail}
                                  className="text-success hover:bg-success/10"
                                  disabled={emailSaving}
                                >
                                  {emailSaving ? (
                                    <span className="w-4 h-4 spinner" />
                                  ) : (
                                    <Save className="w-4 h-4 mr-1" />
                                  )}
                                  Salva
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEmailEdit}
                                  disabled={emailSaving}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Annulla
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditName(i)}
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Nome
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditEmail(i)}
                                >
                                  <Mail className="w-4 h-4 mr-1" />
                                  Email
                                </Button>
                                {i.email && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${i.email}`;
                                      const accountChooserUrl = `https://accounts.google.com/AccountChooser?service=mail&continue=${encodeURIComponent(gmailUrl)}`;
                                      window.open(accountChooserUrl, '_blank');
                                    }}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    title="Invia email con Gmail"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                )}
                                <Dialog
                                  open={selected?.user_id === i.user_id}
                                  onOpenChange={(open) => {
                                    setSelected(open ? i : null);
                                    if (!open) setNewPassword("");
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <KeyRound className="w-4 h-4 mr-1" />
                                      Password
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Modifica password</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                      <Label>Nuova password per</Label>
                                      <div className="text-sm text-muted-foreground">{i.full_name} ({i.email ?? "-"})</div>
                                      <Input
                                        type="password"
                                        minLength={6}
                                        placeholder="Minimo 6 caratteri"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                      />
                                    </div>
                                    <DialogFooter>
                                      <Button onClick={handleUpdatePassword} disabled={saving}>
                                        {saving ? "Aggiornamento..." : "Aggiorna"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant={i.is_supervisor ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleSupervisor(i)}
                                  disabled={togglingRoleId === i.user_id}
                                  className={i.is_supervisor ? "bg-accent hover:bg-accent/90" : ""}
                                  title={i.is_supervisor ? "Rimuovi accesso sola lettura" : "Promuovi a supervisore (accesso globale sola lettura)"}
                                >
                                  {togglingRoleId === i.user_id ? (
                                    <span className="w-4 h-4 spinner" />
                                  ) : i.is_supervisor ? (
                                    <>
                                      <ShieldCheck className="w-4 h-4 mr-1" />
                                      Admin (Sola Lettura)
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-4 h-4 mr-1" />
                                      Rendi Admin (SL)
                                    </>
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteInstructor(i)}
                                  disabled={deletingId === i.user_id}
                                >
                                  {deletingId === i.user_id ? (
                                    <span className="w-4 h-4 spinner" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main >
    </div >
  );
}
