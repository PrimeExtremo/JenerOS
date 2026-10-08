// Source artwork and corner mark stay shared with the setup wizard.
const fs = require('node:fs');
const path = require('node:path');
const dashboard = path.resolve(__dirname, '../../[DASHBOARD]');
const ribbon = fs.readFileSync(path.join(dashboard, 'wallpaper-ribbon.svg'), 'utf8')
  .replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
const logo = fs.readFileSync(path.join(dashboard, 'logo.svg'), 'utf8');
const paths = [...logo.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map(match => `<path d="${match[1]}"/>`).join('\n      ');
// The wizard displays the 512px logo canvas at 28px, opacity .7.
// Anchor the painted bounds (x=96..416, y=80..432), not the padded canvas.
const scale = 28 / 512;
for (const width of [3440, 2560]) for (const theme of ['dark', 'light']) {
  const height = 1440;
  const x = width - 40 - 416 * scale, y = height - 80 - 432 * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">JenerOS warm ribbons — ${theme}, ${width} × ${height}</title>
  <desc id="desc">Wide warm brown swooshes with a quiet center and a small angular J above the bottom-right taskbar.</desc>
  <rect width="${width}" height="${height}" fill="${theme === 'dark' ? '#1F1913' : '#F6F1E7'}"/>
  <!-- Expand the wizard ribbons across the whole desktop, without cropping. -->
  <svg width="${width}" height="${height}" viewBox="0 0 1600 1000" preserveAspectRatio="none" fill="none">
    <g opacity="${theme === 'dark' ? '1' : '.23'}">
      ${ribbon}
    </g>
  </svg>
  <!-- Painted right/bottom edges: ${width - 40}, ${height - 80}. -->
  <g id="corner-mark" fill="${theme === 'dark' ? '#E9E9E2' : '#16161D'}" opacity=".7" transform="translate(${x} ${y}) scale(${scale})">
      ${paths}
  </g>
</svg>
`;
  fs.writeFileSync(path.join(__dirname, `jeneros-ribbons-${width}x${height}-${theme}.svg`), svg);
}
console.log('Regenerated four self-contained desktop SVGs.');
