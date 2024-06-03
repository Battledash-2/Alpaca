import Environment from '../Environment.js';

export const global = {
	print: typeof print !== "undefined" ? print : console.log,
	io: {
		read: prompt,
		write: alert,
	},
	tonumber: (n) => {
		let num = Number(n);
		if (isNaN(num)) return null;
		return num;
	},
	tostring: (a) => String(a),
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
