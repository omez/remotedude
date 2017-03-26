#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt = require("mqtt");
const minimist = require("minimist");
const MqttClient_1 = require("../MqttClient");
const options = minimist(process.argv.slice(2));
const dudeOpts = Object.keys(options).filter((key) => key != '_').reduce((args, key) => {
    const ukey = (key.length > 1 ? '--' : '-') + key;
    if (options[key] instanceof Array) {
        options[key].forEach((value) => args.push(ukey, value));
    }
    else {
        args.push(ukey, options[key]);
    }
    return args;
}, []);
const host = options._.length ? options._[0] : 'localhost:1883';
const uri = 'mqtt://' + host;
const client = mqtt.connect(uri);
let args = process.argv.slice(2);
const mqttClient = new MqttClient_1.MqttClient(client);
new Promise((res, rej) => {
    console.log('Connecting to %s...', uri);
    setTimeout(() => rej(new Error('Connection timeout')), 1000);
    client.on('connect', () => res(dudeOpts));
}).then((args) => {
    return mqttClient.execute(args);
}).then((exitCode) => {
    process.exitCode = exitCode;
    client.end();
}).catch((err) => {
    console.error(err);
    client.end(true);
    process.exit(0);
});
