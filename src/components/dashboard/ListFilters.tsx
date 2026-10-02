import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ListFiltersProps {
  filterInstructor: string;
  setFilterInstructor: (val: string) => void;
  uniqueInstructors: string[];
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  uniqueCategories: string[];
  filterClass: string;
  setFilterClass: (val: string) => void;
  uniqueClasses: string[];
  filterStandard: string;
  setFilterStandard: (val: string) => void;
  uniqueStandard: string[];
  filterLatini: string;
  setFilterLatini: (val: string) => void;
  uniqueLatini: string[];
}

export function ListFilters({
  filterInstructor,
  setFilterInstructor,
  uniqueInstructors,
  filterCategory,
  setFilterCategory,
  uniqueCategories,
  filterClass,
  setFilterClass,
  uniqueClasses,
  filterStandard,
  setFilterStandard,
  uniqueStandard,
  filterLatini,
  setFilterLatini,
  uniqueLatini,
}: ListFiltersProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/20 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2">
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Istruttore</label>
        <Select value={filterInstructor} onValueChange={setFilterInstructor}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tutti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {uniqueInstructors.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Categoria</label>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tutte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {uniqueCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Classe</label>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tutte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {uniqueClasses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Standard</label>
        <Select value={filterStandard} onValueChange={setFilterStandard}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tutte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {uniqueStandard.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Latini</label>
        <Select value={filterLatini} onValueChange={setFilterLatini}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tutte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {uniqueLatini.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
