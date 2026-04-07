import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
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

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

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
      roles: ["admin", "instructor", "supervisor"]
    },
    { 
      label: "Iscrizioni Gare", 
      path: "/competition-enrollments", 
      icon: ClipboardList,
      roles: ["admin"] 
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

  return (
    <div className="flex min-h-screen bg-neutral-50/50 dark:bg-neutral-950 transition-colors duration-500">
      {/* Sidebar - Desktop */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-neutral-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl hidden md:flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex items-center justify-between p-6 h-20">
          {isSidebarOpen ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white shadow-sm p-1">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-lg font-display font-bold whitespace-nowrap overflow-hidden">
                Dance Manager
              </h1>
            </motion.div>
          ) : (
            <div className="w-full flex justify-center">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group",
                location.pathname === item.path 
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-lg shadow-neutral-200 dark:shadow-none" 
                  : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", location.pathname === item.path ? "" : "group-hover:scale-110 transition-transform")} />
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="font-medium text-sm"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-neutral-200/50 dark:border-neutral-800/50">
          {isSidebarOpen ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2 py-1">
                <Avatar className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700">
                  <AvatarFallback className="bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold">
                    {userEmail?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold truncate text-neutral-900 dark:text-neutral-100">
                    {userEmail}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {isAdmin ? "Amministratore" : "Istruttore"}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span className="font-medium">Logout</span>
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="w-full text-red-500 mt-2">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white/70 dark:bg-neutral-900/70 border-b border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="font-display font-bold">Dance Manager</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white dark:bg-neutral-950 md:hidden pt-20 px-6"
          >
            <nav className="space-y-2">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl text-lg font-medium",
                    location.pathname === item.path 
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" 
                      : "text-neutral-500 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-4" />
              <Button 
                variant="destructive" 
                size="lg" 
                onClick={handleLogout} 
                className="w-full rounded-2xl gap-3"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300 pt-20 md:pt-0 min-h-screen",
          "md:ml-20",
          isSidebarOpen ? "md:ml-64" : ""
        )}
      >
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-10 animate-fade-in">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Sidebar toggle - visible on desktop hover or click */}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 left-6 z-50 rounded-full shadow-lg border-neutral-200 dark:border-neutral-800 hidden md:flex hover:scale-110 active:scale-95 transition-all bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md"
      >
        <div className={cn("transition-transform duration-500", isSidebarOpen ? "rotate-0" : "rotate-180")}>
          <X className="w-4 h-4" />
        </div>
      </Button>
    </div>
  );
}
