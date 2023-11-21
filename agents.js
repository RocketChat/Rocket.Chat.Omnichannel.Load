import { request } from "undici";
import ShortUniqueId from 'short-unique-id';

import { parseHost } from "./utils.js";
import buzzphrase from "buzzphrase";

const uid = new ShortUniqueId({ length: 10 });

const host = parseHost(process.env.HOST);
const departmentId = process.env.DEPARTMENT || process.argv[4];

export async function getCurrentAgentList(onlyAvailable = true) {
	if (departmentId) {
		const response = await request(`${ host }api/v1/livechat/department/${ departmentId }`);
		const { agents } = response.body.json();

		return agents;
	}

	const response = await request(`${ host }api/v1/livechat/users/agent?onlyAvailable=${ onlyAvailable }`);
	const { agents } = response.body.json();

	return agents;
}

export async function checkAgents(adminUsername, adminPassword) {
	if (!adminUsername || !adminPassword) {
		throw new Error('Admin username and password are required when creating agents');
	}

	return createAgentUser(adminUsername, adminPassword, departmentId);
}

async function createAgentUser(adminUsername, adminPassword, departmentId) {
	const userData = uid();
	const user = await request(`${ host }api/v1/users.create`, { method: 'POST', headers: {
		'content-type': 'application/json',
		'X-User-Id': adminUsername,
		'X-Auth-Token': adminPassword,
	}, body: JSON.stringify({ 
		email: `${uid()}@rocket.chat`,
		joinDefaultChannels: false,
		username: userData,
		password: 'test',
		roles: ['livechat-agent', 'user', 'livechat-manager'],
		verified: true,
		name: 'testerio',
	 }) });

	 const result = await user.body.json();

	 if (!result.user) {
		console.error(result);
		throw new Error('Error creating agent user');
	 }

	 if (departmentId) {
		await request(`${ host }api/v1/livechat/department/${ departmentId }/agents`, { method: 'POST', headers: {
			'content-type': 'application/json',
			'X-User-Id': adminUsername,
			'X-Auth-Token': adminPassword,
		}, body: JSON.stringify({ upsert: [{ username: result.user.username, agentId: result.user._id, count: 0, order: 0 }] }) });
	 }

	return {
		username: userData,
		password: 'test',
	};
}

export async function sendAgentMessage(room, agent) {
	const result = await request(`${ host }api/v1/method.call/sendMessage`, { method: 'POST', headers: {
		'content-type': 'application/json',
		'X-User-Id': agent.userId,
		'X-Auth-Token': agent.authToken,
	}, body: JSON.stringify({ message: JSON.stringify({
		method: 'sendMessage',
		params: [{ rid: room._id, msg: buzzphrase.get({ iterations: 2 }) }],
		id: 'id',
		msg: 'method',
	})}) });

	const response = await result.body.json();
	console.log(`\tAgent ${ agent.userId } sent message to room ${ room._id }. Success: ${ !response.error }`);
}

export async function answerRoom(room, agent) {
	const response = await request(`${ host }api/v1/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: agent.username, password: agent.password }) });

	const { authToken, userId } = (await response.body.json()).data;

	return sendAgentMessage(room, { authToken, userId });
}