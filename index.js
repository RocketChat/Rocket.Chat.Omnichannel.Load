import { setTimeout as wait } from "timers/promises";
import pLimit from 'p-limit';

import { persona, printStats } from './visitors.js';

const limit = pLimit(20);


let errorCount = 0;

const attemptsMax = process.env.ATTEMPTS || Number(process.argv[2]);
const delay = process.env.DELAY || Number(process.argv[3]);

function showHelp() {
	console.log(`
QueueFlooder - Flood omnichannel queue with N requests of rooms
Usage: node index.js [ATTEMPTS] [DELAY]

	[PERSONAS] - The number of personas to create
	[DELAY] - The amount of time to wait between requests (in seconds)
	[DEPARTMENT] - The department to use for the personas (optional)
	`);
}

async function run(delay) {
	try {
		await wait(delay);

		const start = new Date();
		await persona(start);
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
		printStats();
	});
}

init();
console.log(`Started requesting ${ attemptsMax } rooms with a delay of ${ delay } seconds`);