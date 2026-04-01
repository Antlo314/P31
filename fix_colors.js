const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\aarons\\.gemini\\antigravity\\scratch\\P31\\src\\pages';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.css') && file !== 'Home.css') { // Home.css was already completely rewritten
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    
    // Replace white colors with primary plum colors
    content = content.replace(/var\(--pure-white\)/g, 'var(--primary)');
    content = content.replace(/rgba\(255,\s*255,\s*255/g, 'rgba(50, 14, 44');
    
    // Remove explicit hardcoded dark backgrounds
    content = content.replace(/background-color:\s*var\(--royal-plum\);/g, 'background-color: var(--surface);');
    content = content.replace(/background:\s*var\(--royal-plum\);/g, 'background: var(--surface);');
    
    // Fix any borders that were explicitly white/low opacity white meant for dark backgrounds
    content = content.replace(/border-bottom:\s*1px solid rgba\(50, 14, 44,0.05\);/g, 'border-bottom: 1px solid var(--outline-variant);');
    content = content.replace(/border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.05\);/g, 'border-bottom: 1px solid var(--outline-variant);');

    fs.writeFileSync(path.join(dir, file), content);
  }
});
console.log('Fixed CSS colors for light theme.');
