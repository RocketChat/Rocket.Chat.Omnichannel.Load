export function parseHost(host) {
	if (!host) {
		return 'http://localhost:3000/';
	}

	if (!host.endsWith('/')) {
		return `${ host }/`;
	}

	return host;
}
