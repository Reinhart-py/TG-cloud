const gradient = require('gradient-string');
const figlet = require('figlet');
const clear = require('clear');
const chalk = require('chalk');
const boxen = require('boxen');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const renderTitle = () => {
    clear();
    const txt = figlet.textSync('BusinessUI', { font: 'Slant' });
    console.log(gradient.pastel.multiline(txt));
    console.log(gradient.cristal('         Corporate Account Manager | Enterprise Edition'));
    console.log(chalk.hex('#444444')('─────────────────────────────────────────────────────────────'));
};

const displayInfoBox = (header, content, style = 'info') => {
    const borderColor = style === 'error' ? 'red' : style === 'success' ? 'green' : 'cyan';
    console.log(boxen(content, {
        title: header,
        titleAlignment: 'center',
        borderStyle: 'round',
        borderColor: borderColor,
        padding: 1,
        margin: 1
    }));
};

const startLoadingTask = async (text, duration = 2000) => {
    const ora = require('ora');
    const spinner = ora({
        text: chalk.blue(text),
        spinner: 'dots'
    }).start();
    
    await sleep(duration);
    spinner.succeed(chalk.green('Task completed.'));
};

module.exports = { renderTitle, displayInfoBox, startLoadingTask, sleep };
