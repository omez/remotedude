/**
 * Created by omez on 25.03.17.
 */

import * as mqtt from 'mqtt';
import * as uuid from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as dispatcher from './MqttDispatcher';

export class MqttClient {

	private readonly client: mqtt.Client;
	private readonly regex: RegExp = /((?:eeprom|flash):[a-z]:)(.*)((?::[a-z]))?/i;

	constructor(client: mqtt.Client) {
		this.client = client;
	}

	public execute(args: string[]): Promise<number> {
		return Promise.resolve(args)
			.then((args) => {
				return this.processUploads(args);
			})
			.then((args) => {
				return this.processExecution(args);
			});
	}

	private processUploads(args: string[]): Promise<string[]> {
		return Promise.all(args.map((arg: string) => {
			if (this.regex.test(arg)) {
				const filename = this.regex.exec(arg)[2];
				const alias = uuid.v1() + path.extname(filename);
				const newArg = arg.replace(this.regex, '$1' + `%${alias}%` + '$2');

				return new Promise<string>((res, rej) => {
					console.log('Uploading file=%s as alias=%s', filename, alias);
					if (!fs.existsSync(filename)) throw new Error(`File '${filename}' does not exists`);

					this.client.subscribe(dispatcher.topicFileAck);
					this.client.on('message', (topic, message, packet) => {
						if (topic == dispatcher.topicFileAck) {
							if (message == alias) {
								res(newArg);
							}
						}
					});

					// Handle file upload
					this.client.publish(dispatcher.topicFile + '/' + alias, fs.readFileSync(filename));

				});

			} else {
				return Promise.resolve(arg);
			}
		}));
	}

	private processExecution(args: string[]): Promise<number> {

		console.log('Processing command args: %s', JSON.stringify(args));
		const topics = [ dispatcher.topicExit, dispatcher.topicStdout, dispatcher.topicStderr ];

		return new Promise<number>((res, rej) => {

			let timeoutHandler;
			function heartbeat() {
				if (timeoutHandler) clearTimeout(timeoutHandler);
				timeoutHandler = setTimeout(()=>rej(new Error('Process execution timeout reached')), 5000);
			}

			const subscriber = (topic, message, packet) => {
				switch (topic) {
					case dispatcher.topicExit:
						clearTimeout(timeoutHandler);
						res(parseInt(message));
						break;

					case dispatcher.topicStdout:
						process.stdout.write(message);
						heartbeat();
						break;

					case dispatcher.topicStderr:
						process.stderr.write(message);
						heartbeat();
						break;
				}
			};

			this.client.subscribe(topics);
			this.client.on('message', subscriber);
			this.client.publish(dispatcher.topicCommand, args.join(' '));
			heartbeat();
		});

	}

}