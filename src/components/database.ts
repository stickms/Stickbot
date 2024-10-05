import { Collection, MongoClient } from 'mongodb';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '.env') });

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

  static async lookup(...steamids: any[]): Promise<any> {
    if (!steamids?.length) {
      return {};
    } else if (steamids.length > 1) {
      return await Database.players.find({
        _id: { $in: steamids }
      }).toArray(); 
    }

    return await Database.players.findOne({
      _id: steamids[0]
    }) ?? {};
  }
}

new Database();

export default Database;