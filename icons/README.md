# PWA Icons

This directory should contain the following icon files for the Progressive Web App:

- `icon-72x72.png` (72x72 pixels)
- `icon-96x96.png` (96x96 pixels)
- `icon-128x128.png` (128x128 pixels)
- `icon-144x144.png` (144x144 pixels)
- `icon-152x152.png` (152x152 pixels)
- `icon-192x192.png` (192x192 pixels) - **Required for Android**
- `icon-384x384.png` (384x384 pixels)
- `icon-512x512.png` (512x512 pixels) - **Required for Android**

## How to Generate Icons

### Option 1: Using Online Tools
1. Create a square logo/image (at least 512x512 pixels) with your brand colors (#1B4D3E)
2. Use an online PWA icon generator like:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
   - https://www.favicon-generator.org/

### Option 2: Using Image Editing Software
1. Create a 512x512 pixel image with your logo
2. Export/resize to all required sizes
3. Save as PNG files with the names listed above

### Option 3: Using Command Line (ImageMagick)
```bash
# If you have a source image (icon-source.png)
convert icon-source.png -resize 72x72 icon-72x72.png
convert icon-source.png -resize 96x96 icon-96x96.png
convert icon-source.png -resize 128x128 icon-128x128.png
convert icon-source.png -resize 144x144 icon-144x144.png
convert icon-source.png -resize 152x152 icon-152x152.png
convert icon-source.png -resize 192x192 icon-192x192.png
convert icon-source.png -resize 384x384 icon-384x384.png
convert icon-source.png -resize 512x512 icon-512x512.png
```

## Icon Design Guidelines

- Use the brand color: **#1B4D3E** (dark green)
- Keep the design simple and recognizable at small sizes
- Ensure good contrast for visibility
- Consider using the "APPAREL MODEST" text or initials "AM"
- Icons should be square with some padding (don't fill the entire square)

## Temporary Solution

If you need to test the PWA immediately, you can:
1. Create a simple colored square image (512x512) with #1B4D3E background
2. Add white text "AM" or "Apparel Modest" in the center
3. Resize to all required sizes
4. The PWA will work even with simple placeholder icons

