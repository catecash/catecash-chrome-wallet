(() => {
  // src/cate-keylib.mjs
  function Zt(n) {
    return n instanceof Uint8Array || ArrayBuffer.isView(n) && n.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in n && n.BYTES_PER_ELEMENT === 1;
  }
  function rt(n, t = "") {
    if (typeof n != "number") {
      let r = t && `"${t}" `;
      throw new TypeError(`${r}expected number, got ${typeof n}`);
    }
    if (!Number.isSafeInteger(n) || n < 0) {
      let r = t && `"${t}" `;
      throw new RangeError(`${r}expected integer >= 0, got ${n}`);
    }
  }
  function W(n, t, r = "") {
    let e = Zt(n), o = n?.length, s = t !== void 0;
    if (!e || s && o !== t) {
      let c = r && `"${r}" `, i = s ? ` of length ${t}` : "", f = e ? `length=${o}` : `type=${typeof n}`, a = c + "expected Uint8Array" + i + ", got " + f;
      throw e ? new RangeError(a) : new TypeError(a);
    }
    return n;
  }
  function At(n) {
    if (typeof n != "function" || typeof n.create != "function") throw new TypeError("Hash must wrapped by utils.createHasher");
    if (rt(n.outputLen), rt(n.blockLen), n.outputLen < 1) throw new Error('"outputLen" must be >= 1');
    if (n.blockLen < 1) throw new Error('"blockLen" must be >= 1');
  }
  function ht(n, t = true) {
    if (n.destroyed) throw new Error("Hash instance has been destroyed");
    if (t && n.finished) throw new Error("Hash#digest() has already been called");
  }
  function Ft(n, t) {
    W(n, void 0, "digestInto() output");
    let r = t.outputLen;
    if (n.length < r) throw new RangeError('"digestInto() output" expected to be of length >=' + r);
  }
  function P(...n) {
    for (let t = 0; t < n.length; t++) n[t].fill(0);
  }
  function Ot(n) {
    return new DataView(n.buffer, n.byteOffset, n.byteLength);
  }
  function G(n, t) {
    return n << 32 - t | n >>> t;
  }
  function wt(n, t) {
    return n << t | n >>> 32 - t >>> 0;
  }
  var we = typeof Uint8Array.from([]).toHex == "function" && typeof Uint8Array.fromHex == "function";
  var fn = Array.from({ length: 256 }, (n, t) => t.toString(16).padStart(2, "0"));
  function It(n) {
    if (W(n), we) return n.toHex();
    let t = "";
    for (let r = 0; r < n.length; r++) t += fn[n[r]];
    return t;
  }
  var tt = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
  function ye(n) {
    if (n >= tt._0 && n <= tt._9) return n - tt._0;
    if (n >= tt.A && n <= tt.F) return n - (tt.A - 10);
    if (n >= tt.a && n <= tt.f) return n - (tt.a - 10);
  }
  function Mt(n) {
    if (typeof n != "string") throw new TypeError("hex string expected, got " + typeof n);
    if (we) try {
      return Uint8Array.fromHex(n);
    } catch (o) {
      throw o instanceof SyntaxError ? new RangeError(o.message) : o;
    }
    let t = n.length, r = t / 2;
    if (t % 2) throw new RangeError("hex string expected, got unpadded hex of length " + t);
    let e = new Uint8Array(r);
    for (let o = 0, s = 0; o < r; o++, s += 2) {
      let c = ye(n.charCodeAt(s)), i = ye(n.charCodeAt(s + 1));
      if (c === void 0 || i === void 0) {
        let f = n[s] + n[s + 1];
        throw new RangeError('hex string expected, got non-hex character "' + f + '" at index ' + s);
      }
      e[o] = c * 16 + i;
    }
    return e;
  }
  function Ee(...n) {
    let t = 0;
    for (let e = 0; e < n.length; e++) {
      let o = n[e];
      W(o), t += o.length;
    }
    let r = new Uint8Array(t);
    for (let e = 0, o = 0; e < n.length; e++) {
      let s = n[e];
      r.set(s, o), o += s.length;
    }
    return r;
  }
  function Tt(n, t = {}) {
    let r = (o, s) => n(s).update(o).digest(), e = n(void 0);
    return r.outputLen = e.outputLen, r.blockLen = e.blockLen, r.canXOF = e.canXOF, r.create = (o) => n(o), Object.assign(r, t), Object.freeze(r);
  }
  function Be(n = 32) {
    rt(n, "bytesLength");
    let t = typeof globalThis == "object" ? globalThis.crypto : null;
    if (typeof t?.getRandomValues != "function") throw new Error("crypto.getRandomValues must be defined");
    if (n > 65536) throw new RangeError(`"bytesLength" expected <= 65536, got ${n}`);
    return t.getRandomValues(new Uint8Array(n));
  }
  var ve = (n) => ({ oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, n]) });
  function Kt(n, t, r) {
    return n & t ^ ~n & r;
  }
  function Yt(n, t, r) {
    return n & t ^ n & r ^ t & r;
  }
  var bt = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(t, r, e, o) {
      this.blockLen = t, this.outputLen = r, this.padOffset = e, this.isLE = o, this.buffer = new Uint8Array(t), this.view = Ot(this.buffer);
    }
    update(t) {
      ht(this), W(t);
      let { view: r, buffer: e, blockLen: o } = this, s = t.length;
      for (let c = 0; c < s; ) {
        let i = Math.min(o - this.pos, s - c);
        if (i === o) {
          let f = Ot(t);
          for (; o <= s - c; c += o) this.process(f, c);
          continue;
        }
        e.set(t.subarray(c, c + i), this.pos), this.pos += i, c += i, this.pos === o && (this.process(r, 0), this.pos = 0);
      }
      return this.length += t.length, this.roundClean(), this;
    }
    digestInto(t) {
      ht(this), Ft(t, this), this.finished = true;
      let { buffer: r, view: e, blockLen: o, isLE: s } = this, { pos: c } = this;
      r[c++] = 128, P(this.buffer.subarray(c)), this.padOffset > o - c && (this.process(e, 0), c = 0);
      for (let h = c; h < o; h++) r[h] = 0;
      e.setBigUint64(o - 8, BigInt(this.length * 8), s), this.process(e, 0);
      let i = Ot(t), f = this.outputLen;
      if (f % 4) throw new Error("_sha2: outputLen must be aligned to 32bit");
      let a = f / 4, d = this.get();
      if (a > d.length) throw new Error("_sha2: outputLen bigger than state");
      for (let h = 0; h < a; h++) i.setUint32(4 * h, d[h], s);
    }
    digest() {
      let { buffer: t, outputLen: r } = this;
      this.digestInto(t);
      let e = t.slice(0, r);
      return this.destroy(), e;
    }
    _cloneInto(t) {
      t ||= new this.constructor(), t.set(...this.get());
      let { blockLen: r, buffer: e, length: o, finished: s, destroyed: c, pos: i } = this;
      return t.destroyed = c, t.finished = s, t.length = o, t.pos = i, o % r && t.buffer.set(e), t;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var et = Uint32Array.from([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  var an = Uint32Array.from([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
  var ot = new Uint32Array(64);
  var zt = class extends bt {
    constructor(t) {
      super(64, t, 8, false);
    }
    get() {
      let { A: t, B: r, C: e, D: o, E: s, F: c, G: i, H: f } = this;
      return [t, r, e, o, s, c, i, f];
    }
    set(t, r, e, o, s, c, i, f) {
      this.A = t | 0, this.B = r | 0, this.C = e | 0, this.D = o | 0, this.E = s | 0, this.F = c | 0, this.G = i | 0, this.H = f | 0;
    }
    process(t, r) {
      for (let h = 0; h < 16; h++, r += 4) ot[h] = t.getUint32(r, false);
      for (let h = 16; h < 64; h++) {
        let v = ot[h - 15], p = ot[h - 2], S = G(v, 7) ^ G(v, 18) ^ v >>> 3, F = G(p, 17) ^ G(p, 19) ^ p >>> 10;
        ot[h] = F + ot[h - 7] + S + ot[h - 16] | 0;
      }
      let { A: e, B: o, C: s, D: c, E: i, F: f, G: a, H: d } = this;
      for (let h = 0; h < 64; h++) {
        let v = G(i, 6) ^ G(i, 11) ^ G(i, 25), p = d + v + Kt(i, f, a) + an[h] + ot[h] | 0, F = (G(e, 2) ^ G(e, 13) ^ G(e, 22)) + Yt(e, o, s) | 0;
        d = a, a = f, f = i, i = c + p | 0, c = s, s = o, o = e, e = p + F | 0;
      }
      e = e + this.A | 0, o = o + this.B | 0, s = s + this.C | 0, c = c + this.D | 0, i = i + this.E | 0, f = f + this.F | 0, a = a + this.G | 0, d = d + this.H | 0, this.set(e, o, s, c, i, f, a, d);
    }
    roundClean() {
      P(ot);
    }
    destroy() {
      this.destroyed = true, this.set(0, 0, 0, 0, 0, 0, 0, 0), P(this.buffer);
    }
  };
  var Gt = class extends zt {
    A = et[0] | 0;
    B = et[1] | 0;
    C = et[2] | 0;
    D = et[3] | 0;
    E = et[4] | 0;
    F = et[5] | 0;
    G = et[6] | 0;
    H = et[7] | 0;
    constructor() {
      super(32);
    }
  };
  var Se = Tt(() => new Gt(), ve(1));
  var D = (n, t, r) => W(n, t, r);
  var Xt = rt;
  var Wt = It;
  var nt = (...n) => Ee(...n);
  var Lt = (n) => Mt(n);
  var Pt = Zt;
  var Qt = (n) => Be(n);
  var _t = BigInt(0);
  var $t = BigInt(1);
  function it(n, t = "") {
    if (typeof n != "boolean") {
      let r = t && `"${t}" `;
      throw new TypeError(r + "expected boolean, got type=" + typeof n);
    }
    return n;
  }
  function Ut(n) {
    if (typeof n == "bigint") {
      if (!Ht(n)) throw new RangeError("positive bigint expected, got " + n);
    } else Xt(n);
    return n;
  }
  function Et(n, t = "") {
    if (typeof n != "number") {
      let r = t && `"${t}" `;
      throw new TypeError(r + "expected number, got type=" + typeof n);
    }
    if (!Number.isSafeInteger(n)) {
      let r = t && `"${t}" `;
      throw new RangeError(r + "expected safe integer, got " + n);
    }
  }
  function Bt(n) {
    let t = Ut(n).toString(16);
    return t.length & 1 ? "0" + t : t;
  }
  function Re(n) {
    if (typeof n != "string") throw new TypeError("hex string expected, got " + typeof n);
    return n === "" ? _t : BigInt("0x" + n);
  }
  function pt(n) {
    return Re(It(n));
  }
  function Jt(n) {
    return Re(It(un(W(n)).reverse()));
  }
  function qt(n, t) {
    if (rt(t), t === 0) throw new RangeError("zero length");
    n = Ut(n);
    let r = n.toString(16);
    if (r.length > t * 2) throw new RangeError("number too large");
    return Mt(r.padStart(t * 2, "0"));
  }
  function te(n, t) {
    return qt(n, t).reverse();
  }
  function un(n) {
    return Uint8Array.from(D(n));
  }
  var Ht = (n) => typeof n == "bigint" && _t <= n;
  function dn(n, t, r) {
    return Ht(n) && Ht(t) && Ht(r) && t <= n && n < r;
  }
  function ee(n, t, r, e) {
    if (!dn(t, r, e)) throw new RangeError("expected valid " + n + ": " + r + " <= n < " + e + ", got " + t);
  }
  function xt(n) {
    if (n < _t) throw new Error("expected non-negative bigint, got " + n);
    let t;
    for (t = 0; n > _t; n >>= $t, t += 1) ;
    return t;
  }
  var vt = (n) => ($t << BigInt(n)) - $t;
  function Ae(n, t, r) {
    if (rt(n, "hashLen"), rt(t, "qByteLen"), typeof r != "function") throw new TypeError("hmacFn must be a function");
    let e = (R) => new Uint8Array(R), o = Uint8Array.of(), s = Uint8Array.of(0), c = Uint8Array.of(1), i = 1e3, f = e(n), a = e(n), d = 0, h = () => {
      f.fill(1), a.fill(0), d = 0;
    }, v = (...R) => r(a, nt(f, ...R)), p = (R = o) => {
      a = v(s, R), f = v(), R.length !== 0 && (a = v(c, R), f = v());
    }, S = () => {
      if (d++ >= i) throw new Error("drbg: tried max amount of iterations");
      let R = 0, T = [];
      for (; R < t; ) {
        f = v();
        let L = f.slice();
        T.push(L), R += f.length;
      }
      return nt(...T);
    };
    return (R, T) => {
      h(), p(R);
      let L;
      for (; (L = T(S())) === void 0; ) p();
      return h(), L;
    };
  }
  function ct(n, t = {}, r = {}) {
    if (Object.prototype.toString.call(n) !== "[object Object]") throw new TypeError("expected valid options object");
    function e(s, c, i) {
      if (!i && c !== "function" && !Object.hasOwn(n, s)) throw new TypeError(`param "${s}" is invalid: expected own property`);
      let f = n[s];
      if (i && f === void 0) return;
      let a = typeof f;
      if (a !== c || f === null) throw new TypeError(`param "${s}" is invalid: expected ${c}, got ${a}`);
    }
    let o = (s, c) => Object.entries(s).forEach(([i, f]) => e(i, f, c));
    o(t, false), o(r, true);
  }
  var V = BigInt(0);
  var N = BigInt(1);
  var ft = BigInt(2);
  var Te = BigInt(3);
  var He = BigInt(4);
  var _e = BigInt(5);
  var ln = BigInt(7);
  var Le = BigInt(8);
  var hn = BigInt(9);
  var Ue = BigInt(16);
  function $(n, t) {
    if (t <= V) throw new Error("mod: expected positive modulus, got " + t);
    let r = n % t;
    return r >= V ? r : t + r;
  }
  function M(n, t, r) {
    if (t < V) throw new Error("pow2: expected non-negative exponent, got " + t);
    let e = n;
    for (; t-- > V; ) e *= e, e %= r;
    return e;
  }
  function Fe(n, t) {
    if (n === V) throw new Error("invert: expected non-zero number");
    if (t <= V) throw new Error("invert: expected positive modulus, got " + t);
    let r = $(n, t), e = t, o = V, s = N, c = N, i = V;
    for (; r !== V; ) {
      let a = e / r, d = e - r * a, h = o - c * a, v = s - i * a;
      e = r, r = d, o = c, s = i, c = h, i = v;
    }
    if (e !== N) throw new Error("invert: does not exist");
    return $(o, t);
  }
  function ne(n, t, r) {
    let e = n;
    if (!e.eql(e.sqr(t), r)) throw new Error("Cannot find square root");
  }
  function qe(n, t) {
    let r = n, e = (r.ORDER + N) / He, o = r.pow(t, e);
    return ne(r, o, t), o;
  }
  function bn(n, t) {
    let r = n, e = (r.ORDER - _e) / Le, o = r.mul(t, ft), s = r.pow(o, e), c = r.mul(t, s), i = r.mul(r.mul(c, ft), s), f = r.mul(c, r.sub(i, r.ONE));
    return ne(r, f, t), f;
  }
  function pn(n) {
    let t = mt(n), r = Ne(n), e = r(t, t.neg(t.ONE)), o = r(t, e), s = r(t, t.neg(e)), c = (n + ln) / Ue;
    return ((i, f) => {
      let a = i, d = a.pow(f, c), h = a.mul(d, e), v = a.mul(d, o), p = a.mul(d, s), S = a.eql(a.sqr(h), f), F = a.eql(a.sqr(v), f);
      d = a.cmov(d, h, S), h = a.cmov(p, v, F);
      let R = a.eql(a.sqr(h), f), T = a.cmov(d, h, R);
      return ne(a, T, f), T;
    });
  }
  function Ne(n) {
    if (n < Te) throw new Error("sqrt is not defined for small field");
    let t = n - N, r = 0;
    for (; t % ft === V; ) t /= ft, r++;
    let e = ft, o = mt(n);
    for (; Oe(o, e) === 1; ) if (e++ > 1e3) throw new Error("Cannot find square root: probably non-prime P");
    if (r === 1) return qe;
    let s = o.pow(e, t), c = (t + N) / ft;
    return function(f, a) {
      let d = f;
      if (d.is0(a)) return a;
      if (Oe(d, a) !== 1) throw new Error("Cannot find square root");
      let h = r, v = d.mul(d.ONE, s), p = d.pow(a, t), S = d.pow(a, c);
      for (; !d.eql(p, d.ONE); ) {
        if (d.is0(p)) return d.ZERO;
        let F = 1, R = d.sqr(p);
        for (; !d.eql(R, d.ONE); ) if (F++, R = d.sqr(R), F === h) throw new Error("Cannot find square root");
        let T = N << BigInt(h - F - 1), L = d.pow(v, T);
        h = F, v = d.sqr(L), p = d.mul(p, v), S = d.mul(S, L);
      }
      return S;
    };
  }
  function xn(n) {
    return n % He === Te ? qe : n % Le === _e ? bn : n % Ue === hn ? pn(n) : Ne(n);
  }
  var mn = ["create", "isValid", "is0", "neg", "inv", "sqrt", "sqr", "eql", "add", "sub", "mul", "pow", "div", "addN", "subN", "mulN", "sqrN"];
  function re(n) {
    let t = { ORDER: "bigint", BYTES: "number", BITS: "number" }, r = mn.reduce((e, o) => (e[o] = "function", e), t);
    if (ct(n, r), Et(n.BYTES, "BYTES"), Et(n.BITS, "BITS"), n.BYTES < 1 || n.BITS < 1) throw new Error("invalid field: expected BYTES/BITS > 0");
    if (n.ORDER <= N) throw new Error("invalid field: expected ORDER > 1, got " + n.ORDER);
    return n;
  }
  function gn(n, t, r) {
    let e = n;
    if (r < V) throw new Error("invalid exponent, negatives unsupported");
    if (r === V) return e.ONE;
    if (r === N) return t;
    let o = e.ONE, s = t;
    for (; r > V; ) r & N && (o = e.mul(o, s)), s = e.sqr(s), r >>= N;
    return o;
  }
  function Dt(n, t, r = false) {
    let e = n, o = new Array(t.length).fill(r ? e.ZERO : void 0), s = t.reduce((i, f, a) => e.is0(f) ? i : (o[a] = i, e.mul(i, f)), e.ONE), c = e.inv(s);
    return t.reduceRight((i, f, a) => e.is0(f) ? i : (o[a] = e.mul(i, o[a]), e.mul(i, f)), c), o;
  }
  function Oe(n, t) {
    let r = n, e = (r.ORDER - N) / ft, o = r.pow(t, e), s = r.eql(o, r.ONE), c = r.eql(o, r.ZERO), i = r.eql(o, r.neg(r.ONE));
    if (!s && !c && !i) throw new Error("invalid Legendre symbol result");
    return s ? 1 : c ? 0 : -1;
  }
  function yn(n, t) {
    if (t !== void 0 && Xt(t), n <= V) throw new Error("invalid n length: expected positive n, got " + n);
    if (t !== void 0 && t < 1) throw new Error("invalid n length: expected positive bit length, got " + t);
    let r = xt(n);
    if (t !== void 0 && t < r) throw new Error(`invalid n length: expected bit length (${r}) >= n.length (${t})`);
    let e = t !== void 0 ? t : r, o = Math.ceil(e / 8);
    return { nBitLength: e, nByteLength: o };
  }
  var Ie = /* @__PURE__ */ new WeakMap();
  var Nt = class {
    ORDER;
    BITS;
    BYTES;
    isLE;
    ZERO = V;
    ONE = N;
    _lengths;
    _mod;
    constructor(t, r = {}) {
      if (t <= N) throw new Error("invalid field: expected ORDER > 1, got " + t);
      let e;
      this.isLE = false, r != null && typeof r == "object" && (typeof r.BITS == "number" && (e = r.BITS), typeof r.sqrt == "function" && Object.defineProperty(this, "sqrt", { value: r.sqrt, enumerable: true }), typeof r.isLE == "boolean" && (this.isLE = r.isLE), r.allowedLengths && (this._lengths = Object.freeze(r.allowedLengths.slice())), typeof r.modFromBytes == "boolean" && (this._mod = r.modFromBytes));
      let { nBitLength: o, nByteLength: s } = yn(t, e);
      if (s > 2048) throw new Error("invalid field: expected ORDER of <= 2048 bytes");
      this.ORDER = t, this.BITS = o, this.BYTES = s, Object.freeze(this);
    }
    create(t) {
      return $(t, this.ORDER);
    }
    isValid(t) {
      if (typeof t != "bigint") throw new TypeError("invalid field element: expected bigint, got " + typeof t);
      return V <= t && t < this.ORDER;
    }
    is0(t) {
      return t === V;
    }
    isValidNot0(t) {
      return !this.is0(t) && this.isValid(t);
    }
    isOdd(t) {
      return (t & N) === N;
    }
    neg(t) {
      return $(-t, this.ORDER);
    }
    eql(t, r) {
      return t === r;
    }
    sqr(t) {
      return $(t * t, this.ORDER);
    }
    add(t, r) {
      return $(t + r, this.ORDER);
    }
    sub(t, r) {
      return $(t - r, this.ORDER);
    }
    mul(t, r) {
      return $(t * r, this.ORDER);
    }
    pow(t, r) {
      return gn(this, t, r);
    }
    div(t, r) {
      return $(t * Fe(r, this.ORDER), this.ORDER);
    }
    sqrN(t) {
      return t * t;
    }
    addN(t, r) {
      return t + r;
    }
    subN(t, r) {
      return t - r;
    }
    mulN(t, r) {
      return t * r;
    }
    inv(t) {
      return Fe(t, this.ORDER);
    }
    sqrt(t) {
      let r = Ie.get(this);
      return r || Ie.set(this, r = xn(this.ORDER)), r(this, t);
    }
    toBytes(t) {
      return this.isLE ? te(t, this.BYTES) : qt(t, this.BYTES);
    }
    fromBytes(t, r = false) {
      D(t);
      let { _lengths: e, BYTES: o, isLE: s, ORDER: c, _mod: i } = this;
      if (e) {
        if (t.length < 1 || !e.includes(t.length) || t.length > o) throw new Error("Field.fromBytes: expected " + e + " bytes, got " + t.length);
        let a = new Uint8Array(o);
        a.set(t, s ? 0 : a.length - t.length), t = a;
      }
      if (t.length !== o) throw new Error("Field.fromBytes: expected " + o + " bytes, got " + t.length);
      let f = s ? Jt(t) : pt(t);
      if (i && (f = $(f, c)), !r && !this.isValid(f)) throw new Error("invalid field element: outside of range 0..ORDER");
      return f;
    }
    invertBatch(t) {
      return Dt(this, t);
    }
    cmov(t, r, e) {
      return it(e, "condition"), e ? r : t;
    }
  };
  Object.freeze(Nt.prototype);
  function mt(n, t = {}) {
    return new Nt(n, t);
  }
  function De(n) {
    if (typeof n != "bigint") throw new Error("field order must be bigint");
    if (n <= N) throw new Error("field order must be greater than 1");
    let t = xt(n - N);
    return Math.ceil(t / 8);
  }
  function oe(n) {
    let t = De(n);
    return t + Math.ceil(t / 2);
  }
  function se(n, t, r = false) {
    D(n);
    let e = n.length, o = De(t), s = Math.max(oe(t), 16);
    if (e < s || e > 1024) throw new Error("expected " + s + "-1024 bytes of input, got " + e);
    let c = r ? Jt(n) : pt(n), i = $(c, t - N) + N;
    return r ? te(i, o) : qt(i, o);
  }
  var gt = BigInt(0);
  var at = BigInt(1);
  function St(n, t) {
    let r = t.negate();
    return n ? r : t;
  }
  function ae(n, t) {
    let r = Dt(n.Fp, t.map((e) => e.Z));
    return t.map((e, o) => n.fromAffine(e.toAffine(r[o])));
  }
  function Ve(n, t) {
    if (!Number.isSafeInteger(n) || n <= 0 || n > t) throw new Error("invalid window size, expected [1.." + t + "], got W=" + n);
  }
  function ie(n, t) {
    Ve(n, t);
    let r = Math.ceil(t / n) + 1, e = 2 ** (n - 1), o = 2 ** n, s = vt(n), c = BigInt(n);
    return { windows: r, windowSize: e, mask: s, maxNumber: o, shiftBy: c };
  }
  function Ce(n, t, r) {
    let { windowSize: e, mask: o, maxNumber: s, shiftBy: c } = r, i = Number(n & o), f = n >> c;
    i > e && (i -= s, f += at);
    let a = t * e, d = a + Math.abs(i) - 1, h = i === 0, v = i < 0, p = t % 2 !== 0;
    return { nextN: f, offset: d, isZero: h, isNeg: v, isNegF: p, offsetF: a };
  }
  var ce = /* @__PURE__ */ new WeakMap();
  var Ze = /* @__PURE__ */ new WeakMap();
  function fe(n) {
    return Ze.get(n) || 1;
  }
  function je(n) {
    if (n !== gt) throw new Error("invalid wNAF");
  }
  var Ct = class {
    BASE;
    ZERO;
    Fn;
    bits;
    constructor(t, r) {
      this.BASE = t.BASE, this.ZERO = t.ZERO, this.Fn = t.Fn, this.bits = r;
    }
    _unsafeLadder(t, r, e = this.ZERO) {
      let o = t;
      for (; r > gt; ) r & at && (e = e.add(o)), o = o.double(), r >>= at;
      return e;
    }
    precomputeWindow(t, r) {
      let { windows: e, windowSize: o } = ie(r, this.bits), s = [], c = t, i = c;
      for (let f = 0; f < e; f++) {
        i = c, s.push(i);
        for (let a = 1; a < o; a++) i = i.add(c), s.push(i);
        c = i.double();
      }
      return s;
    }
    wNAF(t, r, e) {
      if (!this.Fn.isValid(e)) throw new Error("invalid scalar");
      let o = this.ZERO, s = this.BASE, c = ie(t, this.bits);
      for (let i = 0; i < c.windows; i++) {
        let { nextN: f, offset: a, isZero: d, isNeg: h, isNegF: v, offsetF: p } = Ce(e, i, c);
        e = f, d ? s = s.add(St(v, r[p])) : o = o.add(St(h, r[a]));
      }
      return je(e), { p: o, f: s };
    }
    wNAFUnsafe(t, r, e, o = this.ZERO) {
      let s = ie(t, this.bits);
      for (let c = 0; c < s.windows && e !== gt; c++) {
        let { nextN: i, offset: f, isZero: a, isNeg: d } = Ce(e, c, s);
        if (e = i, !a) {
          let h = r[f];
          o = o.add(d ? h.negate() : h);
        }
      }
      return je(e), o;
    }
    getPrecomputes(t, r, e) {
      let o = ce.get(r);
      return o || (o = this.precomputeWindow(r, t), t !== 1 && (typeof e == "function" && (o = e(o)), ce.set(r, o))), o;
    }
    cached(t, r, e) {
      let o = fe(t);
      return this.wNAF(o, this.getPrecomputes(o, t, e), r);
    }
    unsafe(t, r, e, o) {
      let s = fe(t);
      return s === 1 ? this._unsafeLadder(t, r, o) : this.wNAFUnsafe(s, this.getPrecomputes(s, t, e), r, o);
    }
    createCache(t, r) {
      Ve(r, this.bits), Ze.set(t, r), ce.delete(t);
    }
    hasCache(t) {
      return fe(t) !== 1;
    }
  };
  function Me(n, t, r, e) {
    let o = t, s = n.ZERO, c = n.ZERO;
    for (; r > gt || e > gt; ) r & at && (s = s.add(o)), e & at && (c = c.add(o)), o = o.double(), r >>= at, e >>= at;
    return { p1: s, p2: c };
  }
  function ke(n, t, r) {
    if (t) {
      if (t.ORDER !== n) throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      return re(t), t;
    } else return mt(n, { isLE: r });
  }
  function Ke(n, t, r = {}, e) {
    if (e === void 0 && (e = n === "edwards"), !t || typeof t != "object") throw new Error(`expected valid ${n} CURVE object`);
    for (let f of ["p", "n", "h"]) {
      let a = t[f];
      if (!(typeof a == "bigint" && a > gt)) throw new Error(`CURVE.${f} must be positive bigint`);
    }
    let o = ke(t.p, r.Fp, e), s = ke(t.n, r.Fn, e), i = ["Gx", "Gy", "a", n === "weierstrass" ? "b" : "d"];
    for (let f of i) if (!o.isValid(t[f])) throw new Error(`CURVE.${f} must be valid field element of CURVE.Fp`);
    return t = Object.freeze(Object.assign({}, t)), { CURVE: t, Fp: o, Fn: s };
  }
  function Ye(n, t) {
    return function(e) {
      let o = n(e);
      return { secretKey: o, publicKey: t(o) };
    };
  }
  var jt = class {
    oHash;
    iHash;
    blockLen;
    outputLen;
    canXOF = false;
    finished = false;
    destroyed = false;
    constructor(t, r) {
      if (At(t), W(r, void 0, "key"), this.iHash = t.create(), typeof this.iHash.update != "function") throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
      let e = this.blockLen, o = new Uint8Array(e);
      o.set(r.length > e ? t.create().update(r).digest() : r);
      for (let s = 0; s < o.length; s++) o[s] ^= 54;
      this.iHash.update(o), this.oHash = t.create();
      for (let s = 0; s < o.length; s++) o[s] ^= 106;
      this.oHash.update(o), P(o);
    }
    update(t) {
      return ht(this), this.iHash.update(t), this;
    }
    digestInto(t) {
      ht(this), Ft(t, this), this.finished = true;
      let r = t.subarray(0, this.outputLen);
      this.iHash.digestInto(r), this.oHash.update(r), this.oHash.digestInto(r), this.destroy();
    }
    digest() {
      let t = new Uint8Array(this.oHash.outputLen);
      return this.digestInto(t), t;
    }
    _cloneInto(t) {
      t ||= Object.create(Object.getPrototypeOf(this), {});
      let { oHash: r, iHash: e, finished: o, destroyed: s, blockLen: c, outputLen: i } = this;
      return t = t, t.finished = o, t.destroyed = s, t.blockLen = c, t.outputLen = i, t.oHash = r._cloneInto(t.oHash), t.iHash = e._cloneInto(t.iHash), t;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true, this.oHash.destroy(), this.iHash.destroy();
    }
  };
  var ze = (() => {
    let n = ((t, r, e) => new jt(t, r).update(e).digest());
    return n.create = (t, r) => new jt(t, r), n;
  })();
  var Ge = (n, t) => (n + (n >= 0 ? t : -t) / $e) / t;
  function wn(n, t, r) {
    ee("scalar", n, Q, r);
    let [[e, o], [s, c]] = t, i = Ge(c * n, r), f = Ge(-o * n, r), a = n - i * e - f * s, d = -i * o - f * c, h = a < Q, v = d < Q;
    h && (a = -a), v && (d = -d);
    let p = vt(Math.ceil(xt(r) / 2)) + st;
    if (a < Q || a >= p || d < Q || d >= p) throw new Error("splitScalar (endomorphism): failed for k");
    return { k1neg: h, k1: a, k2neg: v, k2: d };
  }
  function de(n) {
    if (!["compact", "recovered", "der"].includes(n)) throw new Error('Signature format must be "compact", "recovered", or "der"');
    return n;
  }
  function ue(n, t) {
    ct(n);
    let r = {};
    for (let e of Object.keys(t)) r[e] = n[e] === void 0 ? t[e] : n[e];
    return it(r.lowS, "lowS"), it(r.prehash, "prehash"), r.format !== void 0 && de(r.format), r;
  }
  var le = class extends Error {
    constructor(t = "") {
      super(t);
    }
  };
  var X = { Err: le, _tlv: { encode: (n, t) => {
    let { Err: r } = X;
    if (Et(n, "tag"), n < 0 || n > 255) throw new r("tlv.encode: wrong tag");
    if (typeof t != "string") throw new TypeError('"data" expected string, got type=' + typeof t);
    if (t.length & 1) throw new r("tlv.encode: unpadded data");
    let e = t.length / 2, o = Bt(e);
    if (o.length / 2 & 128) throw new r("tlv.encode: long form length too big");
    let s = e > 127 ? Bt(o.length / 2 | 128) : "";
    return Bt(n) + s + o + t;
  }, decode(n, t) {
    let { Err: r } = X;
    t = D(t, void 0, "DER data");
    let e = 0;
    if (n < 0 || n > 255) throw new r("tlv.encode: wrong tag");
    if (t.length < 2 || t[e++] !== n) throw new r("tlv.decode: wrong tlv");
    let o = t[e++], s = !!(o & 128), c = 0;
    if (!s) c = o;
    else {
      let f = o & 127;
      if (!f) throw new r("tlv.decode(long): indefinite length not supported");
      if (f > 4) throw new r("tlv.decode(long): byte length is too big");
      let a = t.subarray(e, e + f);
      if (a.length !== f) throw new r("tlv.decode: length bytes not complete");
      if (a[0] === 0) throw new r("tlv.decode(long): zero leftmost byte");
      for (let d of a) c = c << 8 | d;
      if (e += f, c < 128) throw new r("tlv.decode(long): not minimal encoding");
    }
    let i = t.subarray(e, e + c);
    if (i.length !== c) throw new r("tlv.decode: wrong value length");
    return { v: i, l: t.subarray(e + c) };
  } }, _int: { encode(n) {
    let { Err: t } = X;
    if (Ut(n), n < Q) throw new t("integer: negative integers are not allowed");
    let r = Bt(n);
    if (Number.parseInt(r[0], 16) & 8 && (r = "00" + r), r.length & 1) throw new t("unexpected DER parsing assertion: unpadded hex");
    return r;
  }, decode(n) {
    let { Err: t } = X;
    if (n.length < 1) throw new t("invalid signature integer: empty");
    if (n[0] & 128) throw new t("invalid signature integer: negative");
    if (n.length > 1 && n[0] === 0 && !(n[1] & 128)) throw new t("invalid signature integer: unnecessary leading zero");
    return pt(n);
  } }, toSig(n) {
    let { Err: t, _int: r, _tlv: e } = X, o = D(n, void 0, "signature"), { v: s, l: c } = e.decode(48, o);
    if (c.length) throw new t("invalid signature: left bytes after parsing");
    let { v: i, l: f } = e.decode(2, s), { v: a, l: d } = e.decode(2, f);
    if (d.length) throw new t("invalid signature: left bytes after parsing");
    return { r: r.decode(i), s: r.decode(a) };
  }, hexFromSig(n) {
    let { _tlv: t, _int: r } = X, e = t.encode(2, r.encode(n.r)), o = t.encode(2, r.encode(n.s)), s = e + o;
    return t.encode(48, s);
  } };
  Object.freeze(X._tlv);
  Object.freeze(X._int);
  Object.freeze(X);
  var Q = BigInt(0);
  var st = BigInt(1);
  var $e = BigInt(2);
  var kt = BigInt(3);
  var En = BigInt(4);
  function Xe(n, t = {}) {
    let r = Ke("weierstrass", n, t), e = r.Fp, o = r.Fn, s = r.CURVE, { h: c, n: i } = s;
    ct(t, {}, { allowInfinityPoint: "boolean", clearCofactor: "function", isTorsionFree: "function", fromBytes: "function", toBytes: "function", endo: "object" });
    let { endo: f, allowInfinityPoint: a } = t;
    if (f && (!e.is0(s.a) || typeof f.beta != "bigint" || !Array.isArray(f.basises))) throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    let d = Pe(e, o);
    function h() {
      if (!e.isOdd) throw new Error("compression is not supported: Field does not have .isOdd()");
    }
    function v(U, l, y) {
      if (a && l.is0()) return Uint8Array.of(0);
      let { x: E, y: b } = l.toAffine(), u = e.toBytes(E);
      if (it(y, "isCompressed"), y) {
        h();
        let x = !e.isOdd(b);
        return nt(We(x), u);
      } else return nt(Uint8Array.of(4), u, e.toBytes(b));
    }
    function p(U) {
      D(U, void 0, "Point");
      let { publicKey: l, publicKeyUncompressed: y } = d, E = U.length, b = U[0], u = U.subarray(1);
      if (a && E === 1 && b === 0) return { x: e.ZERO, y: e.ZERO };
      if (E === l && (b === 2 || b === 3)) {
        let x = e.fromBytes(u);
        if (!e.isValid(x)) throw new Error("bad point: is not on curve, wrong x");
        let g = R(x), m;
        try {
          m = e.sqrt(g);
        } catch (_) {
          let I = _ instanceof Error ? ": " + _.message : "";
          throw new Error("bad point: is not on curve, sqrt error" + I);
        }
        h();
        let w = e.isOdd(m);
        return (b & 1) === 1 !== w && (m = e.neg(m)), { x, y: m };
      } else if (E === y && b === 4) {
        let x = e.BYTES, g = e.fromBytes(u.subarray(0, x)), m = e.fromBytes(u.subarray(x, x * 2));
        if (!T(g, m)) throw new Error("bad point: is not on curve");
        return { x: g, y: m };
      } else throw new Error(`bad point: got length ${E}, expected compressed=${l} or uncompressed=${y}`);
    }
    let S = t.toBytes === void 0 ? v : t.toBytes, F = t.fromBytes === void 0 ? p : t.fromBytes;
    function R(U) {
      let l = e.sqr(U), y = e.mul(l, U);
      return e.add(e.add(y, e.mul(U, s.a)), s.b);
    }
    function T(U, l) {
      let y = e.sqr(l), E = R(U);
      return e.eql(y, E);
    }
    if (!T(s.Gx, s.Gy)) throw new Error("bad curve params: generator point");
    let L = e.mul(e.pow(s.a, kt), En), z = e.mul(e.sqr(s.b), BigInt(27));
    if (e.is0(e.add(L, z))) throw new Error("bad curve params: a or b");
    function K(U, l, y = false) {
      if (!e.isValid(l) || y && e.is0(l)) throw new Error(`bad point coordinate ${U}`);
      return l;
    }
    function H(U) {
      if (!(U instanceof O)) throw new Error("Weierstrass Point expected");
    }
    function Y(U) {
      if (!f || !f.basises) throw new Error("no endo");
      return wn(U, f.basises, o.ORDER);
    }
    function ut(U, l, y, E, b) {
      return y = new O(e.mul(y.X, U), y.Y, y.Z), l = St(E, l), y = St(b, y), l.add(y);
    }
    class O {
      static BASE = new O(s.Gx, s.Gy, e.ONE);
      static ZERO = new O(e.ZERO, e.ONE, e.ZERO);
      static Fp = e;
      static Fn = o;
      X;
      Y;
      Z;
      constructor(l, y, E) {
        this.X = K("x", l), this.Y = K("y", y, true), this.Z = K("z", E), Object.freeze(this);
      }
      static CURVE() {
        return s;
      }
      static fromAffine(l) {
        let { x: y, y: E } = l || {};
        if (!l || !e.isValid(y) || !e.isValid(E)) throw new Error("invalid affine point");
        if (l instanceof O) throw new Error("projective point not allowed");
        return e.is0(y) && e.is0(E) ? O.ZERO : new O(y, E, e.ONE);
      }
      static fromBytes(l) {
        let y = O.fromAffine(F(D(l, void 0, "point")));
        return y.assertValidity(), y;
      }
      static fromHex(l) {
        return O.fromBytes(Lt(l));
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      precompute(l = 8, y = true) {
        return J.createCache(this, l), y || this.multiply(kt), this;
      }
      assertValidity() {
        let l = this;
        if (l.is0()) {
          if (t.allowInfinityPoint && e.is0(l.X) && e.eql(l.Y, e.ONE) && e.is0(l.Z)) return;
          throw new Error("bad point: ZERO");
        }
        let { x: y, y: E } = l.toAffine();
        if (!e.isValid(y) || !e.isValid(E)) throw new Error("bad point: x or y not field elements");
        if (!T(y, E)) throw new Error("bad point: equation left != right");
        if (!l.isTorsionFree()) throw new Error("bad point: not in prime-order subgroup");
      }
      hasEvenY() {
        let { y: l } = this.toAffine();
        if (!e.isOdd) throw new Error("Field doesn't support isOdd");
        return !e.isOdd(l);
      }
      equals(l) {
        H(l);
        let { X: y, Y: E, Z: b } = this, { X: u, Y: x, Z: g } = l, m = e.eql(e.mul(y, g), e.mul(u, b)), w = e.eql(e.mul(E, g), e.mul(x, b));
        return m && w;
      }
      negate() {
        return new O(this.X, e.neg(this.Y), this.Z);
      }
      double() {
        let { a: l, b: y } = s, E = e.mul(y, kt), { X: b, Y: u, Z: x } = this, g = e.ZERO, m = e.ZERO, w = e.ZERO, B = e.mul(b, b), _ = e.mul(u, u), I = e.mul(x, x), A = e.mul(b, u);
        return A = e.add(A, A), w = e.mul(b, x), w = e.add(w, w), g = e.mul(l, w), m = e.mul(E, I), m = e.add(g, m), g = e.sub(_, m), m = e.add(_, m), m = e.mul(g, m), g = e.mul(A, g), w = e.mul(E, w), I = e.mul(l, I), A = e.sub(B, I), A = e.mul(l, A), A = e.add(A, w), w = e.add(B, B), B = e.add(w, B), B = e.add(B, I), B = e.mul(B, A), m = e.add(m, B), I = e.mul(u, x), I = e.add(I, I), B = e.mul(I, A), g = e.sub(g, B), w = e.mul(I, _), w = e.add(w, w), w = e.add(w, w), new O(g, m, w);
      }
      add(l) {
        H(l);
        let { X: y, Y: E, Z: b } = this, { X: u, Y: x, Z: g } = l, m = e.ZERO, w = e.ZERO, B = e.ZERO, _ = s.a, I = e.mul(s.b, kt), A = e.mul(y, u), C = e.mul(E, x), j = e.mul(b, g), k = e.add(y, E), q = e.add(u, x);
        k = e.mul(k, q), q = e.add(A, C), k = e.sub(k, q), q = e.add(y, b);
        let Z = e.add(u, g);
        return q = e.mul(q, Z), Z = e.add(A, j), q = e.sub(q, Z), Z = e.add(E, b), m = e.add(x, g), Z = e.mul(Z, m), m = e.add(C, j), Z = e.sub(Z, m), B = e.mul(_, q), m = e.mul(I, j), B = e.add(m, B), m = e.sub(C, B), B = e.add(C, B), w = e.mul(m, B), C = e.add(A, A), C = e.add(C, A), j = e.mul(_, j), q = e.mul(I, q), C = e.add(C, j), j = e.sub(A, j), j = e.mul(_, j), q = e.add(q, j), A = e.mul(C, q), w = e.add(w, A), A = e.mul(Z, q), m = e.mul(k, m), m = e.sub(m, A), A = e.mul(k, C), B = e.mul(Z, B), B = e.add(B, A), new O(m, w, B);
      }
      subtract(l) {
        return H(l), this.add(l.negate());
      }
      is0() {
        return this.equals(O.ZERO);
      }
      multiply(l) {
        let { endo: y } = t;
        if (!o.isValidNot0(l)) throw new RangeError("invalid scalar: out of range");
        let E, b, u = (x) => J.cached(this, x, (g) => ae(O, g));
        if (y) {
          let { k1neg: x, k1: g, k2neg: m, k2: w } = Y(l), { p: B, f: _ } = u(g), { p: I, f: A } = u(w);
          b = _.add(A), E = ut(y.beta, B, I, x, m);
        } else {
          let { p: x, f: g } = u(l);
          E = x, b = g;
        }
        return ae(O, [E, b])[0];
      }
      multiplyUnsafe(l) {
        let { endo: y } = t, E = this, b = l;
        if (!o.isValid(b)) throw new RangeError("invalid scalar: out of range");
        if (b === Q || E.is0()) return O.ZERO;
        if (b === st) return E;
        if (J.hasCache(this)) return this.multiply(b);
        if (y) {
          let { k1neg: u, k1: x, k2neg: g, k2: m } = Y(b), { p1: w, p2: B } = Me(O, E, x, m);
          return ut(y.beta, w, B, u, g);
        } else return J.unsafe(E, b);
      }
      toAffine(l) {
        let y = this, E = l, { X: b, Y: u, Z: x } = y;
        if (e.eql(x, e.ONE)) return { x: b, y: u };
        let g = y.is0();
        E == null && (E = g ? e.ONE : e.inv(x));
        let m = e.mul(b, E), w = e.mul(u, E), B = e.mul(x, E);
        if (g) return { x: e.ZERO, y: e.ZERO };
        if (!e.eql(B, e.ONE)) throw new Error("invZ was invalid");
        return { x: m, y: w };
      }
      isTorsionFree() {
        let { isTorsionFree: l } = t;
        return c === st ? true : l ? l(O, this) : J.unsafe(this, i).is0();
      }
      clearCofactor() {
        let { clearCofactor: l } = t;
        return c === st ? this : l ? l(O, this) : this.multiplyUnsafe(c);
      }
      isSmallOrder() {
        return c === st ? this.is0() : this.clearCofactor().is0();
      }
      toBytes(l = true) {
        return it(l, "isCompressed"), this.assertValidity(), S(O, this, l);
      }
      toHex(l = true) {
        return Wt(this.toBytes(l));
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
    }
    let dt = o.BITS, J = new Ct(O, t.endo ? Math.ceil(dt / 2) : dt);
    return dt >= 8 && O.BASE.precompute(8), Object.freeze(O.prototype), Object.freeze(O), O;
  }
  function We(n) {
    return Uint8Array.of(n ? 2 : 3);
  }
  function Pe(n, t) {
    return { secretKey: t.BYTES, publicKey: 1 + n.BYTES, publicKeyUncompressed: 1 + 2 * n.BYTES, publicKeyHasPrefix: true, signature: 2 * t.BYTES };
  }
  function Bn(n, t = {}) {
    let { Fn: r } = n, e = t.randomBytes === void 0 ? Qt : t.randomBytes, o = Object.assign(Pe(n.Fp, r), { seed: Math.max(oe(r.ORDER), 16) });
    function s(p) {
      try {
        let S = r.fromBytes(p);
        return r.isValidNot0(S);
      } catch {
        return false;
      }
    }
    function c(p, S) {
      let { publicKey: F, publicKeyUncompressed: R } = o;
      try {
        let T = p.length;
        return S === true && T !== F || S === false && T !== R ? false : !!n.fromBytes(p);
      } catch {
        return false;
      }
    }
    function i(p) {
      return p = p === void 0 ? e(o.seed) : p, se(D(p, o.seed, "seed"), r.ORDER);
    }
    function f(p, S = true) {
      return n.BASE.multiply(r.fromBytes(p)).toBytes(S);
    }
    function a(p) {
      let { secretKey: S, publicKey: F, publicKeyUncompressed: R } = o, T = r._lengths;
      if (!Pt(p)) return;
      let L = D(p, void 0, "key").length, z = L === F || L === R, K = L === S || !!T?.includes(L);
      if (!(z && K)) return z;
    }
    function d(p, S, F = true) {
      if (a(p) === true) throw new Error("first arg must be private key");
      if (a(S) === false) throw new Error("second arg must be public key");
      let R = r.fromBytes(p);
      return n.fromBytes(S).multiply(R).toBytes(F);
    }
    let h = { isValidSecretKey: s, isValidPublicKey: c, randomSecretKey: i }, v = Ye(i, f);
    return Object.freeze(h), Object.freeze(o), Object.freeze({ getPublicKey: f, getSharedSecret: d, keygen: v, Point: n, utils: h, lengths: o });
  }
  function Qe(n, t, r = {}) {
    let e = t;
    At(e), ct(r, {}, { hmac: "function", lowS: "boolean", randomBytes: "function", bits2int: "function", bits2int_modN: "function" }), r = Object.assign({}, r);
    let o = r.randomBytes === void 0 ? Qt : r.randomBytes, s = r.hmac === void 0 ? (b, u) => ze(e, b, u) : r.hmac, { Fp: c, Fn: i } = n, { ORDER: f, BITS: a } = i, { keygen: d, getPublicKey: h, getSharedSecret: v, utils: p, lengths: S } = Bn(n, r), F = { prehash: true, lowS: typeof r.lowS == "boolean" ? r.lowS : true, format: "compact", extraEntropy: false }, R = f * $e + st < c.ORDER;
    function T(b) {
      let u = f >> st;
      return b > u;
    }
    function L(b, u) {
      if (!i.isValidNot0(u)) throw new Error(`invalid signature ${b}: out of range 1..Point.Fn.ORDER`);
      return u;
    }
    function z() {
      if (R) throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
    }
    function K(b, u) {
      de(u);
      let x = S.signature, g = u === "compact" ? x : u === "recovered" ? x + 1 : void 0;
      return D(b, g);
    }
    class H {
      r;
      s;
      recovery;
      constructor(u, x, g) {
        if (this.r = L("r", u), this.s = L("s", x), g != null) {
          if (z(), ![0, 1, 2, 3].includes(g)) throw new Error("invalid recovery id");
          this.recovery = g;
        }
        Object.freeze(this);
      }
      static fromBytes(u, x = F.format) {
        K(u, x);
        let g;
        if (x === "der") {
          let { r: _, s: I } = X.toSig(D(u));
          return new H(_, I);
        }
        x === "recovered" && (g = u[0], x = "compact", u = u.subarray(1));
        let m = S.signature / 2, w = u.subarray(0, m), B = u.subarray(m, m * 2);
        return new H(i.fromBytes(w), i.fromBytes(B), g);
      }
      static fromHex(u, x) {
        return this.fromBytes(Lt(u), x);
      }
      assertRecovery() {
        let { recovery: u } = this;
        if (u == null) throw new Error("invalid recovery id: must be present");
        return u;
      }
      addRecoveryBit(u) {
        return new H(this.r, this.s, u);
      }
      recoverPublicKey(u) {
        let { r: x, s: g } = this, m = this.assertRecovery(), w = m === 2 || m === 3 ? x + f : x;
        if (!c.isValid(w)) throw new Error("invalid recovery id: sig.r+curve.n != R.x");
        let B = c.toBytes(w), _ = n.fromBytes(nt(We((m & 1) === 0), B)), I = i.inv(w), A = ut(D(u, void 0, "msgHash")), C = i.create(-A * I), j = i.create(g * I), k = n.BASE.multiplyUnsafe(C).add(_.multiplyUnsafe(j));
        if (k.is0()) throw new Error("invalid recovery: point at infinify");
        return k.assertValidity(), k;
      }
      hasHighS() {
        return T(this.s);
      }
      toBytes(u = F.format) {
        if (de(u), u === "der") return Lt(X.hexFromSig(this));
        let { r: x, s: g } = this, m = i.toBytes(x), w = i.toBytes(g);
        return u === "recovered" ? (z(), nt(Uint8Array.of(this.assertRecovery()), m, w)) : nt(m, w);
      }
      toHex(u) {
        return Wt(this.toBytes(u));
      }
    }
    Object.freeze(H.prototype), Object.freeze(H);
    let Y = r.bits2int === void 0 ? function(u) {
      if (u.length > 8192) throw new Error("input is too large");
      let x = pt(u), g = u.length * 8 - a;
      return g > 0 ? x >> BigInt(g) : x;
    } : r.bits2int, ut = r.bits2int_modN === void 0 ? function(u) {
      return i.create(Y(u));
    } : r.bits2int_modN, O = vt(a);
    function dt(b) {
      return ee("num < 2^" + a, b, Q, O), i.toBytes(b);
    }
    function J(b, u) {
      return D(b, void 0, "message"), u ? D(e(b), void 0, "prehashed message") : b;
    }
    function U(b, u, x) {
      let { lowS: g, prehash: m, extraEntropy: w } = ue(x, F);
      b = J(b, m);
      let B = ut(b), _ = i.fromBytes(u);
      if (!i.isValidNot0(_)) throw new Error("invalid private key");
      let I = [dt(_), dt(B)];
      if (w != null && w !== false) {
        let k = w === true ? o(S.secretKey) : w;
        I.push(D(k, void 0, "extraEntropy"));
      }
      let A = nt(...I), C = B;
      function j(k) {
        let q = Y(k);
        if (!i.isValidNot0(q)) return;
        let Z = i.inv(q), lt = n.BASE.multiply(q).toAffine(), yt = i.create(lt.x);
        if (yt === Q) return;
        let Rt = i.create(Z * i.create(C + yt * _));
        if (Rt === Q) return;
        let me = (lt.x === yt ? 0 : 2) | Number(lt.y & st), ge = Rt;
        return g && T(Rt) && (ge = i.neg(Rt), me ^= 1), new H(yt, ge, R ? void 0 : me);
      }
      return { seed: A, k2sig: j };
    }
    function l(b, u, x = {}) {
      let { seed: g, k2sig: m } = U(b, u, x);
      return Ae(e.outputLen, i.BYTES, s)(g, m).toBytes(x.format);
    }
    function y(b, u, x, g = {}) {
      let { lowS: m, prehash: w, format: B } = ue(g, F);
      if (x = D(x, void 0, "publicKey"), u = J(u, w), !Pt(b)) {
        let _ = b instanceof H ? ", use sig.toBytes()" : "";
        throw new Error("verify expects Uint8Array signature" + _);
      }
      K(b, B);
      try {
        let _ = H.fromBytes(b, B), I = n.fromBytes(x);
        if (m && _.hasHighS()) return false;
        let { r: A, s: C } = _, j = ut(u), k = i.inv(C), q = i.create(j * k), Z = i.create(A * k), lt = n.BASE.multiplyUnsafe(q).add(I.multiplyUnsafe(Z));
        return lt.is0() ? false : i.create(lt.x) === A;
      } catch {
        return false;
      }
    }
    function E(b, u, x = {}) {
      let { prehash: g } = ue(x, F);
      return u = J(u, g), H.fromBytes(b, "recovered").recoverPublicKey(u).toBytes();
    }
    return Object.freeze({ keygen: d, getPublicKey: h, getSharedSecret: v, utils: p, lengths: S, Point: n, sign: l, verify: y, recoverPublicKey: E, Signature: H, hash: e });
  }
  var be = { p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"), n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"), h: BigInt(1), a: BigInt(0), b: BigInt(7), Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"), Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8") };
  var vn = { beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"), basises: [[BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")], [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]] };
  var Je = BigInt(2);
  function Sn(n) {
    let t = be.p, r = BigInt(3), e = BigInt(6), o = BigInt(11), s = BigInt(22), c = BigInt(23), i = BigInt(44), f = BigInt(88), a = n * n * n % t, d = a * a * n % t, h = M(d, r, t) * d % t, v = M(h, r, t) * d % t, p = M(v, Je, t) * a % t, S = M(p, o, t) * p % t, F = M(S, s, t) * S % t, R = M(F, i, t) * F % t, T = M(R, f, t) * R % t, L = M(T, i, t) * F % t, z = M(L, r, t) * d % t, K = M(z, c, t) * S % t, H = M(K, e, t) * a % t, Y = M(H, Je, t);
    if (!he.eql(he.sqr(Y), n)) throw new Error("Cannot find square root");
    return Y;
  }
  var he = mt(be.p, { sqrt: Sn });
  var Rn = Xe(be, { Fp: he, endo: vn });
  var pe = Qe(Rn, Se);
  var An = Uint8Array.from([7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8]);
  var en = Uint8Array.from(new Array(16).fill(0).map((n, t) => t));
  var Fn = en.map((n) => (9 * n + 5) % 16);
  var nn = (() => {
    let r = [[en], [Fn]];
    for (let e = 0; e < 4; e++) for (let o of r) o.push(o[e].map((s) => An[s]));
    return r;
  })();
  var rn = nn[0];
  var on = nn[1];
  var sn = [[11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8], [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7], [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9], [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6], [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5]].map((n) => Uint8Array.from(n));
  var On = rn.map((n, t) => n.map((r) => sn[t][r]));
  var In = on.map((n, t) => n.map((r) => sn[t][r]));
  var Tn = Uint32Array.from([0, 1518500249, 1859775393, 2400959708, 2840853838]);
  var Hn = Uint32Array.from([1352829926, 1548603684, 1836072691, 2053994217, 0]);
  function tn(n, t, r, e) {
    return n === 0 ? t ^ r ^ e : n === 1 ? t & r | ~t & e : n === 2 ? (t | ~r) ^ e : n === 3 ? t & e | r & ~e : t ^ (r | ~e);
  }
  var Vt = new Uint32Array(16);
  var xe = class extends bt {
    h0 = 1732584193;
    h1 = -271733879;
    h2 = -1732584194;
    h3 = 271733878;
    h4 = -1009589776;
    constructor() {
      super(64, 20, 8, true);
    }
    get() {
      let { h0: t, h1: r, h2: e, h3: o, h4: s } = this;
      return [t, r, e, o, s];
    }
    set(t, r, e, o, s) {
      this.h0 = t | 0, this.h1 = r | 0, this.h2 = e | 0, this.h3 = o | 0, this.h4 = s | 0;
    }
    process(t, r) {
      for (let p = 0; p < 16; p++, r += 4) Vt[p] = t.getUint32(r, true);
      let e = this.h0 | 0, o = e, s = this.h1 | 0, c = s, i = this.h2 | 0, f = i, a = this.h3 | 0, d = a, h = this.h4 | 0, v = h;
      for (let p = 0; p < 5; p++) {
        let S = 4 - p, F = Tn[p], R = Hn[p], T = rn[p], L = on[p], z = On[p], K = In[p];
        for (let H = 0; H < 16; H++) {
          let Y = wt(e + tn(p, s, i, a) + Vt[T[H]] + F, z[H]) + h | 0;
          e = h, h = a, a = wt(i, 10) | 0, i = s, s = Y;
        }
        for (let H = 0; H < 16; H++) {
          let Y = wt(o + tn(S, c, f, d) + Vt[L[H]] + R, K[H]) + v | 0;
          o = v, v = d, d = wt(f, 10) | 0, f = c, c = Y;
        }
      }
      this.set(this.h1 + i + d | 0, this.h2 + a + v | 0, this.h3 + h + o | 0, this.h4 + e + c | 0, this.h0 + s + f | 0);
    }
    roundClean() {
      P(Vt);
    }
    destroy() {
      this.destroyed = true, P(this.buffer), this.set(0, 0, 0, 0, 0);
    }
  };
  var cn = Tt(() => new xe());
  var hr = (n) => pe.getPublicKey(n, true);
  var br = (n) => cn(n);
  var pr = (n) => pe.utils.isValidSecretKey(n);

  // src/cate-address.mjs
  var networks = Object.freeze({
    devnet: { name: "DEVNET", address: [31, 192], wif: 240, notice: "Development network \xB7 provisional address format" },
    testnet: { name: "TESTNET", address: [7, 132], wif: 211, notice: "Test network \xB7 private rehearsal format" },
    mainnet: { name: "MAINNET CANDIDATE", address: [6, 132], wif: 210, notice: "Mainnet candidate \xB7 no public launch verified" }
  });
  var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function base58(bytes) {
    let value = 0n;
    for (const byte of bytes) value = value << 8n | BigInt(byte);
    let result = "";
    while (value > 0n) {
      result = alphabet[Number(value % 58n)] + result;
      value /= 58n;
    }
    for (const byte of bytes) {
      if (byte !== 0) break;
      result = `1${result}`;
    }
    return result;
  }
  async function sha256(bytes) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  }
  async function base58Check(payload) {
    const first = await sha256(payload);
    const second = await sha256(first);
    first.fill(0);
    const checked = new Uint8Array(payload.length + 4);
    checked.set(payload);
    checked.set(second.subarray(0, 4), payload.length);
    const result = base58(checked);
    checked.fill(0);
    second.fill(0);
    return result;
  }
  async function addressAndWif(secret, networkId) {
    const network2 = networks[networkId];
    if (!network2 || !pr(secret)) throw new Error("Invalid network or private key");
    const publicKey = hr(secret);
    const publicHash = br(await sha256(publicKey));
    const addressPayload = new Uint8Array(22);
    addressPayload.set(network2.address);
    addressPayload.set(publicHash, 2);
    const address = await base58Check(addressPayload);
    const wifPayload = new Uint8Array(34);
    wifPayload[0] = network2.wif;
    wifPayload.set(secret, 1);
    wifPayload[33] = 1;
    const wif = await base58Check(wifPayload);
    wifPayload.fill(0);
    addressPayload.fill(0);
    publicHash.fill(0);
    publicKey.fill(0);
    return { address, wif };
  }
  function newSecret() {
    if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
      throw new Error("Secure browser cryptography unavailable");
    }
    let secret;
    do {
      secret = crypto.getRandomValues(new Uint8Array(32));
    } while (!pr(secret));
    return secret;
  }

  // src/accounts.js
  var secretPattern = /^[0-9a-f]{64}$/i;
  async function createAccounts() {
    const cate = newSecret();
    const shield = crypto.getRandomValues(new Uint8Array(32));
    try {
      return {
        cateKey: Array.from(cate, (b) => b.toString(16).padStart(2, "0")).join(""),
        shieldSeed: Array.from(shield, (b) => b.toString(16).padStart(2, "0")).join("")
      };
    } finally {
      cate.fill(0);
      shield.fill(0);
    }
  }
  function withShieldAccount(secrets2) {
    if (!secrets2 || !secretPattern.test(secrets2.cateKey)) throw new Error("Wallet contains an invalid Catecash key.");
    if (secretPattern.test(secrets2.shieldSeed ?? "")) return { secrets: secrets2, upgraded: false };
    if (secrets2.shieldSeed != null) throw new Error("Wallet contains an invalid Ironwood key.");
    const seed = crypto.getRandomValues(new Uint8Array(32));
    try {
      return { secrets: { ...secrets2, shieldSeed: Array.from(seed, (b) => b.toString(16).padStart(2, "0")).join("") }, upgraded: true };
    } finally {
      seed.fill(0);
    }
  }
  async function accountAddresses(secrets2, network2) {
    if (!secrets2 || !secretPattern.test(secrets2.cateKey)) throw new Error("Wallet contains an invalid Catecash key.");
    const cate = Uint8Array.from(secrets2.cateKey.match(/.{2}/g), (byte) => parseInt(byte, 16));
    try {
      return { cateAddress: (await addressAndWif(cate, network2)).address };
    } finally {
      cate.fill(0);
    }
  }
  async function cateWif(secrets2, network2) {
    if (!secretPattern.test(secrets2?.cateKey ?? "")) throw new Error("Wallet contains invalid Catecash key.");
    const cate = Uint8Array.from(secrets2.cateKey.match(/.{2}/g), (byte) => parseInt(byte, 16));
    try {
      return (await addressAndWif(cate, network2)).wif;
    } finally {
      cate.fill(0);
    }
  }

  // src/vault.js
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();
  var ITERATIONS = 6e5;
  var toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
  var fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  async function keyFor(password, salt) {
    const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptVault(secrets2, password) {
    if (typeof password !== "string" || password.length < 12) throw new Error("Use a password of at least 12 characters.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFor(password, salt);
    const payload = encoder.encode(JSON.stringify(secrets2));
    try {
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload));
      return { format: "catecash-chrome-wallet", version: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, cipher: "AES-256-GCM", salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
    } finally {
      payload.fill(0);
    }
  }
  async function decryptVault(vault2, password) {
    if (!vault2 || vault2.format !== "catecash-chrome-wallet" || vault2.version !== 1 || vault2.kdf !== "PBKDF2-SHA256" || vault2.iterations !== ITERATIONS || vault2.cipher !== "AES-256-GCM") throw new Error("Unsupported wallet backup.");
    let salt, iv, ciphertext;
    try {
      salt = fromBase64(vault2.salt);
      iv = fromBase64(vault2.iv);
      ciphertext = fromBase64(vault2.ciphertext);
    } catch {
      throw new Error("Wallet backup is damaged.");
    }
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error("Wallet backup is damaged.");
    try {
      const key = await keyFor(password, salt);
      const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
      try {
        return JSON.parse(decoder.decode(plaintext));
      } finally {
        plaintext.fill(0);
      }
    } catch {
      throw new Error("Wrong password or damaged wallet backup.");
    }
  }

  // src/networks.js
  var CATE_NETWORKS = Object.freeze({
    mainnet: { label: "Mainnet candidate", chain: "catecash-mainnet", genesis: "050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323", explorer: "https://scan.catecash.com" },
    testnet: { label: "Testnet", chain: "catecash-testnet", genesis: "15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2", explorer: "https://scan-testnet.catecash.com" },
    devnet: { label: "Devnet", chain: "catecash-devnet", genesis: "6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf", explorer: "https://scan-devnet.catecash.com" }
  });
  function formatUnits(raw, places) {
    if (!/^(0|[1-9]\d*)$/.test(String(raw))) throw new Error("Invalid balance from network.");
    const value = BigInt(raw);
    const divisor = 10n ** BigInt(places);
    const whole = value / divisor;
    const fraction = String(value % divisor).padStart(places, "0").replace(/0+$/, "");
    return `${whole}${fraction ? "." + fraction : ""}`;
  }
  async function cateBalance(networkId, address, fetchImpl = fetch) {
    const network2 = CATE_NETWORKS[networkId];
    if (!network2) throw new Error("Unknown Catecash network.");
    const statusResponse = await fetchImpl(network2.explorer + "/api/status", { cache: "no-store" });
    if (!statusResponse.ok) throw new Error("Catecash explorer is unavailable.");
    const status = await statusResponse.json();
    if (status.chain !== network2.chain || status.genesisHash?.toLowerCase() !== network2.genesis) throw new Error("Catecash explorer network identity does not match.");
    const response = await fetchImpl(network2.explorer + "/api/address/" + encodeURIComponent(address), { cache: "no-store" });
    if (!response.ok) throw new Error("Catecash balance is unavailable.");
    const data = await response.json();
    if (data.address !== address || data.unit !== "catemoto" || !/^(0|[1-9]\d*)$/.test(String(data.balance))) throw new Error("Catecash explorer returned invalid balance data.");
    return data.balance;
  }

  // src/cate-signer.js
  var encoder2 = new TextEncoder();
  var decoder2 = new TextDecoder();
  var signerPromise;
  async function createSigner(bytes) {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const {
      memory,
      alloc,
      dealloc,
      sign_json: signJson,
      shield_json: shieldJson,
      shield_address_json: shieldAddressJson,
      scan_ironwood_json: scanIronwoodJson,
      shielded_send_json: shieldedSendJson
    } = instance.exports;
    const invoke = (operation, request, needsEntropy, expectsTransaction, maxResult = 5e5) => {
      if (!["devnet", "testnet", "mainnet"].includes(request?.network)) throw new Error("Unknown Catecash network.");
      const input = encoder2.encode(JSON.stringify({
        ...request,
        ...needsEntropy ? { entropy_hex: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("") } : {}
      }));
      const inputLength = input.length;
      const pointer = alloc(inputLength);
      if (!pointer) throw new Error("Catecash signer could not allocate memory.");
      new Uint8Array(memory.buffer, pointer, inputLength).set(input);
      input.fill(0);
      let resultPointer;
      try {
        resultPointer = operation(pointer, inputLength);
        if (!resultPointer) throw new Error("Catecash signer rejected the request.");
        const view2 = new DataView(memory.buffer);
        const size = view2.getUint32(resultPointer, true);
        if (size > maxResult) throw new Error("Catecash signer returned an oversized result.");
        const response = JSON.parse(decoder2.decode(new Uint8Array(memory.buffer, resultPointer + 4, size)));
        if (response.error) throw new Error(response.error);
        if (!response.ok || expectsTransaction && !response.ok.raw_hex) throw new Error("Catecash signer returned no result.");
        return response.ok;
      } finally {
        dealloc(pointer, inputLength);
        if (resultPointer) {
          const size = new DataView(memory.buffer).getUint32(resultPointer, true);
          if (size <= 16e6) dealloc(resultPointer, size + 4);
        }
      }
    };
    const sign = (request) => invoke(signJson, request, true, true);
    sign.shield = (request) => invoke(shieldJson, request, true, true);
    sign.shieldAddress = (request) => invoke(shieldAddressJson, request, false, false).address;
    sign.scanIronwood = (request) => invoke(scanIronwoodJson, request, false, false, 16e6);
    sign.shieldedSend = (request) => invoke(shieldedSendJson, request, true, true);
    return sign;
  }
  async function loadSigner() {
    signerPromise ??= fetch(chrome.runtime.getURL("catecash_browser_engine.wasm")).then(async (response) => {
      if (!response.ok) throw new Error("Catecash signer module is missing.");
      return createSigner(await response.arrayBuffer());
    });
    return signerPromise;
  }

  // src/cate-gateway.js
  var URLS = {
    devnet: "http://127.0.0.1:34777",
    testnet: "https://plugin-wallet-test.catecash.com",
    mainnet: "https://wallet.catecash.com"
  };
  function gatewayUrl(network2) {
    const url = URLS[network2];
    if (!url) throw new Error("Unknown Catecash network.");
    return url;
  }
  function assertNetwork(data, network2) {
    const expected = CATE_NETWORKS[network2];
    if (!expected) throw new Error("Unknown Catecash network.");
    if (data?.chain !== expected.chain || data?.genesis !== expected.genesis || !Number.isSafeInteger(data.height)) throw new Error("Gateway has the wrong Catecash chain.");
    return data;
  }
  async function json(response) {
    if (!response.ok) {
      if (response.status === 422) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Catecash node rejected the transaction.");
      }
      throw new Error(`Catecash gateway returned HTTP ${response.status}.`);
    }
    return response.json();
  }
  async function readJson(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch(url);
      } catch (error) {
        if (attempt === 2) throw new Error("Cannot reach the Catecash gateway. Try again shortly.", { cause: error });
      }
      if (response?.ok) return response.json();
      if (response && (![502, 503, 504].includes(response.status) || attempt === 2)) return json(response);
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  async function spendableUtxos(network2, address) {
    const url = gatewayUrl(network2);
    const [status, data] = await Promise.all([
      readJson(url + "/status"),
      readJson(url + "/utxos/" + encodeURIComponent(address))
    ]);
    assertNetwork(status, network2);
    assertNetwork(data, network2);
    if (data.address !== address || !Array.isArray(data.utxos) || Math.abs(status.height - data.height) > 2) throw new Error("Gateway returned inconsistent UTXOs.");
    const spendable = data.utxos.filter((utxo) => !utxo.coinbase);
    if (data.utxos.length > 0 && spendable.length === 0) {
      throw new Error("These funds are mined rewards. Catecash requires them to be shielded before a transparent send.");
    }
    return { ...data, utxos: spendable };
  }
  async function shieldSetup(network2, address) {
    const data = assertNetwork(await readJson(gatewayUrl(network2) + "/shield-setup/" + encodeURIComponent(address)), network2);
    if (data.address !== address || !/^[0-9a-fA-F]{64}$/.test(data.hash) || typeof data.tree_state_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex) || !Array.isArray(data.rewards) || data.rewards.length > 20) throw new Error("Gateway returned invalid shield setup.");
    return data;
  }
  async function shieldCheckpoint(network2) {
    const data = assertNetwork(await readJson(gatewayUrl(network2) + "/shield-checkpoint"), network2);
    if (!/^[0-9a-fA-F]{64}$/.test(data.hash) || typeof data.tree_state_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex)) throw new Error("Gateway returned invalid Ironwood checkpoint.");
    return { height: data.height, hash: data.hash, tree_hex: data.tree_state_hex, notes: [], balance: "0" };
  }
  async function gatewayStatus(network2) {
    return assertNetwork(await readJson(gatewayUrl(network2) + "/status"), network2);
  }
  async function shieldBlock(network2, height) {
    if (!Number.isSafeInteger(height) || height < 1) throw new Error("Invalid scan height.");
    const data = assertNetwork(await readJson(gatewayUrl(network2) + "/shield-block/" + height), network2);
    if (data.height !== height || !/^[0-9a-fA-F]{64}$/.test(data.hash) || typeof data.raw_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.raw_hex) || typeof data.tree_state_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex)) {
      throw new Error("Gateway returned invalid Ironwood block.");
    }
    return data;
  }
  async function broadcastCate(network2, rawHex) {
    const url = gatewayUrl(network2);
    const expected = CATE_NETWORKS[network2];
    if (!expected) throw new Error("Unknown Catecash network.");
    const result = await json(await fetch(url + "/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw_hex: rawHex, chain: expected.chain, genesis: expected.genesis })
    }));
    assertNetwork(result, network2);
    if (!/^[0-9a-fA-F]{64}$/.test(result.txid)) throw new Error("Gateway returned an invalid transaction ID.");
    return result.txid;
  }

  // src/ironwood-client.js
  var activeWorkers = /* @__PURE__ */ new Map();
  var nextId = 0;
  function stopIronwoodWork() {
    for (const [worker, reject] of activeWorkers) {
      worker.terminate();
      reject(new Error("Ironwood work stopped."));
    }
    activeWorkers.clear();
  }
  function runIronwood(operation, request, onProgress) {
    const worker = new Worker(chrome.runtime.getURL("ironwood-worker.js"));
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      activeWorkers.set(worker, reject);
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        if (data.progress) {
          onProgress?.(data.progress);
          return;
        }
        activeWorkers.delete(worker);
        worker.terminate();
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.onerror = () => {
        activeWorkers.delete(worker);
        worker.terminate();
        reject(new Error("Ironwood worker failed."));
      };
      worker.postMessage({ id, operation, request, wasmUrl: chrome.runtime.getURL("catecash_browser_engine.wasm") });
    });
  }

  // src/ironwood-state.js
  var encoder3 = new TextEncoder();
  var decoder3 = new TextDecoder();
  var keyName = (network2) => `ironwoodScan_${network2}`;
  async function scanKey(seedHex, network2) {
    if (!/^[0-9a-fA-F]{64}$/.test(seedHex ?? "")) throw new Error("Wallet has no valid Ironwood key.");
    const seed = Uint8Array.from(seedHex.match(/../g), (item) => parseInt(item, 16));
    try {
      const material = await crypto.subtle.importKey("raw", seed, "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: encoder3.encode("Catecash browser Ironwood scan state v1"),
          info: encoder3.encode(network2)
        },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      seed.fill(0);
    }
  }
  async function saveScanState(seedHex, network2, state) {
    const key = await scanKey(seedHex, network2);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const clear = encoder3.encode(JSON.stringify(state));
    try {
      const cipher = new Uint8Array(await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv,
        additionalData: encoder3.encode(keyName(network2))
      }, key, clear));
      await chrome.storage.local.set({ [keyName(network2)]: {
        version: 1,
        iv: Array.from(iv),
        cipher: Array.from(cipher)
      } });
    } finally {
      clear.fill(0);
    }
  }
  async function loadScanState(seedHex, network2) {
    const record = (await chrome.storage.local.get(keyName(network2)))[keyName(network2)];
    if (!record) return null;
    if (record.version !== 1 || !Array.isArray(record.iv) || record.iv.length !== 12 || !Array.isArray(record.cipher) || record.cipher.length < 17) throw new Error("Saved Ironwood scan is damaged.");
    const key = await scanKey(seedHex, network2);
    let clear;
    try {
      clear = new Uint8Array(await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: Uint8Array.from(record.iv),
          additionalData: encoder3.encode(keyName(network2))
        },
        key,
        Uint8Array.from(record.cipher)
      ));
      const state = JSON.parse(decoder3.decode(clear));
      if (!Number.isSafeInteger(state.height) || !/^[0-9a-fA-F]{64}$/.test(state.hash) || typeof state.tree_hex !== "string" || !Array.isArray(state.notes) || !/^(0|[1-9]\d*)$/.test(state.balance)) throw new Error("Saved Ironwood scan is damaged.");
      return state;
    } catch {
      throw new Error("Cannot open saved Ironwood scan. Restore the wallet backup and rescan.");
    } finally {
      clear?.fill(0);
    }
  }

  // src/idle-lock.js
  var DEFAULT_LOCK_MINUTES = 5;
  var LOCK_MINUTES = Object.freeze([5, 15, 30, 60, 120, 240, 480]);
  function lockMinutes(raw) {
    const minutes = Number(raw);
    return LOCK_MINUTES.includes(minutes) ? minutes : DEFAULT_LOCK_MINUTES;
  }
  function createIdleLock(onLock, now = Date.now, schedule = setTimeout, cancel = clearTimeout) {
    let minutes = DEFAULT_LOCK_MINUTES;
    let lastActivity = 0;
    let timer;
    let active = false;
    function check() {
      if (!active) return;
      const remaining = lastActivity + minutes * 6e4 - now();
      if (remaining <= 0) {
        stop();
        onLock();
      } else {
        cancel(timer);
        timer = schedule(check, remaining);
      }
    }
    function stop() {
      active = false;
      cancel(timer);
      timer = void 0;
    }
    return {
      start() {
        active = true;
        lastActivity = now();
        check();
      },
      activity() {
        if (active) {
          lastActivity = now();
          check();
        }
      },
      configure(raw) {
        minutes = lockMinutes(raw);
        check();
      },
      check,
      stop
    };
  }

  // src/qrcode.mjs
  var qrcode = function(typeNumber, errorCorrectionLevel) {
    const PAD0 = 236;
    const PAD1 = 17;
    let _typeNumber = typeNumber;
    const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null;
    let _moduleCount = 0;
    let _dataCache = null;
    const _dataList = [];
    const _this = {};
    const makeImpl = function(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = (function(moduleCount) {
        const modules = new Array(moduleCount);
        for (let row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (let col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      })(_moduleCount);
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }
      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    };
    const setupPositionProbePattern = function(row, col) {
      for (let r = -1; r <= 7; r += 1) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c += 1) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };
    const getBestMaskPattern = function() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i += 1) {
        makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    };
    const setupTimingPattern = function() {
      for (let r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = r % 2 == 0;
      }
      for (let c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = c % 2 == 0;
      }
    };
    const setupPositionAdjustPattern = function() {
      const pos = QRUtil.getPatternPosition(_typeNumber);
      for (let i = 0; i < pos.length; i += 1) {
        for (let j = 0; j < pos.length; j += 1) {
          const row = pos[i];
          const col = pos[j];
          if (_modules[row][col] != null) {
            continue;
          }
          for (let r = -2; r <= 2; r += 1) {
            for (let c = -2; c <= 2; c += 1) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };
    const setupTypeNumber = function(test) {
      const bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };
    const setupTypeInfo = function(test, maskPattern) {
      const data = _errorCorrectionLevel << 3 | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }
      _modules[_moduleCount - 8][8] = !test;
    };
    const mapData = function(data, maskPattern) {
      let inc = -1;
      let row = _moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (let col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col -= 1;
        while (true) {
          for (let c = 0; c < 2; c += 1) {
            if (_modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) == 1;
              }
              const mask = maskFunc(row, col - c);
              if (mask) {
                dark = !dark;
              }
              _modules[row][col - c] = dark;
              bitIndex -= 1;
              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };
    const createBytes = function(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r += 1) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i += 1) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
        }
      }
      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }
      for (let i = 0; i < maxEcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }
      return data;
    };
    const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
      const buffer = qrBitBuffer();
      for (let i = 0; i < dataList.length; i += 1) {
        const data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }
      return createBytes(buffer, rsBlocks);
    };
    _this.addData = function(data, mode) {
      mode = mode || "Byte";
      let newData = null;
      switch (mode) {
        case "Numeric":
          newData = qrNumber(data);
          break;
        case "Alphanumeric":
          newData = qrAlphaNum(data);
          break;
        case "Byte":
          newData = qr8BitByte(data);
          break;
        case "Kanji":
          newData = qrKanji(data);
          break;
        default:
          throw "mode:" + mode;
      }
      _dataList.push(newData);
      _dataCache = null;
    };
    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + "," + col;
      }
      return _modules[row][col];
    };
    _this.getModuleCount = function() {
      return _moduleCount;
    };
    _this.make = function() {
      if (_typeNumber < 1) {
        let typeNumber2 = 1;
        for (; typeNumber2 < 40; typeNumber2++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
          const buffer = qrBitBuffer();
          for (let i = 0; i < _dataList.length; i++) {
            const data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
            data.write(buffer);
          }
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }
        _typeNumber = typeNumber2;
      }
      makeImpl(false, getBestMaskPattern());
    };
    _this.createTableTag = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      let qrHtml = "";
      qrHtml += '<table style="';
      qrHtml += " border-width: 0px; border-style: none;";
      qrHtml += " border-collapse: collapse;";
      qrHtml += " padding: 0px; margin: " + margin + "px;";
      qrHtml += '">';
      qrHtml += "<tbody>";
      for (let r = 0; r < _this.getModuleCount(); r += 1) {
        qrHtml += "<tr>";
        for (let c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += " border-width: 0px; border-style: none;";
          qrHtml += " border-collapse: collapse;";
          qrHtml += " padding: 0px; margin: 0px;";
          qrHtml += " width: " + cellSize + "px;";
          qrHtml += " height: " + cellSize + "px;";
          qrHtml += " background-color: ";
          qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
          qrHtml += ";";
          qrHtml += '"/>';
        }
        qrHtml += "</tr>";
      }
      qrHtml += "</tbody>";
      qrHtml += "</table>";
      return qrHtml;
    };
    _this.createSvgTag = function(cellSize, margin, alt, title) {
      let opts = {};
      if (typeof arguments[0] == "object") {
        opts = arguments[0];
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      alt = typeof alt === "string" ? { text: alt } : alt || {};
      alt.text = alt.text || null;
      alt.id = alt.text ? alt.id || "qrcode-description" : null;
      title = typeof title === "string" ? { text: title } : title || {};
      title.text = title.text || null;
      title.id = title.text ? title.id || "qrcode-title" : null;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let c, mc, r, mr, qrSvg = "", rect;
      rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
      qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
      qrSvg += ">";
      qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
      qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';
      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c)) {
            mc = c * cellSize + margin;
            qrSvg += "M" + mc + "," + mr + rect;
          }
        }
      }
      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += "</svg>";
      return qrSvg;
    };
    _this.createDataURL = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          const c = Math.floor((x - min) / cellSize);
          const r = Math.floor((y - min) / cellSize);
          return _this.isDark(r, c) ? 0 : 1;
        } else {
          return 1;
        }
      });
    };
    _this.createImgTag = function(cellSize, margin, alt) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let img = "";
      img += "<img";
      img += ' src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += ' width="';
      img += size;
      img += '"';
      img += ' height="';
      img += size;
      img += '"';
      if (alt) {
        img += ' alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += "/>";
      return img;
    };
    const escapeXml = function(s) {
      let escaped = "";
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charAt(i);
        switch (c) {
          case "<":
            escaped += "&lt;";
            break;
          case ">":
            escaped += "&gt;";
            break;
          case "&":
            escaped += "&amp;";
            break;
          case '"':
            escaped += "&quot;";
            break;
          default:
            escaped += c;
            break;
        }
      }
      return escaped;
    };
    const _createHalfASCII = function(margin) {
      const cellSize = 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r1, r2, p;
      const blocks = {
        "\u2588\u2588": "\u2588",
        "\u2588 ": "\u2580",
        " \u2588": "\u2584",
        "  ": " "
      };
      const blocksLastLineNoMargin = {
        "\u2588\u2588": "\u2580",
        "\u2588 ": "\u2580",
        " \u2588": " ",
        "  ": " "
      };
      let ascii = "";
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = "\u2588";
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = " ";
          }
          if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += " ";
          } else {
            p += "\u2588";
          }
          ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
        }
        ascii += "\n";
      }
      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("\u2580");
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;
      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }
      cellSize -= 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r, p;
      const white = Array(cellSize + 1).join("\u2588\u2588");
      const black = Array(cellSize + 1).join("  ");
      let ascii = "";
      let line = "";
      for (y = 0; y < size; y += 1) {
        r = Math.floor((y - min) / cellSize);
        line = "";
        for (x = 0; x < size; x += 1) {
          p = 1;
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }
          line += p ? white : black;
        }
        for (r = 0; r < cellSize; r += 1) {
          ascii += line + "\n";
        }
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      const length = _this.getModuleCount();
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? "black" : "white";
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    };
    return _this;
  };
  qrcode.stringToBytes = function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      bytes.push(c & 255);
    }
    return bytes;
  };
  qrcode.createStringToBytes = function(unicodeData, numChars) {
    const unicodeMap = (function() {
      const bin = base64DecodeInputStream(unicodeData);
      const read = function() {
        const b = bin.read();
        if (b == -1) throw "eof";
        return b;
      };
      let count = 0;
      const unicodeMap2 = {};
      while (true) {
        const b0 = bin.read();
        if (b0 == -1) break;
        const b1 = read();
        const b2 = read();
        const b3 = read();
        const k = String.fromCharCode(b0 << 8 | b1);
        const v = b2 << 8 | b3;
        unicodeMap2[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + " != " + numChars;
      }
      return unicodeMap2;
    })();
    const unknownChar = "?".charCodeAt(0);
    return function(s) {
      const bytes = [];
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          const b = unicodeMap[s.charAt(i)];
          if (typeof b == "number") {
            if ((b & 255) == b) {
              bytes.push(b);
            } else {
              bytes.push(b >>> 8);
              bytes.push(b & 255);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };
  var QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3
  };
  var QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
  };
  var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  var QRUtil = (function() {
    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    const _this = {};
    const getBCHDigit = function(data) {
      let digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };
    _this.getBCHTypeInfo = function(data) {
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
      }
      return (data << 10 | d) ^ G15_MASK;
    };
    _this.getBCHTypeNumber = function(data) {
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
      }
      return data << 12 | d;
    };
    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };
    _this.getMaskFunction = function(maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return function(i, j) {
            return (i + j) % 2 == 0;
          };
        case QRMaskPattern.PATTERN001:
          return function(i, j) {
            return i % 2 == 0;
          };
        case QRMaskPattern.PATTERN010:
          return function(i, j) {
            return j % 3 == 0;
          };
        case QRMaskPattern.PATTERN011:
          return function(i, j) {
            return (i + j) % 3 == 0;
          };
        case QRMaskPattern.PATTERN100:
          return function(i, j) {
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN101:
          return function(i, j) {
            return i * j % 2 + i * j % 3 == 0;
          };
        case QRMaskPattern.PATTERN110:
          return function(i, j) {
            return (i * j % 2 + i * j % 3) % 2 == 0;
          };
        case QRMaskPattern.PATTERN111:
          return function(i, j) {
            return (i * j % 3 + (i + j) % 2) % 2 == 0;
          };
        default:
          throw "bad maskPattern:" + maskPattern;
      }
    };
    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    };
    _this.getLengthInBits = function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10;
          case QRMode.MODE_ALPHA_NUM:
            return 9;
          case QRMode.MODE_8BIT_BYTE:
            return 8;
          case QRMode.MODE_KANJI:
            return 8;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12;
          case QRMode.MODE_ALPHA_NUM:
            return 11;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 10;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 14;
          case QRMode.MODE_ALPHA_NUM:
            return 13;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 12;
          default:
            throw "mode:" + mode;
        }
      } else {
        throw "type:" + type;
      }
    };
    _this.getLostPoint = function(qrcode2) {
      const moduleCount = qrcode2.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          let sameCount = 0;
          const dark = qrcode2.isDark(row, col);
          for (let r = -1; r <= 1; r += 1) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }
            for (let c = -1; c <= 1; c += 1) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }
              if (r == 0 && c == 0) {
                continue;
              }
              if (dark == qrcode2.isDark(row + r, col + c)) {
                sameCount += 1;
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }
      ;
      for (let row = 0; row < moduleCount - 1; row += 1) {
        for (let col = 0; col < moduleCount - 1; col += 1) {
          let count = 0;
          if (qrcode2.isDark(row, col)) count += 1;
          if (qrcode2.isDark(row + 1, col)) count += 1;
          if (qrcode2.isDark(row, col + 1)) count += 1;
          if (qrcode2.isDark(row + 1, col + 1)) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }
      let darkCount = 0;
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount; row += 1) {
          if (qrcode2.isDark(row, col)) {
            darkCount += 1;
          }
        }
      }
      const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    };
    return _this;
  })();
  var QRMath = (function() {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i]] = i;
    }
    const _this = {};
    _this.glog = function(n) {
      if (n < 1) {
        throw "glog(" + n + ")";
      }
      return LOG_TABLE[n];
    };
    _this.gexp = function(n) {
      while (n < 0) {
        n += 255;
      }
      while (n >= 256) {
        n -= 255;
      }
      return EXP_TABLE[n];
    };
    return _this;
  })();
  var qrPolynomial = function(num, shift) {
    if (typeof num.length == "undefined") {
      throw num.length + "/" + shift;
    }
    const _num = (function() {
      let offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      const _num2 = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i += 1) {
        _num2[i] = num[i + offset];
      }
      return _num2;
    })();
    const _this = {};
    _this.getAt = function(index) {
      return _num[index];
    };
    _this.getLength = function() {
      return _num.length;
    };
    _this.multiply = function(e) {
      const num2 = new Array(_this.getLength() + e.getLength() - 1);
      for (let i = 0; i < _this.getLength(); i += 1) {
        for (let j = 0; j < e.getLength(); j += 1) {
          num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return qrPolynomial(num2, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }
      const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      const num2 = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i += 1) {
        num2[i] = _this.getAt(i);
      }
      for (let i = 0; i < e.getLength(); i += 1) {
        num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      }
      return qrPolynomial(num2, 0).mod(e);
    };
    return _this;
  };
  var QRRSBlock = (function() {
    const RS_BLOCK_TABLE = [
      // L
      // M
      // Q
      // H
      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],
      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],
      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],
      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],
      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],
      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],
      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],
      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],
      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],
      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],
      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],
      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],
      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],
      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],
      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],
      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],
      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],
      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],
      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],
      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],
      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],
      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],
      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],
      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],
      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],
      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],
      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],
      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],
      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],
      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],
      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];
    const qrRSBlock = function(totalCount, dataCount) {
      const _this2 = {};
      _this2.totalCount = totalCount;
      _this2.dataCount = dataCount;
      return _this2;
    };
    const _this = {};
    const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == "undefined") {
        throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
      }
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i += 1) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount));
        }
      }
      return list;
    };
    return _this;
  })();
  var qrBitBuffer = function() {
    const _buffer = [];
    let _length = 0;
    const _this = {};
    _this.getBuffer = function() {
      return _buffer;
    };
    _this.getAt = function(index) {
      const bufIndex = Math.floor(index / 8);
      return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
    };
    _this.put = function(num, length) {
      for (let i = 0; i < length; i += 1) {
        _this.putBit((num >>> length - i - 1 & 1) == 1);
      }
    };
    _this.getLengthInBits = function() {
      return _length;
    };
    _this.putBit = function(bit) {
      const bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }
      if (bit) {
        _buffer[bufIndex] |= 128 >>> _length % 8;
      }
      _length += 1;
    };
    return _this;
  };
  var qrNumber = function(data) {
    const _mode = QRMode.MODE_NUMBER;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const data2 = _data;
      let i = 0;
      while (i + 2 < data2.length) {
        buffer.put(strToNum(data2.substring(i, i + 3)), 10);
        i += 3;
      }
      if (i < data2.length) {
        if (data2.length - i == 1) {
          buffer.put(strToNum(data2.substring(i, i + 1)), 4);
        } else if (data2.length - i == 2) {
          buffer.put(strToNum(data2.substring(i, i + 2)), 7);
        }
      }
    };
    const strToNum = function(s) {
      let num = 0;
      for (let i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i));
      }
      return num;
    };
    const chatToNum = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      }
      throw "illegal char :" + c;
    };
    return _this;
  };
  var qrAlphaNum = function(data) {
    const _mode = QRMode.MODE_ALPHA_NUM;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const s = _data;
      let i = 0;
      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
          11
        );
        i += 2;
      }
      if (i < s.length) {
        buffer.put(getCode(s.charAt(i)), 6);
      }
    };
    const getCode = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      } else if ("A" <= c && c <= "Z") {
        return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
      } else {
        switch (c) {
          case " ":
            return 36;
          case "$":
            return 37;
          case "%":
            return 38;
          case "*":
            return 39;
          case "+":
            return 40;
          case "-":
            return 41;
          case ".":
            return 42;
          case "/":
            return 43;
          case ":":
            return 44;
          default:
            throw "illegal char :" + c;
        }
      }
    };
    return _this;
  };
  var qr8BitByte = function(data) {
    const _mode = QRMode.MODE_8BIT_BYTE;
    const _data = data;
    const _bytes = qrcode.stringToBytes(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _bytes.length;
    };
    _this.write = function(buffer) {
      for (let i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };
    return _this;
  };
  var qrKanji = function(data) {
    const _mode = QRMode.MODE_KANJI;
    const _data = data;
    const stringToBytes2 = qrcode.stringToBytes;
    !(function(c, code) {
      const test = stringToBytes2(c);
      if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
        throw "sjis not supported.";
      }
    })("\u53CB", 38726);
    const _bytes = stringToBytes2(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };
    _this.write = function(buffer) {
      const data2 = _bytes;
      let i = 0;
      while (i + 1 < data2.length) {
        let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
        if (33088 <= c && c <= 40956) {
          c -= 33088;
        } else if (57408 <= c && c <= 60351) {
          c -= 49472;
        } else {
          throw "illegal char at " + (i + 1) + "/" + c;
        }
        c = (c >>> 8 & 255) * 192 + (c & 255);
        buffer.put(c, 13);
        i += 2;
      }
      if (i < data2.length) {
        throw "illegal char at " + (i + 1);
      }
    };
    return _this;
  };
  var byteArrayOutputStream = function() {
    const _bytes = [];
    const _this = {};
    _this.writeByte = function(b) {
      _bytes.push(b & 255);
    };
    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };
    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (let i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };
    _this.writeString = function(s) {
      for (let i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i));
      }
    };
    _this.toByteArray = function() {
      return _bytes;
    };
    _this.toString = function() {
      let s = "";
      s += "[";
      for (let i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ",";
        }
        s += _bytes[i];
      }
      s += "]";
      return s;
    };
    return _this;
  };
  var base64EncodeOutputStream = function() {
    let _buffer = 0;
    let _buflen = 0;
    let _length = 0;
    let _base64 = "";
    const _this = {};
    const writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 63));
    };
    const encode = function(n) {
      if (n < 0) {
        throw "n:" + n;
      } else if (n < 26) {
        return 65 + n;
      } else if (n < 52) {
        return 97 + (n - 26);
      } else if (n < 62) {
        return 48 + (n - 52);
      } else if (n == 62) {
        return 43;
      } else if (n == 63) {
        return 47;
      } else {
        throw "n:" + n;
      }
    };
    _this.writeByte = function(n) {
      _buffer = _buffer << 8 | n & 255;
      _buflen += 8;
      _length += 1;
      while (_buflen >= 6) {
        writeEncoded(_buffer >>> _buflen - 6);
        _buflen -= 6;
      }
    };
    _this.flush = function() {
      if (_buflen > 0) {
        writeEncoded(_buffer << 6 - _buflen);
        _buffer = 0;
        _buflen = 0;
      }
      if (_length % 3 != 0) {
        const padlen = 3 - _length % 3;
        for (let i = 0; i < padlen; i += 1) {
          _base64 += "=";
        }
      }
    };
    _this.toString = function() {
      return _base64;
    };
    return _this;
  };
  var base64DecodeInputStream = function(str) {
    const _str = str;
    let _pos = 0;
    let _buffer = 0;
    let _buflen = 0;
    const _this = {};
    _this.read = function() {
      while (_buflen < 8) {
        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw "unexpected end of file./" + _buflen;
        }
        const c = _str.charAt(_pos);
        _pos += 1;
        if (c == "=") {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/)) {
          continue;
        }
        _buffer = _buffer << 6 | decode(c.charCodeAt(0));
        _buflen += 6;
      }
      const n = _buffer >>> _buflen - 8 & 255;
      _buflen -= 8;
      return n;
    };
    const decode = function(c) {
      if (65 <= c && c <= 90) {
        return c - 65;
      } else if (97 <= c && c <= 122) {
        return c - 97 + 26;
      } else if (48 <= c && c <= 57) {
        return c - 48 + 52;
      } else if (c == 43) {
        return 62;
      } else if (c == 47) {
        return 63;
      } else {
        throw "c:" + c;
      }
    };
    return _this;
  };
  var gifImage = function(width, height) {
    const _width = width;
    const _height = height;
    const _data = new Array(width * height);
    const _this = {};
    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };
    _this.write = function(out) {
      out.writeString("GIF87a");
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(128);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(255);
      out.writeByte(255);
      out.writeByte(255);
      out.writeString(",");
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);
      const lzwMinCodeSize = 2;
      const raster = getLZWRaster(lzwMinCodeSize);
      out.writeByte(lzwMinCodeSize);
      let offset = 0;
      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }
      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0);
      out.writeString(";");
    };
    const bitOutputStream = function(out) {
      const _out = out;
      let _bitLength = 0;
      let _bitBuffer = 0;
      const _this2 = {};
      _this2.write = function(data, length) {
        if (data >>> length != 0) {
          throw "length over";
        }
        while (_bitLength + length >= 8) {
          _out.writeByte(255 & (data << _bitLength | _bitBuffer));
          length -= 8 - _bitLength;
          data >>>= 8 - _bitLength;
          _bitBuffer = 0;
          _bitLength = 0;
        }
        _bitBuffer = data << _bitLength | _bitBuffer;
        _bitLength = _bitLength + length;
      };
      _this2.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };
      return _this2;
    };
    const getLZWRaster = function(lzwMinCodeSize) {
      const clearCode = 1 << lzwMinCodeSize;
      const endCode = (1 << lzwMinCodeSize) + 1;
      let bitLength = lzwMinCodeSize + 1;
      const table = lzwTable();
      for (let i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i));
      }
      table.add(String.fromCharCode(clearCode));
      table.add(String.fromCharCode(endCode));
      const byteOut = byteArrayOutputStream();
      const bitOut = bitOutputStream(byteOut);
      bitOut.write(clearCode, bitLength);
      let dataIndex = 0;
      let s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      while (dataIndex < _data.length) {
        const c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
        if (table.contains(s + c)) {
          s = s + c;
        } else {
          bitOut.write(table.indexOf(s), bitLength);
          if (table.size() < 4095) {
            if (table.size() == 1 << bitLength) {
              bitLength += 1;
            }
            table.add(s + c);
          }
          s = c;
        }
      }
      bitOut.write(table.indexOf(s), bitLength);
      bitOut.write(endCode, bitLength);
      bitOut.flush();
      return byteOut.toByteArray();
    };
    const lzwTable = function() {
      const _map = {};
      let _size = 0;
      const _this2 = {};
      _this2.add = function(key) {
        if (_this2.contains(key)) {
          throw "dup key:" + key;
        }
        _map[key] = _size;
        _size += 1;
      };
      _this2.size = function() {
        return _size;
      };
      _this2.indexOf = function(key) {
        return _map[key];
      };
      _this2.contains = function(key) {
        return typeof _map[key] != "undefined";
      };
      return _this2;
    };
    return _this;
  };
  var createDataURL = function(width, height, getPixel) {
    const gif = gifImage(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y));
      }
    }
    const b = byteArrayOutputStream();
    gif.write(b);
    const base64 = base64EncodeOutputStream();
    const bytes = b.toByteArray();
    for (let i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();
    return "data:image/gif;base64," + base64;
  };
  var stringToBytes = qrcode.stringToBytes;

  // src/popup.js
  var $2 = (id) => document.getElementById(id);
  var screens = ["home", "asset", "send", "review", "receive", "shield", "settings"];
  var titles = { home: "Catecash", asset: "Catecash", send: "Send", review: "Review send", receive: "Receive", shield: "Shield", settings: "Settings" };
  var vault = null;
  var secrets = null;
  var network = "mainnet";
  var addresses = null;
  var currentScreen = "home";
  var reviewResolver = null;
  var shieldAddress = null;
  var shieldBackupReady = false;
  var scanPromise = null;
  var scanState = null;
  var shieldRewardAvailable = false;
  var idleLock = createIdleLock(() => lockWallet("Wallet locked after inactivity."));
  function notice(message, error = false) {
    $2("notice").textContent = message;
    $2("notice").classList.toggle("error", error);
  }
  function view(name) {
    for (const id of ["setup", "locked", "wallet"]) $2(id).hidden = id !== name;
    $2("refresh").hidden = name !== "wallet";
    $2("lock").hidden = name !== "wallet";
    $2("back").hidden = name !== "wallet" || currentScreen === "home";
    if (name !== "wallet") {
      $2("header-title").textContent = "Catecash";
      $2("header-subtitle").textContent = "Wallet 1";
      $2("unlock-password").type = "password";
      $2("toggle-unlock-password").textContent = "Show";
      $2("toggle-unlock-password").setAttribute("aria-label", "Show password");
    }
  }
  function navigate(screen) {
    if (!screens.includes(screen) || !secrets) return;
    if (currentScreen === "review" && screen !== "review" && reviewResolver) {
      const resolve = reviewResolver;
      reviewResolver = null;
      resolve(false);
    }
    currentScreen = screen;
    for (const name of screens) $2("screen-" + name).hidden = name !== screen;
    $2("header-title").textContent = titles[screen];
    $2("header-subtitle").textContent = screen === "asset" ? CATE_NETWORKS[network].label : "Wallet 1";
    $2("back").hidden = screen === "home";
    document.querySelectorAll(".bottom-nav [data-screen]").forEach((button) => button.classList.toggle("selected", button.dataset.screen === screen));
    notice("");
    $2("wallet").scrollIntoView({ block: "start" });
    if (screen === "shield") loadShieldCandidate().catch((error) => notice(error.message, true));
  }
  async function run(button, action) {
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      notice(error?.message || "Something went wrong.", true);
    } finally {
      button.disabled = false;
    }
  }
  function updateDetail() {
    if (!addresses) return;
    $2("detail-network").textContent = ("Catecash " + CATE_NETWORKS[network].label).toUpperCase();
    $2("detail-balance").textContent = $2("cate-balance").textContent + " CATE";
    $2("detail-address").textContent = addresses.cateAddress;
    $2("cate-row-network").textContent = CATE_NETWORKS[network].label;
    $2("total-network").textContent = "Catecash " + CATE_NETWORKS[network].label + " \xB7 transparent account";
  }
  function updateBalance(balance) {
    $2("cate-balance").textContent = balance;
    $2("total-balance").textContent = balance + " CATE";
    updateDetail();
  }
  function showShieldedBalance(state, complete) {
    $2("shielded-balance").textContent = state ? formatUnits(state.balance, 8) + " CATE" : "\u2014 CATE";
    $2("shielded-sync").textContent = state ? complete ? `Synced through block ${state.height}.` : `Scanning from block ${state.height}\u2026` : "Shielded balance unavailable.";
  }
  async function initialScanState(activeSecrets, selectedNetwork) {
    const saved = await loadScanState(activeSecrets.shieldSeed, selectedNetwork);
    if (saved) return saved;
    const birth = activeSecrets.shieldBirth?.[selectedNetwork];
    if (birth) return { ...birth, notes: [], balance: "0" };
    const first = await shieldBlock(selectedNetwork, 1);
    return { height: 1, hash: first.hash, tree_hex: first.tree_state_hex, notes: [], balance: "0" };
  }
  async function syncShielded() {
    if (scanPromise) return scanPromise;
    if (!secrets?.shieldSeed) throw new Error("This wallet has no Ironwood account.");
    const activeSecrets = secrets, selectedNetwork = network;
    const task = (async () => {
      let state = await initialScanState(activeSecrets, selectedNetwork);
      const tip = (await gatewayStatus(selectedNetwork)).height;
      if (state.height > tip) throw new Error("Saved Ironwood scan is ahead of the network.");
      while (state.height < tip) {
        if (secrets !== activeSecrets || network !== selectedNetwork) return null;
        state = await runIronwood(
          "scan",
          {
            network: selectedNetwork,
            shield_seed_hex: activeSecrets.shieldSeed,
            state,
            targetHeight: tip,
            maxBlocks: 25
          },
          ({ height, targetHeight }) => {
            if (secrets === activeSecrets && network === selectedNetwork) $2("shielded-sync").textContent = `Scanning block ${height} of ${targetHeight}\u2026`;
          }
        );
        if (secrets !== activeSecrets || network !== selectedNetwork) return null;
        await saveScanState(activeSecrets.shieldSeed, selectedNetwork, state);
        scanState = state;
        showShieldedBalance(state, false);
      }
      if (secrets === activeSecrets && network === selectedNetwork) {
        scanState = state;
        showShieldedBalance(state, true);
      }
      return state;
    })();
    scanPromise = task;
    try {
      return await task;
    } finally {
      if (scanPromise === task) scanPromise = null;
    }
  }
  async function prepareShieldSecrets(opened, password, creating = false) {
    const upgraded = withShieldAccount(opened);
    if (!creating && !upgraded.upgraded) return { prepared: upgraded.secrets, changed: false };
    const prepared = { ...upgraded.secrets };
    try {
      const birth = await shieldCheckpoint(network);
      prepared.shieldBirth = { ...prepared.shieldBirth ?? {}, [network]: birth };
    } catch {
    }
    const encrypted = await encryptVault(prepared, password);
    await chrome.storage.local.set({ vault: encrypted, cateNetwork: network, shieldBackupReady: false });
    vault = encrypted;
    shieldBackupReady = false;
    return { prepared, changed: true };
  }
  function updateSendForm() {
    $2("send-network-note").textContent = "Catecash " + CATE_NETWORKS[network].label;
  }
  function updateReceive() {
    if (!addresses) return;
    $2("receive-network").textContent = "Catecash " + CATE_NETWORKS[network].label;
    $2("receive-address").textContent = addresses.cateAddress;
    const qr = qrcode(0, "M");
    qr.addData(addresses.cateAddress);
    qr.make();
    const count = qr.getModuleCount();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${count + 8} ${count + 8}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const plate = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    plate.setAttribute("width", String(count + 8));
    plate.setAttribute("height", String(count + 8));
    plate.setAttribute("fill", "#fff");
    svg.append(plate);
    const marks = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let path = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
      }
    }
    marks.setAttribute("d", path);
    marks.setAttribute("fill", "#000");
    svg.append(marks);
    $2("receive-qr").replaceChildren(svg);
  }
  function reviewTransfer({ amount, to, networkName, fee, inputs, source = "Transparent" }) {
    if (!secrets || currentScreen !== "send") return Promise.resolve(false);
    $2("review-amount").textContent = amount + " CATE";
    $2("review-network").textContent = networkName;
    $2("review-source").textContent = source;
    $2("review-to").textContent = to;
    $2("review-fee").textContent = fee;
    $2("review-inputs-row").hidden = inputs == null;
    $2("review-inputs").textContent = inputs ?? "\u2014";
    return new Promise((resolve) => {
      reviewResolver = resolve;
      navigate("review");
    });
  }
  async function loadShieldCandidate() {
    if (!secrets || !addresses || currentScreen !== "shield") return;
    shieldRewardAvailable = false;
    updateShieldControls();
    $2("shield-reward").textContent = "Checking mature mining rewards\u2026";
    const activeSecrets = secrets, selectedNetwork = network;
    const setup = await shieldSetup(selectedNetwork, addresses.cateAddress);
    if (secrets !== activeSecrets || network !== selectedNetwork || currentScreen !== "shield") return;
    shieldRewardAvailable = setup.rewards.length > 0;
    $2("shield-reward").textContent = setup.rewards.length ? formatUnits(setup.rewards[0].value, 8) + " CATE" : "No mature reward available";
    updateShieldControls();
  }
  function updateShieldControls() {
    $2("shield-backup-warning").hidden = shieldBackupReady;
    $2("shield-confirm").disabled = !shieldAddress || !shieldRewardAvailable || !shieldBackupReady;
  }
  async function copyAddress() {
    if (!secrets || !addresses) return;
    await navigator.clipboard.writeText(addresses.cateAddress);
    notice("Address copied.");
  }
  async function enterWallet(nextSecrets) {
    secrets = nextSecrets;
    $2("keys").hidden = true;
    $2("keys").textContent = "";
    $2("cate-network").value = network;
    addresses = await accountAddresses(secrets, network);
    try {
      shieldAddress = await runIronwood("address", { network, shield_seed_hex: secrets.shieldSeed });
    } catch {
      shieldAddress = null;
    }
    $2("shield-address").textContent = shieldAddress ?? "Ironwood engine unavailable";
    $2("shield-copy").disabled = !shieldBackupReady || !shieldAddress;
    updateShieldControls();
    updateSendForm();
    updateReceive();
    updateDetail();
    idleLock.start();
    view("wallet");
    navigate("home");
    if (!shieldAddress) notice("Ironwood engine is unavailable. Transparent funds remain accessible.", true);
    else if (!shieldBackupReady) notice("Download a fresh encrypted backup before shielding.");
    await refresh();
  }
  async function refresh() {
    if (!secrets || !addresses) return;
    const selectedNetwork = network, selectedAddress = addresses;
    updateBalance("Loading\u2026");
    try {
      const balance = formatUnits(await cateBalance(selectedNetwork, selectedAddress.cateAddress), 8);
      if (secrets && network === selectedNetwork && addresses === selectedAddress) updateBalance(balance);
    } catch {
      if (secrets && network === selectedNetwork && addresses === selectedAddress) {
        updateBalance("Unavailable");
        notice("Catecash balance service is unavailable. Address is still shown.", true);
      }
    }
    showShieldedBalance(scanState, false);
    syncShielded().catch((error) => {
      if (secrets && network === selectedNetwork) {
        showShieldedBalance(null, false);
        notice(error.message, true);
      }
    });
  }
  $2("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      const password = $2("create-password").value;
      if (password !== $2("confirm-password").value) throw new Error("Passwords do not match.");
      if (vault) throw new Error("A wallet already exists.");
      const created = await createAccounts();
      const { prepared } = await prepareShieldSecrets(created, password, true);
      $2("create-password").value = "";
      $2("confirm-password").value = "";
      await enterWallet(prepared);
    });
  });
  $2("unlock-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      const password = $2("unlock-password").value;
      const opened = await decryptVault(vault, password);
      await accountAddresses(opened, network);
      const { prepared } = await prepareShieldSecrets(opened, password);
      $2("unlock-password").value = "";
      await enterWallet(prepared);
    });
  });
  $2("toggle-unlock-password").addEventListener("click", () => {
    const input = $2("unlock-password"), button = $2("toggle-unlock-password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Hide" : "Show";
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
  $2("restore-locked").addEventListener("click", () => $2("restore-file").click());
  $2("restore-file").addEventListener("change", (event) => {
    run($2("restore-locked"), async () => {
      const file = event.target.files?.[0];
      if (!file || file.size > 1e5) throw new Error("Choose a small encrypted wallet backup.");
      const candidate = JSON.parse(await file.text());
      const password = prompt("Enter the password for this encrypted backup:");
      if (password === null) return;
      const opened = await decryptVault(candidate, password);
      await accountAddresses(opened, network);
      if (vault && !confirm("Replace this browser\u2019s existing wallet with the imported backup? Save its backup first.")) return;
      await chrome.storage.local.set({ vault: candidate, cateNetwork: network, shieldBackupReady: Boolean(opened.shieldSeed) });
      vault = candidate;
      shieldBackupReady = Boolean(opened.shieldSeed);
      await chrome.storage.local.remove(["ironwoodScan_mainnet", "ironwoodScan_testnet", "ironwoodScan_devnet"]);
      await chrome.storage.local.remove(["ironwoodPending_mainnet", "ironwoodPending_testnet", "ironwoodPending_devnet"]);
      const { prepared } = await prepareShieldSecrets(opened, password);
      await enterWallet(prepared);
    });
    event.target.value = "";
  });
  function lockWallet(message = "Wallet locked.") {
    idleLock.stop();
    stopIronwoodWork();
    scanState = null;
    scanPromise = null;
    shieldAddress = null;
    shieldRewardAvailable = false;
    if (reviewResolver) {
      const resolve = reviewResolver;
      reviewResolver = null;
      resolve(false);
    }
    secrets = null;
    addresses = null;
    $2("keys").textContent = "";
    $2("keys").hidden = true;
    $2("receive-qr").replaceChildren();
    updateBalance("\u2014");
    $2("cate-send-form").reset();
    currentScreen = "home";
    view("locked");
    notice(message);
  }
  $2("lock").addEventListener("click", () => lockWallet());
  for (const name of ["pointerdown", "keydown"]) document.addEventListener(name, () => idleLock.activity());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) idleLock.check();
  });
  $2("refresh").addEventListener("click", (event) => run(event.currentTarget, refresh));
  $2("back").addEventListener("click", () => navigate(currentScreen === "review" ? "send" : currentScreen === "asset" ? "home" : "home"));
  document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.screen)));
  document.querySelectorAll("[data-asset]").forEach((button) => button.addEventListener("click", () => {
    updateDetail();
    navigate("asset");
  }));
  $2("asset-send").addEventListener("click", () => {
    updateSendForm();
    navigate("send");
  });
  $2("asset-receive").addEventListener("click", () => {
    updateReceive();
    navigate("receive");
  });
  $2("shield-copy").addEventListener("click", (event) => run(event.currentTarget, async () => {
    if (!shieldBackupReady) throw new Error("Download the encrypted backup before sharing this address.");
    if (!shieldAddress) throw new Error("Ironwood address is unavailable.");
    await navigator.clipboard.writeText(shieldAddress);
    notice("Ironwood address copied.");
  }));
  $2("shield-confirm").addEventListener("click", (event) => run(event.currentTarget, async () => {
    if (!shieldBackupReady) throw new Error("Download the updated encrypted backup before shielding.");
    if (!secrets || !addresses || !shieldAddress) throw new Error("Unlock the wallet first.");
    const activeSecrets = secrets, selectedNetwork = network, expectedAddress = shieldAddress;
    const setup = await shieldSetup(selectedNetwork, addresses.cateAddress);
    const utxo = setup.rewards[0];
    if (!utxo) throw new Error("No mature mining reward is available to shield.");
    notice("Generating Ironwood proof. This can take a minute.");
    const transaction = await runIronwood("shield", {
      network: selectedNetwork,
      secret_hex: activeSecrets.cateKey,
      shield_seed_hex: activeSecrets.shieldSeed,
      tip_height: setup.height,
      tree_height: setup.height,
      tree_state_hex: setup.tree_state_hex,
      utxo,
      destination: null
    });
    if (secrets !== activeSecrets || network !== selectedNetwork || shieldAddress !== expectedAddress) return;
    if (transaction.shielded_address !== expectedAddress || transaction.source_address !== addresses.cateAddress) {
      throw new Error("Shield transaction account does not match the wallet.");
    }
    const approved = confirm(`Shield ${formatUnits(transaction.amount, 8)} CATE from your mining reward?

Fee: ${formatUnits(transaction.fee, 8)} CATE
Destination: ${transaction.shielded_address}`);
    if (!approved) {
      notice("Shielding canceled.");
      return;
    }
    const txid = await broadcastCate(selectedNetwork, transaction.raw_hex);
    if (secrets !== activeSecrets) return;
    navigate("home");
    await refresh();
    notice(`Shield transaction submitted: ${txid}. Balance appears after confirmation and scan.`);
  }));
  $2("detail-copy").addEventListener("click", () => run($2("detail-copy"), copyAddress));
  $2("receive-copy").addEventListener("click", () => run($2("receive-copy"), copyAddress));
  $2("cate-network").addEventListener("change", (event) => run(event.currentTarget, async () => {
    const selectedNetwork = $2("cate-network").value;
    if (!CATE_NETWORKS[selectedNetwork]) throw new Error("Unknown network.");
    const selectedAddresses = await accountAddresses(secrets, selectedNetwork);
    stopIronwoodWork();
    scanState = null;
    scanPromise = null;
    shieldRewardAvailable = false;
    await chrome.storage.local.set({ cateNetwork: selectedNetwork });
    if (!secrets) return;
    network = selectedNetwork;
    addresses = selectedAddresses;
    try {
      shieldAddress = await runIronwood("address", { network, shield_seed_hex: secrets.shieldSeed });
    } catch {
      shieldAddress = null;
    }
    $2("shield-address").textContent = shieldAddress ?? "Ironwood engine unavailable";
    $2("shield-copy").disabled = !shieldBackupReady || !shieldAddress;
    updateSendForm();
    updateReceive();
    updateDetail();
    notice(`Viewing ${CATE_NETWORKS[network].label}.`);
    await refresh();
  }));
  $2("lock-minutes").addEventListener("change", (event) => run(event.currentTarget, async () => {
    const minutes = lockMinutes($2("lock-minutes").value);
    await chrome.storage.local.set({ lockMinutes: minutes });
    $2("lock-minutes").value = String(minutes);
    idleLock.configure(minutes);
    notice(`Auto-lock set to ${$2("lock-minutes").selectedOptions[0].textContent.toLowerCase()}.`);
  }));
  $2("open-mode")?.addEventListener("change", (event) => run(event.currentTarget, async () => {
    const mode = $2("open-mode").value;
    if (mode !== "sidepanel" && mode !== "popup") throw new Error("Unknown opening mode.");
    await chrome.storage.local.set({ openMode: mode });
    notice(`Wallet will open in the ${mode === "popup" ? "popup" : "side panel"} next time.`);
  }));
  $2("review-confirm").addEventListener("click", () => {
    if (reviewResolver) {
      const resolve = reviewResolver;
      reviewResolver = null;
      navigate("send");
      resolve(true);
    }
  });
  $2("review-cancel").addEventListener("click", () => navigate("send"));
  function cateAtoms(text) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(text)) throw new Error("Enter a CATE amount with at most 8 decimals.");
    const [whole, fraction = ""] = text.split(".");
    const atoms = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, "0"));
    if (atoms <= 0n) throw new Error("Amount must be greater than zero.");
    return atoms.toString();
  }
  $2("cate-send-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      if (!secrets) throw new Error("Unlock the wallet before sending.");
      const sendNetwork = network, sourceAddress = addresses.cateAddress, secretHex = secrets.cateKey, activeSecrets = secrets;
      const to = $2("cate-send-to").value.trim();
      const amount = cateAtoms($2("cate-send-amount").value.trim());
      if ($2("send-source").value === "shielded") {
        notice("Scanning and generating the Ironwood spend proof. This can take a minute.");
        const state = await syncShielded();
        if (!state || secrets !== activeSecrets || network !== sendNetwork) return;
        const tip = (await gatewayStatus(sendNetwork)).height;
        if (tip - state.height > 2) throw new Error("Ironwood scan is behind the chain. Refresh and try again.");
        const pendingKey = `ironwoodPending_${sendNetwork}`;
        const pending = (await chrome.storage.local.get(pendingKey))[pendingKey];
        if (pending && (tip > pending.expiry_height || !state.notes.some((note) => note.nullifier_hex === pending.nullifier_hex))) {
          await chrome.storage.local.remove(pendingKey);
        }
        const pendingNullifier = pending && tip <= pending.expiry_height ? pending.nullifier_hex : null;
        const candidate = state.notes.filter((note) => note.nullifier_hex !== pendingNullifier && tip - note.received_height + 1 >= 10 && BigInt(note.value) >= BigInt(amount) + 11000n).sort((a, b) => BigInt(a.value) < BigInt(b.value) ? -1 : 1)[0];
        if (!candidate) throw new Error("No confirmed Ironwood note covers this amount plus the fee.");
        const transaction2 = await runIronwood("send", {
          network: sendNetwork,
          shield_seed_hex: activeSecrets.shieldSeed,
          destination: to,
          amount,
          tip_height: tip,
          tree_state_hex: state.tree_hex,
          note: candidate
        });
        if (secrets !== activeSecrets || network !== sendNetwork) return;
        const approved2 = await reviewTransfer({
          amount: formatUnits(amount, 8),
          to,
          networkName: "Catecash " + CATE_NETWORKS[sendNetwork].label,
          fee: formatUnits(transaction2.fee, 8) + " CATE",
          source: "Ironwood shielded account",
          inputs: 1
        });
        if (!approved2) {
          if (secrets === activeSecrets) notice("Catecash transaction canceled.");
          return;
        }
        if (secrets !== activeSecrets || network !== sendNetwork) return;
        const txid2 = await broadcastCate(sendNetwork, transaction2.raw_hex);
        if (secrets !== activeSecrets) return;
        await chrome.storage.local.set({ [pendingKey]: {
          txid: txid2,
          nullifier_hex: candidate.nullifier_hex,
          expiry_height: transaction2.expiry_height
        } });
        $2("cate-send-form").reset();
        navigate("home");
        await refresh();
        notice(`Ironwood send submitted: ${txid2}`);
        return;
      }
      if (/^(?:cate[a-z]*|CATE[A-Z]*)1/.test(to)) throw new Error("Transparent funds can only be sent to a transparent address. Choose Ironwood to send to a shielded recipient.");
      const data = await spendableUtxos(sendNetwork, sourceAddress);
      if (secrets !== activeSecrets || network !== sendNetwork) return;
      const sign = await loadSigner();
      if (secrets !== activeSecrets || network !== sendNetwork) return;
      const transaction = sign({ network: sendNetwork, secret_hex: secretHex, destination: to, amount, tip_height: data.height, utxos: data.utxos });
      const approved = await reviewTransfer({
        amount: formatUnits(amount, 8),
        to,
        networkName: "Catecash " + CATE_NETWORKS[sendNetwork].label,
        fee: formatUnits(transaction.fee, 8) + " CATE",
        inputs: transaction.input_count,
        source: "Ordinary transparent balance"
      });
      if (!approved) {
        if (secrets === activeSecrets) notice("Catecash transaction canceled.");
        return;
      }
      if (secrets !== activeSecrets || network !== sendNetwork) return;
      const txid = await broadcastCate(sendNetwork, transaction.raw_hex);
      if (secrets !== activeSecrets) return;
      $2("cate-send-form").reset();
      navigate("home");
      await refresh();
      notice(`Catecash ${sendNetwork} transaction submitted: ${txid}`);
    });
  });
  $2("download-backup").addEventListener("click", () => {
    if (!vault) return;
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catecash-wallet-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    shieldBackupReady = true;
    chrome.storage.local.set({ shieldBackupReady: true });
    $2("shield-copy").disabled = false;
    updateShieldControls();
    notice("Encrypted backup downloaded. Keep its password separately.");
  });
  $2("show-keys").addEventListener("click", (event) => run(event.currentTarget, async () => {
    if (!secrets || !confirm("Reveal private keys on screen? Anyone who sees these can spend your funds.")) return;
    const activeSecrets = secrets, selectedNetwork = network;
    const wif = await cateWif(activeSecrets, selectedNetwork);
    if (secrets !== activeSecrets || network !== selectedNetwork) return;
    $2("keys").textContent = `Catecash ${CATE_NETWORKS[network].label} compressed WIF:
${wif}`;
    $2("keys").hidden = false;
  }));
  (async () => {
    try {
      const saved = await chrome.storage.local.get(["vault", "cateNetwork", "lockMinutes", "openMode", "shieldBackupReady"]);
      vault = saved.vault ?? null;
      shieldBackupReady = saved.shieldBackupReady === true;
      network = CATE_NETWORKS[saved.cateNetwork] ? saved.cateNetwork : "mainnet";
      const minutes = lockMinutes(saved.lockMinutes);
      $2("lock-minutes").value = String(minutes);
      if ($2("open-mode")) $2("open-mode").value = saved.openMode === "popup" ? "popup" : "sidepanel";
      idleLock.configure(minutes);
      view(vault ? "locked" : "setup");
    } catch {
      notice("Browser storage is unavailable.", true);
      view("setup");
    }
  })();
})();
