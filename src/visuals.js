const gradient = require('gradient-string');
const figlet = require('figlet');
const clear = require('clear');
const chalk = require('chalk');
const boxen = require('boxen');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const renderTitle = () => {
  clear();
  const txt = figlet.textSync('MIKA', { font: 'Slant' });
  console.log(gradient.pastel.multiline(txt));
  console.log(gradient.cristal('         Created by Reinhart | v69.4.20 | No Sleep Edition'));
  console.log(chalk.hex('#444444')('─────────────────────────────────────────────────────────────'));
};

const sexyBox = (header, content, style = 'info') => {
  const border = style === 'bad' ? 'red' : style === 'good' ? 'green' : 'cyan';
  console.log(boxen(content, {
    title: header,
    titleAlignment: 'center',
    borderStyle: 'bold',
    borderColor: border,
    padding: 1,
    margin: 1,
    float: 'center'
  }));
};

const crazyLoader = async (text, duration = 2000) => {
  const ora = require('ora');
  const spinner = ora({
    text: chalk.yellow(text),
    spinner: 'grenade'
  }).start();
  
  await sleep(duration);
  
  if (Math.random() > 0.9) {
    spinner.fail(chalk.red('Wait... sh*t.'));
    await sleep(500);
    spinner.text = chalk.green('Just kidding, we good.');
    spinner.start();
    await sleep(800);
  }
  spinner.succeed(chalk.green('Done.'));
};

module.exports = { renderTitle, sexyBox, crazyLoader, sleep };