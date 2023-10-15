import { getVoiceConnection } from '@discordjs/voice';
import { audiobot } from '../components/audio-bot.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  try {
    if (!oldState.channelId) { 
      return;
    }

    const connection = getVoiceConnection(oldState.guild.id);
    if (connection?.joinConfig.channelId != oldState.channelId) {
      return;
    }

    let channel = await oldState.guild.channels.fetch(oldState.channelId);
    if (channel.members.size != 1) {
      return;
    }

    // Leaves the voice channel, and also pauses playback
    connection.destroy();

    const tracker = audiobot.get(oldState.guild.id);
    const chanid = tracker.getTextChannel();
    if (!chanid) {
      return;
    }

    channel = await oldState.guild.channels.fetch(chanid);
    const mode = tracker.getQueue().length ? 'pausing playback' : 'disconnecting';
    await channel.send(`🎵 Voice Chanel empty, ${mode}...`);    
  } catch (error) {
    // Sometimes we can't send a message in the corresponding channel
  }
}