/*
Handles audio playback into voice channels.
*/
'use strict';
const config = require('../config.json');

/*
Plays the next file in queue for the guild represented by guildId.
@param {Discord.Client} client
@param {Number} 		guildID
*/
const playNext = async function(client, guildId) {
	if(client.audioQueue.get(guildId).length === 0) {
		return;
	}
	const message = client.audioQueue.get(guildId)[0].message;
	const filename = client.audioQueue.get(guildId)[0].filename;
	const voiceChannel = client.audioQueue.get(guildId)[0].voiceChannel;
	const currentVoiceConnection = client.voice.connections.get(guildId);
	client.audioQueue.get(guildId).shift();
	
	// Delete message if configured to and has permission to
	if(config.deleteAfterSound && client.guilds.cache.get(guildId).me.hasPermission('MANAGE_MESSAGES')) {
		message.delete();
	}

	// Play voice file in the correct channel
	let dispatcher;
	try {
		if(currentVoiceConnection && currentVoiceConnection.channel.id === voiceChannel.id) {

				console.log('Attempting to play something on ' + currentVoiceConnection.channel.id);
				dispatcher = client.voice.connections.get(guildId).play(filename, config.soundSettings);
			}
		else {
			try {
				if(currentVoiceConnection) {
					currentVoiceConnection.disconnect();
					
				}
				const newConnection = await voiceChannel.join();
				newConnection.on('error', () => {
					console.log('Connection Error, Sorry about that.');
				});
				console.log('Playing ' + filename);
				dispatcher = newConnection.play(filename, config.soundSettings);
			}
			catch(error) {
				console.log('Connection Error, Sorry about that.');
			}
		}
		dispatcher.on('finish', () => {
			module.exports.playNext(client, guildId);
		});
		dispatcher.on('error', () => {
			console.log('Connection Error, Sorry about that.');
		});
	}
	catch(error) {
		console.error(error);
	}
};

module.exports = {
	playNext: playNext,
};

/*
Adds audio file into queue for the guild.
@param {Discord.Client} client
@param {Discord.VoiceChannel} voiceChannel (required for case where user switches channels after queuing)
@param {Discord.Message} message
@param string filename
*/
module.exports.addAudio = function(client, voiceChannel, message, filename) {
	const guildId = message.member.voice.channel.guild.id;
	client.audioQueue.get(guildId).push({
		message: message,
		filename: filename,
		voiceChannel: voiceChannel,
	});
	// If the bot isn't playing something in that guild currently, connect and play the clip in the right channel
	if(client.voice.connections.get(guildId)) {
		if(client.voice.connections.get(guildId).speaking.bitfield === 0) {
			module.exports.playNext(client, guildId);
		}
	}
	else{
		module.exports.playNext(client, guildId);
	}
};