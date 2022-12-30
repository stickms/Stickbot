const { getVoiceConnection } = require('@discordjs/voice');
const { audiobot } = require('../audio-player');

module.exports = {
	name: 'voiceStateUpdate',
	async execute(oldState, newState) {
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

        const chanid = audiobot.get(oldState.guild.id).getTextChannel();
        if (!chanid) {
            return;
        }

        channel = await oldState.guild.channels.fetch(chanid);
        await channel.send('🎵 Voice Chanel empty, pausing playback...');
	},
};