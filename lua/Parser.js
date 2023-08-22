import Lexer from './Lexer.js';

/*
Naming schemes:
    tokens / keys / values = CAPS
    operations = lows
*/

function toBoolean(item) {
	if (item === 'true') return true;
	if (item === 'false') return false;
	return !!item;
}

export default class Parser {
	static PrimitiveValues = ['NUMBER', 'STRING', 'BOOLEAN', 'NULL'];

	/**
	 * @param {Lexer|String} lexer
	 * @param {String?} filename
	 */
	constructor(lexer, filename = 'runtime') {
		if (typeof lexer === 'string') lexer = new Lexer(lexer, filename);

		this.filename = lexer.filename;
		this.token = lexer.nextToken();
		this.lexer = lexer;
		this.skipSemi = true;
	}

	paren() {
		this.advance('LPAR', 'left bracket');
		let item = this.additionStatement();
		this.advance('RPAR', 'right bracket');
		return this.suffix(item, true, false, true);
	}

	argumentList(type) {
		let rpar = this.token.type == 'LPAR';
		if (rpar) this.advance('LPAR', 'left bracket');

		const args = [];
		while (this.token.type !== 'RPAR') {
			if (!type) {
				args.push(this.suffix(this.additionStatement()));
			} else args.push(this.advance(type));

			if (!rpar) break;
			if (this.token.type !== 'RPAR' && rpar) this.advance('COMMA');
		}

		if (rpar) this.advance('RPAR', 'right bracket');
		return args;
	}

	linked(left) {
		while (this.token && this.token.type === 'PERIOD') {
			this.advance('PERIOD', '.');
			left = {
				type: 'linked',
				brack: false,
				position: left.position,
				left: left,
				right: this.identifier(),
			};
		}
		return this.suffix(left);
	}
	bracked(left) {
		while (this.token && this.token.type === 'LSBRACK') {
			this.advance('LSBRACK', '[');
			left = {
				type: 'linked',
				brack: true,
				position: left.position,
				left: left,
				right: this.additionStatement(),
			};
			this.advance('RSBRACK', ']');
		}
		return this.suffix(left);
	}

	suffix(identifier, func = true, assign = true, linked = true) {
		let res = identifier;
		if (this.token && (this.token.type === 'LPAR' || this.token.type == 'LBRACK' || Parser.PrimitiveValues.includes(this.token.type))) {
			res = {
				type: 'function_call',
				identifier: res,
				arguments: this.argumentList(false),
				position: identifier.position,
			};
		} else if (this.token && this.token.type === 'SEMICOLON') this.advanceWithSemi('SEMICOLON');
		if (this.token && this.token.type === 'PERIOD' && linked) {
			res = this.linked(res);
		}
		if (this.token && this.token.type === 'LSBRACK' && linked) {
			res = this.bracked(res);
		}
		// if (this.token && this.token.type === 'ASSIGN') {
		// 	this.advance('ASSIGN', '=');
		// 	res = {
		// 		type: 'set_variable',
		// 		identifier: res,
		// 		value: this.additionStatement(),
		// 		position: identifier.position,
		// 	};
		// }
		return res;
	}

	identifier(token = false) {
		const identifier = this.advanceWithSemi('IDENTIFIER');
		if (token) identifier.type = 'TOKEN';
		return this.suffix(identifier);
	}

	function() {
		let position = this.advance('FUNCTION').position;
		let res = {
			type: 'function_define',
			identifier: this.token.type === 'IDENTIFIER' ? this.advance('IDENTIFIER') : null,
			parameters: this.argumentList('IDENTIFIER'),
			body: this.statementList('END'),
			position,
		};
		return res;
	}

	prefixStatement(type, astType, ignoreType) {
		const position = this.advance(type).position;
		return {
			type: astType,
			statement: ignoreType != null ? (this.token.type === ignoreType ? null : this.additionStatement()) : this.additionStatement(),
			position,
		};
	}

	ifStatement() {
		const position = this.token.position;
		const statements = [];
		let fail;

		while (this.token.type !== 'END') {
			// console.log(this.token);
			if (this.advance(['IF', 'ELSE_IF'])) {
				let statement = this.additionStatement();
				this.advance('THEN');
				let body = this.statementList(['ELSE', 'END', 'ELSE_IF']);

				// let tok = this.advance(['END', 'ELSE', 'ELSE_IF']);
				statements.push({
					statement,
					body,
				});

				if (this.token.type === 'END') {
					this.advance('END');
					break;
				} else if (this.token.type === 'ELSE') {
					this.advance('ELSE');
					fail = this.statementList('END');
					break;
				}
			}
		}

		return {
			type: 'if_statement',
			fail,
			statements,
			position,
		};
	}

	array(pos) {
		let res = [];

		while (this.token.type !== 'RBRACK') {
			res.push(this.additionStatement());
			if (this.token.type !== 'RBRACK') this.advance('COMMA');
		}

		this.advance('RBRACK');
		return {
			type: 'array',
			content: res,
			position: pos,
		};
	}

	betweenBrack() {
		this.advance('LSBRACK');
		let val = this.additionStatement();
		this.advance('RSBRACK');
		return val;
	}

	objectToken() {
		if (this.token.type === 'LSBRACK') return this.betweenBrack();
		else {
			let id = this.advance('IDENTIFIER');
			id.type = 'TOKEN';
			return id;
		}
	}

	object(pos) {
		let res = [];

		let oldSemi = this.skipSemi;
		this.skipSemi = false;

		while (this.token.type !== 'RBRACK') {
			// let token = this.advance('IDENTIFIER').value;
			let token = this.objectToken();

			this.advance('ASSIGN');

			let value = this.additionStatement();
			res.push([token, value]);
			if (this.token.type !== 'RBRACK') this.advance(['COMMA', 'SEMICOLON']);
		}

		this.skipSemi = oldSemi;
		this.advance('RBRACK');
		return {
			type: 'object',
			content: res,
			position: pos,
		};
	}

	objectOrArray() {
		let pos = this.advance('LBRACK').position;
		if (Parser.PrimitiveValues.includes(this.token.type)) return this.array(pos);
		return this.object(pos);
	}

	primary() {
		switch (this.token && this.token.type) {
			case 'LBRACK':
				return this.objectOrArray();
			case 'NUMBER': {
				let value = Number(this.token.value);
				return {
					...this.advance('NUMBER'),
					value,
				};
			}
			case 'STRING':
				return this.advance('STRING');
			case 'BOOLEAN':
				let value = toBoolean(this.token.value);
				return {
					...this.advance('BOOLEAN'),
					value,
				};
			case 'LPAR':
				return this.paren();
			case 'IDENTIFIER':
				return this.identifier();
			case 'FUNCTION':
				return this.function();
			case 'LOCAL':
				return this.prefixStatement('LOCAL', 'local');
			// return this.local();
			case 'RETURN':
				return this.prefixStatement('RETURN', 'return', 'END');
			case 'IF':
				return this.ifStatement();
		}
		throw new SyntaxError("Unhandled primary token type '" + (this.token && this.token.type) + "' " + this.lexer.errorPos());
	}

	unary() {
		let operator, num;

		if (this.token && this.token.type === 'OPERATOR' && (this.token.value === '+' || this.token.value === '-' || this.token.value === 'not')) {
			operator = this.token;
			this.advance('OPERATOR');
		}

		num = this.primary();
		if (operator != null) {
			return {
				type: 'unary',
				operator: operator.value,
				right: num,
				position: operator.position,
			};
		}

		return num;
	}

	conditionalStatement(up, isOp) {
		let left = up.bind(this)();

		// thanks https://stackoverflow.com/questions/24436469/order-of-evaluation-with-mixed-logical-and-relational-operators#:~:text=Lua%27s%20full%20precedence%20table%20can%20be%20found%20here%3A,as%201%20or%20%28%282%20%3D%3D%203%29%20and%204%29.
		while (this.token != null && this.token.type === 'CONDITIONAL' && isOp(this.token)) {
			let operator = this.token.value;
			this.advance('CONDITIONAL');
			let right = up.bind(this)();

			left = {
				type: 'condition',
				operator,
				left,
				right,
				position: left.position,
			};
		}

		return left;
	}

	defineStatement() {
		let left = this.unary();

		while (this.token != null && this.token.type === 'ASSIGN') {
			this.advance('ASSIGN', '=');
			let right = this.additionStatement();

			left = {
				type: 'set_variable',
				identifier: left,
				value: right,
			};
		}

		return left;
	}

	comparitiveStatement() {
		// ==|~=|>=|<=|>|<|or|and
		return this.conditionalStatement(this.defineStatement, (t) => t.type === 'CONDITIONAL' && ['==', '~=', '>=', '<=', '<', '>'].includes(t.value));
	}
	combinationalComparitiveStatement() {
		return this.conditionalStatement(this.comparitiveStatement, (t) => t.type === 'CONDITIONAL' && (t.value === 'and' || t.value === 'or'));
	}

	opStatement(up, isOp) {
		let left = up.bind(this)();

		while (this.token != null && isOp(this.token)) {
			let operator = this.token.value;
			this.advance('OPERATOR');
			let right = up.bind(this)();

			left = {
				type: 'operation',
				operator,
				left,
				right,
				position: left.position,
			};
		}

		return left;
	}

	exponentialStatement() {
		return this.opStatement(this.combinationalComparitiveStatement, (t) => t.type === 'OPERATOR' && t.value === '^');
	}

	multiplicationStatement() {
		return this.opStatement(this.exponentialStatement, (t) => t.type === 'OPERATOR' && (t.value === '*' || t.value === '/' || t.value === '%'));
	}
	additionStatement() {
		return this.opStatement(this.multiplicationStatement, (t) => t.type === 'OPERATOR' && (t.value === '+' || t.value === '-' || t.value === '..'));
	}

	statementList(endKey, position = this.token && this.token.position) {
		const statements = [];

		while (this.token != null) {
			if (endKey != undefined && (typeof endKey === 'string' ? this.token.type === endKey : endKey.includes(this.token.type))) break;
			statements.push(this.additionStatement());
		}

		if (endKey && typeof endKey === 'string') this.advance(endKey); // if we put it in the if statement within the while loop, there's a chance it won't error and will just silently fail ok

		return {
			type: 'block',
			statements,
			position,
		};
	}

	advanceWithSemi(...a) {
		if (this.skipSemi) this.skipSemi = false;
		let r = this.advance(...a);
		this.skipSemi = true;
		return r;
	}

	advance(tokenType, displayType) {
		displayType = tokenType == null ? 'any' : displayType || (tokenType && typeof tokenType === 'string') ? tokenType : tokenType.join(' OR ');

		if (tokenType && this.token == null) throw new SyntaxError("Input abruptly ended while expecting '" + displayType + "' " + this.lexer.errorPos());
		if (tokenType && (typeof tokenType === 'string' ? this.token.type !== tokenType : !tokenType.includes(this.token.type))) {
			throw new SyntaxError("Unexpected token type '" + this.token.type + "' '" + this.token.value + "' while expecting '" + displayType + "' " + this.lexer.errorPos());
		}

		let old = this.token;
		// console.log(tokenType);
		// this.token = this.lexer.nextToken(!(tokenType === 'SEMICOLON' || (Array.isArray(tokenType) && tokenType.includes('SEMICOLON'))));
		this.token = this.lexer.nextToken(this.skipSemi);
		return old;
	}
}
