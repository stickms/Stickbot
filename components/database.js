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

  static async lookupSteamId(steamid) {
    if (typeof steamid !== typeof SteamID) {
      steamid = new SteamID(steamid);
    }

    const query = await Database.#players.findOne({
      _id: steamid.getSteamID64()
    });

    return query ?? {};
  }
}

new Database();

export default Database;