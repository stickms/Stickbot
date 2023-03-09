const axios = require('axios');
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { 
    httpsGet, resolveSteamID,
    getBanData, formatWelcomeMessage
};

async function httpsGet(url, params={}, timeout=1000) {
    try {
        const response = await axios.get(url, { 
            params: params, 
            timeout: timeout
        });

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
            key: steam_token,
            vanityurl: steamid
        });

        if (response?.data?.response?.steamid) {
            return new SteamID(response.data.response.steamid);
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
            key: steam_token,
            steamids: steamid
        });

        if (!bandata?.data?.players?.[0]) {
            return {};
        }

        bandata = bandata.data.players[0];

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