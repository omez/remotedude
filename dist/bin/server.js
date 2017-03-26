#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander = require("commander");
const mosca = require("mosca");
const Avrdude_1 = require("../Avrdude");
const MqttDispatcher_1 = require("../MqttDispatcher");
const os = require("os");
const packageJson = require('../../package.json');
const defaultAvrdude = os.type() == 'Windows_NT' ? "avrdude.exe" : 'avrdude';
commander
    .version(packageJson.version)
    .description(packageJson.description)
    .usage('[options]')
    .option('-p, --port [1883]', 'Port to start server', parseInt)
    .option('-e, --avrdude-executable [/usr/bin/avrdude]', 'Avrdude executable', defaultAvrdude)
    .option('-c, --avrdude-config [none]', 'Avrdude configuration file path')
    .parse(process.argv);
const options = commander.opts();
const mqttSettings = {
    port: options.port || 1883
};
const avrdude = new Avrdude_1.Avrdude(options.avrdudeExecutable, options.avrdudeConfig);
const server = new mosca.Server(mqttSettings);
server.on('ready', () => {
    console.log(`Started remotedude server on port ${mqttSettings.port}`);
});
server.on('error', (err) => {
    console.error(err);
});
let dispatchers = {};
server.on('clientConnected', (client) => {
    console.log(`Client id=${client.id} connected`);
    dispatchers[client.id] = new MqttDispatcher_1.MqttDispatcher(avrdude, client.id, (topic, data) => {
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
    if (!client)
        return;
    if (dispatchers[client.id] === undefined)
        return;
    console.log(`Dispatching topic=${packet.topic} for id=${client.id}`);
    dispatchers[client.id].dispatch(packet.topic, packet.payload);
});
