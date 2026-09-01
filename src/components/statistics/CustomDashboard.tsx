import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { CustomChart } from "@/types/statistics";
import { Athlete, Couple, Competition, Profile } from "@/types/dashboard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { validateCoupleCategory } from "@/lib/category-validation";

// Util
const getSeason = (dateString: string | Date | null) => {
  if (!dateString) return "Sconosciuta";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth(); 
  if (month >= 8) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
};

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface CustomDashboardProps {
  charts: CustomChart[];
  athletes: Athlete[];
  couples: Couple[];
  competitions: Competition[];
  entries: any[];
  profiles: Profile[];
  onDeleteChart: (id: string) => void;
}

export default function CustomDashboard({ charts, athletes, couples, competitions, entries, profiles, onDeleteChart }: CustomDashboardProps) {

  // Engine to compute data for a given chart configuration
  const getChartData = (chart: CustomChart) => {
    const dataMap: Record<string, number> = {};

    const increment = (key: string, amount: number = 1) => {
      if (!key || key === "undefined") key = "Non Definito";
      dataMap[key] = (dataMap[key] || 0) + amount;
    };

    // Helper per ottenere l'asse X per una coppia
    const getCoupleGroupKey = (couple: Couple): string => {
      if (chart.groupBy === 'class') return couple.class;
      if (chart.groupBy === 'category') return couple.category;
      if (chart.groupBy === 'season') return getSeason(couple.created_at);
      if (chart.groupBy === 'instructor') {
        const prof = profiles.find(p => p.id === couple.instructor_id);
        return prof ? prof.full_name : "Nessun Istruttore";
      }
      return "Tutti";
    };

    if (chart.metric === "couples") {
      couples.forEach(c => increment(getCoupleGroupKey(c)));
    } 
    else if (chart.metric === "athletes") {
      athletes.forEach(a => {
        let key = "Tutti";
        if (chart.groupBy === 'class') key = a.class;
        else if (chart.groupBy === 'category') key = a.category;
        else if (chart.groupBy === 'instructor') {
          const prof = profiles.find(p => p.id === a.instructor_id);
          key = prof ? prof.full_name : "Nessun Istruttore";
        }
        increment(key);
      });
    }
    else if (chart.metric === "entries") {
      entries.forEach(e => {
        const couple = couples.find(c => c.id === e.couple_id);
        const comp = competitions.find(c => c.id === e.competition_id);
        if (!couple || !comp) return;

        if (chart.groupBy === 'competition') {
          increment(comp.name);
        } else if (chart.groupBy === 'season') {
          increment(getSeason(comp.date));
        } else {
          increment(getCoupleGroupKey(couple));
        }
      });
    }
    else if (chart.metric === "anomalies") {
      const today = new Date();
      couples.forEach(c => {
        if (!c.athlete1 || !c.athlete2) return;
        let hasAnomaly = false;
        
        const validation = validateCoupleCategory({
          storedCategory: c.category,
          athlete1BirthDateISO: c.athlete1.birth_date,
          athlete2BirthDateISO: c.athlete2.birth_date,
          onDate: today,
        });
        if (!validation.ok) hasAnomaly = true;

        [c.athlete1, c.athlete2].forEach(a => {
          if (!a.medical_certificate_expiry || new Date(a.medical_certificate_expiry) < today) {
            hasAnomaly = true;
          }
        });

        if (hasAnomaly) {
          increment(getCoupleGroupKey(c));
        }
      });
    }

    return Object.entries(dataMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const renderChart = (chart: CustomChart) => {
    const data = getChartData(chart);

    if (data.length === 0) {
      return <div className="h-full flex items-center justify-center text-muted-foreground">Nessun dato.</div>;
    }

    if (chart.type === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "line") {
      // Sort chronologically if season, otherwise alphabetically
      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sortedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: Bar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
          <YAxis allowDecimals={false} />
          <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (charts.length === 0) {
    return (
      <div className="py-20 text-center glass rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700">
        <h3 className="text-xl font-bold text-muted-foreground mb-2">Nessun grafico in questa scheda</h3>
        <p className="text-sm text-muted-foreground">Clicca su "+ Aggiungi Grafico" per iniziare a incrociare i dati.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {charts.map(chart => (
        <Card key={chart.id} className="shadow-sm border-neutral-200/50 dark:border-neutral-800/50 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg truncate" title={chart.title}>{chart.title}</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteChart(chart.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {renderChart(chart)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
