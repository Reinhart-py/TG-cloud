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

console.log(chalk.blue('Starting Encryption Protocol...'));

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  numbersToExpressions: true,
  simplify: true,
  stringArrayShuffle: true,
  splitStrings: true,
  stringArrayThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  selfDefending: true,
  disableConsoleOutput: false
};

function protectFile(filePath, outputDir) {
  const code = fs.readFileSync(filePath, 'utf8');
  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
  const fileName = path.basename(filePath);
  fs.writeFileSync(path.join(outputDir, fileName), obfuscationResult.getObfuscatedCode());
  console.log(chalk.green(`  [SECURED] ${fileName}`));
}

fs.readdirSync(SRC_DIR).forEach(file => {
  if (file.endsWith('.js')) {
    protectFile(path.join(SRC_DIR, file), path.join(DIST_DIR, 'src'));
  }
});

protectFile('mika.js', DIST_DIR);

fs.copyFileSync('package.json', path.join(DIST_DIR, 'package.json'));

console.log(chalk.bold.magenta('\nBUILD COMPLETE.'));
console.log(chalk.white(`Your secure tool is in the '${DIST_DIR}' folder.`));