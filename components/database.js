import fs from 'node:fs';
import SteamID from 'steamid';

import { getBanData, getPersonaDict } from './bot-helpers.js';

let db = {};

export function loadDB() {
  if (fs.existsSync('./playerlist.json')) {
    db = JSON.parse(fs.readFileSync('./playerlist.json'));
  }

  if (!db?.players) db.players = {};
  if (!db?.servers) db.servers = {};
}

export function saveDB() {
  fs.writeFileSync('./playerlist.json', JSON.stringify(db, null, '\t'));
}

export function exportDB() {
  return db;
}

export function getPlayers() {
  return db.players;
}

export async function createPlayer(steamid) {
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

export function getGuilds(steamid) {
  if (!db.players[steamid]?.tags) {
    return [];
  }

  return Object.keys(db.players[steamid].tags);
}

export function getTags(steamid, guildid) {
  return db.players[steamid]?.tags[guildid] ?? {};
}

export async function setTags(steamid, guildid, tags) {
  if (!db.players[steamid]) {
    await createPlayer(steamid);
  }

  db.players[steamid].tags[guildid] = tags;
  saveDB();
}

export function getNotis(steamid, guildid) {
  return db.players[steamid]?.notifications[guildid] ?? {};
}

export async function setNotis(steamid, guildid, notifications) {
  if (!db.players[steamid]) {
    await createPlayer(steamid);
  }

  db.players[steamid].notifications[guildid] = notifications;
  saveDB();
}

export function getServers(steamid) {
  return db.players[steamid]?.addresses ?? {};
}

export async function setServers(steamid, addresses) {
  if (!db.players[steamid]) {
    await createPlayer(steamid);
  }

  db.players[steamid].addresses = addresses;
  saveDB();
}

export function getNames(steamid) {
  return db.players[steamid]?.names ?? {};
}

export async function setNames(steamid, names) {
  if (!db.players[steamid]) {
    await createPlayer(steamid);
  }

  db.players[steamid].names = names;
  saveDB();
}

export async function getBans(steamid) {
  return db.players[steamid]?.bandata ?? await getBanData(steamid);
}

export async function setBans(steamid, bans) {
  if (!db.players[steamid]) {
    await createPlayer(steamid);
  }

  db.players[steamid].bandata = bans;
  saveDB();
}

export function setWelcome(guildid, channel=null, join=null, leave=null) {
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

export function getWelcome(guildid) {
  if (!db.servers[guildid]?.welcome) {
    return {};
  }

  return db.servers[guildid].welcome;
}

export function setBanwatch(guildid, channel) {
  if(!db.servers[guildid]) {
    db.servers[guildid] = {};
  }

  db.servers[guildid].banwatch = channel;
  saveDB();
}

export function getBanwatch(guildid) {
  if (!db.servers[guildid]?.banwatch) {
    return null;
  }

  return db.servers[guildid].banwatch;
}