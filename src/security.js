const { machineIdSync } = require('node-machine-id');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');

const LICENSE_FILE = path.join(process.cwd(), 'license.key');

const getUserDeviceHash = () => {
    try {
        const raw = machineIdSync({ original: true });
        return crypto.createHash('sha256').update(raw + 'AppService_Salt').digest('hex');
    } catch {
        return 'default-device-id';
    }
};

const saveLicense = async (key) => {
    try {
        await fs.writeFile(LICENSE_FILE, key.trim(), 'utf8');
        return true;
    } catch {
        return false;
    }
};

const validateLicenseKey = async (key) => {
    const hwid = getUserDeviceHash();
    const payload = { key, hwid, timestamp: Date.now() };
    
    try {
        const { data } = await axios.post('https://jules-api.vercel.app/api/validate', payload, { timeout: 5000 });
        if (data.success) {
            return { passed: true, owner: data.owner || 'Authorized User' };
        } else {
            return { passed: false, msg: data.message || 'Invalid Key' };
        }
    } catch (e) {
        return { passed: false, msg: 'Connection Error' };
    }
};

const checkLocalLicense = async () => {
    try {
        const key = (await fs.readFile(LICENSE_FILE, 'utf8')).trim();
        if (!key) return { passed: false, msg: "No license key found locally." };
        return await validateLicenseKey(key);
    } catch (e) {
        return { passed: false, msg: "License file not found." };
    }
};

module.exports = { checkLocalLicense, getUserDeviceHash, saveLicense, validateLicenseKey };
