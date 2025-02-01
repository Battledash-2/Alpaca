function serialize(text) {
	return text.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
}

const ColorCode = {
	identifier: '#ebebeb',
	constant: '#ffd286',
	string: '#9ef396',
	number: '#fd8733',
	comment: '#3e5263',
	keyword: '#da9ce4',
	operator: '#fe9d7c',
	call: '#7e96ed',
};

function makeColor(color, text) {
	return '<span style="color:' + color + ' !important">' + text + '</span>';
}

function colorFor(text) {
	let color = '';
	for (let item of spec) {
		// if (new RegExp(item[0].match(match))
		if (new RegExp('^' + item[0].source).exec(text) != null) {
			if (typeof item[1] === 'string') color = item[1];
			else if (typeof item[1] === 'function') return item[1](text);
			break;
		}
	}

	return color;
}

const spec = [
	[/("|')(\\\1|((?!\1).))*\1/, ColorCode.string],
	[/--.*/, ColorCode.comment],
	[/((\d|_)+\.?(\d|_)+|\.?(\d|_)+)\b/, ColorCode.number],
	[/[()\[\].*/\\+-=;{}]|&lt;|&gt;|\.\./, ColorCode.operator],
	[/(local|function|then|do|end|for|if|elseif|else|return|nil)\b/, ColorCode.keyword],
	[
		/[A-Za-z][A-Za-z0-9]*\(/,
		(match) => {
			return makeColor(ColorCode.call, match.slice(0, -1)) + makeColor(colorFor('('), '(');
		},
	],
	[/[a-z_][A-Za-z0-9_]*/, ColorCode.identifier],
	[/[A-Z][A-Za-z0-9_]*/, ColorCode.constant],
];

const regex = spec.reduce((prev, cur) => {
	return new RegExp((prev[0] == null ? prev.source : prev[0].source) + '|' + (cur[0] == null ? cur.source : cur[0].source), 'g');
});

function colorCode(code) {
	code = serialize(code);

	let out = code;
	out = out.replace(
		regex,
		// (match) => '<span style="color: ' + i[1] + '">' + match + '</span>'
		(match) => {
			let color = colorFor(match);
			return color === '' ? match : color.startsWith('<') ? color : makeColor(color, match);
		}
	);

	return out;
}

function addAt(string = '', add = '', from = 0) {
	return string.slice(0, from) + add + string.slice(from, string.length);
}

onload = () => {
	let tab = 0;
	let tabs = [
		['{', '}'], // [ start, end ]
		['(', ')'], // [ start, end ]
		['do', 'end'],
		['then', ['elseif', 'else', 'end']],
		['elseif', ['elseif', 'else', 'end']],
		['else', 'end'],
		[/\bfunction\s*(\s[a-zA-Z_][a-zA-Z0-9_]*)?\s*\([^\)]*\)/, 'end', 0.5],
	];
	let opened = [];

	function scroll() {
		let display = document.querySelector('#display');
		display.style.top = (-editor.scrollTop) + "px";
	}

	editor.addEventListener('input', (e) => {
		let display = document.querySelector('#display');
		scroll();
		const colored = colorCode(e.target.value);
		display.innerHTML = colored;
	});
	editor.addEventListener('scroll', scroll);
	editor.addEventListener('keydown', (e) => {
		let display = document.querySelector('#display');

		function getLine(start = e.target.selectionStart, text = e.target.value, idx = false) {
			idx = 0;
			let line = 0;
			let split = text.split('\n');
			let lastitem = null;

			let lineEnd = 0;
			let relstart = 0;

			for (let item of split) {
				if (item.length + idx + Math.max(0, split.length - 1) < start) {
					idx += item.length;
					line++;
					continue;
				}

				lastitem = item;
				idx += lastitem.length;
				lineEnd = idx + Math.max(0, line);

				break;
			}

			let rtext = split[Math.max(0, line)];

			return {
				line: Math.max(0, line),
				text: rtext,
				lineEnd,
				lineStart: lineEnd - rtext.length,
				selection: relstart,
			};
		}

		function replaceLine(text, line, nl) {
			let arr = text.split('\n').map((val, idx) => {
				return idx === line ? nl : val;
			});
			text = arr.join('\n');
			return text;
		}
		function check(str = e.target.value, v) {
			if (typeof v === 'string' || (typeof v === 'object' && v instanceof RegExp)) return (str.split(v) || [undefined]).length - 1;
			// array
			let count = 0;
			for (let i in v) {
				let vv = v[i];
				count += (str.split(vv) || [undefined]).length - 1;
			}
			return v.reduce((p, c) => p + ((str.split(c) || [undefined]).length - 1), 0);
		}
		function updateTabs(string = e.target.value) {
			tab = 0;
			opened = [];

			if (string === e.target.value) string = string.slice(0, e.target.selectionEnd);

			for (let i in tabs) {
				let v = tabs[i];
				// let count = (string.split(v[0]) || [undefined]).length - 1;
				let count = check(string, v[0]);
				if (v[2] != null) count = count * v[2];
				tab += count;
				opened = [...opened, ...new Array(count).fill(Number(i))];

				count = check(string, v[1]);
				if (count > 0 && opened.indexOf(Number(i)) > -1) {
					for (let i = 0; i < count; i++) {
						tab--;
						opened.splice(opened.indexOf(Number(i)), 1);
					}
				}
				tab = Math.max(0, tab);
			}
		}

		function checkCloser(argItem = null) {
			return opened.includes(e.key);
		}
		updateTabs();

		if (e.key === 'Tab') {
			e.preventDefault();
			let sel = e.target.selectionStart;
			let el = e.target.selectionEnd;

			if (sel === e.target.selectionEnd) {
				e.target.value = addAt(e.target.value, '\t', sel);
				e.target.selectionStart = sel + 1;
				e.target.selectionEnd = el + 1;
			} else {
				const line = getLine();
				const newLine = replaceLine(e.target.value, line.line, '\t' + e.target.value.slice(line.lineStart, line.lineEnd));
				e.target.value = newLine;
				e.target.selectionStart = sel;
				e.target.selectionEnd = el;
			}
		} else if (checkCloser(null)) {
			e.preventDefault();
			updateTabs();

			const line = getLine();
			const val = e.target.value;

			const sel = e.target.selectionStart;
			const el = e.target.selectionEnd;

			tab = Math.max(0, tab - 1);

			const nl = replaceLine(val, line.line, '\t'.repeat(tab) + val.slice(line.lineStart, sel).trimStart() + e.key + val.slice(sel, line.lineEnd));

			e.target.value = nl;

			let add = nl[sel] === '\n' ? 0 : 1;
			e.target.selectionStart = sel + add;
			e.target.selectionEnd = el + add;
		} else if (e.key === 'Enter' && !e.ctrlKey) {
			e.preventDefault();
			updateTabs();
			const start = e.target.selectionStart;
			const end = e.target.selectionEnd;
			const val = e.target.value;
			const add = '\n' + '\t'.repeat(tab);

			e.target.value = addAt(val, add, start);
			// e.target.selectionStart--;
			e.target.selectionStart = start + add.length;
			e.target.selectionEnd = end + add.length;
		}

		display.innerHTML = colorCode(e.target.value);
	});
};
