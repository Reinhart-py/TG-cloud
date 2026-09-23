const fs = require('fs');
const path = require('path');
const { Select, Input, Toggle } = require('enquirer');
const chalk = require('chalk');
const open = require('open');

const visuals = require('./src/visuals');
const security = require('./src/security');
const storage = require('./src/storage');
const engineModule = require('./src/account-manager');

const renderTitle = visuals.renderTitle;
const displayBox = visuals.displayInfoBox;
const showLoader = visuals.startLoadingTask;

const checkSystem = security.checkLocalLicense;
const saveLicense = security.saveLicense;
const verifyLicenseKey = security.validateLicenseKey;

const initStorage = storage.initStorage;
const getAuthToken = storage.getAuthToken;
const saveSession = storage.saveAccountSession;
const getSessions = storage.listAccountSessions;
const deleteSession = storage.removeAccountSession;
const getCloudConfig = storage.getRemoteConfig;
const setCloudConfig = storage.updateRemoteConfig;

const EngineClass = engineModule.ClientSessionManager;

const API_BASE_URL = 'https://mika-backend.vercel.app/api';
const LICENSE_FILE_PATH = path.resolve(process.cwd(), 'license.key');

let notificationToken = null;

const terminateApp = () => {
    try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch (_) {}
    process.stdin.destroy();
    process.exit(0);
};

process.on('SIGINT', terminateApp);

const authenticateApp = async () => {
    let authState = await checkSystem();
    let validKey = '';

    if (authState && authState.passed) {
        try { validKey = fs.readFileSync(LICENSE_FILE_PATH, 'utf8').trim(); } catch (_) {}
    }

    if (!authState || !authState.passed) {
        displayBox('LICENSE REQUIRED', 'Please enter a valid business license key to initialize.', 'error');

        while (!authState || !authState.passed) {
            try {
                const keyPrompt = new Input({ message: 'License Key:' });
                const enteredKey = (await keyPrompt.run()).trim();

                if (!enteredKey) continue;

                await showLoader('Validating license with corporate server...');
                const checkResult = await verifyLicenseKey(enteredKey);

                if (checkResult && checkResult.passed) {
                    await saveLicense(enteredKey);
                    authState = checkResult;
                    validKey = enteredKey;
                    displayBox('AUTHORIZED', 'License verified successfully.', 'success');
                } else {
                    console.log(chalk.red(`  Verification failed: ${checkResult?.msg || 'Invalid key'}`));
                    const retryPrompt = new Select({
                        message: 'Try again?',
                        choices: ['Yes', 'No (Exit)']
                    });
                    if ((await retryPrompt.run()) === 'No (Exit)') terminateApp();
                }
            } catch (_) { terminateApp(); }
        }
    }
    authState.licenseKey = validKey;
    return authState;
};

const setupEnvironment = async () => {
    initStorage(API_BASE_URL);
    renderTitle();

    const identity = await authenticateApp();
    const userName = identity.owner || 'Corporate User';

    await showLoader(`Synchronizing configuration for ${userName}...`);

    let cloudConfig;
    try {
        cloudConfig = await getCloudConfig(identity.licenseKey);
        notificationToken = await getAuthToken(identity.licenseKey);
    } catch (_) {
        displayBox('SYNC ERROR', 'Unable to reach synchronization server.', 'error');
        terminateApp();
    }

    let apiId = cloudConfig ? cloudConfig.api_id : null;
    let apiHash = cloudConfig ? cloudConfig.api_hash : null;

    if (!apiId || !apiHash) {
        console.log(chalk.yellow('\n--- Telegram API Credentials Setup ---'));
        try {
            const idPrompt = new Input({ message: 'API ID:' });
            apiId = await idPrompt.run();
            const hashPrompt = new Input({ message: 'API Hash:' });
            apiHash = await hashPrompt.run();
            await setCloudConfig(identity.licenseKey, { api_id: apiId, api_hash: apiHash });
            displayBox('CONFIG SAVED', 'API credentials synced.', 'success');
        } catch (_) { terminateApp(); }
    }

    const engine = new EngineClass(apiId, apiHash);
    return { engine, identity };
};

const main = async () => {
    const { engine, identity } = await setupEnvironment();
    const licenseKey = identity.licenseKey;

    while (true) {
        renderTitle();
        console.log(chalk.gray(`  Active License Reference: ${licenseKey.substring(0, 8)}...`));

        try {
            const menuPrompt = new Select({
                name: 'action',
                message: 'Manage Account Operations:',
                choices: [
                    '1. Connect Account',
                    '2. Review Registered Accounts',
                    '3. Active Monitoring Mode',
                    '4. Remove Session',
                    '5. API & System Settings',
                    '6. Application Info',
                    '7. Exit'
                ]
            });

            const selection = await menuPrompt.run();

            if (selection.startsWith('1.')) {
                const phonePrompt = new Input({ message: 'Phone number (Int. Format):' });
                const phone = await phonePrompt.run();
                try {
                    console.log(chalk.blue('establishing secure session...'));
                    const result = await engine.login(phone);
                    await saveSession(phone, result.session, result.me, licenseKey);
                    displayBox('CONNECTED', `User: ${result.me.username || 'N/A'}`, 'success');
                } catch (err) {
                    displayBox('CONNECTION FAILED', err.message, 'error');
                }
            } else if (selection.startsWith('2.')) {
                const accounts = await getSessions(licenseKey);
                if (!accounts || accounts.length === 0) {
                    console.log(chalk.gray('  No sessions linked to this account.'));
                } else {
                    accounts.forEach((acc, i) => console.log(chalk.cyan(`  [${i+1}] ${acc.phone} | ${acc.username || 'N/A'}`)));
                }
            } else if (selection.startsWith('3.')) {
                const accounts = await getSessions(licenseKey);
                if (!accounts || accounts.length === 0) {
                    console.log(chalk.red('  No accounts mapped for monitoring.'));
                } else {
                    const cloudConfig = await getCloudConfig(licenseKey);
                    let adminId = cloudConfig ? cloudConfig.admin_id : null;

                    if (!adminId) {
                        const setup = new Toggle({ message: 'Configure Admin notification ID?', enabled: 'Yes', disabled: 'No' });
                        if (await setup.run()) {
                            const prompt = new Input({ message: 'Recipient User ID:' });
                            adminId = await prompt.run();
                            await setCloudConfig(licenseKey, { admin_id: adminId });
                        }
                    }

                    let botConfig = (adminId && notificationToken) ? { token: notificationToken, admin: adminId } : null;
                    console.log(chalk.green('--- MONITORING ACTIVE ---'));
                    
                    await engine.initializeSessions(accounts, botConfig, (msg) => {
                        console.log(`${chalk.bgBlue.white(` ${msg.phone} `)} ${chalk.yellow(msg.sender)}: ${msg.text.substring(0, 80)}`);
                    });
                    await new Promise(() => {});
                }
            } else if (selection.startsWith('4.')) {
                const accounts = await getSessions(licenseKey);
                const phones = (accounts || []).map(a => a.phone);
                if (phones.length === 0) {
                    console.log(chalk.red('  No sessions available.'));
                } else {
                    const sel = new Select({ message: 'Select session to remove:', choices: [...phones, 'Cancel'] });
                    const target = await sel.run();
                    if (target !== 'Cancel') {
                        const confirm = new Toggle({ message: 'Confirm permanent removal?', enabled: 'Yes', disabled: 'No' });
                        if (await confirm.run()) {
                            await deleteSession(target, licenseKey);
                            console.log(chalk.green(`  Session ${target} removed.`));
                        }
                    }
                }
            } else if (selection.startsWith('5.')) {
                renderTitle();
                const cloudConfig = await getCloudConfig(licenseKey);
                console.log(chalk.gray(`API ID: ${cloudConfig?.api_id || 'Not Set'}`));
                console.log(chalk.gray(`Admin ID: ${cloudConfig?.admin_id || 'Not Set'}`));
                
                const choice = new Select({
                    message: 'Modify setting:',
                    choices: ['API Credentials', 'Admin ID', 'Cancel']
                });
                const field = await choice.run();
                if (field === 'API Credentials') {
                    const id = new Input({ message: 'New API ID:' });
                    const hash = new Input({ message: 'New API Hash:' });
                    await setCloudConfig(licenseKey, { api_id: await id.run(), api_hash: await hash.run() });
                } else if (field === 'Admin ID') {
                    const admin = new Input({ message: 'New Admin ID:' });
                    await setCloudConfig(licenseKey, { admin_id: await admin.run() });
                }
            } else if (selection.startsWith('6.')) {
                renderTitle();
                console.log(chalk.cyan('  APP INFO: Account Manager Enterprise v1.0.0\n  Status: Operational'));
                const openDoc = new Toggle({ message: 'Open documentation?', enabled: 'Yes', disabled: 'No' });
                if (await openDoc.run()) await open('https://reinhart.pages.dev');
            } else {
                terminateApp();
            }
            if (!selection.startsWith('3.')) {
                await new Input({ message: 'Press Enter to return...' }).run();
            }
        } catch (_) { terminateApp(); }
    }
};

main().catch(terminateApp);
