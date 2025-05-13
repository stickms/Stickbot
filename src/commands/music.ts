import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior } from '@discordjs/voice';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Plays a song!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = await interaction.guild.members.fetch(interaction.member.user.id);
  const voice = member.voice.channel;

  if (!voice) {
    await interaction.reply({
      content: '❌ Error: Please join a voice channel first'
    });

    return;
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  const resource = createAudioResource('URL');
  player.play(resource);

  const connection = joinVoiceChannel({
    channelId: voice.id,
    guildId: voice.guildId,
    adapterCreator: voice.guild.voiceAdapterCreator
  });

  connection.subscribe(player);	

  await interaction.reply({
    content: 'Playing song!',
  });
}
