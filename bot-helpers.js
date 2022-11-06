const fs = require('node:fs');
const axios = require('axios').default;
const CONSTS = require('./bot-consts.js');
const SteamID = require('steamid');
const { steam_token } = require('./config.json');

module.exports = { setupPlayerList, resolveSteamID, getProfileEntry, setProfileEntry, getBanData, uploadText };

function setupPlayerList() {
    // Format playerlist so we don't run into null errors later
    if (fs.existsSync('./playerlist.json')) {
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
    } else {
        fs.writeFileSync('./playerlist.json', JSON.stringify({}, null, '\t'));
    }
} 

async function resolveSteamID(steamid) {
    try {
        return new SteamID(steamid);
    } catch (error) {
        // Try to check if this is a Vanity URL
        try {
            let response = await axios.get(CONSTS.VANITY_URL, { 
                params: { key: steam_token, vanityurl: steamid }, 
                validateStatus: () => true,
                timeout: 1500,
            });

            let data = response.data.response;

            if (data.hasOwnProperty('steamid')) {
                return new SteamID(data.steamid);
            }    
            else {
                return null;
            }
        } catch (error2) {
            return null;
        }
    }
}

async function getProfileEntry(steamid) {
	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    return plist[steamid] ?? await newProfileEntry(steamid);
}

async function setProfileEntry(steamid, data) {
	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    plist[steamid] = data;
	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));
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

// Returns hastebin URL
async function uploadText(content) {
    try {
        let response = await axios.post(CONSTS.PASTE_URL, friendstext, { 
            headers: { 'Content-Type': 'text/plain' },
            timeout: 1500
        });

        if (!response.data) {
            return '';
        }

        return response.data.raw;
    } catch (error) {
        return '';
    }
}