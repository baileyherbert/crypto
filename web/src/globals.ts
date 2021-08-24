import { WebEngine } from './engine/WebEngine';

function getSubscription(): string {
	const workspace = window as any;

	if (workspace.subscription === undefined) {
		alert('Unknown subscription!');
		throw new Error('There was no subscription set in the global workspace');
	}

	return workspace.subscription;
}

function getWS(): string {
	const workspace = window as any;

	if (workspace.ws === undefined) {
		alert('Unknown ws!');
		throw new Error('There was no ws set in the global workspace');
	}

	return workspace.ws;
}

function getWSPath(): string | undefined {
	const workspace = window as any;

	if (workspace.wsPath === undefined) {
		return;
	}

	return workspace.wsPath;
}

export const Backend = new WebEngine({
	url: getWS(),
	path: getWSPath(),
	account: getSubscription()
});
