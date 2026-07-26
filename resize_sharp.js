const sharp = require('sharp');

async function processImage() {
  try {
    // 512x512
    await sharp('public/logoadm.png')
      .resize(512, 512, { fit: 'contain', background: { r: 30, g: 64, b: 175, alpha: 1 } }) // background #1e40af (blue to match manifest theme)
      .toFile('public/logoadm-512.png');
      
    // 192x192
    await sharp('public/logoadm.png')
      .resize(192, 192, { fit: 'contain', background: { r: 30, g: 64, b: 175, alpha: 1 } })
      .toFile('public/logoadm-192.png');
      
    console.log('Images resized perfectly square with Sharp.');
  } catch (err) {
    console.error(err);
  }
}

processImage();
