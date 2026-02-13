import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  value: number;
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
    <div 
      className={cn(
        "stat-card cursor-pointer",
        isActive && "ring-2 ring-accent shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="stat-value">{value}</p>
          <p className="stat-label">{label}</p>
        </div>
      </div>
    </div>
  );
}
