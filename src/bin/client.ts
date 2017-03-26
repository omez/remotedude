#!/usr/bin/env node

/**
 * Client implemetation for remote avrdude call
 *
 * Created by omez on 25.03.17.
 */

import * as mqtt from 'mqtt';
import * as minimist from 'minimist';
import {MqttClient} from "../MqttClient";


const options = minimist(process.argv.slice(2));


// transpose arguments
const dudeOpts = Object.keys(options).filter((key) => key != '_').reduce((args, key) => {
	const ukey = (key.length > 1 ? '--' : '-') + key;
	if (options[key] instanceof Array) {
		options[key].forEach((value) => args.push(ukey, value));
	} else {
		args.push(ukey, options[key]);
	}
	return args;
}, []);

const host = options._.length ? options._[0] : 'localhost:1883';
const uri = 'mqtt://' + host;

const client: mqtt.Client = mqtt.connect(uri);

const mqttClient = new MqttClient(client);

new Promise<any>((res, rej) =>{
	console.log('Connecting to %s...', uri);

	setTimeout(() => rej(new Error('Connection timeout')), 1000);
	client.on('connect', () => res(dudeOpts));
}).then((args) => {
	return mqttClient.execute(args);
}).then((exitCode: number) => {
	process.exitCode = exitCode;
	client.end();

}).catch((err) => {
	console.error(err);
	client.end(true);
	process.exit(0);
});
