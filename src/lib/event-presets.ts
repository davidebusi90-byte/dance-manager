export const DISCIPLINES = ["Danze Standard", "Danze Latino Americane", "Combinata", "Show Dance"];

export const STANDARD_LATIN_EVENTS = [
  // Syllabus
  { name: "Juvenile 1 (6/9)", classes: ["D", "C", "B1", "B2", "B3"], minAge: 6, maxAge: 9 },
  { name: "Juvenile 2 (10/11)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 10, maxAge: 11 },
  { name: "Junior 1 (12/13)", classes: ["D", "C", "B1", "B2", "B3", "A"], minAge: 12, maxAge: 13 },
  { name: "Junior 2 (14/15)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 14, maxAge: 15 },
  { name: "Youth (16/18)", classes: ["C", "B1", "B2", "B3", "A", "AS"], minAge: 16, maxAge: 18 },
  { name: "Adult (19/34)", classes: ["D", "C", "B1", "B2", "B3", "A1", "A2"], minAge: 19, maxAge: 34 },
  { name: "Senior 1 (35/44)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35, maxAge: 44 },
  { name: "Senior 2 (45/54)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45, maxAge: 54 },
  { name: "Senior 3a (55/60)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55, maxAge: 60 },
  { name: "Senior 3b (61/64)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 61, maxAge: 64 },
  { name: "Senior 4a (65/69)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65, maxAge: 69 },
  { name: "Senior 4b (70/74)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 70, maxAge: 74 },
  { name: "Senior 5 (75+)", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 75 },
  
  // Under/Over
  { name: "Under 16", classes: ["C", "B1", "B2", "B3", "A", "A1", "A2", "AS"], maxAge: 15 },
  { name: "Under 21", classes: ["C", "B1", "B2", "B3", "A", "A1", "A2", "AS"], minAge: 16, maxAge: 20 },
  { name: "Over 35", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 35 },
  { name: "Over 45", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 45 },
  { name: "Over 55", classes: ["D", "C", "B1", "B2", "B3", "A", "AS"], minAge: 55 },
  { name: "Over 65", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 65 },
  { name: "Over 75", classes: ["D", "C", "B1", "B2", "B3", "A", "AS", "MASTER"], minAge: 75 },

  // Open/Rising
  { name: "Adult Open", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Amator Open A", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Rising Star", classes: ["A", "A1", "A2", "AS"], minAge: 16 },
  { name: "Youth Open", classes: ["B1", "B2", "B3", "A", "A1", "A2", "AS"], minAge: 16, maxAge: 18 },
  { name: "Open Classe B", classes: ["B1", "B2", "B3"] },
  
  // Master
  { name: "Rising Star Master", classes: ["MASTER"] },
  { name: "Adult Master", classes: ["MASTER"] },
  { name: "Master 1", classes: ["MASTER"] },
  { name: "Master 2", classes: ["MASTER"] },
  { name: "Master 3", classes: ["MASTER"] },
  { name: "Master 4", classes: ["MASTER"] },
];

export const COMBINATA_EVENTS = [
  { name: "Combinata 10 Balli", classes: ["MASTER", "AS", "A", "A1", "A2", "B1", "B2", "B3"] },
  { name: "Combinata 8 Balli", classes: ["C", "D"] },
  { name: "Classic Show Dance", classes: ["MASTER", "AS", "A"] },
  { name: "South America Showdance", classes: ["MASTER", "AS", "A"] },
];

export const getEventsForDiscipline = (discipline: string) => {
  if (discipline === "Combinata") return COMBINATA_EVENTS;
  if (discipline === "Show Dance") return COMBINATA_EVENTS.filter(e => e.name.includes("Show"));
  return STANDARD_LATIN_EVENTS;
};
