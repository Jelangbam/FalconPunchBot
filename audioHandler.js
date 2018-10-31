/*
Handles audio playback into voice channels.
*/
'use strict';
const config = require('./config.json');

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
	const currentVoiceConnection = client.voiceConnections.get(guildId);
	client.audioQueue.get(guildId).shift();
	if(config.deleteAfterSound && client.guilds.get(guildId).me.hasPermission('MANAGE_MESSAGES')) {
		message.delete();
	}
	let dispatcher;
	if(currentVoiceConnection && currentVoiceConnection.channel.id === voiceChannel.id) {
		try {
			dispatcher = client.voiceConnections.get(guildId).play(filename, config.soundSettings);
		}
		catch(error) {
			console.log(error);
		}
	}
	else {
		if(currentVoiceConnection) {
			await currentVoiceConnection.disconnect();
		}
		try {
			const newConnection = await voiceChannel.join();
			dispatcher = newConnection.play(filename, config.soundSettings);
		}
		catch(error) {
			console.log(error);
		}
	}
	dispatcher.on('end', () => {
		module.exports.playNext(client, guildId);
	});
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
	if(client.voiceConnections.get(guildId)) {
		if(client.voiceConnections.get(guildId).speaking.bitfield === 0) {
			module.exports.playNext(client, guildId);
		}
	}
	else{
		module.exports.playNext(client, guildId);
	}
};