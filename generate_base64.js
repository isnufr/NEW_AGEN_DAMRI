const sharp = require('sharp');
const fs = require('fs');

async function processImage() {
  try {
    const inputPath = 'c:\\src\\PAC-KAWUNGANTEN-APPS\\logo.png';
    const outputPath = 'c:\\src\\PAC-KAWUNGANTEN-APPS\\Logo.html';
    
    // Resize image to 256x256 for optimal loading speed in Apps Script
    const buffer = await sharp(inputPath)
      .resize(256, 256, { fit: 'inside' })
      .toFormat('png')
      .toBuffer();
      
    const base64String = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64String}`;
    
    const htmlContent = `<script>\n  const APP_LOGO = "${dataUri}";\n</script>`;
    
    fs.writeFileSync(outputPath, htmlContent, 'utf8');
    console.log('Logo optimized and saved as Logo.html successfully.');
  } catch (err) {
    console.error('Failed to process image:', err);
  }
}

processImage();
