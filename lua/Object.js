export default class LuaObject {
	constructor(record = {}, frozen = false) {
		this.frozen = frozen;
		this.array = Array.isArray(record);
		this.record = Array.isArray(record) ? Object.assign({}, record) : record;
	}

	get(item) {
		if (this.record.hasOwnProperty(item)) return this.record[item];
		return null;
	}

	set(item, value) {
		if (this.frozen) return false;
		this.record[item] = value;
		return true;
	}
}
