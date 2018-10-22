'use strict';
const config = require('./config.json');

const playNext = async function(client, guildId) {
	if(client.audioQueue.get(guildId).length == 0) {
		return;
	}
	const voiceChannel = client.audioQueue.get(guildId)[0].voiceChannel;
	const filename = client.audioQueue.get(guildId)[0].filename;
	const currentVoiceConnection = client.voiceConnections.get(guildId);
	client.audioQueue.get(guildId).shift();
	// if we aren't in the right channel
	if(!(currentVoiceConnection)) {
		const newConnection = await voiceChannel.join();
		const dispatcher = newConnection.play(filename, config.soundSettings);
		dispatcher.on('end', () => {
			module.exports.playNext(client, guildId);
		});
	}
	else if(currentVoiceConnection.channel.id !== voiceChannel.id) {
		currentVoiceConnection.disconnect();
		const newConnection = await voiceChannel.join();
		const dispatcher = newConnection.play(filename, config.soundSettings);
		dispatcher.on('end', () => {
			module.exports.playNext(client, guildId);
		});
	}
	else{
		const dispatcher = client.voiceConnections.get(guildId).play(filename, config.soundSettings);
		dispatcher.on('end', () => {
			module.exports.playNext(client, guildId);
		});
	}
};

module.exports = {
	playNext: playNext,
};

module.exports.addAudio = function(client, voiceChannel, filename) {
	const guildId = voiceChannel.guild.id;
	client.audioQueue.get(guildId).push({
		voiceChannel: voiceChannel,
		filename: filename,
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