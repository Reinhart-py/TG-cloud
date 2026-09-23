const axios = require('axios');

let CLOUD_API_URL = "";

const initStorage = (url) => {
    CLOUD_API_URL = url;
};

const requestApi = async (action, key, payload = {}) => {
    try {
        const { data } = await axios.post(CLOUD_API_URL, {
            action,
            key,
            payload
        });
        return data;
    } catch (e) {
        throw new Error('Cloud synchronization failed');
    }
};

const getAuthToken = async (ownerKey) => {
    try {
        const res = await requestApi('get_sys_token', ownerKey);
        return res.token;
    } catch (e) {
        return null;
    }
};

const saveAccountSession = async (phone, session, me, ownerKey) => {
    await requestApi('save', ownerKey, { phone, session, me });
};

const listAccountSessions = async (ownerKey) => {
    const res = await requestApi('list', ownerKey);
    return res.sessions || [];
};

const removeAccountSession = async (phone, ownerKey) => {
    await requestApi('delete', ownerKey, { phone });
};

const getRemoteConfig = async (ownerKey) => {
    const res = await requestApi('get_config', ownerKey);
    return res.settings;
};

const updateRemoteConfig = async (ownerKey, data) => {
    await requestApi('set_config', ownerKey, data);
};

module.exports = {
    initStorage,
    getAuthToken,
    saveAccountSession,
    listAccountSessions,
    removeAccountSession,
    getRemoteConfig,
    updateRemoteConfig
};
