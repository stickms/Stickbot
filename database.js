const fs = require('node:fs');
const SteamID = require('steamid');

const { getBanData } = require('./bot-helpers')

let db = {};

module.exports = {
    db, loadDB, saveDB,
    setTags, getTags,
    setNotis, getNotis,
    setAddrs, getAddrs,
    setBans, getBans
};

function loadDB() {
    if (fs.existsSync('./playerlist.json')) {
        db = JSON.parse(fs.readFileSync('./playerlist.json'));
    }

    if (!db.players) db.players = {};
    if (!db.servers) db.servers = {};
}

function saveDB() {
    fs.writeFileSync('./playerlist.json', JSON.stringify(db, null, '\t'));
}

async function createPlayer(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    db.players[steamid] = {
        tags: {},
        addresses: {},
        notifications: {},
        bandata: await getBanData(steamid)
    };
}

function getTags(steamid, guildid) {
    if (!db.players[steamid]?.tags[guildid]) {
        return {};
    }

    return db.players[steamid].tags[guildid];
}

async function setTags(steamid, guildid, tags) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].tags[guildid] = tags;
    saveDB();
}

function getNotis(steamid, guildid) {
    if (!db.players[steamid]?.notifications[guildid]) {
        return {};
    }

    return db.players[steamid].notifications[guildid];
}

async function setNotis(steamid, guildid, notifications) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].notifications[guildid] = notifications;
    saveDB();
}

function getAddrs(steamid) {
    if (!db.players[steamid]?.addresses) {
        return {};
    }

    return db.players[steamid].addresses;
}

async function setAddrs(steamid, addresses) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].addresses = addresses;
    saveDB();
}

async function getBans(steamid) {
    if (!db.players[steamid]?.bans) {
        return await getBanData(steamid);
    }

    return db.players[steamid].bans;
}

async function setBans(steamid, bans) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].bans = bans;
    saveDB();
}