const play = require('play-dl');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, getVoiceConnection, 
    entersState, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');

class GuildTracker {
    constructor(guildId) {
        this.createPlayer();
        this.id = guildId;
        this.textchan = 0;
        this.queue = [];
        this.loop = 'off';
    }

    createPlayer() {
        this.audioplayer = createAudioPlayer({
            behaviors: { 
                noSubscriber: NoSubscriberBehavior.Pause,
                maxMissedFrames: undefined
            }
        });

        this.audioplayer.on(AudioPlayerStatus.Idle, async () => {
            if (this.loop == 'one') {
                this.queue.splice(1, 0, this.queue[0]);
            } else if (this.loop == 'all') {
                this.queue.push(this.queue[0]);
            }
    
            this.queue.shift();
    
            if (this.queue[0]) {
                playAudio(this.queue[0]); 
            } else {
                this.loop = 'off';
            }
        });
    }
    
    playAudio(url) {
        const connection = getVoiceConnection(this.id);
	    if (!connection) return;

        play.stream(url).then((stream) => {
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            this.audioplayer.play(resource);
            connection.subscribe(this.audioplayer);
        });
    }

    resetAll() {
        this.queue = [];
        this.loop = 'off';
    }

    getPlayer() {
        return this.audioplayer;
    }

    skip() {
        if (!this.queue.length) return;
        this.queue.shift();
        
        if (this.queue.length) {
            this.playAudio(this.queue[0]);
        } else {
            this.audioplayer.stop();
            this.loop = 'off';
        }
    }

    clear() {
        this.queue = [];
        this.loop = 'off';
        this.audioplayer.stop();
    }

    setLoop(mode) {
        this.loop = mode;
    }

    addQueue(url, chan = null) {
        if (chan) this.textchan = chan;
        if (this.queue.push(url) == 1) {
            this.playAudio(this.queue[0]);
        }
    }

    getQueue() {
        return this.queue;
    }

    getTextChannel() {
        return this.textchan;
    }
}

class AudioBot {
    constructor() {
        this.trackers = {};
    }

    get(guildId) {
        if (!this.trackers[guildId]) {
            this.trackers[guildId] = new GuildTracker(guildId);
        }

        return this.trackers[guildId];
    }
}

module.exports = {
    audiobot: new AudioBot()
}