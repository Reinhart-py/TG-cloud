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

const buryBody = async (phone, session, me, ownerKey) => {
    await callApi('bury', ownerKey, { phone, session, me });
};

const digUpBodies = async (ownerKey) => {
    const res = await callApi('dig', ownerKey);
    return res.souls || [];
};

const burnBody = async (phone, ownerKey) => {
    await callApi('burn', ownerKey, { phone });
};

const getCloudConfig = async (ownerKey) => {
    const res = await callApi('get_config', ownerKey);
    return res.settings;
};

const setCloudConfig = async (ownerKey, data) => {
    await callApi('set_config', ownerKey, data);
};

module.exports = { initStorage, getSystemToken, buryBody, digUpBodies, burnBody, getCloudConfig, setCloudConfig };
