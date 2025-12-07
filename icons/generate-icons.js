const fs = require('fs');
const path = require('path');

// This script requires canvas package: npm install canvas
// If canvas is not available, use the HTML generator instead

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
    try {
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Dark forest green background
        ctx.fillStyle = '#1B4D3E';
        ctx.fillRect(0, 0, size, size);

        // Calculate text size based on icon size
        const fontSize = size * 0.234; // A/M font size (larger for visibility)
        const centerX = size / 2;
        const centerY = size / 2;

        // A/M text - clean sans-serif, caps
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A/M', centerX, centerY);

        // Save to file
        const buffer = canvas.toBuffer('image/png');
        const filename = `icon-${size}x${size}.png`;
        const filepath = path.join(__dirname, filename);
        fs.writeFileSync(filepath, buffer);
        console.log(`✅ Generated ${filename}`);
        
        return true;
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('⚠️  Canvas module not found. Please use generate-icons.html instead.');
            console.log('   Or install canvas: npm install canvas');
            return false;
        }
        throw error;
    }
}

// Generate all icons
console.log('Generating PWA icons...\n');
let successCount = 0;

sizes.forEach(size => {
    if (generateIcon(size)) {
        successCount++;
    }
});

if (successCount === sizes.length) {
    console.log(`\n✅ Successfully generated all ${sizes.length} icons!`);
} else if (successCount === 0) {
    console.log('\n⚠️  Could not generate icons. Please use generate-icons.html in a browser.');
}

