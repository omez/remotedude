"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const path = require("path");
const fs = require("fs");
const dispatcher = require("./MqttDispatcher");
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
                const filename = this.regex.exec(arg)[2];
                const alias = uuid.v1() + path.extname(filename);
                const newArg = arg.replace(this.regex, '$1' + `%${alias}%` + '$2');
                return new Promise((res, rej) => {
                    console.log('Uploading file=%s as alias=%s', filename, alias);
                    if (!fs.existsSync(filename))
                        throw new Error(`File '${filename}' does not exists`);
                    this.client.publish(dispatcher.topicFile + '/' + alias, fs.readFileSync(filename));
                    this.client.on('message', (topic, message, packet) => {
                        if (topic == dispatcher.topicFileAck) {
                            if (message == alias) {
                                res(newArg);
                            }
                        }
                    });
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
            setTimeout(() => rej('Processing timeout'), 1000);
            const subscriber = (topic, message, packet) => {
                switch (topic) {
                    case dispatcher.topicExit:
                        res(parseInt(message));
                        break;
                    case dispatcher.topicStdout:
                        process.stdout.write(message);
                        break;
                    case dispatcher.topicStderr:
                        process.stderr.write(message);
                        break;
                }
            };
            this.client.subscribe(topics);
            this.client.on('message', subscriber);
            this.client.publish(dispatcher.topicCommand, args.join(' '));
        });
    }
}
exports.MqttClient = MqttClient;
