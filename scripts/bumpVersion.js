const fs = require('fs');
const path = require('path');
const pbivizPath = path.join(__dirname, '..', 'pbiviz.json');
const pbiviz = JSON.parse(fs.readFileSync(pbivizPath, 'utf8'));
let parts = pbiviz.visual.version.split('.').map(n => parseInt(n, 10));
if (parts.length < 4) {
  while (parts.length < 4) parts.push(0);
}
parts[3] += 1;
pbiviz.visual.version = parts.join('.');
fs.writeFileSync(pbivizPath, JSON.stringify(pbiviz, null, 2));
console.log('Bumped version to', pbiviz.visual.version);

