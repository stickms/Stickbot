const axios = require('axios');
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_tokens } = require('./config.json');

module.exports = { 
    httpsGet, httpsHead, resolveSteamID,
    getBanData, getPersonaDict, formatWelcomeMessage,
    getAPICalls, getSteamToken
};

let apicalls = 0;
let tokennum = 0;

function getAPICalls() {
    return apicalls;
}

function getSteamToken() {
    if (tokennum >= steam_tokens.length) {
        tokennum = 0;
    }

    return steam_tokens[tokennum++];
}

async function httpsGet(url, params={}, timeout=1000, full=false) {
    try {
        if (url.startsWith(CONSTS.BAN_URL) || url.startsWith(CONSTS.FRIEND_URL) || 
            url.startsWith(CONSTS.PROFILE_URL) || url.startsWith(CONSTS.SUMMARY_URL)) {
            apicalls++;
        }

        const response = await axios.get(url, { 
            params: params, 
            timeout: timeout
        });

        if (!response?.data) {
            return null;
        }

        return full ? response : response.data;
    } catch (error) {
        return null;
    }
}

async function httpsHead(url, params={}, timeout=1000) {
    try {
        const response = await axios.head(url, { 
            params: params, 
            timeout: timeout
        });

        if (!response) {
            return null;
        } 

        return response;
    } catch (error) {
        return null;
    }
}

async function resolveSteamID(steamid) {
    try {
        if (typeof steamid === 'string' && steamid.split('/').length > 4) {
            steamid = steamid.split('/')[4];
        }

        // Try to check if this is a Vanity URL first
        const response = await httpsGet(CONSTS.VANITY_URL, {
            key: getSteamToken(),
            vanityurl: steamid
        });

        if (response?.response?.steamid) {
            return new SteamID(response.response.steamid);
        }    
        else {
            // Check if it's a regular steamid format
            return new SteamID(steamid);
        }
    } catch (error) {
        return null;
    }
}

async function getBanData(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    try {
        let bandata = await httpsGet(CONSTS.BAN_URL, {
            key: getSteamToken(),
            steamids: steamid
        });

        if (!bandata?.players?.[0]) {
            return {};
        }

        bandata = bandata.players[0];

        return {
            vacbans: bandata.NumberOfVACBans,
            gamebans: bandata.NumberOfGameBans,
            communityban: bandata.CommunityBanned,
            tradeban: bandata.EconomyBan == 'banned'
        };
    } catch (error) {
        return {};
    }
}

async function getPersonaDict(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    try {
        const response = await httpsGet(CONSTS.SUMMARY_URL, {
            key: getSteamToken(),
            steamids: steamid
        });

        if (!response?.response?.players?.[0]) {
            return {};
        }

        const summary = response.response.players[0];
        const persona = JSON.stringify(summary.personaname);

        return {
            [persona]: Math.floor(Date.now() / 1000)
        };
    } catch (error) {
        return {};
    }
}

function formatWelcomeMessage(message, member) {
    message = message.replaceAll('{mention}', `<@${member.user.id}>`);
    message = message.replaceAll('{disc}', member.user?.discriminator);
    message = message.replaceAll('{id}', member.user.id);
    message = message.replaceAll('{server}', member.guild.name);
    message = message.replaceAll('{guild}', member.guild.name);
    message = message.replaceAll('{name}', member.user?.username);
    message = message.replaceAll('{nick}', member.nickname ?? member.user?.username);
    return message;
}