#!/usr/bin/env node
/**
 * Server executable for remotedude
 *
 * Created by omez on 24.03.17.
 */

import * as commander from 'commander';
import mosca = require('mosca');
import { Avrdude } from '../Avrdude';
import { MqttDispatcher, MqttDispatcherInterface } from '../MqttDispatcher';

const packageJson: { version: string, description: string } = require('../../package.json');

commander
	.version(packageJson.version)
	.description(packageJson.description)
	.usage('[options]')
	.option('-p, --port [1883]', 'Port to start server', parseInt)
	.option('-e, --avrdude-executable [/usr/bin/avrdude]', 'Avrdude executable')
	.option('-c, --avrdude-config [none]', 'Avrdude configuration file path')
	.parse(process.argv);

const options = commander.opts();

const mqttSettings = {
	port: options.port || 1883
}

const avrdude = new Avrdude(options.executable || 'avrdude', options.config);


// create server
const server = new mosca.Server(mqttSettings);
server.on('ready', () => {
	console.log(`Started remotedude server on port ${mqttSettings.port}`);
});

server.on('error', (err) => {
	console.error(err);
});


// create attached clients
let dispatchers: {[id: string]: MqttDispatcherInterface } = {};

server.on('clientConnected', (client) => {
	console.log(`Client id=${client.id} connected`);

	dispatchers[client.id] = new MqttDispatcher(avrdude, client.id, (topic, data) => {
		server.publish({
			topic: topic,
			payload: data,
			quos: 0,
			retain: false
		}, client);
	});

});

server.on('clientDisconnected', (client) => {
	console.log(`Client id=${client.id} disconnected`);
	dispatchers[client.id].terminate();
	delete dispatchers[client.id];

});

server.on('published', (packet, client) => {
	if (!client) return;
	if (dispatchers[client.id] === undefined) return;

	console.log(`Dispatching topic=${packet.topic} for id=${client.id}`);
	dispatchers[client.id].dispatch(packet.topic, packet.payload);

});