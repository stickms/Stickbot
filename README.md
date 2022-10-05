# Stickbot
Discord bot made in JavaScript with Discord.JS

## Functionality
Stickbot is a Discord bot that helps you keep track of Steam profiles that you run into and want to log or keep track of. 

__Stickbot features:__
* Steam profile lookups
* Tagging profiles (cheaters, suspcious players, etc.)
* Sourcebans scraping
* Playerlist exporting in various formats
* (WIP) Ban watch and notifying

### config.json formatting
`config.json` __must__ be placed in the same directory as index.js for it to work.

Make sure it's formatted exactly as below: 

```
{
    "discord_token": "YOUR-DISCORD-TOKEN",
	"steam_token": "YOUR-STEAMDEV-TOKEN",
    "client_id": "YOUR-BOTS-CLIENT-ID",
	"sourceban_urls": [
        "Links of various Sourcebans websites",
        "For example:",
        "https://www.skial.com/sourcebans/"
    ]
}
```

### playerlist.json formatting
`playerlist.json` will be automatically created when the bot runs for the first time and doesn't automatically detect the file. Its format is as follows:

```
{
    "STEAM-ID-HERE": {
        "tags": {
            "cheater": {
                addedby: DISCORD-USER-ID,
                date: DATE-ADDED
            }
        },
        "bandata": {
            "vacbans": NUM-VACBANS,
            "gamebans": NUM-GAMEBANS,
            "communityban": TRUE/FALSE,
            "tradeban": TRUE/FALSE
        }
    }
}
```