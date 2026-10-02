const athleteData = {
    disc1: "Danze Latino Americane", class1: "C",
    disc2: "Danze Standard", class2: "B3",
    disc3: "Combinata Standard-Latini", class3: "B3"
};

// ==========================================
// 1. VECCHIA LOGICA (BUGGATA)
// ==========================================
const vecchiDiscInfo: Record<string, string> = {};
for (let i = 1; i <= 3; i++) {
    const d = (athleteData as any)[`disc${i}`];
    const c = (athleteData as any)[`class${i}`];
    if (d && c) {
        const normD = d.toLowerCase();
        // La vecchia logica controllava PRIMA "latino" o "latin"
        const k = (normD.includes("latino") || normD.includes("latin") || /\bla\b/.test(normD)) ? "latino" : 
                  (normD.includes("standard") || /\bstd\b/.test(normD)) ? "standard" : "combinata";
        vecchiDiscInfo[k] = c.toUpperCase();
    }
}

console.log("RISULTATO VECCHIA LOGICA (BUG):");
console.log(JSON.stringify(vecchiDiscInfo, null, 2));


// ==========================================
// 2. NUOVA LOGICA (CORRETTA)
// ==========================================
const nuoviDiscInfo: Record<string, string> = {};
for (let i = 1; i <= 3; i++) {
    const d = (athleteData as any)[`disc${i}`];
    const c = (athleteData as any)[`class${i}`];
    if (d && c) {
        const normD = d.toLowerCase();
        // La nuova logica controlla PRIMA "combinata" (come già fa il parser del singolo atleta)
        let k = "combinata"; // fallback default
        if (normD.includes("combinata") || normD.includes("10 balli")) {
            k = "combinata";
        } else if (normD.includes("latino") || normD.includes("latin") || /\bla\b/.test(normD)) {
            k = "latino";
        } else if (normD.includes("standard") || /\bstd\b/.test(normD)) {
            k = "standard";
        }
        
        nuoviDiscInfo[k] = c.toUpperCase();
    }
}

console.log("\nRISULTATO NUOVA LOGICA (CORRETTA):");
console.log(JSON.stringify(nuoviDiscInfo, null, 2));
