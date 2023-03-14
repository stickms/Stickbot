const fs = require('node:fs');
const SteamID = require('steamid');

const { getBanData, getPersonaDict } = require('./bot-helpers')

let db = {};

module.exports = {
    loadDB, saveDB,
    getPlayers, getGuilds,
    setTags, getTags,
    setNotis, getNotis,
    setAddrs, getAddrs,
    setNames, getNames,
    setBans, getBans,
    setWelcome, getWelcome,
    setBanwatch, getBanwatch
};

function loadDB() {
    if (fs.existsSync('./playerlist.json')) {
        db = JSON.parse(fs.readFileSync('./playerlist.json'));
    }

    if (!db?.players) db.players = {};
    if (!db?.servers) db.servers = {};
}

function saveDB() {
    fs.writeFileSync('./playerlist.json', JSON.stringify(db, null, '\t'));
}

function getPlayers() {
    return db.players;
}

async function createPlayer(steamid) {
    if (typeof steamid === typeof SteamID) {
        steamid = steamid.getSteamID64();
    }

    db.players[steamid] = {
        tags: {},
        addresses: {},
        notifications: {},
        names: await getPersonaDict(steamid),
        bandata: await getBanData(steamid)
    };
}

function getGuilds(steamid) {
    if (!db.players[steamid]?.tags) {
        return [];
    }

    return Object.keys(db.players[steamid].tags);
}

function getTags(steamid, guildid) {
    return db.players[steamid]?.tags[guildid] ?? {};
}

async function setTags(steamid, guildid, tags) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].tags[guildid] = tags;
    saveDB();
}

function getNotis(steamid, guildid) {
    return db.players[steamid]?.notifications[guildid] ?? {};
}

async function setNotis(steamid, guildid, notifications) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].notifications[guildid] = notifications;
    saveDB();
}

function getAddrs(steamid) {
    return db.players[steamid]?.addresses ?? {};
}

async function setAddrs(steamid, addresses) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].addresses = addresses;
    saveDB();
}

function getNames(steamid) {
    return db.players[steamid]?.names ?? {};
}

async function setNames(steamid, names) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].names = names;
    saveDB();
}

async function getBans(steamid) {
    return db.players[steamid]?.bandata ?? await getBanData(steamid);
}

async function setBans(steamid, bans) {
    if (!db.players[steamid]) {
        await createPlayer(steamid);
    }

    db.players[steamid].bandata = bans;
    saveDB();
}

function setWelcome(guildid, channel=null, join=null, leave=null) {
    if(!db.servers[guildid]) {
        db.servers[guildid] = {};
    }

    const cur = db.servers[guildid].welcome;
    db.servers[guildid].welcome = {
        channel: channel ?? cur?.channel,
        join: join ?? cur?.join,
        leave: leave ?? cur?.leave 
    };

    saveDB();
}

function getWelcome(guildid) {
    if (!db.servers[guildid]?.welcome) {
        return {};
    }

    return db.servers[guildid].welcome;
}

function setBanwatch(guildid, channel) {
    if(!db.servers[guildid]) {
        db.servers[guildid] = {};
    }

    db.servers[guildid].banwatch = channel;
    saveDB();
}

function getBanwatch(guildid) {
    if (!db.servers[guildid]?.banwatch) {
        return null;
    }

    return db.servers[guildid].banwatch;
}