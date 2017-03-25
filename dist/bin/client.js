"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt = require("mqtt");
const MqttClient_1 = require("../MqttClient");
const host = 'localhost:1883';
const uri = 'mqtt://' + host;
const client = mqtt.connect(uri);
let args = process.argv.slice(2);
const mqttClient = new MqttClient_1.MqttClient(client);
new Promise((res, rej) => {
    setTimeout(() => rej(new Error('Connection timeout')), 1000);
    client.on('connect', () => res(args));
}).then((args) => {
    return mqttClient.execute(args);
}).then((exitCode) => {
    console.log('Exited after promise = %d', exitCode);
    process.exitCode = exitCode;
    client.end();
}).catch((err) => {
    console.error(err);
    client.end(true);
    process.exit(0);
});
