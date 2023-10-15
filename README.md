# Stickbot

Discord bot made by Stick in JavaScript with Discord.JS

## Functionality

Stickbot is a Discord bot that helps you keep track of Steam profiles that you want to log or keep track of.

It also has some other cool features.

__Stickbot features:__

* Steam profile lookups

* Tagging profiles (cheaters, suspcious players, etc.)

* Sourcebans scraping

* Playerlist exporting in various formats

* Ban watch and notifying

* Music commands (queue, playlist support, YouTube search, direct file links)

## File Formatting

### Bot configuration formatting

Tokens and other secrets can be placed in a `.env` file. They are as follows:

```yaml
CLIENT_ID           # Discord bot Client ID
DISCORD_TOKEN       # Discord bot token
STEAM_TOKENS        # Comma-deliminated list of SteamWebAPI tokens

# Optional (but highly recommended) below

RUST_TOKEN          # Rustbanned.com token
SOUNDCLOUD_TOKEN    # Soundcloud.com account token
SPOTIFY_TOKEN       # Spotify developer token
SPOTIFY_SECRET      # Spotify developer secret token
SPOTIFY_REFRESH     # Spotify developer refresh token
```

Other configuration settings can be changed in `components/bot-config.js` and are commented accordingly.

### playerlist.json formatting

`playerlist.json` will be automatically created when the bot runs for the first time and doesn't automatically detect the file. Its format is as follows:

```yaml
{
    "players": {
        "STEAM-ID-HERE": {
            "tags": {
                "cheater": {
                    "addedby": "511661119996297226",
                    "date": 1669857194
                }
            },
            "addresses": {
                "91.216.250.42:27015": {
                    "game": "Team Fortress 2",
                    "date": 1669857194
                }
            },
            "notifications": {
                "ban": [
                    "511661119996297226"
                ]
            },
            "bandata": {
                "vacbans": 0,
                "gamebans": 0,
                "communityban": false,
                "tradeban": false,
            }
        }
    },
    "servers": {
        "944816654569844796": {
            "banwatch": "1020127285229146112"
            "welcome": {
                "channel": "1020127285229146112",
                "join": "{name} just left {guild}!",
                "leave": "bye bye {name}..."
            }
        }
    }
}
```
