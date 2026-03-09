const { CreateFileWebpack } = require('./.tools/CreateFileWebpack');
const PACKAGE = require('./package.json');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const WebpackFreeTexPacker = require('webpack-free-tex-packer');
const fs = require('fs');
const path = require('path');
const buildPath = path.resolve(__dirname, 'dist');
const webpack = require("webpack");
const ImageminPlugin = require('image-minimizer-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const WorkboxPlugin = require('workbox-webpack-plugin');
const JSONC = require('jsonc-parser');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// --- LÓGICA DE FILTRADO DE ASSETS ---
const selectedBundleName = process.env.GAME_BUNDLE; // Ejemplo: "patagonia"
const assetsJsoncPath = path.resolve(__dirname, 'src/assets.jsonc');
const assetsContent = fs.readFileSync(assetsJsoncPath, 'utf8');
const assetsData = JSONC.parse(assetsContent);

const copyPatterns = [];

if (selectedBundleName) {
    console.log(`\x1b[32m%s\x1b[0m`, `🚀 Building bundle: ${selectedBundleName}`);
    
    // Filtramos los bundles: el seleccionado + los obligatorios
    const activeBundles = assetsData.filter(b => 
        b.name === selectedBundleName || b.name === "donotdelete"
    );

    activeBundles.forEach(bundle => {
        Object.values(bundle.assets).forEach(assetPath => {
            // Limpiamos el path (quitamos el ./ inicial)
            const cleanPath = assetPath.replace(/^\.\//, '');
            copyPatterns.push({
                from: path.resolve(__dirname, 'assets', cleanPath),
                to: cleanPath,
                noErrorOnMissing: true,
                // Mantenemos tu lógica de minificar JSONs internos si existen
                transform: (content, filePath) => {
                    if (filePath.endsWith('.json')) {
                        return Buffer.from(JSON.stringify(JSON.parse(content.toString())), 'utf8');
                    }
                    return content;
                }
            });
        });
    });
} else {
    // Si no hay bundle seleccionado, copiamos todo (comportamiento original)
    copyPatterns.push({
        from: 'assets', to: '', globOptions: {
            ignore: ["**/thumbs.db", "**/Thumbs.db"],
        },
        transform: function (content, path) {
            if (path.endsWith('.json')) {
                return Buffer.from(JSON.stringify(JSON.parse(content.toString())), 'utf8');
            }
            return content;
        }
    });
}

// Siempre incluimos el assets.jsonc transformado a json
copyPatterns.push({
    from: "src/assets.jsonc", to: "assets.json",
    transform: function (content) {
        return Buffer.from(JSON.stringify(JSONC.parse(content.toString())), 'utf8');
    }
});

const copyPlugin = new CopyWebpackPlugin({ patterns: copyPatterns });
// --------------------------------------

const providePlugin = new webpack.ProvidePlugin({
    THREE: 'three'
});

const dirMain = path.resolve(__dirname, 'atlas');
const atlasPackages = [];
const manifest = [];

const readDirMain = fs.readdirSync(dirMain);

readDirMain.forEach((dirNext) => {
    // OPTIMIZACIÓN ATLAS: Solo empaquetamos el atlas si coincide con el bundle o es común
    const shouldPackAtlas = !selectedBundleName || dirNext === selectedBundleName || dirNext === "common";

    if (shouldPackAtlas && fs.lstatSync(dirMain + "/" + dirNext).isDirectory() && fs.readdirSync(dirMain + "/" + dirNext).length > 0) {
        const texPackerPlugin = new WebpackFreeTexPacker(path.resolve(dirMain, dirNext), "atlas", {
            textureName: dirNext,
            width: 2048,
            height: 2048,
            fixedSize: false,
            powerOfTwo: true,
            padding: 2,
            allowRotation: true,
            detectIdentical: true,
            allowTrim: true,
            exporter: "Pixi",
            removeFileExtension: false,
            prependFolderName: true,
            packer: "OptimalPacker",
            omitZeroIndex: true
        });
        atlasPackages.push(texPackerPlugin);
        manifest.push({ name: dirNext, url: "atlas/" + dirNext + ".json" })
    }
});

const texPackerManifest = new CreateFileWebpack({
    outputFile: 'atlas/autoPackedAtlas.json',
    content: JSON.stringify(manifest)
});

const htmlPlugin = new HTMLWebpackPlugin({
    template: 'src/index.ejs',
    filename: 'index.html',
    templateParameters: { PACKAGE: PACKAGE, buildDate: new Date() },
    hash: true,
    minify: false
});

const definePlugin = new webpack.DefinePlugin({
    'process.env.DATE': Date.now(),
    'process.env.GAME_BUNDLE': JSON.stringify(selectedBundleName) // Pasamos la variable al código fuente también
});

// ... (Resto de los plugins: defaultCompression, pwaManifest, pwaWorker, typeChecker se mantienen igual)
const defaultCompression = new ImageminPlugin({
    minimizer: {
        implementation: ImageminPlugin.sharpMinify,
        options: {
            encodeOptions: {
                jpeg: { quality: 90 },
                webp: { nearLossless: true },
                avif: { lossless: true },
                png: { adaptiveFiltering: true, quality: 100, compressionLevel: 7 },
                gif: { reoptimise: true },
            },
        },
    },
});


const pwaManifest = new WebpackPwaManifest({
    name: PACKAGE.pwa.name,
    short_name: PACKAGE.pwa.short_name,
    description: PACKAGE.pwa.description,
    background_color: PACKAGE.pwa.background_color,
    crossorigin: 'use-credentials', //I think this must remain like this....
    orientation: "landscape",
    icons: [
        {
            src: path.resolve('icon.png'),
            sizes: [96, 120, 128, 144, 152, 180, 192, 256, 384, 512], // multiple sizes
            purpose: 'any maskable'
        }
    ],
    ios: true
})

const pwaWorker = new WorkboxPlugin.GenerateSW({
    swDest: 'sw.js',
    // these options encourage the ServiceWorkers to get in there fast 
    // and not allow any straggling "old" SWs to hang around
    clientsClaim: true,
    skipWaiting: true,
    cacheId: PACKAGE.name,
    cleanupOutdatedCaches: true
});

const typeChecker = new ForkTsCheckerWebpackPlugin();

exports.providePlugin = providePlugin;
exports.copyPlugin = copyPlugin;
exports.htmlPlugin = htmlPlugin;
exports.definePlugin = definePlugin;
exports.atlasPackages = atlasPackages;
exports.texPackerManifest = texPackerManifest;
exports.defaultCompression = defaultCompression;
exports.pwaManifest = pwaManifest;
exports.pwaWorker = pwaWorker;
exports.typeChecker = typeChecker;

exports.config = {
    stats: 'minimal',
    entry: './src/index.ts',
    devServer: {
        compress: true, static: false,
        client: { logging: "warn", overlay: { errors: false, warnings: false }, progress: true },
        port: 3000, hot: true, host: '0.0.0.0'
    },
    experiments: { asyncWebAssembly: true, syncWebAssembly: true },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'esbuild-loader',
                options: { loader: 'ts', target: 'es2015' },
                exclude: /node_modules/
            },
            {
                test: /\.((frag)|(vert))$/,
                use: 'raw-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: { root: __dirname, src: path.resolve(__dirname, 'src') },
        fallback: {
            path: false, fs: false,
            zlib: require.resolve("browserify-zlib"),
            http: require.resolve("stream-http")
        }
    },
    plugins: [
        providePlugin,
        copyPlugin,
        ...atlasPackages,
        texPackerManifest,
        typeChecker,
        htmlPlugin,
        definePlugin,
    ],
    performance: { hints: false },
    output: { filename: 'main.js', path: buildPath }
}