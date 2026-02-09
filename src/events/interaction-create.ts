import { Events, type Interaction } from 'discord.js';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  command.execute(interaction).catch(console.error);
}
