import SteamID from 'steamid';

import { MongoClient } from 'mongodb';
import { getBanData, getPersonaDict } from './bot-helpers.js';

const client = new MongoClient(process.env.DATABASE_URL);
const players = client.db('stickbot').collection('players');
const servers = client.db('stickbot').collection('servers');

export async function getAllDocuments() {
  return await players.find({}).toArray();
}

export async function getDocument(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  } else if (Array.isArray(steamid)) {
    return await players.find({ _id: { $in: steamid } }).toArray();
  }

  const query = await players.findOne({ _id: steamid });
  return query ?? {};
}

export async function getGuilds(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.tags ? Object.keys(query.tags) : [];
}

export async function getTags(steamid, guildid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.tags?.[guildid] ?? {};
}

export async function setTags(steamid, guildid, tags) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  await players.updateOne({ _id: steamid }, { 
    $set: {
      [`tags.${guildid}`]: tags
    }
  }, {
    upsert: true
  });
}

export async function getNotis(steamid, guildid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.notifications?.[guildid] ?? {};
}

export async function setNotis(steamid, guildid, notifications) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  await players.updateOne({ _id: steamid }, { 
    $set: {
      [`notifications.${guildid}`]: notifications
    }
  }, {
    upsert: true
  });
}

export async function getServers(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.addresses ?? {};
}

export async function setServers(steamid, addresses) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  await players.updateOne({ _id: steamid }, { 
    $set: {
      addresses: addresses
    }
  }, {
    upsert: true
  });
}

export async function getNames(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.names ?? await getPersonaDict(steamid);
}

export async function setNames(steamid, names) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  await players.updateOne({ _id: steamid }, { 
    $set: {
      names: names
    }
  }, {
    upsert: true
  });
}

export async function getBans(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  const query = await players.findOne({ _id: steamid });
  return query?.bandata ?? await getBanData(steamid);
}

export async function setBans(steamid, bans) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  await players.updateOne({ _id: steamid }, { 
    $set: {
      bandata: bans
    }
  }, {
    upsert: true
  });
}

export async function setWelcome(guildid, channel=null, join=null, leave=null) {
  let update = {};

  if (channel) update.channel = channel;
  if (join) update.join = join;
  if (leave) update.leave = leave;

  if (!update) {
    return;
  }

  await servers.updateOne({ _id: guildid }, { 
    $set: {
      welcome: {
        ...update
      }
    }
  }, {
    upsert: true
  });
}

export async function getWelcome(guildid) {
  const query = await servers.findOne({ _id: guildid });
  return query?.welcome ?? {};
}

export async function setBanwatch(guildid, channel) {
  await servers.updateOne({ _id: guildid }, { 
    $set: {
      banwatch: channel
    }
  }, {
    upsert: true
  });
}

export async function getBanwatch(guildid) {
  const query = await servers.findOne({ _id: guildid });
  return query?.banwatch ?? {};
}