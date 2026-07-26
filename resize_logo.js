const Jimp = require('jimp');

async function processImage() {
  try {
    const image = await Jimp.read('public/logoadm.png');
    // Resize to 512x512, covering the area to make it square
    image.cover(512, 512).write('public/logoadm-512.png');
    
    const image192 = await Jimp.read('public/logoadm.png');
    image192.cover(192, 192).write('public/logoadm-192.png');
    
    console.log('Images resized successfully.');
  } catch (err) {
    console.error(err);
  }
}

processImage();
