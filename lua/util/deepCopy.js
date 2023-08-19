function deepArray(arr) {
	let copy = [];
	for (let i = 0; i < arr.length; i++) {
		copy[i] = deepCopy(arr[i]);
	}
	return copy;
}
function deepObj(obj) {
	let copy = [];
	for (let k in obj) {
		copy[k] = deepCopy(arr[k]);
	}
	return copy;
}

export function deepCopy(obj) {
	if (!(typeof obj === 'object')) return obj;
	let copy = Array.isArray(obj) ? [] : {};
	for (let k in obj) {
		if (Array.isArray(obj)) k = Number(k);
		let item = obj[k];
		if (typeof item === 'object' && Array.isArray(item)) {
			copy[k] = deepArray(item);
		} else if (typeof item === 'object') {
			copy[k] = deepObj(item);
		} else {
			copy[k] = item;
		}
	}
	return copy;
}
