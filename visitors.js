import { request } from "undici";
import assert from 'assert';
import buzzphrase from 'buzzphrase';
import ShortUniqueId from 'short-unique-id';
import { setTimeout as wait } from "timers/promises";


import { parseHost } from "./utils.js";
import { answerRoom } from "./agents.js";

const uid = new ShortUniqueId({ length: 10 });
let host = parseHost(process.env.HOST);
const departmentId = process.env.DEPARTMENT || process.argv[4];

const visitorCreationTime = [];
const roomCreationTime = [];
const messageCreationTime = [];
const fetchMessagesTime = [];
const send2ndMessageTime = [];
const fetch2ndMessagesTime = [];

function parseNaNValue(value) {
	return (Number.isNaN(value) ? 0 : value).toFixed(2);
}

export function printStats(total) {
	const totalOpTime = total.reduce((a, b) => a + b / 1000, 0) - 5 * total.length;
	const avgPersonaTime = totalOpTime / total.length;
	const avgVisitorCreationTime = visitorCreationTime.reduce((a, b) => a + b / 1000, 0) / visitorCreationTime.length;
	const avgRoomCreationTime = roomCreationTime.reduce((a, b) => a + b / 1000, 0) / roomCreationTime.length;
	const avgMessageCreationTime = messageCreationTime.reduce((a, b) => a + b / 1000, 0) / messageCreationTime.length;
	const avgFetchMessagesTime = fetchMessagesTime.reduce((a, b) => a + b / 1000, 0) / fetchMessagesTime.length;
	const avgSend2ndMessageTime = send2ndMessageTime.reduce((a, b) => a + b / 1000, 0) / send2ndMessageTime.length;
	const avgFetch2ndMessagesTime = fetch2ndMessagesTime.reduce((a, b) => a + b / 1000, 0) / fetch2ndMessagesTime.length;
	
	console.table({
		'Total Persona Time': totalOpTime.toFixed(2),
		'Average Persona Time': parseNaNValue(avgPersonaTime),
		'Average Visitor Creation Time': parseNaNValue(avgVisitorCreationTime),
		'Average Room Creation Time': parseNaNValue(avgRoomCreationTime),
		'Average Message Creation Time': parseNaNValue(avgMessageCreationTime),
		'Average Fetch Messages Time': parseNaNValue(avgFetchMessagesTime),
		'Average Send 2nd Message Time': parseNaNValue(avgSend2ndMessageTime),
		'Average Fetch 2nd Messages Time': parseNaNValue(avgFetch2ndMessagesTime),
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
	assert(messages.length > 0, 'No messages found');
}

async function measureActionTo(action, arr) {
	const start = new Date();
	const returnValue = await action();
	arr.push(new Date() - start);

	return returnValue;
}

async function consumeBody(request) {
	const body = await request.body.json();
	if (request.statusCode !== 200) {
		console.dir({
			statusCode: request.statusCode,
			error: body.error,
			fullBody: body,
		});
		return {};
	}

	return body;
}

// represents a persona and the actions it can perform with a hardcoded delay. Each persona will:
// 1. create itself
// 2. create a room
// 3. send a message to the room
// 4. fetch messages from the room
// 5. send a message to the room
// 6. fetch messages from the room again
// 7. end
export async function persona(start, agent) {
	const { visitor } = await consumeBody(await measureActionTo(createVisitor, visitorCreationTime));
	assert(visitor, 'Visitor was not created');

	await wait(1000)
	const { room } = await consumeBody(await measureActionTo(() => createRoomForVisitor(visitor), roomCreationTime));
	assert(room, 'Room was not created');

	await wait(1000)
	const { message } = await consumeBody(await measureActionTo(() => sendMessageToRoom(visitor, room), messageCreationTime));
	assert(message, 'Message is not present');

	await wait(1000)
	await measureActionTo(() => fetchMessages(visitor, room), fetchMessagesTime);

	await wait(1000)
	await measureActionTo(() => sendMessageToRoom(visitor, room), send2ndMessageTime);

	await wait(1000)
	await measureActionTo(() => fetchMessages(visitor, room), fetch2ndMessagesTime);

	if (agent) {
		console.log(`\tPersona ${ visitor.token } is being answered by agent ${ agent.username }`);
		try {
			await answerRoom(room, agent);
		} catch (e) {
			console.error(`\tPersona ${ visitor.token } could not be answered by agent ${ agent.username }`, e);
		}
	}

	console.log(`Persona ${ visitor.token } done in ${ new Date() - start }ms`);
}