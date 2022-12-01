# Stickbot

Discord bot made in JavaScript with Discord.JS

## Functionality

Stickbot is a Discord bot that helps you keep track of Steam profiles that you want to log or keep track of.

__Stickbot features:__

* Steam profile lookups

* Tagging profiles (cheaters, suspcious players, etc.)

* Sourcebans scraping

* Playerlist exporting in various formats

* Ban watch and notifying

* Music commands (queue, playlist support, YouTube search)

## File Formatting

### config.json formatting

`config.json` __must__ be placed in the same directory as index.js for it to work.

Make sure it's formatted exactly as below, note that `rust_token`, `soundcloud_id`, and `spotify_id` are optional:

```yaml
{
    "client_id": "YOUR-BOTS-CLIENT-ID",
    "discord_token": "YOUR-DISCORD-TOKEN",
    "steam_token": "YOUR-STEAMDEV-TOKEN",
    "rust_token": "RUSTBANNED.COM-API-TOKEN",
    "soundcloud_id": "SOUNDCLOUD-USER-ID",
    "spotify_id": {
        "client_id": "SPOTIFY-USER-ID",
        "client_secret": "SPOTIFY-API-SECRET",
        "refresh_token": "SPOTIFY-API-REFRESH",
        "market": "2-DIGIT-COUNTRY-CODE",
    },
    "sourceban_urls": { // Links of various Sourceban websites and their SteamID formats
        "https://www.skial.com/sourcebans/": 3,
        "https://lazypurple.com/sourcebans/": 2,
    }
}
```

### playerlist.json formatting

`playerlist.json` will be automatically created when the bot runs for the first time and doesn't automatically detect the file. Its format is as follows:

```yaml
{
    "players": {
        "STEAM-ID-HERE": {
            "tags": {
                "cheater": {
                    "addedby": "DISCORD-USER-ID",
                    "date": 1669857194 // Date Added
                }
            },
            "addresses": {
                "GAME-SERVER-IP": {
                    "game": "NAME-OF-GAME",
                    "date": 1669857194 // Date Played
                }
            },
            "notifications": {
                "ban": [
                    "DISCORD-USER-IDS"
                ]
            },
            "bandata": {
                "vacbans": 0, // Number of VAC Bans
                "gamebans": 0, // Number of Game Bans
                "communityban": false, // Community ban status
                "tradeban": false, // Trade ban status
            }
        }
    },
    "servers": {
        "<DISCORD-GUILD-ID>": {
            "banwatch": "CHANNEL-ID"
        }
    }
}
```
