import * as fs from 'fs';
import * as path from 'path';

function searchFiles(dir, term) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
          results = results.concat(searchFiles(fullPath, term));
        }
      } else {
        if (file.toLowerCase().includes(term.toLowerCase())) {
          results.push(fullPath);
        }
      }
    });
  } catch (e) {
    // Ignore errors
  }
  return results;
}

const workspaceDir = 'c:\\Users\\david\\Downloads\\Antigravity\\Dance Manager';
const parentDir = 'c:\\Users\\david\\Downloads\\Antigravity';

console.log("Searching for files containing 'password' in workspace...");
const workspaceResults = searchFiles(workspaceDir, 'password');
console.log("Workspace results:", workspaceResults);

console.log("\nSearching for files containing 'password' in parent folder...");
const parentResults = searchFiles(parentDir, 'password');
console.log("Parent folder results:", parentResults);
