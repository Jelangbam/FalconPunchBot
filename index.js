'use strict';
const Discord = require('discord.js');
const client = new Discord.Client();
client.audioQueue = new Discord.Collection();
const config = require('./config.json');
// const users = new SQLite(config.userDB);
const fs = require('fs');
const soundCommands = require('./soundCommands.js');
const audioHandler = require('./audioHandler.js');

client.on('error', (error) => console.log(error));

// Create soundDB if not there, check for new audio files, and create a queue.
client.on('ready', async () => {
	await soundCommands.prepareSound(client);
	console.log('Bot Started!');
});


// Handle the audio queue for when the bot joins and leaves servers
client.on('guildCreate', (guild) => {
	client.audioQueue.set(guild.id, []);
});

client.on('guildDelete', (guild) => {
	client.audioQueue.delete(guild.id);
});

// Command Handling
client.on('message', async (message) => {
	if(message.author.bot || message.content.indexOf(config.prefix) !== 0) {
		return;
	}
	const command = message.content.slice(config.prefix.length).split(' ');
	switch(command[0].toLowerCase()) {
		case 'alias':
			if(message.author.id === config.admin) {
				soundCommands.alias(message);
			}
			break;
		case 'dbsize':
			soundCommands.dbSize(message);
			break;
		case 'disconnect':
			if(message.author.id === config.admin) {
				await Promise.all(client.voiceConnections.map(async (connection) => await connection.disconnect()));
				await soundCommands.closeSound();
				console.log('Disconnecting! Have a good day!');
				client.destroy();
			}
			break;
		case 'description':
			if(message.author.id === config.admin) {
				soundCommands.modifyDescription(message);
			}
			break;
		case 'cleardata':
			if(message.author.id === config.admin) {
				soundCommands.clearData(message);
			}
			break;
		case 'help':
			message.channel.send(fs.readFileSync('./help.txt').toString('utf-8'));
			break;
		case 'mostplayed':
			soundCommands.mostPlayed(message, false);
			break;
		case 'mostplayeddetailed':
			soundCommands.mostPlayed(message, true);
			break;
		case 'part':
		case 'leave':
			if(message.guild && (message.member.voice.channel === client.voiceConnections.get(message.guild.id).channel)) {
				client.voiceConnections.get(message.guild.id).disconnect();
				client.audioQueue.set(message.guild.id, []);
			}
			break;
		case 'search':
			soundCommands.search(message, false);
			break;
		case 'searchword':
			soundCommands.search(message, true);
			break;
		case 'update':
			if(message.author.id === config.admin) {
				await soundCommands.updateSoundFiles();
			}
			break;
		default:
			soundCommands.soundFragment(client, message);
			break;
	}
});

// Force bot to leave if it is the last one in the channel.
client.on('voiceStateUpdate', (oldState) => {
	const voiceConnection = client.voiceConnections.get(oldState.guild.id);
	if(oldState.id !== client.user.id && voiceConnection && voiceConnection.channel.members.size === 1) {
		voiceConnection.disconnect();

		// Create new queue, removing stuff for the channel that is now empty
		const newQueue = [];
		for(const queueItem of client.audioQueue.get(oldState.guild.id)) {
			if(queueItem.voiceChannel.id !== oldState.channel.id) {
				newQueue.push(queueItem);
			}
			else if(config.deleteAfterSound && client.guilds.get(oldState.guild.id).me.hasPermission('MANAGE_MESSAGES')) {
				// delete messages that are queued in the channel that won't get played
				queueItem.message.delete();
			}
		}
		client.audioQueue.set(oldState.guild.id, newQueue);

		// Resume playing to other voice channels if they are in queue
		audioHandler.playNext(client, oldState.guild.id);
	}
});

client.login(config.token);