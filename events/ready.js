import { updatePlayerData } from '../components/update-data.js';

export const name = 'ready';
export const once = true;

export async function execute(client) {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	setInterval(updatePlayerData, 86_400_000, client); // every 24 hours
	client.user.setPresence({
		activities: [ { name: 'Slash Commands!', type: 2 } ]
	});
}