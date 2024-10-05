import { Collection, MongoClient } from 'mongodb';
import type { WithId, Document } from 'mongodb'
import * as path from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '.env') });

type TagEntry = {
  addedby: string,
  date: number
}

export interface DatabasePlayerEntry extends WithId<Document> {
  addresses: {
    [ip: string]: {
      game: string,
      date: number
    }
  }[],
  bandata: {
    vacbans: number,
    gamebans: number,
    communityban: boolean,
    tradeban: boolean
  },
  names: {
    [name: string]: number
  }[],
  notifications: {
    [guildid: string]: {
      ban: string[],
      name: string[],
      log: string[]
    }
  },
  tags: {
    [guildid: string]: {
      cheater?: TagEntry,
      suspicious?: TagEntry,
      popular?: TagEntry,
      banwatch?: TagEntry
    }
  }
};

type DatabaseServerEntry = {

};

class Database {
  private static client: MongoClient | null = null;

  private static players: Collection<Document>;
  private static servers: Collection<Document>;

  constructor() {
    if (Database.client) {
      return;
    }

    Database.client = new MongoClient(process.env.DATABASE_URL!);

    Database.players = Database.client.db('stickbot')
      .collection('players');

    Database.servers = Database.client.db('stickbot')
      .collection('servers');  
  }

  static async lookup(...steamids: any[]): Promise<DatabasePlayerEntry | DatabasePlayerEntry[] | null> {
    if (!steamids?.length) {
      return null;
    } else if (steamids.length > 1) {
      return await Database.players.find({
        _id: { $in: steamids }
      }).toArray() as DatabasePlayerEntry[]; 
    }

    return await Database.players.findOne({
      _id: steamids[0]
    }) as DatabasePlayerEntry ?? null;
  }
}

new Database();

export default Database;