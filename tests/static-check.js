const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const failures = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === '.git') return [];
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(root).filter(file => /\.(?:html|js|json)$/.test(file));

for (const file of files) {
  const relative = path.relative(root, file);
  const source = fs.readFileSync(file, 'utf8');

  if (relative !== path.join('tests', 'static-check.js') && source.includes('[cite:')) failures.push(`${relative}: contains an invalid citation token`);

  if (file.endsWith('.json')) {
    try { JSON.parse(source); } catch (error) { failures.push(`${relative}: invalid JSON (${error.message})`); }
  } else if (file.endsWith('.js')) {
    try { new Function(source); } catch (error) { failures.push(`${relative}: invalid JavaScript (${error.message})`); }
  } else {
    const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIndex = 0;
    while ((match = scriptPattern.exec(source))) {
      scriptIndex += 1;
      try { new Function(match[1]); } catch (error) {
        failures.push(`${relative}: inline script ${scriptIndex} is invalid (${error.message})`);
      }
    }

    if (!relative.includes(path.sep) && source.includes('src="../assets/gas-sync.js"')) {
      failures.push(`${relative}: root page points outside the repository for gas-sync.js`);
    }
  }
}

const sandbox = {
  localStorage: { getItem: () => null },
  window: { location: { search: '' } },
  URLSearchParams,
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/gas-sync.js'), 'utf8'), sandbox);

const helperCases = [
  ['contract extension is added', "getContractDurationDays({durationDays:140,totalExtendedDays:30})", 170],
  ['durationWeeks fallback', "getContractDurationDays({durationWeeks:20,extensionDays:7})", 147],
  ['on-plan status', "getProgressStatus(50,50)", 'ตามแผน'],
  ['behind-plan status', "getProgressStatus(40,50)", 'ช้ากว่าแผน'],
  ['scoped progress key', "getWeeklyProgressKey(2,'PROJ_X','SEP_2569')", 'WEEK_PROGRESS_DATA_PROJ_X_SEP_2569_2']
];

for (const [name, expression, expected] of helperCases) {
  const actual = vm.runInContext(expression, sandbox);
  if (actual !== expected) failures.push(`${name}: expected ${expected}, got ${actual}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Static checks passed for ${files.length} code/data files.`);
