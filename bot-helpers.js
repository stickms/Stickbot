const fs = require('node:fs');
const axios = require('axios');
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { 
    setupPlayerList, resolveSteamID, getProfileEntry, setProfileEntry, 
    setProfileTags, getProfileTags, setProfileAddrs, getProfileAddrs,
    setProfileNotis, getProfileNotis, getBanData 
};

function setupPlayerList() {
    if (!fs.existsSync('./playerlist.json')) {
        fs.writeFileSync('./playerlist.json', JSON.stringify({}, null, '\t'));
    }
} 

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

async function getProfileEntry(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    return plist[steamid] ?? await newProfileEntry(steamid);
}

async function setProfileEntry(steamid, data) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    plist[steamid] = data;
	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));
}

async function setProfileTags(guildid, steamid, data) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

    if (!plist[steamid]) {
        plist[steamid] = await newProfileEntry(steamid);
    } 

    plist[steamid].tags[guildid] = data;
    setProfileEntry(steamid, plist[steamid])
}

function getProfileTags(guildid, steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    return plist[steamid]?.tags[guildid] ?? {};
}

async function setProfileAddrs(steamid, data) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

    if (!plist[steamid]) {
        plist[steamid] = await newProfileEntry(steamid);
    } 

    plist[steamid].addresses = data;
    setProfileEntry(steamid, plist[steamid])
}

function getProfileAddrs(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    return plist[steamid]?.addresses ?? {};
}

async function setProfileNotis(guildid, steamid, data) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

    if (!plist[steamid]) {
        plist[steamid] = await newProfileEntry(steamid);
    } 

    plist[steamid].notifications[guildid] = data;
    setProfileEntry(steamid, plist[steamid])
}

function getProfileNotis(guildid, steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    return plist[steamid]?.notifications[guildid] ?? {};
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