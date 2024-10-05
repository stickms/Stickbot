import { Client } from "discord.js";

export const name = 'ready';
export const once = true;

export async function execute(client: Client) {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	client.user.setPresence({
		activities: [ { name: 'Slash Commands!', type: 2 } ]
	});
}
