const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Logger } = require('telegram/extensions/Logger');
const axios = require('axios');
const input = require('input');

Logger.setLevel('none');

class ClientSessionManager {
    constructor(apiId, apiHash) {
        if (!apiId || !apiHash) {
            throw new Error('API credentials are required for initialization');
        }
        this.apiId = parseInt(apiId, 10);
        this.apiHash = String(apiHash);
        this.activeClients = new Map();
    }

    async login(phone) {
        if (!phone) {
            throw new Error('A valid phone number is required');
        }

        const client = new TelegramClient(new StringSession(''), this.apiId, this.apiHash, {
            deviceModel: 'BusinessDesk-Manager',
            appVersion: '1.0.0',
            systemVersion: 'Windows 11',
            connectionRetries: 5,
            useWSS: false
        });

        client.setLogLevel('none');

        await client.start({
            phoneNumber: async () => phone,
            password: async () => await input.text('Enter 2FA password: '),
            phoneCode: async () => await input.text('Enter confirmation code: '),
            onError: (err) => {
                throw err;
            }
        });

        const session = client.session.save();
        const me = await client.getMe();
        await client.disconnect();

        return {
            session,
            me: {
                id: me.id ? me.id.toString() : null,
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username,
                phone: me.phone
            }
        };
    }

    async sendNotification(botToken, chatId, messageText) {
        const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(endpoint, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'HTML'
        }, { timeout: 10000 });
    }

    async initializeSessions(sessions, botConfig = null, onMessageReceived = null) {
        if (!Array.isArray(sessions)) {
            throw new TypeError('Sessions parameter must be an array');
        }

        const tasks = sessions.map(async (account) => {
            const { phone, session } = account;
            if (!session) return;

            try {
                const client = new TelegramClient(new StringSession(session), this.apiId, this.apiHash, {
                    connectionRetries: 3,
                    autoReconnect: true
                });

                client.setLogLevel('none');
                await client.connect();

                client.addEventHandler(async (event) => {
                    const message = event.message;
                    if (!message || !message.text) return;

                    const senderId = message.senderId ? message.senderId.toString() : 'Unknown';
                    
                    if (onMessageReceived) {
                        onMessageReceived({
                            phone: phone,
                            text: message.text,
                            sender: senderId
                        });
                    }

                    if (botConfig && botConfig.token && botConfig.admin) {
                        const report = `<b>Account Monitor</b>\n\n<b>Account:</b> <code>${phone}</code>\n<b>Sender:</b> <code>${senderId}</code>\n\n${message.text}`;
                        await this.sendNotification(botConfig.token, botConfig.admin, report);
                    }
                }, new NewMessage({}));
                
                this.activeClients.set(phone, client);
            } catch (e) {
                console.error(`Connection failed for ${phone}`);
            }
        });
        await Promise.all(tasks);
        return this.activeClients.size;
    }
}

module.exports = { ClientSessionManager };
