import { Collection, MongoClient, OptionalId } from 'mongodb';
import { WithId, Document, Condition, ObjectId } from 'mongodb';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '.env') });

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
  }[];
  bandata: {
    vacbans: number;
    gamebans: number;
    communityban: boolean;
    tradeban: boolean;
  };
  names: {
    [name: string]: number;
  }[];
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
    if (Database.client) {
      return;
    }

    Database.client = new MongoClient(process.env.DATABASE_URL!);
    Database.players = Database.client.db('stickbot').collection('players');
    Database.servers = Database.client.db('stickbot').collection('servers');
  }

  static async lookupMany(
    steamids: string[]
  ): Promise<DatabasePlayerEntry[] | null> {
    if (!steamids.length) {
      return null;
    }

    return (await Database.players
      .find({
        _id: { $in: steamids }
      })
      .toArray()) as DatabasePlayerEntry[];
  }

  static async lookupOne(steamid: string): Promise<DatabasePlayerEntry | null> {
    return (
      ((await Database.players.findOne({
        _id: steamid
      })) as DatabasePlayerEntry) ?? null
    );
  }
}

new Database();

export default Database;
