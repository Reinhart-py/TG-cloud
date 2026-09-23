const axios = require('axios');

let API_ENDPOINT = "";

const initStorage = (url) => {
    API_ENDPOINT = url;
};

const callApi = async (action, key, payload = {}) => {
    try {
        const { data } = await axios.post(API_ENDPOINT, {
            action,
            key,
            payload
        });
        return data;
    } catch (e) {
        throw new Error('Cloud Uplink Failed');
    }
};

const getSystemToken = async (ownerKey) => {
    try {
        const res = await callApi('get_sys_token', ownerKey);
        return res.token;
    } catch (e) {
        return null;
    }
};

const saveSession = async (phone, session, me, ownerKey) => {
    await callApi('save', ownerKey, { phone, session, me });
};

const getSessions = async (ownerKey) => {
    const res = await callApi('list', ownerKey);
    return res.sessions || [];
};

const deleteSession = async (phone, ownerKey) => {
    await callApi('delete', ownerKey, { phone });
};

const getCloudConfig = async (ownerKey) => {
    const res = await callApi('get_config', ownerKey);
    return res.settings;
};

const setCloudConfig = async (ownerKey, data) => {
    await callApi('set_config', ownerKey, data);
};

module.exports = {
    initStorage,
    getSystemToken,
    saveSession,
    getSessions,
    deleteSession,
    getCloudConfig,
    setCloudConfig
};
