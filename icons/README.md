# PWA Icons for Apparel Modest

This directory contains the icons needed for the Progressive Web App (PWA).

## Required Icons

The following icon sizes are required:
- 72x72.png
- 96x96.png
- 128x128.png
- 144x144.png
- 152x152.png
- 192x192.png
- 384x384.png
- 512x512.png

## Generating Icons

### Method 1: Using the HTML Generator (Recommended)

1. Open `generate-icons.html` in your web browser
2. Click "Generate Icons" (icons will auto-generate on page load)
3. Click "Download All Icons" to download all icon files
4. Move the downloaded files to this `icons/` directory

### Method 2: Using Node.js Script

If you have Node.js installed:

1. Install the canvas package: `npm install canvas`
2. Run: `node generate-icons.js`
3. The icons will be generated in this directory

### Method 3: Manual Creation

You can also create icons manually using the `logo.svg` file as a reference:
- Use any image editor (Photoshop, GIMP, Figma, etc.)
- Open `logo.svg` or use the design specifications
- Export icons at the required sizes
- Save them with the naming convention: `icon-{size}x{size}.png`

## Logo Design

The logo features:
- Dark forest green background (#1B4D3E)
- "A/M" text in white, sans-serif, bold, all caps

## Icon Requirements

- Format: PNG
- Background: #1B4D3E (dark forest green)
- Text: White (#FFFFFF)
- All icons should be square and properly sized
