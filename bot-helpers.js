const axios = require('axios').default;
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { resolveSteamID, newProfileEntry, getBanData };

async function resolveSteamID(steamid) {
    try {
        return new SteamID(steamid);
    } catch (error) {
        // Try to check if this is a Vanity URL
        let response = await axios.get(CONSTS.VANITY_URL, { 
            params: { key: steam_token, vanityurl: steamid }, 
            validateStatus: () => true 
        });

        let data = response.data.response;

        if (data.hasOwnProperty('steamid')) {
            return new SteamID(data.steamid);
        }    
        else {
            return null;
        }
    }
}

async function newProfileEntry(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    return {
        tags: {},
        addresses: {},
        notifications: {},
        bandata: await getBanData(steamid)
    }
}

async function getBanData(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let bandata = await axios.get(CONSTS.BAN_URL, { 
        params: { key: steam_token, steamids: steamid },
        validateStatus: () => true
     });

     if (!bandata.data.players[0]) {
        return null;
     }

     bandata = bandata.data.players[0];

     return {
        vacbans: bandata.NumberOfVACBans,
        gamebans: bandata.NumberOfGameBans,
        communityban: bandata.CommunityBanned,
        tradeban: bandata.EconomyBan == 'banned'
    };
}