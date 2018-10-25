'use strict';
const Discord = require('discord.js');
const client = new Discord.Client();
client.audioQueue = new Discord.Collection();
const config = require('./config.json');
// const users = new SQLite(config.userDB);
const fs = require('fs');
const soundCommands = require('./soundCommands.js');

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
				console.log('Disconnecting! Have a good day!');
				client.destroy();
			}
			break;
		case 'description':
			if(message.author.id === config.admin) {
				soundCommands.modifyDescription(message);
			}
			break;
		case 'help':
			message.channel.send(fs.readFileSync('./help.txt').toString('utf-8'));
			break;
		case 'mostplayed':
			soundCommands.mostPlayed(message);
			break;
		case 'mostplayeddetailed':
			soundCommands.mostPlayedDetailed(message);
			break;
		case 'part':
		case 'leave':
			if(message.guild && (message.member.voice.channel === client.voiceConnections.get(message.guild.id).channel)) {
				client.voiceConnections.get(message.guild.id).disconnect();
				client.audioQueue.set(message.guild.id, []);
			}
			break;
		case 'search':
			soundCommands.search(message);
			break;
		default:
			soundCommands.soundFragment(client, message);
			break;
	}
});


// Force bot to leave if it is the last one in the channel.
client.on('voiceStateUpdate', (oldState) => {
	const voiceConnection = client.voiceConnections.get(oldState.guild.id);
	if(voiceConnection && voiceConnection.channel.members.size === 1) {
		voiceConnection.disconnect();
	}
});

client.login(config.token);