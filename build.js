const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const chalk = require('chalk');

const DIST_DIR = './dist';
const SRC_DIR = './src';

if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);
fs.mkdirSync(path.join(DIST_DIR, 'src'));

console.log(chalk.blue('Starting Encryption Protocol (Mobile Optimized)...'));

const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.8, // Reduced from 1.0 to save CPU
    numbersToExpressions: true,
    simplify: true,
    stringArray: true,
    stringArrayEncoding: ['rc4'], // Keep the database URL encrypted
    stringArrayThreshold: 1,
    splitStrings: true,
    splitStringsChunkLength: 5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    selfDefending: true,
    
    // CRITICAL FIXES:
    debugProtection: false,      // Disabled to prevent freezing on Termux
    disableConsoleOutput: false, // Disabled so you can actually see the UI
    target: 'node'
};

function protectFile(filePath, outputDir) {
    const code = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    console.log(chalk.yellow(`   [encrypting] ${fileName}...`));
    
    try {
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
        fs.writeFileSync(path.join(outputDir, fileName), obfuscationResult.getObfuscatedCode());
        console.log(chalk.green(`   [LOCKED] ${fileName}`));
    } catch (e) {
        console.log(chalk.red(`   [FAIL] Could not encrypt ${fileName}: ${e.message}`));
    }
}

fs.readdirSync(SRC_DIR).forEach(file => {
    if (file.endsWith('.js')) {
        protectFile(path.join(SRC_DIR, file), path.join(DIST_DIR, 'src'));
    }
});

protectFile('mika.js', DIST_DIR);

fs.copyFileSync('package.json', path.join(DIST_DIR, 'package.json'));

console.log(chalk.bold.magenta('\nBUILD COMPLETE.'));
console.log(chalk.white(`Your armored tool is in '${DIST_DIR}'.`));
