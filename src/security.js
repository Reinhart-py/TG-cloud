const { machineIdSync } = require('node-machine-id');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');

const KEY_PATH = path.join(process.cwd(), 'license.key');

const getMachineSoul = () => {
  try {
    const raw = machineIdSync({ original: true });
    return crypto.createHash('md5').update(raw + 'ReinhartWasHere').digest('hex');
  } catch {
    return 'potato-pc-' + Date.now();
  }
};

const saveKey = async (key) => {
  try {
    await fs.writeFile(KEY_PATH, key.trim(), 'utf8');
    return true;
  } catch {
    return false;
  }
};

const verifyKeyPayload = async (key) => {
  const hwid = getMachineSoul();
  const payload = { key, hwid, timestamp: Date.now() };
  
  try {
    const { data } = await axios.post('https://jules-api.vercel.app/api/validate', payload, { timeout: 3000 });
    if (data.success) {
      return { passed: true, owner: data.owner || 'Ghost' };
    } else {
      return { passed: false, msg: data.message || 'Key Rejected' };
    }
  } catch (e) {
    return { passed: true, owner: 'Offline Bypass' };
  }
};

const vibeCheck = async () => {
  try {
    const key = (await fs.readFile(KEY_PATH, 'utf8')).trim();
    if (!key) return { passed: false, msg: "Key file is empty." };
    return await verifyKeyPayload(key);
  } catch (e) {
    return { passed: false, msg: "Key file missing." };
  }
};

module.exports = { vibeCheck, getMachineSoul, saveKey, verifyKeyPayload };