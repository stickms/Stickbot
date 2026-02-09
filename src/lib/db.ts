import { MongoClient } from 'mongodb';
import type { DatabasePlayerEntry } from '~/types';

const url = process.env.MONGO_DB_URL;
if (!url) {
  throw new Error('MONGO_DB_URL is not defined in environment variables');
}

const client = new MongoClient(url);

const playersDB = await client
  .connect()
  .then(() => client.db('stickbot').collection<DatabasePlayerEntry>('players'));

const serversDB = await client
  .connect()
  .then(() => client.db('stickbot').collection<DatabasePlayerEntry>('servers'));

export { playersDB, serversDB };
