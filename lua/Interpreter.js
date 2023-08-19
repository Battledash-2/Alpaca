import Environment from './Environment.js';
import LuaObject from './Object.js';
import Parser from './Parser.js';
import Global from './core/Global.js';

const print = console.log;

function hasEnv(func) {
	if (typeof func !== 'function') return false;
	return /(function\s*)?\w*\(_env/.test(func.toString());
}

class Internal {
	/**
	 * @param {"RETURN"|"OBJECT"|"IDENTIFIER"} type
	 * @param {*} value
	 */
	constructor(type, value) {
		this.type = type;
		this.value = value;
	}
}

export default class Interpreter {
	/**
	 * @param {Parser} parser
	 * @param {String?} filename
	 */
	constructor(parser, filename = 'runtime', env = Global(this)) {
		if (typeof parser === 'string') parser = new Parser(parser, filename);
		this.filename = parser.filename;
		this.parser = parser;
		this.token;

		this.ast = parser.statementList();
		this.env = env;
		this.top = env;
		this.inLocal = false;
	}

	errorPos(from = this.token, addl = 0, addc = 0) {
		return this.parser.lexer.errorPos.bind({
			position: {
				line: from.position.line + addl,
				char: from.position.char + addc,
			},
			filename: this.filename,
		})();
	}

	eval(ast = this.ast, varenv = this.env, obj = false, env) {
		env = env || varenv;

		const type = (type) => ast.type.toLowerCase() === type.toLowerCase();

		if (typeof ast === 'number' || typeof ast === 'string' || typeof ast === 'boolean' || typeof ast === 'function' || ast === null) {
			return ast;
		}

		this.token = ast;

		// Handle main stuff
		if (type('block')) {
			let output = undefined;
			for (let item of ast.statements) {
				if (item.type === 'return' && env === this.top) throw new Error("Cannot use 'return' in top-level " + this.errorPos(item));
				if (item.type === 'return') return new Internal('RETURN', this.eval(item.statement, env, obj));
				let val = this.eval(item, env, obj);
				if (val instanceof Internal && val.type === 'RETURN') {
					return val.value;
				}
			}
			return output;
		}

		// Handle return
		if (type('return')) {
			return this.eval(ast.statement, env);
		}

		// Identifiers
		if (type('identifier')) {
			if (obj) return ast.value;
			let res = this.get(env, ast.value);
			return res;
			// return env.resolveLookup(ast.value);
		}

		// Handle primitive values
		if (type('number') || type('string') || type('boolean') || type('token')) {
			return ast.value;
		}

		// Handle math operations
		if (type('operation')) {
			return this.operation(ast.operator, ast.left, ast.right, env);
		}
		// Local
		if (type('local')) {
			this.inLocal = true;
			let res = this.eval(ast.statement, env);
			this.inLocal = false;
			return res;
		}

		// Variables
		if (type('set_variable')) {
			// let name = this.eval(ast.identifier, env, true);
			let name = ast.identifier.value;

			if (name instanceof Internal && name.type === 'IDENTIFIER') name = name.value;
			if (!name.trim()) throw new EvalError('Name is false-ish ' + this.errorPos(ast.identifier));

			const val = this.eval(ast.value, env);

			if (this.inLocal) this.set(env, name, val);
			else this.set(this.top, name, val);

			return true;
		}

		// -- FUNCTIONS -- \\
		if (type('function_define')) {
			const funct = {
				name: (ast.identifier && ast.identifier.value) || null,
				env,
				body: ast.body,
				parameters: ast.parameters,
			};
			if (ast.identifier != null) env.define(ast.identifier.value, funct);
			return funct;
		}
		if (type('function_call')) {
			const funct = obj && typeof obj !== 'boolean' && ast.identifier.type === 'IDENTIFIER' ? this.get(obj, ast.identifier.value) : this.eval(ast.identifier, env);
			if (funct == null) throw new TypeError('Attempt to call a nil value at ' + this.errorPos(ast));

			if (typeof funct === 'function') {
				let f = hasEnv(funct);
				let a = ast.arguments.map((e) => this.eval(e, env));
				let r = f ? funct(env, ...a) : funct(...a);
				if (obj) return new Internal('RETURN', r);
				return r;
			}

			const args = {};
			for (let parIdx in funct.parameters) {
				let parName = funct.parameters[parIdx].value;
				if (ast.arguments[parIdx] == null) {
					args[parName] = null;
					continue;
				}
				let parVal = this.eval(ast.arguments[parIdx], env);
				args[parName] = parVal;
			}

			const fenv = new Environment(args, funct.env);
			if (obj) return new Internal('RETURN', this.eval(funct.body, fenv));
			let r = this.eval(funct.body, fenv);
			if (r instanceof Internal && r.type === 'RETURN') return r.value;
			return r;
		}

		// Unary
		if (type('unary')) {
			return this.unary(
				ast.operator,
				ast.right,
				{
					position: ast.position,
					filename: this.filename,
				},
				env
			);
		}

		// Conditionals
		if (type('condition')) {
			return this.conditional(ast.operator, ast.left, ast.right, env);
		}

		// If statements
		if (type('if_statement')) {
			for (let i in ast.statements) {
				let statement = ast.statements[i];
				if (this.eval(statement.statement, env)) return this.eval(statement.body, new Environment({}, env));
			}

			if (ast.fail != null) return this.eval(ast.fail, new Environment({}, env));

			return null;
		}

		// -- OOP -- \\
		if (type('array')) {
			return new LuaObject(
				ast.content.map((e) => this.eval(e, env)),
				false
			);
		}
		if (type('object')) {
			let record = {};
			for (let item of ast.content) {
				record[this.eval(item[0], env)] = this.eval(item[1], env);
			}
			return new LuaObject(record, false);
		}
		if (type('linked')) {
			if (ast.left.type === 'linked' && ast.right.type === 'linked') return this.bothLinked(ast, env, obj, varenv);
			else if (!ast.brack) return this.linked(ast, env, obj, varenv);
			else return this.brackLinked(ast, env, obj, varenv);
			// throw 'Unimplemented';
		}

		if (ast instanceof Internal && ast.type === 'RETURN') {
			return ast.value;
		}

		throw new EvalError("Unknown type '" + ast.type + "' " + this.errorPos(ast));
	}

	bothLinked(ast, env, obj) {
		let left = this.eval(ast.left, env, obj);
		return this.eval(ast.right, env, left);
	}
	brackLinked(ast, env, obj) {
		let evaled = this.eval(ast.left, env, ast.left.type === 'linked' || ast.left.type === 'IDENTIFIER' ? obj : false);
		let left = obj ? this.get(obj, evaled) : evaled;
		if (left == null) throw new TypeError('Attempt to index a nil value ' + this.errorPos(ast));

		return this.get(left, this.eval(ast.right, env, false));
	}
	linked(ast, env, obj) {
		if (ast.right.type === 'function_call') {
			let tright = ast.right.identifier;
			let tobj = { ...ast.right, identifier: ast };
			tobj.identifier.right = tright;
			return this.eval(tobj, env, obj);
		}

		let evaled = this.eval(ast.left, env, obj);
		let left = obj && ast.left.type !== 'function_call' ? this.get(obj, evaled) : evaled;
		if (left instanceof Internal && left.type === 'RETURN') left = this.getValueFromInternal(left);
		if (left == null) throw new TypeError('Attempt to index a nil value ' + this.errorPos(ast));

		if (ast.right.type === 'linked') {
			return this.eval(ast.right, env, left);
		} else {
			return this.get(left, ast.right.value);
		}
	}

	getValueFromInternal(internal) {
		while (internal instanceof Internal) {
			internal = internal.value;
		}
		return internal;
	}

	get(object, name) {
		if (object instanceof LuaObject && object.array && typeof name === 'number') return object.get(name - 1); // javascript arrays start from idx 0, lua starts from idx 1
		if (object instanceof Environment) return object.resolveLookup(name);
		if (typeof object === 'object' && !(object instanceof LuaObject)) return object[name];
		return object.get(name);
	}
	set(object, name, value, conzt = false) {
		if (object instanceof Environment) return object.set(name, value, conzt);
		if (typeof object === 'object' && !(object instanceof LuaObject)) return (object[name] = value);
		return object.set(name, value, conzt);
	}

	typeof(selector) {
		if (selector == null) return 'nil';
		return typeof selector;
	}

	conditional(operator, wleft, wright, env) {
		const left = this.eval(wleft, env);
		const right = this.eval(wright, env);

		// ==|~=|>=|<=|>|<|or|and
		switch (operator) {
			case '==':
				return left === right;
			case '~=':
				return left !== right;
			case '>=':
				return left >= right;
			case '<=':
				return left <= right;
			case '>':
				return left > right;
			case '<':
				return left < right;
			case 'or':
				return left || right;
			case 'and':
				return left && right;
		}

		throw new Error("Unhandled operator '" + operator + "' " + this.errorPos(wleft));
	}

	unary(operator, right, position, env) {
		right = this.eval(right, env);

		switch (operator) {
			case 'not':
				return !!!right;
			case '-':
				return -right;
			case '+':
				return +right;
		}

		throw new Error("Unkown operator '" + operator + "' " + this.errorPos(position));
	}

	operation(operator, wleft, wright, env) {
		const left = this.eval(wleft, env);
		const right = this.eval(wright, env);

		switch (operator) {
			case '+':
				return Number(left) + Number(right);
			case '-':
				return Number(left) - Number(right);
			case '*':
				return Number(left) * Number(right);
			case '/':
				return Number(left) / Number(right);
			case '^':
				return Number(left) ** Number(right);
			case '%':
				return Number(left) % Number(right);
			case '..':
				return String(left) + String(right);
		}

		throw new Error("Unknown operator '" + operator + "' " + this.errorPos(wleft));
	}
}
