"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
exports.topicStdout = 'remotedude/stdout';
exports.topicStderr = 'remotedude/stderr';
exports.topicFile = 'remotedude/file';
exports.topicFileAck = 'remotedude/fileack';
exports.topicCommand = 'remotedude/command';
exports.topicExit = 'remotedude/exit';
class MqttDispatcher {
    constructor(avrdude, tag, publisher) {
        this.bindings = {};
        this.files = [];
        this.avrdude = avrdude;
        this.tag = tag;
        this.publisher = publisher;
    }
    dispatch(topic, payload) {
        switch (topic) {
            case exports.topicCommand:
                this.handleCommand(payload instanceof Buffer ? payload.toString() : payload);
                break;
            default:
                if (topic.substring(0, exports.topicFile.length + 1) == exports.topicFile + '/') {
                    this.handleFile(topic.substring(exports.topicFile.length + 1), payload);
                }
                break;
        }
    }
    terminate() {
        this.files = this.files.filter((filename) => {
            fs.unlinkSync(filename);
            console.log('[%s] file=%s removed', this.tag, filename);
            return false;
        });
        this.bindings = {};
    }
    handleFile(alias, content) {
        console.log('[%s] Handling file upload alias=%s of size=%d', this.tag, alias, content.length);
        const filename = path.resolve(__dirname, '../files', `${this.tag}-${alias}`);
        fs.writeFileSync(filename, content, {
            flag: 'w'
        });
        this.files.push(filename);
        this.bindings[alias] = filename;
        this.publisher(exports.topicFileAck, alias);
        console.log('[%s] Uploaded file alias=%s as path=%s', this.tag, alias, filename);
    }
    handleCommand(flags) {
        const args = flags.split(' ').map((part) => {
            for (let binding in this.bindings) {
                part = part.replace(`%${binding}%`, this.bindings[binding]);
            }
            return part;
        });
        console.log('[%s] Handling command with args: %s', this.tag, JSON.stringify(args));
        this.avrdude.execute(args, (stdout, stderr) => {
            stdout.on('data', (data) => this.publisher(exports.topicStdout, data));
            stderr.on('data', (data) => this.publisher(exports.topicStderr, data));
        }).then((code) => {
            console.log('[%s] Command completed with exit code=%d', this.tag, code);
            this.publisher(exports.topicExit, `${code}`);
        });
    }
}
exports.MqttDispatcher = MqttDispatcher;
