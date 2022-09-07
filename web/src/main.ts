import App from './App.svelte';
import { Backend } from 'src/globals';

const app = new App({
	target: document.body
});

Backend.start();

export default app;

setInterval(() => {
	// @ts-ignore
	if (window.performance.memory) {
		// @ts-ignore
		if (window.performance.memory.totalJSHeapSize > (1024 * 1024 * 256)) {
			window.location.reload();
		}
	}
}, 120000);
