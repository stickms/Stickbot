import { Collection, MongoClient } from 'mongodb';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config({
  path: path.join(import.meta.dirname, '..', '..', '.env')
});

type TagEntry = {
  addedby: string;
  date: number;
};

export interface DatabasePlayerEntry {
  _id: string;
  addresses: {
    [ip: string]: {
      game: string;
      date: number;
    };
  };
  bandata: {
    vacbans: number;
    gamebans: number;
    communityban: boolean;
    tradeban: boolean;
  };
  names: {
    [name: string]: number;
  };
  notifications: {
    [guildid: string]: {
      ban: string[];
      name: string[];
      log: string[];
    };
  };
  tags: {
    [guildid: string]: {
      cheater?: TagEntry;
      suspicious?: TagEntry;
      popular?: TagEntry;
      banwatch?: TagEntry;
    };
  };
}

export interface DatabaseServerEntry {
  _id: string;
  banwatch: string;
  welcome?: {
    channel: string;
    join?: string;
    leave?: string;
  };
}

class Database {
  private static client: MongoClient | null = null;

  private static players: Collection<DatabasePlayerEntry>;
  private static servers: Collection<DatabaseServerEntry>;

  constructor() {
    // Only setup DB connection once
    if (Database.client) {
      return;
    }

    Database.client = new MongoClient(process.env.DATABASE_URL!);
    Database.players = Database.client.db('stickbot').collection('players');
    Database.servers = Database.client.db('stickbot').collection('servers');
  }

  // Player-related database functions

  static async lookupPlayer(steamid: string) {
    const profile = await Database.players.findOne({
      _id: steamid
    });

    return profile;
  }

  static async lookupPlayers(steamids: string[]) {
    if (!steamids.length) {
      return null;
    }

    const profiles = await Database.players.find({
      _id: { $in: steamids }
    }).toArray();

    return profiles;
  }

  static async addTag(steamid: string, guildid: string, userid: string, tag: string) {
    const resp = await Database.players.updateOne(
      { _id: steamid }, 
      {
        $set: {
          [`tags.${guildid}.${tag}`]: {
            addedby: userid,
            date: Math.floor(Date.now() / 1000)
          }
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }

  static async removeTag(steamid: string, guildid: string, tag: string) {
    const resp = await Database.players.updateOne(
      { _id: steamid }, 
      {
        $unset: {
          [`tags.${guildid}.${tag}`]: 1
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }

  // Server-related database functions

  static async lookupServer(guildid: string) {
    const server = await Database.servers.findOne({
      _id: guildid
    });

    return server;
  }

  static async setWelcomeChannel(guildid: string, channelid: string) {
    const resp = await Database.servers.updateOne(
      { _id: guildid },
      { $set: {
          'welcome.channel': channelid
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }

  static async setWelcomeJoin(guildid: string, message: string) {
    const resp = await Database.servers.updateOne(
      { _id: guildid },
      { $set: {
          'welcome.join': message
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }

  static async setWelcomeLeave(guildid: string, message: string) {
    const resp = await Database.servers.updateOne(
      { _id: guildid },
      { $set: {
          'welcome.leave': message
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }

  static async setBanwatch(guildid: string, channelid: string) {
    const resp = await Database.servers.updateOne(
      { _id: guildid },
      { $set: {
          'banwatch': channelid
        }
      },
      { upsert: true }
    );

    return resp.acknowledged;
  }
}

new Database();

export default Database;
