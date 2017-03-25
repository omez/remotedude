/**
 * Client implemetation for remote avrdude call
 *
 * Created by omez on 25.03.17.
 */

import * as mqtt from 'mqtt';
import * as fs from 'fs';
import {MqttClient} from "../MqttClient";

const host = 'localhost:1883';
const uri = 'mqtt://' + host;

const client: mqtt.Client = mqtt.connect(uri);


// take arguments from commandline
let args = process.argv.slice(2);


const mqttClient = new MqttClient(client);


new Promise<any>((res, rej) =>{
	setTimeout(() => rej(new Error('Connection timeout')), 1000);
	client.on('connect', () => res(args));
}).then((args) => {
	return mqttClient.execute(args);
}).then((exitCode: number) => {

	console.log('Exited after promise = %d', exitCode);

	process.exitCode = exitCode;
	client.end();

}).catch((err) => {
	console.error(err);
	client.end(true);
	process.exit(0);
});
