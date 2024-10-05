import { BaseInteraction, MessageComponentInteraction } from "discord.js";

export const name = 'interactionCreate';

export async function execute(interaction: BaseInteraction) {
	if (!(interaction instanceof MessageComponentInteraction)) {
		return;
	}

	if (!interaction.customId.includes(':')) {
		return;
	}

	switch (interaction.customId.split(':')[0]) {
		case 'moreinfo':
			return handleMoreInfo(interaction);
		default:
			break;
	}
}

function handleMoreInfo(interaction: MessageComponentInteraction) {
	console.log(interaction);
}
