/**
 * Created by omez on 25.03.17.
 */

import {AvrdudeInterface} from './Avrdude';
import mosca = require('mosca');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';

export const topicStdout = 'remotedude/stdout';
export const topicStderr = 'remotedude/stderr';
export const topicFile = 'remotedude/file';
export const topicFileAck = 'remotedude/fileack';
export const topicCommand = 'remotedude/command';
export const topicExit = 'remotedude/exit';

export interface MqttDispatcherInterface {
	dispatch(topic, payload: Buffer|string): void;
	terminate(): void;
}

export class MqttDispatcher implements MqttDispatcherInterface {

	private readonly avrdude: AvrdudeInterface;
	private readonly tag: string;
	private readonly publisher: (topic, payload) => any;
	private readonly uploadDir: string;

	private bindings: {[key: string]: string} = {};
	private files: string[] = [];

	constructor(avrdude: AvrdudeInterface, tag: string, publisher: (topic, payload) => any) {
		this.avrdude = avrdude;
		this.tag = tag;
		this.publisher = publisher;

		this.uploadDir = os.tmpdir();
		if (!(fs.existsSync(this.uploadDir) && fs.statSync(this.uploadDir).isDirectory())) {
			throw new Error(util.format('Upload tmp path=%s is not reachable or not a directory', this.uploadDir));
		}
	}

	public dispatch(topic, payload: Buffer|string) {

		switch (topic) {

			case topicCommand:
				this.handleCommand(payload instanceof Buffer ? payload.toString(): payload);
				break;

			default:
				// files topic
				if (topic.substring(0, topicFile.length + 1) == topicFile + '/') {
					this.handleFile(topic.substring(topicFile.length + 1), payload);
				}
				break;
		}

	}

	public terminate() {
		// remove all uploaded files
		this.files = this.files.filter((filename) => {
			fs.unlinkSync(filename);
			console.log('[%s] file=%s removed', this.tag, filename);
			return false;
		});

		// remove all bindings
		this.bindings = {};
	}

	/**
	 * Handles file upload
	 *
	 * @param alias
	 * @param content
	 */
	protected handleFile(alias: string, content: Buffer | string) {
		console.log('[%s] Handling file upload alias=%s of size=%d', this.tag, alias, content.length);

		const filename = path.resolve(this.uploadDir, `${this.tag}-${alias}`);

		fs.writeFileSync(filename, content, {
			flag: 'w'
		});

		this.files.push(filename);
		this.bindings[alias] = filename;

		this.publisher(topicFileAck, alias);

		console.log('[%s] Uploaded file alias=%s as path=%s', this.tag, alias, filename);
	}

	protected handleCommand(flags: string) {

		const args = flags.split(' ').map((part: string) => {
			for (let binding in this.bindings) {
				part = part.replace(`%${binding}%`, this.bindings[binding]);
			}
			return part;
		});

		console.log('[%s] Handling command with args: %s', this.tag, JSON.stringify(args));

		this.avrdude.execute(args, (stdout, stderr) => {
			stdout.on('data', (data) => this.publisher(topicStdout, data));
			stderr.on('data', (data) => this.publisher(topicStderr, data));
		}).then((code) => {
			console.log('[%s] Command completed with exit code=%d', this.tag, code);
			this.publisher(topicExit, `${code}`);
		});


	}

}

