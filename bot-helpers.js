const fs = require('node:fs');
const axios = require('axios');
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { 
    resolveSteamID, getBanData
};

async function resolveSteamID(steamid) {
    try {
        if (typeof steamid === 'string' && steamid.split('/').length > 4) {
            steamid = steamid.split('/')[4];
        }

        // Try to check if this is a Vanity URL first
        let response = await axios.get(CONSTS.VANITY_URL, { 
            params: { key: steam_token, vanityurl: steamid }, 
            validateStatus: () => true,
            timeout: 1500,
        });

        let data = response.data.response;

        if (data.steamid) {
            return new SteamID(data.steamid);
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
        let bandata = await axios.get(CONSTS.BAN_URL, { 
            params: { key: steam_token, steamids: steamid },
            validateStatus: () => true
        });

        if (!bandata.data.players[0]) {
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