import { request } from "undici";
import ShortUniqueId from 'short-unique-id';
import assert from 'assert';
import buzzphrase from 'buzzphrase';
import { setTimeout as wait } from "timers/promises";
import pLimit from 'p-limit';

const limit = pLimit(20);

const uid = new ShortUniqueId({ length: 10 });
const host = process.env.HOST || 'http://localhost:3000/';
let errorCount = 0;

const attemptsMax = process.env.ATTEMPTS || Number(process.argv[2]);
const delay = process.env.DELAY || Number(process.argv[3]);
const departmentId = process.env.DEPARTMENT || process.argv[4];

function showHelp() {
	console.log(`
QueueFlooder - Flood omnichannel queue with N requests of rooms
Usage: node index.js [ATTEMPTS] [DELAY]

	[PERSONAS] - The number of personas to create
	[DELAY] - The amount of time to wait between requests (in seconds)
	[DEPARTMENT] - The department to use for the personas
	`);
}

const personaTotalTime = [];
const visitorCreationTime = [];
const roomCreationTime = [];
const messageCreationTime = [];
const fetchMessagesTime = [];
const send2ndMessageTime = [];
const fetch2ndMessagesTime = [];

function printStats() {
	const totalOpTime = personaTotalTime.reduce((a, b) => a + b / 1000, 0) - 5 * personaTotalTime.length;
	const avgPersonaTime = totalOpTime / personaTotalTime.length;
	const avgVisitorCreationTime = visitorCreationTime.reduce((a, b) => a + b / 1000, 0) / visitorCreationTime.length;
	const avgRoomCreationTime = roomCreationTime.reduce((a, b) => a + b / 1000, 0) / roomCreationTime.length;
	const avgMessageCreationTime = messageCreationTime.reduce((a, b) => a + b / 1000, 0) / messageCreationTime.length;
	const avgFetchMessagesTime = fetchMessagesTime.reduce((a, b) => a + b / 1000, 0) / fetchMessagesTime.length;
	const avgSend2ndMessageTime = send2ndMessageTime.reduce((a, b) => a + b / 1000, 0) / send2ndMessageTime.length;
	const avgFetch2ndMessagesTime = fetch2ndMessagesTime.reduce((a, b) => a + b / 1000, 0) / fetch2ndMessagesTime.length;
	
	console.table({
		'Total Persona Time': totalOpTime.toFixed(2),
		'Average Persona Time': avgPersonaTime.toFixed(2),
		'Average Visitor Creation Time': avgVisitorCreationTime.toFixed(2),
		'Average Room Creation Time': avgRoomCreationTime.toFixed(2),
		'Average Message Creation Time': avgMessageCreationTime.toFixed(2),
		'Average Fetch Messages Time': avgFetchMessagesTime.toFixed(2),
		'Average Send 2nd Message Time': avgSend2ndMessageTime.toFixed(2),
		'Average Fetch 2nd Messages Time': avgFetch2ndMessagesTime.toFixed(2),
	});
}

// create visitor
async function createVisitor() {
	const visitorToken = uid();
	const visitorObj = {
		token: visitorToken,
		email: `${visitorToken}@gmail.com`,
		name: `Test Queue ${ visitorToken }`,
		department: departmentId,
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

// fetch messages from room
async function fetchMessages(visitor, room) {
	const { messages } = await (await request(`${ host }api/v1/livechat/messages.history/${ room._id }?token=${ visitor.token }`)).body.json();
	assert(messages, 'Messages are present');
	assert(messages.length > 0, 'Messages sent are here');
}

async function measureActionTo(action, arr) {
	const start = new Date();
	const returnValue = await action();
	arr.push(new Date() - start);

	return returnValue;
}

// represents a persona and the actions it can perform with a hardcoded delay. Each persona will:
// 1. create itself
// 2. create a room
// 3. send a message to the room
// 4. fetch messages from the room
// 5. send a message to the room
// 6. fetch messages from the room again
// 7. end
async function persona(start) {
	const { visitor } = await (await measureActionTo(createVisitor, visitorCreationTime)).body.json() || {};

	await wait(1000)
	const { room } = await (await measureActionTo(() => createRoomForVisitor(visitor), roomCreationTime)).body.json() || {};

	await wait(1000)
	const { message } = await (await measureActionTo(() => sendMessageToRoom(visitor, room), messageCreationTime)).body.json() || {};
	assert(message, 'Message is present');

	await wait(1000)
	await measureActionTo(() => fetchMessages(visitor, room), fetchMessagesTime);

	await wait(1000)
	await measureActionTo(() => sendMessageToRoom(visitor, room), send2ndMessageTime);

	await wait(1000)
	await measureActionTo(() => fetchMessages(visitor, room), fetch2ndMessagesTime);

	console.log(`Persona ${ visitor.token } done in ${ new Date() - start }ms`);
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
		console.error('Impossible to reach server, or to create a new room, or to create a new visitor, or to send a new message. ');
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
	console.log('Cmon, be nice to server')
	process.exit(1);
}

const op = [];
function init() { 
	console.log('Starting...');
	for (let i = 0; i < attemptsMax; i++) {
		op.push(limit(() => run(delay * 1000)));
	}

	Promise.all(op).then(() => {
		printStats();
	});
}

init();
console.log(`Started requesting ${ attemptsMax } rooms with a delay of ${ delay } seconds`);