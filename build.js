// Build: setzt src/-Teile zur Einzeldatei MSFS_Airport_Scout.html zusammen.
// Reihenfolge der Teile: part00, part01, ... (lexikalisch, zweistellig).
const fs = require('fs'), path = require('path');

function cat(group) {
  const dir = path.join('src', group);
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(group + '.part'))
    .sort();
  return files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
}

const tpl  = fs.readFileSync('src/template.html', 'utf8');
const data = cat('data');
const geo  = cat('geo');

if (!tpl.includes('/*__DATA__*/') || !tpl.includes('/*__GEO__*/'))
  throw new Error('Marker im Template fehlen');

const html = tpl
  .replace('/*__DATA__*/', () => data)
  .replace('/*__GEO__*/', () => geo);

fs.writeFileSync('MSFS_Airport_Scout.html', html);
console.log('Build ok:', html.length, 'Zeichen');