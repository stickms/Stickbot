import { type Client, Events } from 'discord.js';
import { updateDatabase } from '~/lib/update-data';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  // Update database every 24 hours
  //setInterval(updateDatabase, 86_400_000, client);
  updateDatabase(client);
  client.user.setPresence({
    activities: [{ name: 'Slash Commands!', type: 2 }]
  });

  console.log(`Ready! Logged in as ${client.user.tag}`);
}
