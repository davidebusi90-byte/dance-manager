import XLSX from 'xlsx';

function readExcel() {
  console.log("=== READING PASSWORD EXCEL FILE ===");
  try {
    const workbook = XLSX.readFile('Password Dance Manager.xlsx');
    const sheetName = workbook.SheetNames[0];
    console.log("Sheet Name:", sheetName);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log("Total rows found:", jsonData.length);
    console.log("First row example:", jsonData[0]);
    console.log("Headers:", Object.keys(jsonData[0] || {}));
    
    // Print all rows so we can check the contents
    console.log("\nAll rows:");
    jsonData.forEach((row, index) => {
      console.log(`[${index}]`, row);
    });
  } catch (error) {
    console.error("Error reading Excel:", error);
  }
}

readExcel();
