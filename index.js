import { setTimeout as wait } from "timers/promises";
import pLimit from 'p-limit';

import { persona, printStats } from './visitors.js';
import { checkAgents } from "./agents.js";

const limit = pLimit(20);


let errorCount = 0;

const attemptsMax = process.env.ATTEMPTS || Number(process.argv[2]);
const delay = process.env.DELAY || Number(process.argv[3]);
const agents = process.env.ENABLE_AGENTS || Number(process.argv[4]);
const username = process.env.ADMIN_ID;
const password = process.env.ADMIN_TOKEN;

function showHelp() {
	console.log(`
QueueFlooder - Flood omnichannel queue with N requests of rooms
Usage: node index.js [ATTEMPTS] [DELAY]

	[PERSONAS] - The number of personas to create
	[DELAY] - The amount of time to wait between requests (in seconds)
	[DEPARTMENT] - The department to use for the personas (optional)
	`);
}

const personaTotalTime = [];

async function run(delay) {
	let agent;
	try {
		agent = agents ? await checkAgents(username, password) : null;
		await wait(delay);

		const start = new Date();
		await persona(start, agent);
		personaTotalTime.push(new Date() - start);

		errorCount = 0;
	} catch(e) {
		errorCount++;
		console.error(e);
	} finally {
		// hardcoded limit cause we need limits somewhere
		if (errorCount > 20) {
			console.error('Max number of consecutive errors reached. Stopping');
			process.exit(1);
		}
	}
}

if (!attemptsMax || !delay) {
	showHelp();
	process.exit(1);
}

if (delay < 0.5) {
	console.log('Cmon, be nice to server. Delay should be at least 0.5 seconds')
	process.exit(1);
}

const op = [];
function init() { 
	for (let i = 0; i < attemptsMax; i++) {
		op.push(limit(() => run(delay * 1000)));
	}

	Promise.all(op).then(() => {
		printStats(personaTotalTime);
	});
}

init();
console.log(`Started requesting ${ attemptsMax } rooms with a delay of ${ delay } seconds`);