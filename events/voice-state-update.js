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

        const tracker = audiobot.get(oldState.guild.id);
        const chanid = tracker.getTextChannel();
        if (!chanid) {
            return;
        }

        channel = await oldState.guild.channels.fetch(chanid);
        const mode = tracker.getQueue().length ? 'pausing playback' : 'disconnecting';
        await channel.send(`🎵 Voice Chanel empty, ${mode}...`);
	},
};