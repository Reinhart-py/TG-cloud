const fs = require('fs');
const path = require('path');
const { Select, Input, Toggle } = require('enquirer');
const chalk = require('chalk');
const open = require('open');

const visuals = require('./src/visuals');
const security = require('./src/security');
const storage = require('./src/storage');
const engineModule = require('./src/engine');

const renderTitle = visuals.renderTitle || (() => {});
const displayBox = visuals.displayBox || visuals.sexyBox || console.log;
const showLoader = visuals.showLoader || visuals.crazyLoader || (async () => {});

const verifySystem = security.verifySystem || security.vibeCheck;
const saveKey = security.saveKey;
const verifyKey = security.verifyKey || security.verifyKeyPayload;

const initStorage = storage.initStorage;
const getNotificationToken = storage.getNotificationToken || storage.getSystemToken;
const saveSession = storage.saveSession || storage.buryBody;
const getSessions = storage.getSessions || storage.digUpBodies;
const deleteSession = storage.deleteSession || storage.burnBody;
const getCloudConfig = storage.getCloudConfig;
const setCloudConfig = storage.setCloudConfig;

const EngineClass = engineModule.AccountManager || engineModule.WarMachine;

const API_BASE_URL = 'https://mika-backend.vercel.app/api';
const LICENSE_FILE_PATH = path.resolve(process.cwd(), 'license.key');

let notificationToken = null;

const terminateProcess = () => {
    try {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    } catch (_) {}
    process.stdin.destroy();
    process.exit(0);
};

process.on('SIGINT', terminateProcess);
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const authenticateLicense = async () => {
    let authState = await verifySystem();
    let validKey = '';

    if (authState && authState.passed) {
        try {
            validKey = fs.readFileSync(LICENSE_FILE_PATH, 'utf8').trim();
        } catch (_) {}
    }

    if (!authState || !authState.passed) {
        const failureReason = authState && authState.msg ? authState.msg : 'Invalid license';
        displayBox('AUTHENTICATION REQUIRED', `Status: ${failureReason}`, 'bad');
        console.log(chalk.yellow('  Please provide a valid license key to continue.'));

        while (!authState || !authState.passed) {
            try {
                const keyPrompt = new Input({ message: 'Enter License Key:' });
                const enteredKey = (await keyPrompt.run()).trim();

                if (!enteredKey) {
                    continue;
                }

                await showLoader('Verifying license key with server...');
                const checkResult = await verifyKey(enteredKey);

                if (checkResult && checkResult.passed) {
                    await saveKey(enteredKey);
                    authState = checkResult;
                    validKey = enteredKey;
                    displayBox('ACCESS GRANTED', 'License key validated successfully.', 'good');
                } else {
                    const message = checkResult && checkResult.msg ? checkResult.msg : 'Key verification failed';
                    console.log(chalk.red(`  Verification failed: ${message}`));

                    const retryPrompt = new Select({
                        message: 'Would you like to try again?',
                        choices: ['Yes', 'No (Exit)']
                    });

                    const retryChoice = await retryPrompt.run();
                    if (retryChoice === 'No (Exit)') {
                        terminateProcess();
                    }
                }
            } catch (_) {
                terminateProcess();
            }
        }
    }

    authState.licenseKey = validKey;
    return authState;
};

const setupEnvironment = async () => {
    initStorage(API_BASE_URL);
    renderTitle();

    const identity = await authenticateLicense();
    const accountOwner = identity.owner || 'User';

    await showLoader(`Loading configuration for ${accountOwner}...`, 1000);

    let cloudConfig;
    try {
        cloudConfig = await getCloudConfig(identity.licenseKey);
        notificationToken = await getNotificationToken(identity.licenseKey);
    } catch (_) {
        displayBox('SERVICE ERROR', 'Unable to connect to the configuration API.', 'bad');
        terminateProcess();
    }

    let apiId = cloudConfig ? cloudConfig.api_id : null;
    let apiHash = cloudConfig ? cloudConfig.api_hash : null;

    if (!apiId || !apiHash) {
        console.log(chalk.yellow('\n--- TELEGRAM API SETUP ---'));
        try {
            const apiIdPrompt = new Input({ message: 'Telegram API ID:' });
            apiId = await apiIdPrompt.run();

            const apiHashPrompt = new Input({ message: 'Telegram API Hash:' });
            apiHash = await apiHashPrompt.run();

            await setCloudConfig(identity.licenseKey, { api_id: apiId, api_hash: apiHash });
            displayBox('CONFIGURATION SAVED', 'API credentials synchronized with cloud.', 'good');
        } catch (_) {
            terminateProcess();
        }
    }

    const engine = new EngineClass(apiId, apiHash);
    return { engine, identity };
};

const main = async () => {
    const { engine, identity } = await setupEnvironment();
    const licenseKey = identity.licenseKey;

    while (true) {
        renderTitle();
        console.log(chalk.gray(`  Session ID: ${licenseKey.substring(0, 8)}...`));

        try {
            const menuPrompt = new Select({
                name: 'action',
                message: 'Select an operation:',
                choices: [
                    '1. Login Account',
                    '2. List Accounts',
                    '3. Start Realtime Monitor',
                    '4. Delete Account Session',
                    '5. Manage Cloud Settings',
                    '6. System Information',
                    '7. Exit'
                ]
            });

            const selection = await menuPrompt.run();

            if (selection.startsWith('1.')) {
                const phonePrompt = new Input({ message: 'Phone number (international format):' });
                const phoneNumber = await phonePrompt.run();

                try {
                    console.log(chalk.blue('Initiating client login session...'));
                    const loginFn = engine.login || engine.hijack;
                    const loginResult = await loginFn.call(engine, phoneNumber);

                    await saveSession(phoneNumber, loginResult.session, loginResult.me, licenseKey);
                    displayBox('SUCCESS', `Account authorized.\nUser: ${loginResult.me.username || 'N/A'}\nID: ${loginResult.me.id}`, 'good');
                } catch (err) {
                    displayBox('FAILURE', `Login failed: ${err.message}`, 'bad');
                }
            } else if (selection.startsWith('2.')) {
                const accounts = await getSessions(licenseKey);

                if (!accounts || accounts.length === 0) {
                    console.log(chalk.gray('  No active sessions registered.'));
                } else {
                    accounts.forEach((acc, index) => {
                        console.log(chalk.cyan(`  [${index + 1}] Phone: ${acc.phone} | User: ${acc.username || 'N/A'} | ID: ${acc.uid}`));
                    });
                }
            } else if (selection.startsWith('3.')) {
                const accounts = await getSessions(licenseKey);

                if (!accounts || accounts.length === 0) {
                    console.log(chalk.red('  No accounts available to monitor.'));
                } else {
                    renderTitle();

                    const cloudConfig = await getCloudConfig(licenseKey);
                    let adminId = cloudConfig ? cloudConfig.admin_id : null;

                    if (!adminId) {
                        console.log(chalk.hex('#FFA500')('--- FORWARDING CONFIGURATION ---'));
                        console.log(chalk.gray('Configure a Telegram ID to receive message notifications.'));

                        const setupPrompt = new Toggle({
                            message: 'Configure Telegram notification recipient now?',
                            enabled: 'Yes',
                            disabled: 'No (Local display only)'
                        });

                        const wantsSetup = await setupPrompt.run();
                        if (wantsSetup) {
                            const adminPrompt = new Input({ message: 'Target Telegram User ID:' });
                            adminId = await adminPrompt.run();
                            await setCloudConfig(licenseKey, { admin_id: adminId });
                            console.log(chalk.green('  Notification target updated.'));
                        }
                    }

                    let botConfig = null;
                    if (adminId && notificationToken) {
                        console.log(chalk.hex('#FFA500')(`Forwarding incoming messages to Admin ID: ${adminId}`));
                        botConfig = { token: notificationToken, admin: adminId };
                    } else {
                        console.log(chalk.gray('Forwarding disabled. Displaying messages locally only.'));
                    }

                    console.log(chalk.green('--- MONITORING ACTIVE ---'));
                    console.log(chalk.gray('Press Ctrl+C to stop listening.'));

                    const monitorFn = engine.initializeSessions || engine.wakeUpNeo;
                    await monitorFn.call(engine, accounts, botConfig, (msg) => {
                        const phoneTag = chalk.bgBlue.white(` ${msg.phone} `);
                        const sanitizedBody = String(msg.text || '').replace(/\n/g, ' ');
                        console.log(`${phoneTag} ${chalk.yellow(msg.sender)}: ${sanitizedBody.substring(0, 80)}`);
                    });

                    await new Promise(() => {});
                }
            } else if (selection.startsWith('4.')) {
                const accounts = await getSessions(licenseKey);
                const phoneNumbers = (accounts || []).map((acc) => acc.phone);

                if (phoneNumbers.length === 0) {
                    console.log(chalk.red('  No accounts available to delete.'));
                } else {
                    const deleteSelectionPrompt = new Select({
                        message: 'Select account session to remove:',
                        choices: [...phoneNumbers, 'Cancel']
                    });

                    const targetAccount = await deleteSelectionPrompt.run();
                    if (targetAccount !== 'Cancel') {
                        renderTitle();
                        console.log(chalk.bgRed.white.bold('\n  WARNING: PERMANENT ACTION  \n'));
                        console.log(chalk.red(`  You are about to remove the session data for: ${targetAccount}`));

                        const confirmPrompt = new Toggle({
                            message: 'Proceed with session removal?',
                            enabled: 'Confirm',
                            disabled: 'Cancel'
                        });

                        const isConfirmed = await confirmPrompt.run();
                        if (isConfirmed) {
                            await deleteSession(targetAccount, licenseKey);
                            console.log(chalk.green(`  Session for ${targetAccount} has been removed.`));
                        } else {
                            console.log(chalk.gray('  Removal cancelled.'));
                        }
                    }
                }
            } else if (selection.startsWith('5.')) {
                renderTitle();
                console.log(chalk.cyan('--- CLOUD CONFIGURATION ---'));

                const cloudConfig = await getCloudConfig(licenseKey);
                const currentApiId = cloudConfig && cloudConfig.api_id ? cloudConfig.api_id : 'Not Set';
                const currentAdminId = cloudConfig && cloudConfig.admin_id ? cloudConfig.admin_id : 'Not Set';

                console.log(chalk.gray(`Telegram API ID: ${currentApiId}`));
                console.log(chalk.gray(`Admin Recipient ID: ${currentAdminId}`));

                const fieldPrompt = new Select({
                    message: 'Select setting to modify:',
                    choices: ['Telegram API Credentials', 'Admin Recipient ID', 'Cancel']
                });

                const fieldChoice = await fieldPrompt.run();

                if (fieldChoice === 'Telegram API Credentials') {
                    const idInput = new Input({ message: 'Enter new API ID:' });
                    const newApiId = await idInput.run();

                    const hashInput = new Input({ message: 'Enter new API Hash:' });
                    const newApiHash = await hashInput.run();

                    await setCloudConfig(licenseKey, { api_id: newApiId, api_hash: newApiHash });
                    displayBox('SAVED', 'API credentials updated.', 'good');
                } else if (fieldChoice === 'Admin Recipient ID') {
                    const adminInput = new Input({ message: 'Enter new Admin ID (or empty to clear):' });
                    let newAdminId = await adminInput.run();

                    if (newAdminId.toLowerCase() === 'null') {
                        newAdminId = '';
                    }

                    await setCloudConfig(licenseKey, { admin_id: newAdminId });
                    displayBox('SAVED', 'Admin recipient updated.', 'good');
                }
            } else if (selection.startsWith('6.')) {
                renderTitle();
                console.log(chalk.bold.cyan(`
  SESSION MANAGEMENT SUITE
  ========================
  Architecture : Node.js Client Services
  Status       : Operational
  Interface    : Terminal UI
                `));

                const linkPrompt = new Toggle({
                    message: 'Open developer documentation in browser?',
                    enabled: 'Yes',
                    disabled: 'No',
                    initial: false
                });

                const shouldOpen = await linkPrompt.run();
                if (shouldOpen) {
                    await open('https://reinhart.pages.dev');
                }
            } else {
                terminateProcess();
            }

            if (!selection.startsWith('3.')) {
                const continuePrompt = new Input({ message: 'Press Enter to return to main menu...' });
                await continuePrompt.run();
            }
        } catch (_) {
            terminateProcess();
        }
    }
};

main().catch((err) => {
    if (err && err !== '') {
        console.error(chalk.bgRed.white(' CRITICAL ERROR '));
        console.error(err);
    }
    terminateProcess();
});
