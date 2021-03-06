"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const path = require("path");
const fs = require("fs");
const dispatcher = require("./MqttDispatcher");
const os = require("os");
function normalizePath(filepath) {
    filepath = filepath.replace('~', os.homedir());
    if (!fs.existsSync(filepath))
        throw new Error(`File '${filepath}' does not exists`);
    return fs.realpathSync(filepath);
}
exports.normalizePath = normalizePath;
class MqttClient {
    constructor(client) {
        this.regex = /((?:eeprom|flash):[a-z]:)(.*)((?::[a-z]))?/i;
        this.client = client;
    }
    execute(args) {
        return Promise.resolve(args)
            .then((args) => {
            return this.processUploads(args);
        })
            .then((args) => {
            return this.processExecution(args);
        });
    }
    processUploads(args) {
        return Promise.all(args.map((arg) => {
            if (this.regex.test(arg)) {
                const filename = normalizePath(this.regex.exec(arg)[2]);
                const alias = uuid.v1() + path.extname(filename);
                const newArg = arg.replace(this.regex, '$1' + `%${alias}%` + '$3');
                return new Promise((res, rej) => {
                    console.log('Uploading file=%s as alias=%s', filename, alias);
                    if (!fs.existsSync(filename))
                        throw new Error(`File '${filename}' does not exists`);
                    this.client.subscribe(dispatcher.topicFileAck);
                    this.client.on('message', (topic, message, packet) => {
                        if (topic == dispatcher.topicFileAck) {
                            if (message == alias) {
                                res(newArg);
                            }
                        }
                    });
                    this.client.publish(dispatcher.topicFile + '/' + alias, fs.readFileSync(filename));
                });
            }
            else {
                return Promise.resolve(arg);
            }
        }));
    }
    processExecution(args) {
        console.log('Processing command args: %s', JSON.stringify(args));
        const topics = [dispatcher.topicExit, dispatcher.topicStdout, dispatcher.topicStderr];
        return new Promise((res, rej) => {
            let timeoutHandler;
            function heartbeat() {
                if (timeoutHandler)
                    clearTimeout(timeoutHandler);
                timeoutHandler = setTimeout(() => rej(new Error('Process execution timeout reached')), 5000);
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
exports.MqttClient = MqttClient;
