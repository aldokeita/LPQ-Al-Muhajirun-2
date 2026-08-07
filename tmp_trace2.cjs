const fs = require('fs');
const f = 'src/pages/HijaiyahGamePage.jsx';
let c = fs.readFileSync(f, 'utf8');
const component = fs.readFileSync('tmp_tracing_component.txt', 'utf8');

const startMarker = 'const TracingStage = ({ letter, harakat, reading, accent, onNext }) => {';
const endMarker = 'const MatchingStage = ({ target, targetHarakat, letterOptions, harakatOptions, accent, onNext }) => {';
const start = c.indexOf(startMarker);
const end = c.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) { console.log('MARKERS NOT FOUND', start, end); process.exit(1); }

const newFile = c.slice(0, start) + component + '\n\n' + c.slice(end);
fs.writeFileSync(f, newFile);
console.log('TracingStage replaced');
