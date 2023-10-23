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

```js
CLIENT_ID           // Discord bot Client ID
DISCORD_TOKEN       // Discord bot token
STEAM_TOKENS        // Comma-deliminated list of SteamWebAPI tokens
DATABASE_URL        // MongoDB Database URL

// Optional (but highly recommended) below

RUST_TOKEN          // Rustbanned.com token
SPOTIFY_TOKEN       // Spotify developer token
SPOTIFY_SECRET      // Spotify developer secret token
SPOTIFY_REFRESH     // Spotify developer refresh token
```

Other configuration settings can be changed in `components/bot-config.js` and are commented accordingly.

## Steam Profile Database

Stickbot uses [MongoDB](https://github.com/mongodb/mongo) for databse operations. You will need your own MongoDB URL in order to use the bot. There are separate collections for Steam Profiles (`players`) and Server-specific data (`servers`).

### MongoDB formatting

For the `players` collection, a typical profile would look like this:

```yaml
{
    "_id": "76561197960287930",
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
    },
    "names": {
        "\"Rabscuttle\"": 1669857194
    }
}
```

A typical guild in the `servers` collection would look like this:

```yaml
{
    "_id": "944816654569844796",
    "banwatch": "1020127285229146112"
    "welcome": {
        "channel": "1020127285229146112",
        "join": "{name} just left {guild}!",
        "leave": "bye bye {name}..."
    }
}
```
