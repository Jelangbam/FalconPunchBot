'use strict';
const Discord = require('discord.js');
const client = new Discord.Client();
client.audioQueue = new Discord.Collection();
const config = require('./config.json');
// const users = new SQLite(config.userDB);
const fs = require('fs');
const soundCommands = require('./soundCommands.js');

client.on('ready', async () => {
	await soundCommands.prepareSound(client);
	console.log('Bot Started!');
});

client.on('guildCreate', (guild) => {
	client.audioQueue.set(guild.id, []);
});

client.on('guildDelete', (guild) => {
	client.audioQueue.delete(guild.id);
});

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
		case 'help':
			message.channel.send(fs.readFileSync('./commands.txt').toString('utf-8'));
			break;
		case 'mostplayed':
			soundCommands.mostPlayed(message);
			break;
		case 'mostplayeddetailed':
			soundCommands.mostPlayedDetailed(message);
			break;
		case 'part':
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

client.login(config.token);