// download.js
const youtubedl = require('youtube-dl-exec');
const path = require('path');

async function downloadAudio(url, outputDir) {
  const outputTemplate = path.resolve(outputDir, '%(title)s.%(ext)s');

  console.log(`Descargando y extrayendo audio de: ${url}`);
  await youtubedl(
    url,
    {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0, // mejor calidad
      output: outputTemplate,
    }
  );

  console.log(`¡Audio guardado en: ${outputDir}`);
}

// Uso: node download.js <URL_YOUTUBE> [directorio_salida]
const [url, outputDir = __dirname] = process.argv.slice(2);

if (!url) {
  console.error('Uso: node download.js <URL_YOUTUBE> [directorio_salida]');
  process.exit(1);
}

downloadAudio(url, outputDir)
  .catch(err => console.error('Error en descarga:', err));
