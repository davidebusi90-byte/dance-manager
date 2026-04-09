import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, UserPlus, Users, Edit2, Save, X, Plus, Trash2, Mail, ShieldCheck, Shield } from "lucide-react";
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

export default function Instructors({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
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

  const handleEditName = (instructor: Instructor) => {
    setEditingId(instructor.user_id);
    setEditingName(instructor.full_name || "");
  };

  const handleSaveName = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editingName })
        .eq("user_id", userId);

      if (error) throw error;

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

  const handleEditEmail = (instructor: Instructor) => {
    setEditingEmailId(instructor.user_id);
    setNewEmail(instructor.email || "");
  };

  const handleCancelEmailEdit = () => {
    setEditingEmailId(null);
    setNewEmail("");
  };

  const handleUpdateEmail = async () => {
    if (!editingEmailId) return;
    if (!newEmail || !newEmail.includes("@")) {
      toast({ title: "Errore", description: "Inserisci un'email valida.", variant: "destructive" });
      return;
    }

    setEmailSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-email", {
        body: { user_id: editingEmailId, new_email: newEmail },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Email aggiornata", description: "L'email dell'istruttore è stata aggiornata con successo." });
      setEditingEmailId(null);
      setNewEmail("");
      await fetchData();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleCreateInstructor = async () => {
    if (!newInstructorName || !newInstructorEmail || !newInstructorPassword) {
      toast({ title: "Errore", description: "Compila tutti i campi.", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-instructor", {
        body: {
          full_name: newInstructorName,
          email: newInstructorEmail,
          password: newInstructorPassword,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Istruttore creato", description: `${newInstructorName} aggiunto con successo.` });
      setIsAddOpen(false);
      setNewInstructorName("");
      setNewInstructorEmail("");
      setNewInstructorPassword("");
      await fetchData();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteInstructor = async (instructor: Instructor) => {
    if (!confirm(`Eliminare ${instructor.full_name}? L'azione è irreversibile.`)) return;

    setDeletingId(instructor.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: instructor.user_id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Istruttore eliminato", description: "Dati rimossi." });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={isEmbedded ? "" : "min-h-screen bg-neutral-50/50 dark:bg-neutral-950/50"}>
      <main className={isEmbedded ? "" : "container mx-auto px-4 py-8 space-y-8"}>
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
                    placeholder="Mario Rossi"
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
                  <Label htmlFor="password" className="text-sm font-bold uppercase tracking-wider ml-1">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimo 6 caratteri"
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
              className="mb-8"
            >
              <Card className="rounded-[2.5rem] border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden shadow-lg shadow-amber-500/5">
                <CardHeader className="border-b border-amber-500/10 pb-4">
                  <CardTitle className="text-xl flex items-center gap-3 text-amber-600 font-display font-bold">
                    <UserPlus className="w-6 h-6" />
                    Richieste di Registrazione
                    <Badge variant="secondary" className="bg-amber-500 text-white ml-auto rounded-full">{pendingUsers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-amber-500/5 border-b border-amber-500/10">
                          <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-amber-700/60">Nome</th>
                          <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-amber-700/60">Email</th>
                          <th className="px-8 py-4 text-right pr-8 text-xs font-black uppercase tracking-widest text-amber-700/60">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map((u) => (
                          <tr key={u.user_id} className="border-b border-amber-500/5">
                            <td className="px-8 py-5 font-bold">{u.full_name}</td>
                            <td className="px-8 py-5 text-muted-foreground">{u.email ?? "-"}</td>
                            <td className="px-8 py-5 text-right pr-8">
                              <Button
                                size="sm"
                                onClick={() => handlePromote(u)}
                                disabled={promotingId === u.user_id}
                                className="rounded-xl bg-amber-500 text-white hover:bg-amber-600 shadow-md"
                              >
                                {promotingId === u.user_id ? "Promozione..." : "Approva"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="rounded-[2.5rem] shadow-2xl border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="p-8 border-b border-neutral-200 dark:border-neutral-800">
            <CardTitle className="text-2xl flex items-center gap-4 font-display font-bold">
              <div className="w-10 h-10 bg-primary/5 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5 text-primary dark:text-white" />
              </div>
              Istruttori Attivi ({instructors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-gray-700 dark:text-gray-100">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Caricamento istruttori...</p>
              </div>
            ) : instructors.length === 0 ? (
              <div className="py-20 text-center">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Nessun istruttore trovato.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100/50 dark:bg-white/5 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60">Dettagli Istruttore</th>
                      <th className="px-8 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60">Ruolo & Permessi</th>
                      <th className="px-8 py-4 text-right pr-8 text-xs font-black uppercase tracking-widest text-muted-foreground/60">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map((i, idx) => (
                      <motion.tr 
                        key={i.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group border-b border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-100/30 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-8 py-6">
                          <AnimatePresence mode="wait">
                            {editingId === i.user_id ? (
                              <div className="flex items-center gap-2 max-w-md">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="rounded-xl h-10 bg-white dark:bg-black/20"
                                  autoFocus
                                />
                                <Button size="icon" onClick={() => handleSaveName(i.user_id)} className="shrink-0 bg-primary w-10 h-10 rounded-xl">
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="shrink-0 w-10 h-10 rounded-xl">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : editingEmailId === i.user_id ? (
                               <div className="flex items-center gap-2 max-w-md">
                                <Input
                                  value={newEmail}
                                  onChange={(e) => setNewEmail(e.target.value)}
                                  className="rounded-xl h-10 bg-white dark:bg-black/20"
                                  autoFocus
                                />
                                <Button size="icon" onClick={handleUpdateEmail} disabled={emailSaving} className="shrink-0 bg-primary w-10 h-10 rounded-xl">
                                  {emailSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleCancelEmailEdit} className="shrink-0 w-10 h-10 rounded-xl">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 group/name">
                                  <span className="font-bold text-lg">{i.full_name}</span>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover/name:opacity-100" onClick={() => handleEditName(i)}>
                                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 group/email">
                                  <span className="text-sm text-muted-foreground font-medium">{i.email ?? "-"}</span>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover/email:opacity-100" onClick={() => handleEditEmail(i)}>
                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  {i.email && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="w-6 h-6 text-red-500 opacity-0 group-hover/email:opacity-100" 
                                      onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${i.email}`, '_blank')}
                                    >
                                      <Mail className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </AnimatePresence>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <Badge variant={i.is_supervisor ? "default" : "outline"} className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                              i.is_supervisor ? "bg-accent text-white" : "text-muted-foreground border-muted-foreground/30"
                            )}>
                              {i.is_supervisor ? "Supervisore" : "Istruttore"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl h-8 px-3 text-[10px] uppercase font-bold tracking-wider hover:bg-accent/10 transition-all"
                              onClick={() => handleToggleSupervisor(i)}
                              disabled={togglingRoleId === i.user_id}
                            >
                              {i.is_supervisor ? "Rimuovi Supervisione" : "Rendi Supervisore"}
                            </Button>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right pr-8">
                          <Button
                            variant="destructive"
                            size="icon"
                            disabled={deletingId === i.user_id}
                            onClick={() => handleDeleteInstructor(i)}
                            className="rounded-xl shadow-lg hover:bg-red-600 transition-all w-10 h-10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
