/**
 * Avrdude common files
 *
 * Created by omez on 24.03.17.
 */

import * as child from 'child_process';

export type FlagsType = string[] | string;
export type StdioCallback = (stdout, stdin)=>any;

export interface AvrdudeInterface {

	/**
	 * Executes avrdude with flags, bindings.
	 * Returns promise of execution code
	 *
	 * @param flags
	 * @param stdioCallback
	 */
	execute(flags: FlagsType, stdioCallback?: StdioCallback): Promise<number>;

}

export class Avrdude implements AvrdudeInterface {

	private readonly executable;
	private readonly config;

	public constructor(executable: string = 'avrdude', config?: string) {
		this.executable = executable;
		this.config = config;
	}

	public execute(flags: FlagsType, stdioCallback?: StdioCallback)  {

		if (typeof flags == 'string') {
			flags = [ flags ];
		}
		let args = flags;

		return new Promise((res, rej) => {

			if (this.config) args.push('-C', this.config);

			const process: child.ChildProcess = child.spawn(this.executable, args);

			// bind stdio callbacks
			if (stdioCallback) stdioCallback(process.stdout, process.stderr);

			// bind lifecycle callbacks
			process.on('exit', (code: string, signal: string) => {
				res(code);
			});
			process.on('error', (err: Error) => {
				rej(err);
			})
		});
	}

}