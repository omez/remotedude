"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child = require("child_process");
class Avrdude {
    constructor(executable = 'avrdude', config) {
        this.executable = executable;
        this.config = config;
    }
    execute(flags, stdioCallback) {
        if (typeof flags == 'string') {
            flags = [flags];
        }
        let args = flags;
        return new Promise((res, rej) => {
            if (this.config)
                args.push('-C', this.config);
            const process = child.spawn(this.executable, args);
            if (stdioCallback)
                stdioCallback(process.stdout, process.stderr);
            process.on('exit', (code, signal) => {
                res(code);
            });
            process.on('error', (err) => {
                rej(err);
            });
        });
    }
}
exports.Avrdude = Avrdude;
