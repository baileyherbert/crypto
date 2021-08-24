import App from './App.svelte';
import { Backend } from 'src/globals';

const app = new App({
	target: document.body
});

Backend.start();

export default app;
