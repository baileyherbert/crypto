import { PromiseTimeoutSource } from '@baileyherbert/common';
import fs from 'fs';

export class FileWriteAggregator {

	private _active = new Set<string>();
	private _queued = new Map<string, string>();

	/**
	 * @param interval The number of milliseconds between executions.
	 */
	public constructor(public interval = 100) {

	}

	public write(path: string, content: string) {
		if (this._active.has(path)) {
			this._queued.set(path, content);
			return;
		}

		this._execute(path, content);
	}

	private async _execute(path: string, content: string) {
		this._active.add(path);
		await fs.promises.writeFile(path, content);

		this.interval > 0 && await new PromiseTimeoutSource(this.interval);
		this._active.delete(path);

		if (this._queued.has(path)) {
			const content = this._queued.get(path)!;
			this._queued.delete(path);
			this._execute(path, content);
		}
	}

}
