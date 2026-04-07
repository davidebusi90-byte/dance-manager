import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  colorClass: string;
  onClick?: () => void;
  isActive?: boolean;
}

export default function StatCard({ 
  icon: Icon, 
  value, 
  label, 
  colorClass, 
  onClick,
  isActive 
}: StatCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onClick={onClick}
      className={cn(
        "stat-card cursor-pointer group relative overflow-hidden",
        isActive 
          ? "ring-2 ring-primary shadow-xl bg-primary/5 dark:bg-white/10" 
          : "hover:shadow-lg dark:hover:shadow-none dark:hover:bg-neutral-800/50"
      )}
    >
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
        colorClass.includes("primary") ? "bg-primary" : 
        colorClass.includes("success") ? "bg-green-500" : "bg-blue-500"
      )} />

      <div className="flex items-center gap-4 relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:rotate-6", 
          colorClass
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <motion.p 
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="text-3xl font-display font-bold text-foreground"
          >
            {value}
          </motion.p>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            {label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
