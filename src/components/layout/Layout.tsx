import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUserRole } from "@/hooks/use-user-role";
import { 
  Users, 
  Settings, 
  Trophy, 
  FileWarning, 
  LogOut, 
  LayoutDashboard,
  ClipboardList,
  Menu,
  X,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";

interface LayoutProps {
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
  activePath?: string;
}

export default function Layout({ children, onNavigate, activePath }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, userId, userEmail, loading: roleLoading } = useUserRole();
  const isAdmin = role === "admin" || role === "supervisor";

  const navItems = [
    { 
      label: "Dashboard", 
      path: "/dashboard", 
      icon: LayoutDashboard,
      roles: ["admin", "instructor", "supervisor"] 
    },
    { 
      label: "Anomalie", 
      path: "/anomalies", 
      icon: FileWarning,
      roles: ["admin"]
    },
    { 
      label: "Iscrizioni", 
      path: "/enroll", 
      icon: ClipboardList,
      roles: ["admin", "instructor"] 
    },
    { 
      label: "Istruttori", 
      path: "/instructors", 
      icon: Users,
      roles: ["admin"] 
    },
    { 
      label: "Impostazioni", 
      path: "/settings", 
      icon: Settings,
      roles: ["admin", "instructor", "supervisor"]
    },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes("admin") ? isAdmin : true
  );

  const handleNavClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const currentPath = activePath || location.pathname;

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50/50 dark:bg-neutral-950 transition-colors duration-500">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/50 px-6">
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between gap-8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-sm p-1.5 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500 hidden sm:block">
              Dance Manager
            </h1>
          </div>

          {/* Main Navigation (Desktop) */}
          <nav className="hidden md:flex items-center bg-neutral-100/50 dark:bg-neutral-800/50 p-1.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50">
            {filteredNavItems.map((item) => {
              const isActive = currentPath === item.path;
              const ClickComponent = onNavigate ? "button" : Link;
              const componentProps = onNavigate 
                ? { onClick: () => handleNavClick(item.path) } 
                : { to: item.path };

              return (
                <div key={item.path} className="flex">
                  {(ClickComponent === "button") ? (
                    <button
                      onClick={() => handleNavClick(item.path)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                        isActive 
                          ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                        isActive 
                          ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Section & Mobile Toggle */}
          <div className="flex items-center gap-4">
            {/* User Profile (Desktop) */}
            {!roleLoading && (
              <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-col items-end">
                  <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[150px]">
                    {userEmail || "Utente"}
                  </p>
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-0.5",
                    isAdmin ? "bg-primary/10 text-primary" : "bg-neutral-100 dark:bg-neutral-800 text-muted-foreground"
                  )}>
                    {role === "admin" ? "Admin" : role === "supervisor" ? "Sola Lettura" : "Istruttore"}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-9 h-9 rounded-xl hover:bg-red-500/10 hover:text-red-500"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>

                <Avatar className="w-10 h-10 rounded-xl border border-white/20 dark:border-white/10 shadow-lg ml-2">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-black">
                    {userEmail?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl md:hidden pt-24 px-6"
          >
            <nav className="flex flex-col gap-3">
              {filteredNavItems.map((item) => (
                <div key={item.path}>
                   {onNavigate ? (
                    <button
                      onClick={() => {
                        handleNavClick(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-5 rounded-3xl text-lg font-bold transition-all",
                        currentPath === item.path 
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl" 
                          : "text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                      {item.label}
                    </button>
                   ) : (
                    <Link
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 p-5 rounded-3xl text-lg font-bold transition-all",
                        location.pathname === item.path 
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl" 
                          : "text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                      {item.label}
                    </Link>
                   )}
                </div>
              ))}
              <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                <Button 
                  variant="destructive" 
                  className="w-full h-14 rounded-3xl text-lg font-bold"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 w-6 h-6" /> Esci
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-12 transition-all duration-300">
        <div className="max-w-[1440px] mx-auto p-4 md:p-8 lg:p-10">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      <PrivacyConsentModal />
    </div>
  );
}
