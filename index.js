import pkg from "undici";
import ShortUniqueId from 'short-unique-id';
import assert from 'assert';
import buzzphrase from 'buzzphrase';

const { request } = pkg;
const uid = new ShortUniqueId({ length: 10 });
const host = 'http://localhost:3000/';
let errorCount = 0;

function showHelp() {
	console.log(`
QueueFlooder - Flood omnichannel queue with N requests of rooms
Usage: node index.js [ATTEMPTS] [DELAY]

	[ATTEMPTS] - The number of requests for rooms to make
	[DELAY] - The amount of time to wait between requests (in milliseconds)
	`);
}

// create visitor
async function createVisitor() {
	const visitorToken = uid();
	const visitorObj = {
		token: visitorToken,
		email: `${visitorToken}@gmail.com`,
		name: `Test Queue ${ visitorToken }`,
		department: 'E8MZxRZuhdmgCAE2z',
	}

	return request(`${ host }api/v1/livechat/visitor`, { method: 'POST', headers: { 
		'content-type': 'application/json',
	}, body: JSON.stringify({ visitor: visitorObj }) }); // will return .body
}
// create room
async function createRoomForVisitor(visitor) {
	return request(`${ host }api/v1/livechat/room?token=${ visitor.token }`);
}

// send message to room (queue inquiry)
async function sendMessageToRoom(visitor, room) {
	const messageObj = {
		token: visitor.token,
		rid: room._id,
		msg: buzzphrase.get({ iterations: 2 }),
	}

	return request(`${ host }api/v1/livechat/message`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(messageObj) });
}

async function run() {
	try {
		const { visitor } = await (await createVisitor()).body.json() || {};
		const { room } = await (await createRoomForVisitor(visitor)).body.json();
		const message = await (await sendMessageToRoom(visitor, room)).body.json();

		assert(message, 'Message is present');
		errorCount = 0;
	} catch(e) {
		errorCount++;
		console.error('Impossible to reach server, or to create a new room, or to create a new visitor, or to send a new message. ');
	} finally {
		// hardcoded limit cause we need limits somewhere
		if (errorCount > 20) {
			console.error('Max number of consecutive errors reached. Stopping');
			process.exit(1);
		}
	}
}

const attemptsMax = Number(process.argv[2]);
const delay = Number(process.argv[3]);
if (!attemptsMax || !delay) {
	showHelp();
	process.exit(1);
}

if (delay < 100) {
	console.log('Cmon, be nice to server')
	process.exit(1);
}

let attempts = 1;
async function timeOut(time) {
	run()
	setTimeout(() => {
		attempts++;
		if (attempts < attemptsMax) {
			timeOut(time)
		}
	}, time);
}

timeOut(delay);
console.log(`Finished requesting ${ attemptsMax } rooms`);