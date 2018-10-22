# FalconPunchBot

FalconPunchBot is a personal Discord sound bot using [Discord.js](https://discord.js.org/) that is primarily for playing short soundclips to voice channels. 

## Features
Currently supports:
* Clip queuing: After the first clip finishes, the next clip queued will play in the appropriate channel.
* Alias support: Add aliases to your sound clips to give them more memorable commands.
* Search: Search for clips based on description or filename.
* Tracking: Tracks the most played clips from the bot. 

## Prerequisites
*Node v10 or later
*Microsoft Build Tools 2015

## Installation and Configuration
This is a personal bot for my own uses, but if you want to try it out:
* From command line (cmd or PowerShell), run `npm install`
* Open `config.json.example` in a text editor and edit the `admin` and `token` field with your user ID ex.(123456789012345678) and your bot's secret token.
* Take note of `soundDirectory`: Change it if you wish, then create the folder. For example if you have `"soundDirectory": "./clips/",` then create a clips folder in the root directory
* Add your sounds to the directory!
* Run the bot once, it should state the files added and "Bot Started!" if it works!
* If you wish to change the descriptions, use a SQLite DB viewer such as [this](https://sqlitebrowser.org/). Go to "sounds" table and edit the description columns. 
* If you wish to add Aliases, use a SQLite DB viewer to view the "aliases" table and add a new row with the alias value of the new alias, and a filename value of the path to the file you wish to link with the alias. 

## License
This project is licensed under the MIT License - see the LICENSE.md file for details


