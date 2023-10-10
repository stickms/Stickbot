const play = require('play-dl');
const { createAudioResource, createAudioPlayer, getVoiceConnection, 
        NoSubscriberBehavior, AudioPlayerStatus, } = require('@discordjs/voice');

class GuildTracker {
  constructor(guildId) {
    this.id = guildId;
    this.textchan = 0;
    this.queue = [];
    this.loop = 'off';

    this.createPlayer();
  }

  createPlayer() {
    this.audioplayer = createAudioPlayer({
      behaviors: { 
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    this.audioplayer.on(AudioPlayerStatus.Idle, () => {
      if (this.loop == 'one') {
        this.queue.splice(1, 0, this.queue[0]);
      } else if (this.loop == 'all') {
        this.queue.push(this.queue[0]);
      }

      this.queue.shift();

      if (this.queue.length) {
        this.playAudio(this.queue[0]); 
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
    }).catch(_ => {
      const resource = createAudioResource(url);
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