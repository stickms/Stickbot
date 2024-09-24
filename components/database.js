import SteamID from 'steamid';

class Database {
  static #client = null;

  static #players;
  static #servers;

  constructor() {
    if (Database.#client) {
      return;
    }

    Database.#client = new MongoClient(process.env.DATABASE_URL);

    Database.#players = Database.#client.db('stickbot')
      .collection('players');

    Database.#servers = Database.#client.db('stickbot')
      .collection('servers');  
  }

  static async lookup(...steamids) {
    if (!steamids?.length) {
      return {};
    } else if (steamids.length > 1) {
      return await Database.#players.find({
        _id: { $in: steamids }
      }).toArray(); 
    }

    return await Database.#players.findOne({
      _id: steamids
    }) ?? {};
  }
}

new Database();

export default Database;