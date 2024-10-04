export const name = 'interactionCreate';

export async function execute(interaction) {
	const customid = interaction.customId;
	if (!customid?.includes(':')) {
		return;
	}
}
