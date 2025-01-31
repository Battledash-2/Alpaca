import Environment from '../Environment.js';

export const global = {
	// ----------------------
	// -- Runtime Information
	_VERSION: "Alpaca 1.0",

	// ----------------------
	// -- Io Manipulation
	print: typeof print !== "undefined" ? print : console.log,
	io: {
		read: prompt,
		write: alert,
	},

	// ----------------------
	// -- Type Conversion
	tonumber: (n) => {
		let num = Number(n);
		if (isNaN(num)) return null;
		return num;
	},
	tostring: (a) => String(a),

	// ----------------------
	// -- Environment Handle
	getfenv(_env, f, l=-1) { 
		// -- Global Env -- \\
		if (typeof f === 'undefined' || typeof f === 'number') {
			l = typeof f === 'number' ? f : -1;
			if (l < 0) return _env;
			for (let i = 0; i < l; i++) {
				if (typeof _env.parent === 'undefined') return null;
				_env = _env.parent;
			}
			return _env;
		}

		// -- Function Env -- \\
		if (typeof f === 'function') throw new TypeError('Cannot modify internal function environment. (Alpaca V1.1 may provide this functionality.)');
		if (typeof f.type === 'undefined' || f.type !== 'function') throw new TypeError('Cannot getfenv of value \'' + f + '\'');

		if (l < 0) return f.env;
		let env = f.env;

		console.log(f.env);

		for (let i = 0; i < l; i++) {
			if (typeof env.parent === 'undefined') return null;
			env = env.parent;
		}
		return env;
	}
};
export const global_const = {};

export const _create = (add = {}, add_const = {}) => ({
	global: { ...global, ...add },
	conzt: Object.freeze({ ...global_const, ...add_const }),
});
export default function create(interpreter, add = {}) {
	const c = _create(add);
	return new Environment(c.global, null, c.conzt, false, interpreter);
}
