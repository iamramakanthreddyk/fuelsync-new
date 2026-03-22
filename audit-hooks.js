const fs = require('fs');
const path = require('path');

const hooksDir = './src/hooks';
const files = fs.readdirSync(hooksDir).filter(f => f.startsWith('use')).sort();

let good = 0, mixed = 0, bad = 0;
const goodHooks = [];
const mixedHooks = [];
const badHooks = [];

files.forEach(file => {
  const filePath = path.join(hooksDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasUseQuery = content.includes('useQuery');
  const hasApiClient = content.includes('apiClient.');
  const hasService = content.includes('Service');
  const hasInlineState = content.includes('useState');
  
  if (hasUseQuery && hasService && !hasInlineState) {
    good++;
    goodHooks.push(file);
  } else if ((hasUseQuery) && hasApiClient && hasService) {
    mixed++;
    mixedHooks.push(file);
  } else if (hasApiClient && hasInlineState) {
    bad++;
    badHooks.push(file);
  }
});

console.log('\n================== FRONTEND HOOKS AUDIT - PHASE 5a ==================\n');
console.log('Total hooks: ' + files.length);
console.log('GOOD (delegates to service): ' + good + ' (' + Math.round(good/files.length*100) + '%)');
console.log('MIXED (some inline, some delegated): ' + mixed + ' (' + Math.round(mixed/files.length*100) + '%)');
console.log('BAD (mostly inline API calls): ' + bad + ' (' + Math.round(bad/files.length*100) + '%)');

console.log('\n========== REFACTORING BATCHES ==========\n');
console.log('Batch 1 (Easy - Improve Good): ' + good + ' hooks');
console.log('  Tasks: Add types, improve docs, add error handling');
console.log('  Effort: 30 min | Impact: +5% quality\n');

console.log('Batch 2 (Medium - Fix Mixed): ' + mixed + ' hooks');
console.log('  Tasks: Extract API calls from hooks to services');
console.log('  Effort: 2 hours | Impact: +40% quality\n');

console.log('Batch 3 (Hard - Decompose Bad): ' + bad + ' hooks');
console.log('  Tasks: Extract hooks into service + hook pattern');
console.log('  Effort: 3 hours | Impact: +50% quality\n');

if (good > 0) {
  console.log('\nGood hooks (' + good + '):');
  goodHooks.slice(0, 5).forEach(h => console.log('  - ' + h));
  if (good > 5) console.log('  ... and ' + (good - 5) + ' more');
}

if (mixed > 0) {
  console.log('\nMixed hooks (' + mixed + '):');
  mixedHooks.slice(0, 5).forEach(h => console.log('  - ' + h));
  if (mixed > 5) console.log('  ... and ' + (mixed - 5) + ' more');
}

if (bad > 0) {
  console.log('\nBad hooks (' + bad + '):');
  badHooks.slice(0, 5).forEach(h => console.log('  - ' + h));
  if (bad > 5) console.log('  ... and ' + (bad - 5) + ' more');
}

console.log('\n========== EXECUTION PLAN ==========\n');
console.log('Phase 5b.1: Service layer consolidation (1 hour)');
console.log('  - Audit service files for coverage gaps');
console.log('  - Create/complete missing service methods');
console.log('  - Add error handling to all services\n');

console.log('Phase 5b.2: MIXED hook refactoring (2 hours)');
console.log('  - Extract API calls from ' + mixed + ' hooks into services');
console.log('  - Convert to pure React Query wrappers');
console.log('  - Add consistent error handling\n');

console.log('Phase 5b.3: BAD hook decomposition (3 hours)');
console.log('  - Extract ' + bad + ' hooks into service + hook pattern');
console.log('  - Remove manual state management');
console.log('  - Simplify component logic\n');

console.log('Phase 5d: Component integration (1-2 hours)');
console.log('  - Update components to use refactored hooks');
console.log('  - Test integration');
console.log('  - Verify error handling\n');

console.log('Total Estimated Time: 6-7 hours for complete modernization\n');
console.log('AUDIT COMPLETE\n');
