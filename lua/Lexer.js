const spec = [
	[/^--.*/, null],
	[/^;/, 'SEMICOLON'],
	[/^\s+/, null],

	[/^(\+|-|\*|\/|\.\.|\^|\%|not\b)/, 'OPERATOR'],
	[/^(==|~=|>=|<=|>|<|or\b|and\b)/, 'CONDITIONAL'],

	[/^("|')(\\\1|((?!\1).))*\1/, 'STRING'],
	[/^((\d|_)+\.?(\d|_)+|\.?(\d|_)+)\b/, 'NUMBER'],
	[/^(true|false)\b/, 'BOOLEAN'],

	[/^\=/, 'ASSIGN'],
	[/^return\b/, 'RETURN'],

	[/^elseif\b/, 'ELSE_IF'],
	[/^end\b/, 'END'],
	[/^else\b/, 'ELSE'],
	[/^if\b/, 'IF'],
	[/^local\b/, 'LOCAL'],
	[/^function\b/, 'FUNCTION'],
	[/^then\b/, 'THEN'],

	[/^,/, 'COMMA'],
	[/^\./, 'PERIOD'],

	[/^\(/, 'LPAR'],
	[/^\)/, 'RPAR'],

	[/^\{/, 'LBRACK'],
	[/^\}/, 'RBRACK'],

	[/^\[/, 'LSBRACK'],
	[/^\]/, 'RSBRACK'],

	[/^[A-Za-z_][A-Za-z0-9_]*/, 'IDENTIFIER'],
];

export default class Lexer {
	constructor(code = '', filename = 'runtime') {
		this.code = code;
		this.filename = filename;

		this.pointer = 0;
		this.position = {
			line: 1,
			char: 1,
		};
	}
	isEOF() {
		return this.pointer >= this.code.length;
	}

	nextToken() {
		if (this.isEOF()) return null;
		for (let value of spec) {
			let match = this.match(value[0]);
			if (match == null) continue;
			if (value[1] == null) return this.nextToken();
			return {
				value: value[1] === 'STRING' ? match.slice(1, -1) : match,
				type: value[1],
				position: {
					line: this.position.line,
					char: this.position.char - match.length,
				},
			};
		}
		throw new SyntaxError("Unknown token '" + this.code.charAt(this.pointer) + "' at " + this.errorPos());
	}

	errorPos() {
		return '[' + (this.filename == null ? '' : this.filename + ':') + this.position.line + ':' + this.position.char + ']';
	}

	match(regex = new RegExp()) {
		let match = regex.exec(this.code.substring(this.pointer));
		if (match == null) return null;

		this.pointer += match[0].length;
		let lines = (match[0].match(/\n/gi) || []).length;

		if (lines === 0) this.position.char += match[0].length;
		else {
			this.position.char = 1;
			this.position.line += lines;
		}

		return match[0];
	}
}
