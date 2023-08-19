export default class Environment {
	constructor(
		record = {},
		parent = null,
		constant_record = {},
		frozen = false,
		interpreter = parent.interpreter
	) {
		this.record = record;
		this.const_record = constant_record;
		this.parent = parent;
		this.frozen = frozen;
		this.interpreter = interpreter;
	}

	define(name, value, conzt = false) {
		if (this.frozen) return false;
		if (
			conzt === true &&
			(this.record.hasOwnProperty(name) ||
				this.const_record.hasOwnProperty(name))
		)
			throw new ReferenceError(
				"Variable '" +
					name +
					"' already exists, cannot override as a constant " +
					this.interpreter.errorPos()
			);
		if (this.const_record.hasOwnProperty(name))
			throw new ReferenceError(
				"Cannot override a constant variable '" +
					name +
					"' " +
					this.interpreter.errorPos()
			);
		if (conzt === true) this.const_record[name] = value;
		else this.record[name] = value;
	}
	set(name, value, conzt = false) {
		const res = this.resolve(name);
		if (res == null) return this.define(name, value, conzt);
		res.define(name, value, conzt);
		return true;
	}

	lookup(name) {
		if (this.record.hasOwnProperty(name)) return this.record[name];
		if (this.const_record.hasOwnProperty(name))
			return this.const_record[name];
		return undefined;
	}
	resolve(name, within = this) {
		if (within == null) return null;
		if (
			within.record.hasOwnProperty(name) ||
			within.const_record.hasOwnProperty(name)
		)
			return within;
		return this.resolve(name, within.parent);
	}
	resolveLookup(name, within = this) {
		const res = this.resolve(name, within);
		if (res == null) return null;
		return res.lookup(name);
	}
}
