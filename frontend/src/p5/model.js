import { future } from "../utils.js";

export class Grammar {
	constructor(axiom, rules) {
		this._state = axiom;
		this._rules = rules;
	}

	get state() {
		return this._state;
	}

	static parse(sentence) {
		// convert human friendly to machine suitable representation
		return sentence.split(" ").map(c => {
			let op = c[0];
			let arg = parseFloat(c.slice(1)) || undefined;
			return [op, arg];
		});
	}

	async generate() {
		let next_state = [];
		for (let [op, arg] of this._state) {
			if (this._rules.has(op)) {
				let rewriting = this._rules.get(op)(arg);
				next_state = next_state.concat(rewriting);
			} else {
				next_state.push([op, arg])
			}
		}
		this._state = next_state;
	}

	async epoch(e) {
		for (let i = 0; i < e; i++) {
			await this.generate();
		}
		return this;
	}
}

export class Tree {
	constructor(cvs, cmds) {
		this._cvs = cvs;
		this._cmds = cmds;
		this._vertices = [];
		this._leaf_vertices = [];
	}

	async compile(sentence) {
		let state = {
			len: this._cvs.height / 20,
			angle: 15,
			vtx: [],
			leaf_vtx: [],
			stack: [],
			turtle: new Turtle(),
			glue: -1,
		};

		for (let [op, arg] of sentence) {
			let action = this._cmds.get(op);
			if (action instanceof Function) {
				// wrap in a promise to give a change to the main loop to draw frames
				await future(_ => action(state, arg));
			}
		}

		this._vertices = state.vtx;
		this._leaf_vertices = state.leaf_vtx;

		return this;
	}

	draw() {
		let p = this._cvs;

		// setup reference frame
		p.translate(0, p.height / 2);
		p.rotateX(p.PI/2);

		// draw tree branches
		p.noFill();
		p.stroke(150, 100, 0);
		p.strokeWeight(3);
		p.beginShape(p.LINES);
		this._vertices.forEach(v => p.vertex(v.x, v.y, v.z));
		p.endShape();

		// draw tree leaves
		p.noFill();
		p.stroke(50, 200, 100);
		p.strokeWeight(0.5);
		p.beginShape(p.LINES);
		this._leaf_vertices.forEach(v => p.vertex(v.x, v.y, v.z));
		p.endShape();

		// draw vertices
		/*
		p.stroke(255,0,0);
		p.beginShape(p.POINTS);
		this._vertices.forEach(v => v());
		p.endShape();
		*/

	}
}


class Turtle {
	constructor() {
		this._rotation = new Quaternion(1, new p5.Vector(0,0,0)); // no initial rotation
		this._position = new p5.Vector(0,0,0);
	}

	get position() {
		return this._position.copy();
	}

	get head() { // versor of motion
		let h = new p5.Vector(0,0,1);
		return this._rotation.apply(h);
	}

	get side() {
		let r = new p5.Vector(1,0,0);
		return this._rotation.apply(r);
	}

	get ground() {
		let g = new p5.Vector(0,1,0);
		return this._rotation.apply(g);
	}

	pitch(p) {
		let q = Quaternion.from_euclidean(this.side, p);
		this._rotation = q.mult(this._rotation);
	}

	yaw(y) {
		let q = Quaternion.from_euclidean(this.ground, y);
		this._rotation = q.mult(this._rotation);
	}

	roll(r) {
		let q = Quaternion.from_euclidean(this.head, r);
		this._rotation = q.mult(this._rotation);
	}

	flip() {
		this.yaw(180);
	}

	move(len) {
		this._position.add(this.head.mult(len));
	}

	copy() {
		let t = new Turtle();
		t._rotation = this._rotation.copy();
		t._position = this._position.copy();
		return t;
	}
}

class Quaternion { // used to apply rotations on vectors
	constructor(real, pure, copy_vector = true) {
		this._real = real;
		if (copy_vector) {
			this._pure = pure.copy();
		} else {
			this._pure = pure;
		}
	}

	static from_euclidean(axis, angle) {
		let a = p5.prototype.radians(angle) / 2;
		let r = Math.cos(a);
		let p = axis.copy().mult(Math.sin(a));
		return new Quaternion(r, p, false);
	}

	get real() {
		return this._real;
	}

	get pure() {
		return this._pure.copy();
	}

	copy() {
		return new Quaternion(this._real, this._pure);
	}

	conj() {
		let q = this.copy();
		q._pure.mult(-1);
		return q;
	}

	apply(v) {
		return this .mult(new Quaternion(0, v)) .mult(this.conj()) ._pure;
	}

	mult(q) {
		// vw - V·W
		let r = this.real * q.real - this.pure.dot(q.pure);
		// vW + wV + V×W
		let p = (q.pure.mult(this.real)) .add(this.pure.mult(q.real)) .add(this.pure.cross(q.pure));

		return new Quaternion(r, p, false);
	}
}
