import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center relative z-10"
      >
        <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/10 rotate-12">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-8xl font-display font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold mb-6">Pagina non trovata</h2>
        <p className="text-muted-foreground font-medium mb-10 max-w-md mx-auto leading-relaxed">
          Spiacenti, la pagina che stai cercando non esiste o è stata spostata. 
          Verifica l'URL o torna alla dashboard.
        </p>
        
        <Button asChild size="lg" className="h-14 px-8 rounded-2xl gap-3 text-lg font-bold shadow-xl shadow-primary/20">
          <Link to="/">
            <Home className="w-5 h-5" />
            Torna alla Dashboard
          </Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
