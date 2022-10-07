const fs = require('node:fs');
const axios = require('axios').default;
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { setupPlayerList, resolveSteamID, newProfileEntry, getBanData };

function setupPlayerList() {
    // Create playerlist if it doesn't otherwise exist
    //fs.writeFileSync('./playerlist.json', '{}', { flag: 'wx' }, x => {});

    // Format playerlist so we don't run into null errors later
    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    for (let id of Object.keys(plist)) {
        if (!plist[id].tags) {
            plist[id].tags = {};
        } if (!plist[id].addresses) {
            plist[id].addresses = {};
        } if (!plist[id].notifications) {
            plist[id].notifications = {};
        } if (!plist[id].bandata) {
            plist[id].bandata = {};
        }
    }

    fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));
} 

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
        return {};
     }

     bandata = bandata.data.players[0];

     return {
        vacbans: bandata.NumberOfVACBans,
        gamebans: bandata.NumberOfGameBans,
        communityban: bandata.CommunityBanned,
        tradeban: bandata.EconomyBan == 'banned'
    };
}