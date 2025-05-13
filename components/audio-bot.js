import { createAudioResource, createAudioPlayer, getVoiceConnection, 
        NoSubscriberBehavior, AudioPlayerStatus, } from '@discordjs/voice';

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
        this.playAudio(this.queue[0].stream_url); 
      } else {
        this.loop = 'off';
      }
    });
  }
    
  playAudio(url) {
    const connection = getVoiceConnection(this.id);
    if (!connection) return;

    const resource = createAudioResource(url);
    this.audioplayer.play(resource);
    connection.subscribe(this.audioplayer);
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
      this.playAudio(this.queue[0].stream_url);
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

  addQueue(url, stream_url, chan = null) {
    if (chan) this.textchan = chan;
    if (this.queue.push({ url, stream_url }) == 1) {
      this.playAudio(this.queue[0].stream_url);
    }
  }

  getQueue() {
    return this.queue.map((item) => item.url);
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

export const audiobot = new AudioBot();