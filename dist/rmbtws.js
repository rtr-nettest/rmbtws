function _OverloadYield(e, d) {
  this.v = e, this.k = d;
}
function _applyDecoratedDescriptor(i, e, r, n, l) {
  var a = {};
  return Object.keys(n).forEach(function (i) {
    a[i] = n[i];
  }), a.enumerable = !!a.enumerable, a.configurable = !!a.configurable, ("value" in a || a.initializer) && (a.writable = !0), a = r.slice().reverse().reduce(function (r, n) {
    return n(i, e, r) || r;
  }, a), l && void 0 !== a.initializer && (a.value = a.initializer ? a.initializer.call(l) : void 0, a.initializer = void 0), void 0 === a.initializer ? (Object.defineProperty(i, e, a), null) : a;
}
function _applyDecs2311(e, t, n, r, o, i) {
  var a,
    c,
    u,
    s,
    f,
    l,
    p,
    d = Symbol.metadata || Symbol.for("Symbol.metadata"),
    m = Object.defineProperty,
    h = Object.create,
    y = [h(null), h(null)],
    v = t.length;
  function g(t, n, r) {
    return function (o, i) {
      n && (i = o, o = e);
      for (var a = 0; a < t.length; a++) i = t[a].apply(o, r ? [i] : []);
      return r ? i : o;
    };
  }
  function b(e, t, n, r) {
    if ("function" != typeof e && (r || void 0 !== e)) throw new TypeError(t + " must " + (n || "be") + " a function" + (r ? "" : " or undefined"));
    return e;
  }
  function applyDec(e, t, n, r, o, i, u, s, f, l, p) {
    function d(e) {
      if (!p(e)) throw new TypeError("Attempted to access private element on non-instance");
    }
    var h = [].concat(t[0]),
      v = t[3],
      w = !u,
      D = 1 === o,
      S = 3 === o,
      j = 4 === o,
      E = 2 === o;
    function I(t, n, r) {
      return function (o, i) {
        return n && (i = o, o = e), r && r(o), P[t].call(o, i);
      };
    }
    if (!w) {
      var P = {},
        k = [],
        F = S ? "get" : j || D ? "set" : "value";
      if (f ? (l || D ? P = {
        get: _setFunctionName(function () {
          return v(this);
        }, r, "get"),
        set: function (e) {
          t[4](this, e);
        }
      } : P[F] = v, l || _setFunctionName(P[F], r, E ? "" : F)) : l || (P = Object.getOwnPropertyDescriptor(e, r)), !l && !f) {
        if ((c = y[+s][r]) && 7 !== (c ^ o)) throw Error("Decorating two elements with the same name (" + P[F].name + ") is not supported yet");
        y[+s][r] = o < 3 ? 1 : o;
      }
    }
    for (var N = e, O = h.length - 1; O >= 0; O -= n ? 2 : 1) {
      var T = b(h[O], "A decorator", "be", !0),
        z = n ? h[O - 1] : void 0,
        A = {},
        H = {
          kind: ["field", "accessor", "method", "getter", "setter", "class"][o],
          name: r,
          metadata: a,
          addInitializer: function (e, t) {
            if (e.v) throw new TypeError("attempted to call addInitializer after decoration was finished");
            b(t, "An initializer", "be", !0), i.push(t);
          }.bind(null, A)
        };
      if (w) c = T.call(z, N, H), A.v = 1, b(c, "class decorators", "return") && (N = c);else if (H.static = s, H.private = f, c = H.access = {
        has: f ? p.bind() : function (e) {
          return r in e;
        }
      }, j || (c.get = f ? E ? function (e) {
        return d(e), P.value;
      } : I("get", 0, d) : function (e) {
        return e[r];
      }), E || S || (c.set = f ? I("set", 0, d) : function (e, t) {
        e[r] = t;
      }), N = T.call(z, D ? {
        get: P.get,
        set: P.set
      } : P[F], H), A.v = 1, D) {
        if ("object" == typeof N && N) (c = b(N.get, "accessor.get")) && (P.get = c), (c = b(N.set, "accessor.set")) && (P.set = c), (c = b(N.init, "accessor.init")) && k.unshift(c);else if (void 0 !== N) throw new TypeError("accessor decorators must return an object with get, set, or init properties or undefined");
      } else b(N, (l ? "field" : "method") + " decorators", "return") && (l ? k.unshift(N) : P[F] = N);
    }
    return o < 2 && u.push(g(k, s, 1), g(i, s, 0)), l || w || (f ? D ? u.splice(-1, 0, I("get", s), I("set", s)) : u.push(E ? P[F] : b.call.bind(P[F])) : m(e, r, P)), N;
  }
  function w(e) {
    return m(e, d, {
      configurable: !0,
      enumerable: !0,
      value: a
    });
  }
  return void 0 !== i && (a = i[d]), a = h(null == a ? null : a), f = [], l = function (e) {
    e && f.push(g(e));
  }, p = function (t, r) {
    for (var i = 0; i < n.length; i++) {
      var a = n[i],
        c = a[1],
        l = 7 & c;
      if ((8 & c) == t && !l == r) {
        var p = a[2],
          d = !!a[3],
          m = 16 & c;
        applyDec(t ? e : e.prototype, a, m, d ? "#" + p : _toPropertyKey(p), l, l < 2 ? [] : t ? s = s || [] : u = u || [], f, !!t, d, r, t && d ? function (t) {
          return _checkInRHS(t) === e;
        } : o);
      }
    }
  }, p(8, 0), p(0, 0), p(8, 1), p(0, 1), l(u), l(s), c = f, v || w(e), {
    e: c,
    get c() {
      var n = [];
      return v && [w(e = applyDec(e, [t], r, e.name, 5, n)), g(n, 1)];
    }
  };
}
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _arrayWithoutHoles(r) {
  if (Array.isArray(r)) return _arrayLikeToArray(r);
}
function _assertClassBrand(e, t, n) {
  if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
  throw new TypeError("Private element is not present on this object");
}
function _assertThisInitialized(e) {
  if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
function _asyncGeneratorDelegate(t) {
  var e = {},
    n = !1;
  function pump(e, r) {
    return n = !0, r = new Promise(function (n) {
      n(t[e](r));
    }), {
      done: !1,
      value: new _OverloadYield(r, 1)
    };
  }
  return e["undefined" != typeof Symbol && Symbol.iterator || "@@iterator"] = function () {
    return this;
  }, e.next = function (t) {
    return n ? (n = !1, t) : pump("next", t);
  }, "function" == typeof t.throw && (e.throw = function (t) {
    if (n) throw n = !1, t;
    return pump("throw", t);
  }), "function" == typeof t.return && (e.return = function (t) {
    return n ? (n = !1, t) : pump("return", t);
  }), e;
}
function _asyncIterator(r) {
  var n,
    t,
    o,
    e = 2;
  for ("undefined" != typeof Symbol && (t = Symbol.asyncIterator, o = Symbol.iterator); e--;) {
    if (t && null != (n = r[t])) return n.call(r);
    if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r));
    t = "@@asyncIterator", o = "@@iterator";
  }
  throw new TypeError("Object is not async iterable");
}
function AsyncFromSyncIterator(r) {
  function AsyncFromSyncIteratorContinuation(r) {
    if (Object(r) !== r) return Promise.reject(new TypeError(r + " is not an object."));
    var n = r.done;
    return Promise.resolve(r.value).then(function (r) {
      return {
        value: r,
        done: n
      };
    });
  }
  return AsyncFromSyncIterator = function (r) {
    this.s = r, this.n = r.next;
  }, AsyncFromSyncIterator.prototype = {
    s: null,
    n: null,
    next: function () {
      return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments));
    },
    return: function (r) {
      var n = this.s.return;
      return void 0 === n ? Promise.resolve({
        value: r,
        done: !0
      }) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
    },
    throw: function (r) {
      var n = this.s.return;
      return void 0 === n ? Promise.reject(r) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
    }
  }, new AsyncFromSyncIterator(r);
}
function asyncGeneratorStep(n, t, e, r, o, a, c) {
  try {
    var i = n[a](c),
      u = i.value;
  } catch (n) {
    return void e(n);
  }
  i.done ? t(u) : Promise.resolve(u).then(r, o);
}
function _asyncToGenerator(n) {
  return function () {
    var t = this,
      e = arguments;
    return new Promise(function (r, o) {
      var a = n.apply(t, e);
      function _next(n) {
        asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
      }
      function _throw(n) {
        asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
      }
      _next(void 0);
    });
  };
}
function _awaitAsyncGenerator(e) {
  return new _OverloadYield(e, 0);
}
function _callSuper(t, o, e) {
  return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e));
}
function _checkInRHS(e) {
  if (Object(e) !== e) throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null"));
  return e;
}
function _checkPrivateRedeclaration(e, t) {
  if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object");
}
function _classCallCheck(a, n) {
  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function _classNameTDZError(e) {
  throw new ReferenceError('Class "' + e + '" cannot be referenced in computed property keys.');
}
function _classPrivateFieldGet2(s, a) {
  return s.get(_assertClassBrand(s, a));
}
function _classPrivateFieldInitSpec(e, t, a) {
  _checkPrivateRedeclaration(e, t), t.set(e, a);
}
function _classPrivateFieldLooseBase(e, t) {
  if (!{}.hasOwnProperty.call(e, t)) throw new TypeError("attempted to use private field on non-instance");
  return e;
}
var id = 0;
function _classPrivateFieldLooseKey(e) {
  return "__private_" + id++ + "_" + e;
}
function _classPrivateFieldSet2(s, a, r) {
  return s.set(_assertClassBrand(s, a), r), r;
}
function _classPrivateGetter(s, r, a) {
  return a(_assertClassBrand(s, r));
}
function _classPrivateMethodInitSpec(e, a) {
  _checkPrivateRedeclaration(e, a), a.add(e);
}
function _classPrivateSetter(s, r, a, t) {
  return r(_assertClassBrand(s, a), t), t;
}
function _classStaticPrivateMethodGet(s, a, t) {
  return _assertClassBrand(a, s), t;
}
function _construct(t, e, r) {
  if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments);
  var o = [null];
  o.push.apply(o, e);
  var p = new (t.bind.apply(t, o))();
  return r && _setPrototypeOf(p, r.prototype), p;
}
function _defineProperties(e, r) {
  for (var t = 0; t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}
function _createForOfIteratorHelper(r, e) {
  var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (!t) {
    if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
      t && (r = t);
      var n = 0,
        F = function () {};
      return {
        s: F,
        n: function () {
          return n >= r.length ? {
            done: !0
          } : {
            done: !1,
            value: r[n++]
          };
        },
        e: function (r) {
          throw r;
        },
        f: F
      };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  var o,
    a = !0,
    u = !1;
  return {
    s: function () {
      t = t.call(r);
    },
    n: function () {
      var r = t.next();
      return a = r.done, r;
    },
    e: function (r) {
      u = !0, o = r;
    },
    f: function () {
      try {
        a || null == t.return || t.return();
      } finally {
        if (u) throw o;
      }
    }
  };
}
function _createForOfIteratorHelperLoose(r, e) {
  var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (t) return (t = t.call(r)).next.bind(t);
  if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
    t && (r = t);
    var o = 0;
    return function () {
      return o >= r.length ? {
        done: !0
      } : {
        done: !1,
        value: r[o++]
      };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _createSuper(t) {
  var r = _isNativeReflectConstruct();
  return function () {
    var e,
      o = _getPrototypeOf(t);
    if (r) {
      var s = _getPrototypeOf(this).constructor;
      e = Reflect.construct(o, arguments, s);
    } else e = o.apply(this, arguments);
    return _possibleConstructorReturn(this, e);
  };
}
function _decorate(e, r, t, i) {
  var o = _getDecoratorsApi();
  if (i) for (var n = 0; n < i.length; n++) o = i[n](o);
  var s = r(function (e) {
      o.initializeInstanceElements(e, a.elements);
    }, t),
    a = o.decorateClass(_coalesceClassElements(s.d.map(_createElementDescriptor)), e);
  return o.initializeClassElements(s.F, a.elements), o.runClassFinishers(s.F, a.finishers);
}
function _getDecoratorsApi() {
  _getDecoratorsApi = function () {
    return e;
  };
  var e = {
    elementsDefinitionOrder: [["method"], ["field"]],
    initializeInstanceElements: function (e, r) {
      ["method", "field"].forEach(function (t) {
        r.forEach(function (r) {
          r.kind === t && "own" === r.placement && this.defineClassElement(e, r);
        }, this);
      }, this);
    },
    initializeClassElements: function (e, r) {
      var t = e.prototype;
      ["method", "field"].forEach(function (i) {
        r.forEach(function (r) {
          var o = r.placement;
          if (r.kind === i && ("static" === o || "prototype" === o)) {
            var n = "static" === o ? e : t;
            this.defineClassElement(n, r);
          }
        }, this);
      }, this);
    },
    defineClassElement: function (e, r) {
      var t = r.descriptor;
      if ("field" === r.kind) {
        var i = r.initializer;
        t = {
          enumerable: t.enumerable,
          writable: t.writable,
          configurable: t.configurable,
          value: void 0 === i ? void 0 : i.call(e)
        };
      }
      Object.defineProperty(e, r.key, t);
    },
    decorateClass: function (e, r) {
      var t = [],
        i = [],
        o = {
          static: [],
          prototype: [],
          own: []
        };
      if (e.forEach(function (e) {
        this.addElementPlacement(e, o);
      }, this), e.forEach(function (e) {
        if (!_hasDecorators(e)) return t.push(e);
        var r = this.decorateElement(e, o);
        t.push(r.element), t.push.apply(t, r.extras), i.push.apply(i, r.finishers);
      }, this), !r) return {
        elements: t,
        finishers: i
      };
      var n = this.decorateConstructor(t, r);
      return i.push.apply(i, n.finishers), n.finishers = i, n;
    },
    addElementPlacement: function (e, r, t) {
      var i = r[e.placement];
      if (!t && -1 !== i.indexOf(e.key)) throw new TypeError("Duplicated element (" + e.key + ")");
      i.push(e.key);
    },
    decorateElement: function (e, r) {
      for (var t = [], i = [], o = e.decorators, n = o.length - 1; n >= 0; n--) {
        var s = r[e.placement];
        s.splice(s.indexOf(e.key), 1);
        var a = this.fromElementDescriptor(e),
          l = this.toElementFinisherExtras((0, o[n])(a) || a);
        e = l.element, this.addElementPlacement(e, r), l.finisher && i.push(l.finisher);
        var c = l.extras;
        if (c) {
          for (var p = 0; p < c.length; p++) this.addElementPlacement(c[p], r);
          t.push.apply(t, c);
        }
      }
      return {
        element: e,
        finishers: i,
        extras: t
      };
    },
    decorateConstructor: function (e, r) {
      for (var t = [], i = r.length - 1; i >= 0; i--) {
        var o = this.fromClassDescriptor(e),
          n = this.toClassDescriptor((0, r[i])(o) || o);
        if (void 0 !== n.finisher && t.push(n.finisher), void 0 !== n.elements) {
          e = n.elements;
          for (var s = 0; s < e.length - 1; s++) for (var a = s + 1; a < e.length; a++) if (e[s].key === e[a].key && e[s].placement === e[a].placement) throw new TypeError("Duplicated element (" + e[s].key + ")");
        }
      }
      return {
        elements: e,
        finishers: t
      };
    },
    fromElementDescriptor: function (e) {
      var r = {
        kind: e.kind,
        key: e.key,
        placement: e.placement,
        descriptor: e.descriptor
      };
      return Object.defineProperty(r, Symbol.toStringTag, {
        value: "Descriptor",
        configurable: !0
      }), "field" === e.kind && (r.initializer = e.initializer), r;
    },
    toElementDescriptors: function (e) {
      if (void 0 !== e) return _toArray(e).map(function (e) {
        var r = this.toElementDescriptor(e);
        return this.disallowProperty(e, "finisher", "An element descriptor"), this.disallowProperty(e, "extras", "An element descriptor"), r;
      }, this);
    },
    toElementDescriptor: function (e) {
      var r = e.kind + "";
      if ("method" !== r && "field" !== r) throw new TypeError('An element descriptor\'s .kind property must be either "method" or "field", but a decorator created an element descriptor with .kind "' + r + '"');
      var t = _toPropertyKey(e.key),
        i = e.placement + "";
      if ("static" !== i && "prototype" !== i && "own" !== i) throw new TypeError('An element descriptor\'s .placement property must be one of "static", "prototype" or "own", but a decorator created an element descriptor with .placement "' + i + '"');
      var o = e.descriptor;
      this.disallowProperty(e, "elements", "An element descriptor");
      var n = {
        kind: r,
        key: t,
        placement: i,
        descriptor: Object.assign({}, o)
      };
      return "field" !== r ? this.disallowProperty(e, "initializer", "A method descriptor") : (this.disallowProperty(o, "get", "The property descriptor of a field descriptor"), this.disallowProperty(o, "set", "The property descriptor of a field descriptor"), this.disallowProperty(o, "value", "The property descriptor of a field descriptor"), n.initializer = e.initializer), n;
    },
    toElementFinisherExtras: function (e) {
      return {
        element: this.toElementDescriptor(e),
        finisher: _optionalCallableProperty(e, "finisher"),
        extras: this.toElementDescriptors(e.extras)
      };
    },
    fromClassDescriptor: function (e) {
      var r = {
        kind: "class",
        elements: e.map(this.fromElementDescriptor, this)
      };
      return Object.defineProperty(r, Symbol.toStringTag, {
        value: "Descriptor",
        configurable: !0
      }), r;
    },
    toClassDescriptor: function (e) {
      var r = e.kind + "";
      if ("class" !== r) throw new TypeError('A class descriptor\'s .kind property must be "class", but a decorator created a class descriptor with .kind "' + r + '"');
      this.disallowProperty(e, "key", "A class descriptor"), this.disallowProperty(e, "placement", "A class descriptor"), this.disallowProperty(e, "descriptor", "A class descriptor"), this.disallowProperty(e, "initializer", "A class descriptor"), this.disallowProperty(e, "extras", "A class descriptor");
      var t = _optionalCallableProperty(e, "finisher");
      return {
        elements: this.toElementDescriptors(e.elements),
        finisher: t
      };
    },
    runClassFinishers: function (e, r) {
      for (var t = 0; t < r.length; t++) {
        var i = (0, r[t])(e);
        if (void 0 !== i) {
          if ("function" != typeof i) throw new TypeError("Finishers must return a constructor.");
          e = i;
        }
      }
      return e;
    },
    disallowProperty: function (e, r, t) {
      if (void 0 !== e[r]) throw new TypeError(t + " can't have a ." + r + " property.");
    }
  };
  return e;
}
function _createElementDescriptor(e) {
  var r,
    t = _toPropertyKey(e.key);
  "method" === e.kind ? r = {
    value: e.value,
    writable: !0,
    configurable: !0,
    enumerable: !1
  } : "get" === e.kind ? r = {
    get: e.value,
    configurable: !0,
    enumerable: !1
  } : "set" === e.kind ? r = {
    set: e.value,
    configurable: !0,
    enumerable: !1
  } : "field" === e.kind && (r = {
    configurable: !0,
    writable: !0,
    enumerable: !0
  });
  var i = {
    kind: "field" === e.kind ? "field" : "method",
    key: t,
    placement: e.static ? "static" : "field" === e.kind ? "own" : "prototype",
    descriptor: r
  };
  return e.decorators && (i.decorators = e.decorators), "field" === e.kind && (i.initializer = e.value), i;
}
function _coalesceGetterSetter(e, r) {
  void 0 !== e.descriptor.get ? r.descriptor.get = e.descriptor.get : r.descriptor.set = e.descriptor.set;
}
function _coalesceClassElements(e) {
  for (var r = [], isSameElement = function (e) {
      return "method" === e.kind && e.key === o.key && e.placement === o.placement;
    }, t = 0; t < e.length; t++) {
    var i,
      o = e[t];
    if ("method" === o.kind && (i = r.find(isSameElement))) {
      if (_isDataDescriptor(o.descriptor) || _isDataDescriptor(i.descriptor)) {
        if (_hasDecorators(o) || _hasDecorators(i)) throw new ReferenceError("Duplicated methods (" + o.key + ") can't be decorated.");
        i.descriptor = o.descriptor;
      } else {
        if (_hasDecorators(o)) {
          if (_hasDecorators(i)) throw new ReferenceError("Decorators can't be placed on different accessors with for the same property (" + o.key + ").");
          i.decorators = o.decorators;
        }
        _coalesceGetterSetter(o, i);
      }
    } else r.push(o);
  }
  return r;
}
function _hasDecorators(e) {
  return e.decorators && e.decorators.length;
}
function _isDataDescriptor(e) {
  return void 0 !== e && !(void 0 === e.value && void 0 === e.writable);
}
function _optionalCallableProperty(e, r) {
  var t = e[r];
  if (void 0 !== t && "function" != typeof t) throw new TypeError("Expected '" + r + "' to be a function");
  return t;
}
function _defaults(e, r) {
  for (var t = Object.getOwnPropertyNames(r), o = 0; o < t.length; o++) {
    var n = t[o],
      a = Object.getOwnPropertyDescriptor(r, n);
    a && a.configurable && void 0 === e[n] && Object.defineProperty(e, n, a);
  }
  return e;
}
function _defineAccessor(e, r, n, t) {
  var c = {
    configurable: !0,
    enumerable: !0
  };
  return c[e] = t, Object.defineProperty(r, n, c);
}
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}
function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function (n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
function _get() {
  return _get = "undefined" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function (e, t, r) {
    var p = _superPropBase(e, t);
    if (p) {
      var n = Object.getOwnPropertyDescriptor(p, t);
      return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value;
    }
  }, _get.apply(null, arguments);
}
function _getPrototypeOf(t) {
  return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) {
    return t.__proto__ || Object.getPrototypeOf(t);
  }, _getPrototypeOf(t);
}
function _identity(t) {
  return t;
}
function _importDeferProxy(e) {
  var t = null,
    constValue = function (e) {
      return function () {
        return e;
      };
    },
    proxy = function (r) {
      return function (n, o, f) {
        return null === t && (t = e()), r(t, o, f);
      };
    };
  return new Proxy({}, {
    defineProperty: constValue(!1),
    deleteProperty: constValue(!1),
    get: proxy(Reflect.get),
    getOwnPropertyDescriptor: proxy(Reflect.getOwnPropertyDescriptor),
    getPrototypeOf: constValue(null),
    isExtensible: constValue(!1),
    has: proxy(Reflect.has),
    ownKeys: proxy(Reflect.ownKeys),
    preventExtensions: constValue(!0),
    set: constValue(!1),
    setPrototypeOf: constValue(!1)
  });
}
function _inherits(t, e) {
  if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function");
  t.prototype = Object.create(e && e.prototype, {
    constructor: {
      value: t,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(t, "prototype", {
    writable: !1
  }), e && _setPrototypeOf(t, e);
}
function _inheritsLoose(t, o) {
  t.prototype = Object.create(o.prototype), t.prototype.constructor = t, _setPrototypeOf(t, o);
}
function _initializerDefineProperty(e, i, r, l) {
  r && Object.defineProperty(e, i, {
    enumerable: r.enumerable,
    configurable: r.configurable,
    writable: r.writable,
    value: r.initializer ? r.initializer.call(l) : void 0
  });
}
function _initializerWarningHelper(r, e) {
  throw Error("Decorating class property failed. Please ensure that transform-class-properties is enabled and runs after the decorators transform.");
}
function _instanceof(n, e) {
  return null != e && "undefined" != typeof Symbol && e[Symbol.hasInstance] ? !!e[Symbol.hasInstance](n) : n instanceof e;
}
function _interopRequireDefault(e) {
  return e && e.__esModule ? e : {
    default: e
  };
}
function _interopRequireWildcard(e, t) {
  if ("function" == typeof WeakMap) var r = new WeakMap(),
    n = new WeakMap();
  return (_interopRequireWildcard = function (e, t) {
    if (!t && e && e.__esModule) return e;
    var o,
      i,
      f = {
        __proto__: null,
        default: e
      };
    if (null === e || "object" != typeof e && "function" != typeof e) return f;
    if (o = t ? n : r) {
      if (o.has(e)) return o.get(e);
      o.set(e, f);
    }
    for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);
    return f;
  })(e, t);
}
function _isNativeFunction(t) {
  try {
    return -1 !== Function.toString.call(t).indexOf("[native code]");
  } catch (n) {
    return "function" == typeof t;
  }
}
function _isNativeReflectConstruct() {
  try {
    var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
  } catch (t) {}
  return (_isNativeReflectConstruct = function () {
    return !!t;
  })();
}
function _iterableToArray(r) {
  if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r);
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e,
      n,
      i,
      u,
      a = [],
      f = !0,
      o = !1;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t) return;
        f = !1;
      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
    } catch (r) {
      o = !0, n = r;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
var REACT_ELEMENT_TYPE;
function _jsx(e, r, E, l) {
  REACT_ELEMENT_TYPE || (REACT_ELEMENT_TYPE = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103);
  var o = e && e.defaultProps,
    n = arguments.length - 3;
  if (r || 0 === n || (r = {
    children: void 0
  }), 1 === n) r.children = l;else if (n > 1) {
    for (var t = Array(n), f = 0; f < n; f++) t[f] = arguments[f + 3];
    r.children = t;
  }
  if (r && o) for (var i in o) void 0 === r[i] && (r[i] = o[i]);else r || (r = o || {});
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: e,
    key: void 0 === E ? null : "" + E,
    ref: null,
    props: r,
    _owner: null
  };
}
function _maybeArrayLike(r, a, e) {
  if (a && !Array.isArray(a) && "number" == typeof a.length) {
    var y = a.length;
    return _arrayLikeToArray(a, void 0 !== e && e < y ? e : y);
  }
  return r(a, e);
}
function _newArrowCheck(n, r) {
  if (n !== r) throw new TypeError("Cannot instantiate an arrow function");
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _nullishReceiverError(r) {
  throw new TypeError("Cannot set property of null or undefined.");
}
function _objectDestructuringEmpty(t) {
  if (null == t) throw new TypeError("Cannot destructure " + t);
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
function _objectWithoutProperties(e, t) {
  if (null == e) return {};
  var o,
    r,
    i = _objectWithoutPropertiesLoose(e, t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
  }
  return i;
}
function _objectWithoutPropertiesLoose(r, e) {
  if (null == r) return {};
  var t = {};
  for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
    if (-1 !== e.indexOf(n)) continue;
    t[n] = r[n];
  }
  return t;
}
function _possibleConstructorReturn(t, e) {
  if (e && ("object" == typeof e || "function" == typeof e)) return e;
  if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined");
  return _assertThisInitialized(t);
}
function _readOnlyError(r) {
  throw new TypeError('"' + r + '" is read-only');
}
function _regenerator() {
  /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
  var e,
    t,
    r = "function" == typeof Symbol ? Symbol : {},
    n = r.iterator || "@@iterator",
    o = r.toStringTag || "@@toStringTag";
  function i(r, n, o, i) {
    var c = n && n.prototype instanceof Generator ? n : Generator,
      u = Object.create(c.prototype);
    return _regeneratorDefine(u, "_invoke", function (r, n, o) {
      var i,
        c,
        u,
        f = 0,
        p = o || [],
        y = !1,
        G = {
          p: 0,
          n: 0,
          v: e,
          a: d,
          f: d.bind(e, 4),
          d: function (t, r) {
            return i = t, c = 0, u = e, G.n = r, a;
          }
        };
      function d(r, n) {
        for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) {
          var o,
            i = p[t],
            d = G.p,
            l = i[2];
          r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0));
        }
        if (o || r > 1) return a;
        throw y = !0, n;
      }
      return function (o, p, l) {
        if (f > 1) throw TypeError("Generator is already running");
        for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) {
          i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u);
          try {
            if (f = 2, i) {
              if (c || (o = "next"), t = i[o]) {
                if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object");
                if (!t.done) return t;
                u = t.value, c < 2 && (c = 0);
              } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1);
              i = e;
            } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break;
          } catch (t) {
            i = e, c = 1, u = t;
          } finally {
            f = 1;
          }
        }
        return {
          value: t,
          done: y
        };
      };
    }(r, o, i), !0), u;
  }
  var a = {};
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  t = Object.getPrototypeOf;
  var c = [][n] ? t(t([][n]())) : (_regeneratorDefine(t = {}, n, function () {
      return this;
    }), t),
    u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c);
  function f(e) {
    return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e;
  }
  return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine(u), _regeneratorDefine(u, o, "Generator"), _regeneratorDefine(u, n, function () {
    return this;
  }), _regeneratorDefine(u, "toString", function () {
    return "[object Generator]";
  }), (_regenerator = function () {
    return {
      w: i,
      m: f
    };
  })();
}
function _regeneratorAsync(n, e, r, t, o) {
  var a = _regeneratorAsyncGen(n, e, r, t, o);
  return a.next().then(function (n) {
    return n.done ? n.value : a.next();
  });
}
function _regeneratorAsyncGen(r, e, t, o, n) {
  return new _regeneratorAsyncIterator(_regenerator().w(r, e, t, o), n || Promise);
}
function _regeneratorAsyncIterator(t, e) {
  function n(r, o, i, f) {
    try {
      var c = t[r](o),
        u = c.value;
      return u instanceof _OverloadYield ? e.resolve(u.v).then(function (t) {
        n("next", t, i, f);
      }, function (t) {
        n("throw", t, i, f);
      }) : e.resolve(u).then(function (t) {
        c.value = t, i(c);
      }, function (t) {
        return n("throw", t, i, f);
      });
    } catch (t) {
      f(t);
    }
  }
  var r;
  this.next || (_regeneratorDefine(_regeneratorAsyncIterator.prototype), _regeneratorDefine(_regeneratorAsyncIterator.prototype, "function" == typeof Symbol && Symbol.asyncIterator || "@asyncIterator", function () {
    return this;
  })), _regeneratorDefine(this, "_invoke", function (t, o, i) {
    function f() {
      return new e(function (e, r) {
        n(t, i, e, r);
      });
    }
    return r = r ? r.then(f, f) : f();
  }, !0);
}
function _regeneratorDefine(e, r, n, t) {
  var i = Object.defineProperty;
  try {
    i({}, "", {});
  } catch (e) {
    i = 0;
  }
  _regeneratorDefine = function (e, r, n, t) {
    function o(r, n) {
      _regeneratorDefine(e, r, function (e) {
        return this._invoke(r, n, e);
      });
    }
    r ? i ? i(e, r, {
      value: n,
      enumerable: !t,
      configurable: !t,
      writable: !t
    }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2));
  }, _regeneratorDefine(e, r, n, t);
}
function _regeneratorKeys(e) {
  var n = Object(e),
    r = [];
  for (var t in n) r.unshift(t);
  return function e() {
    for (; r.length;) if ((t = r.pop()) in n) return e.value = t, e.done = !1, e;
    return e.done = !0, e;
  };
}
function _regeneratorValues(e) {
  if (null != e) {
    var t = e["function" == typeof Symbol && Symbol.iterator || "@@iterator"],
      r = 0;
    if (t) return t.call(e);
    if ("function" == typeof e.next) return e;
    if (!isNaN(e.length)) return {
      next: function () {
        return e && r >= e.length && (e = void 0), {
          value: e && e[r++],
          done: !e
        };
      }
    };
  }
  throw new TypeError(typeof e + " is not iterable");
}
function set(e, r, t, o) {
  return set = "undefined" != typeof Reflect && Reflect.set ? Reflect.set : function (e, r, t, o) {
    var f,
      i = _superPropBase(e, r);
    if (i) {
      if ((f = Object.getOwnPropertyDescriptor(i, r)).set) return f.set.call(o, t), !0;
      if (!f.writable) return !1;
    }
    if (f = Object.getOwnPropertyDescriptor(o, r)) {
      if (!f.writable) return !1;
      f.value = t, Object.defineProperty(o, r, f);
    } else _defineProperty(o, r, t);
    return !0;
  }, set(e, r, t, o);
}
function _set(e, r, t, o, f) {
  if (!set(e, r, t, o || e) && f) throw new TypeError("failed to set property");
  return t;
}
function _setFunctionName(e, t, n) {
  "symbol" == typeof t && (t = (t = t.description) ? "[" + t + "]" : "");
  try {
    Object.defineProperty(e, "name", {
      configurable: !0,
      value: n ? n + " " + t : t
    });
  } catch (e) {}
  return e;
}
function _setPrototypeOf(t, e) {
  return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) {
    return t.__proto__ = e, t;
  }, _setPrototypeOf(t, e);
}
function _skipFirstGeneratorNext(t) {
  return function () {
    var r = t.apply(this, arguments);
    return r.next(), r;
  };
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _superPropBase(t, o) {
  for (; !{}.hasOwnProperty.call(t, o) && null !== (t = _getPrototypeOf(t)););
  return t;
}
function _superPropGet(t, o, e, r) {
  var p = _get(_getPrototypeOf(1 & r ? t.prototype : t), o, e);
  return 2 & r && "function" == typeof p ? function (t) {
    return p.apply(e, t);
  } : p;
}
function _superPropSet(t, e, o, r, p, f) {
  return _set(_getPrototypeOf(f ? t.prototype : t), e, o, r, p);
}
function _taggedTemplateLiteral(e, t) {
  return t || (t = e.slice(0)), Object.freeze(Object.defineProperties(e, {
    raw: {
      value: Object.freeze(t)
    }
  }));
}
function _taggedTemplateLiteralLoose(e, t) {
  return t || (t = e.slice(0)), e.raw = t, e;
}
function _tdz(e) {
  throw new ReferenceError(e + " is not defined - temporal dead zone");
}
function _temporalRef(r, e) {
  return r === _temporalUndefined ? _tdz(e) : r;
}
function _temporalUndefined() {}
function _toArray(r) {
  return _arrayWithHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableRest();
}
function _toConsumableArray(r) {
  return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _toSetter(t, e, n) {
  e || (e = []);
  var r = e.length++;
  return Object.defineProperty({}, "_", {
    set: function (o) {
      e[r] = o, t.apply(n, e);
    }
  });
}
function _tsRewriteRelativeImportExtensions(t, e) {
  return "string" == typeof t && /^\.\.?\//.test(t) ? t.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+)?)\.([cm]?)ts$/i, function (t, s, r, n, o) {
    return s ? e ? ".jsx" : ".js" : !r || n && o ? r + n + "." + o.toLowerCase() + "js" : t;
  }) : t;
}
function _typeof(o) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, _typeof(o);
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
function _usingCtx() {
  var r = "function" == typeof SuppressedError ? SuppressedError : function (r, e) {
      var n = Error();
      return n.name = "SuppressedError", n.error = r, n.suppressed = e, n;
    },
    e = {},
    n = [];
  function using(r, e) {
    if (null != e) {
      if (Object(e) !== e) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
      if (r) var o = e[Symbol.asyncDispose || Symbol.for("Symbol.asyncDispose")];
      if (void 0 === o && (o = e[Symbol.dispose || Symbol.for("Symbol.dispose")], r)) var t = o;
      if ("function" != typeof o) throw new TypeError("Object is not disposable.");
      t && (o = function () {
        try {
          t.call(e);
        } catch (r) {
          return Promise.reject(r);
        }
      }), n.push({
        v: e,
        d: o,
        a: r
      });
    } else r && n.push({
      d: e,
      a: r
    });
    return e;
  }
  return {
    e: e,
    u: using.bind(null, !1),
    a: using.bind(null, !0),
    d: function () {
      var o,
        t = this.e,
        s = 0;
      function next() {
        for (; o = n.pop();) try {
          if (!o.a && 1 === s) return s = 0, n.push(o), Promise.resolve().then(next);
          if (o.d) {
            var r = o.d.call(o.v);
            if (o.a) return s |= 2, Promise.resolve(r).then(next, err);
          } else s |= 1;
        } catch (r) {
          return err(r);
        }
        if (1 === s) return t !== e ? Promise.reject(t) : Promise.resolve();
        if (t !== e) throw t;
      }
      function err(n) {
        return t = t !== e ? new r(n, t) : n, next();
      }
      return next();
    }
  };
}
function _wrapAsyncGenerator(e) {
  return function () {
    return new AsyncGenerator(e.apply(this, arguments));
  };
}
function AsyncGenerator(e) {
  var t, n;
  function resume(t, n) {
    try {
      var r = e[t](n),
        o = r.value,
        u = o instanceof _OverloadYield;
      Promise.resolve(u ? o.v : o).then(function (n) {
        if (u) {
          var i = "return" === t && o.k ? t : "next";
          if (!o.k || n.done) return resume(i, n);
          n = e[i](n).value;
        }
        settle(!!r.done, n);
      }, function (e) {
        resume("throw", e);
      });
    } catch (e) {
      settle(2, e);
    }
  }
  function settle(e, r) {
    2 === e ? t.reject(r) : t.resolve({
      value: r,
      done: e
    }), (t = t.next) ? resume(t.key, t.arg) : n = null;
  }
  this._invoke = function (e, r) {
    return new Promise(function (o, u) {
      var i = {
        key: e,
        arg: r,
        resolve: o,
        reject: u,
        next: null
      };
      n ? n = n.next = i : (t = n = i, resume(e, r));
    });
  }, "function" != typeof e.return && (this.return = void 0);
}
AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function () {
  return this;
}, AsyncGenerator.prototype.next = function (e) {
  return this._invoke("next", e);
}, AsyncGenerator.prototype.throw = function (e) {
  return this._invoke("throw", e);
}, AsyncGenerator.prototype.return = function (e) {
  return this._invoke("return", e);
};
function _wrapNativeSuper(t) {
  var r = "function" == typeof Map ? new Map() : void 0;
  return _wrapNativeSuper = function (t) {
    if (null === t || !_isNativeFunction(t)) return t;
    if ("function" != typeof t) throw new TypeError("Super expression must either be null or a function");
    if (void 0 !== r) {
      if (r.has(t)) return r.get(t);
      r.set(t, Wrapper);
    }
    function Wrapper() {
      return _construct(t, arguments, _getPrototypeOf(this).constructor);
    }
    return Wrapper.prototype = Object.create(t.prototype, {
      constructor: {
        value: Wrapper,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }), _setPrototypeOf(Wrapper, t);
  }, _wrapNativeSuper(t);
}
function _wrapRegExp() {
  _wrapRegExp = function (e, r) {
    return new BabelRegExp(e, void 0, r);
  };
  var e = RegExp.prototype,
    r = new WeakMap();
  function BabelRegExp(e, t, p) {
    var o = RegExp(e, t);
    return r.set(o, p || r.get(e)), _setPrototypeOf(o, BabelRegExp.prototype);
  }
  function buildGroups(e, t) {
    var p = r.get(t);
    return Object.keys(p).reduce(function (r, t) {
      var o = p[t];
      if ("number" == typeof o) r[t] = e[o];else {
        for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++;
        r[t] = e[o[i]];
      }
      return r;
    }, Object.create(null));
  }
  return _inherits(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) {
    var t = e.exec.call(this, r);
    if (t) {
      t.groups = buildGroups(t, this);
      var p = t.indices;
      p && (p.groups = buildGroups(p, this));
    }
    return t;
  }, BabelRegExp.prototype[Symbol.replace] = function (t, p) {
    if ("string" == typeof p) {
      var o = r.get(this);
      return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) {
        if ("" === t) return e;
        var p = o[r];
        return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : "";
      }));
    }
    if ("function" == typeof p) {
      var i = this;
      return e[Symbol.replace].call(this, t, function () {
        var e = arguments;
        return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e);
      });
    }
    return e[Symbol.replace].call(this, t, p);
  }, _wrapRegExp.apply(this, arguments);
}
function _writeOnlyError(r) {
  throw new TypeError('"' + r + '" is write-only');
}
function _AwaitValue(t) {
  this.wrapped = t;
}
function old_createMetadataMethodsForProperty(e, t, a, r) {
  return {
    getMetadata: function (o) {
      old_assertNotFinished(r, "getMetadata"), old_assertMetadataKey(o);
      var i = e[o];
      if (void 0 !== i) if (1 === t) {
        var n = i.public;
        if (void 0 !== n) return n[a];
      } else if (2 === t) {
        var l = i.private;
        if (void 0 !== l) return l.get(a);
      } else if (Object.hasOwnProperty.call(i, "constructor")) return i.constructor;
    },
    setMetadata: function (o, i) {
      old_assertNotFinished(r, "setMetadata"), old_assertMetadataKey(o);
      var n = e[o];
      if (void 0 === n && (n = e[o] = {}), 1 === t) {
        var l = n.public;
        void 0 === l && (l = n.public = {}), l[a] = i;
      } else if (2 === t) {
        var s = n.priv;
        void 0 === s && (s = n.private = new Map()), s.set(a, i);
      } else n.constructor = i;
    }
  };
}
function old_convertMetadataMapToFinal(e, t) {
  var a = e[Symbol.metadata || Symbol.for("Symbol.metadata")],
    r = Object.getOwnPropertySymbols(t);
  if (0 !== r.length) {
    for (var o = 0; o < r.length; o++) {
      var i = r[o],
        n = t[i],
        l = a ? a[i] : null,
        s = n.public,
        c = l ? l.public : null;
      s && c && Object.setPrototypeOf(s, c);
      var d = n.private;
      if (d) {
        var u = Array.from(d.values()),
          f = l ? l.private : null;
        f && (u = u.concat(f)), n.private = u;
      }
      l && Object.setPrototypeOf(n, l);
    }
    a && Object.setPrototypeOf(t, a), e[Symbol.metadata || Symbol.for("Symbol.metadata")] = t;
  }
}
function old_createAddInitializerMethod(e, t) {
  return function (a) {
    old_assertNotFinished(t, "addInitializer"), old_assertCallable(a, "An initializer"), e.push(a);
  };
}
function old_memberDec(e, t, a, r, o, i, n, l, s) {
  var c;
  switch (i) {
    case 1:
      c = "accessor";
      break;
    case 2:
      c = "method";
      break;
    case 3:
      c = "getter";
      break;
    case 4:
      c = "setter";
      break;
    default:
      c = "field";
  }
  var d,
    u,
    f = {
      kind: c,
      name: l ? "#" + t : _toPropertyKey(t),
      isStatic: n,
      isPrivate: l
    },
    p = {
      v: !1
    };
  if (0 !== i && (f.addInitializer = old_createAddInitializerMethod(o, p)), l) {
    d = 2, u = Symbol(t);
    var v = {};
    0 === i ? (v.get = a.get, v.set = a.set) : 2 === i ? v.get = function () {
      return a.value;
    } : (1 !== i && 3 !== i || (v.get = function () {
      return a.get.call(this);
    }), 1 !== i && 4 !== i || (v.set = function (e) {
      a.set.call(this, e);
    })), f.access = v;
  } else d = 1, u = t;
  try {
    return e(s, Object.assign(f, old_createMetadataMethodsForProperty(r, d, u, p)));
  } finally {
    p.v = !0;
  }
}
function old_assertNotFinished(e, t) {
  if (e.v) throw Error("attempted to call " + t + " after decoration was finished");
}
function old_assertMetadataKey(e) {
  if ("symbol" != typeof e) throw new TypeError("Metadata keys must be symbols, received: " + e);
}
function old_assertCallable(e, t) {
  if ("function" != typeof e) throw new TypeError(t + " must be a function");
}
function old_assertValidReturnValue(e, t) {
  var a = typeof t;
  if (1 === e) {
    if ("object" !== a || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
    void 0 !== t.get && old_assertCallable(t.get, "accessor.get"), void 0 !== t.set && old_assertCallable(t.set, "accessor.set"), void 0 !== t.init && old_assertCallable(t.init, "accessor.init"), void 0 !== t.initializer && old_assertCallable(t.initializer, "accessor.initializer");
  } else if ("function" !== a) throw new TypeError((0 === e ? "field" : 10 === e ? "class" : "method") + " decorators must return a function or void 0");
}
function old_getInit(e) {
  var t;
  return null == (t = e.init) && (t = e.initializer) && void 0 !== console && console.warn(".initializer has been renamed to .init as of March 2022"), t;
}
function old_applyMemberDec(e, t, a, r, o, i, n, l, s) {
  var c,
    d,
    u,
    f,
    p,
    v,
    y,
    h = a[0];
  if (n ? (0 === o || 1 === o ? (c = {
    get: a[3],
    set: a[4]
  }, u = "get") : 3 === o ? (c = {
    get: a[3]
  }, u = "get") : 4 === o ? (c = {
    set: a[3]
  }, u = "set") : c = {
    value: a[3]
  }, 0 !== o && (1 === o && _setFunctionName(a[4], "#" + r, "set"), _setFunctionName(a[3], "#" + r, u))) : 0 !== o && (c = Object.getOwnPropertyDescriptor(t, r)), 1 === o ? f = {
    get: c.get,
    set: c.set
  } : 2 === o ? f = c.value : 3 === o ? f = c.get : 4 === o && (f = c.set), "function" == typeof h) void 0 !== (p = old_memberDec(h, r, c, l, s, o, i, n, f)) && (old_assertValidReturnValue(o, p), 0 === o ? d = p : 1 === o ? (d = old_getInit(p), v = p.get || f.get, y = p.set || f.set, f = {
    get: v,
    set: y
  }) : f = p);else for (var m = h.length - 1; m >= 0; m--) {
    var b;
    void 0 !== (p = old_memberDec(h[m], r, c, l, s, o, i, n, f)) && (old_assertValidReturnValue(o, p), 0 === o ? b = p : 1 === o ? (b = old_getInit(p), v = p.get || f.get, y = p.set || f.set, f = {
      get: v,
      set: y
    }) : f = p, void 0 !== b && (void 0 === d ? d = b : "function" == typeof d ? d = [d, b] : d.push(b)));
  }
  if (0 === o || 1 === o) {
    if (void 0 === d) d = function (e, t) {
      return t;
    };else if ("function" != typeof d) {
      var g = d;
      d = function (e, t) {
        for (var a = t, r = 0; r < g.length; r++) a = g[r].call(e, a);
        return a;
      };
    } else {
      var _ = d;
      d = function (e, t) {
        return _.call(e, t);
      };
    }
    e.push(d);
  }
  0 !== o && (1 === o ? (c.get = f.get, c.set = f.set) : 2 === o ? c.value = f : 3 === o ? c.get = f : 4 === o && (c.set = f), n ? 1 === o ? (e.push(function (e, t) {
    return f.get.call(e, t);
  }), e.push(function (e, t) {
    return f.set.call(e, t);
  })) : 2 === o ? e.push(f) : e.push(function (e, t) {
    return f.call(e, t);
  }) : Object.defineProperty(t, r, c));
}
function old_applyMemberDecs(e, t, a, r, o) {
  for (var i, n, l = new Map(), s = new Map(), c = 0; c < o.length; c++) {
    var d = o[c];
    if (Array.isArray(d)) {
      var u,
        f,
        p,
        v = d[1],
        y = d[2],
        h = d.length > 3,
        m = v >= 5;
      if (m ? (u = t, f = r, 0 != (v -= 5) && (p = n = n || [])) : (u = t.prototype, f = a, 0 !== v && (p = i = i || [])), 0 !== v && !h) {
        var b = m ? s : l,
          g = b.get(y) || 0;
        if (!0 === g || 3 === g && 4 !== v || 4 === g && 3 !== v) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + y);
        !g && v > 2 ? b.set(y, v) : b.set(y, !0);
      }
      old_applyMemberDec(e, u, d, y, v, m, h, f, p);
    }
  }
  old_pushInitializers(e, i), old_pushInitializers(e, n);
}
function old_pushInitializers(e, t) {
  t && e.push(function (e) {
    for (var a = 0; a < t.length; a++) t[a].call(e);
    return e;
  });
}
function old_applyClassDecs(e, t, a, r) {
  if (r.length > 0) {
    for (var o = [], i = t, n = t.name, l = r.length - 1; l >= 0; l--) {
      var s = {
        v: !1
      };
      try {
        var c = Object.assign({
            kind: "class",
            name: n,
            addInitializer: old_createAddInitializerMethod(o, s)
          }, old_createMetadataMethodsForProperty(a, 0, n, s)),
          d = r[l](i, c);
      } finally {
        s.v = !0;
      }
      void 0 !== d && (old_assertValidReturnValue(10, d), i = d);
    }
    e.push(i, function () {
      for (var e = 0; e < o.length; e++) o[e].call(i);
    });
  }
}
function _applyDecs(e, t, a) {
  var r = [],
    o = {},
    i = {};
  return old_applyMemberDecs(r, e, i, o, t), old_convertMetadataMapToFinal(e.prototype, i), old_applyClassDecs(r, e, o, a), old_convertMetadataMapToFinal(e, o), r;
}
function applyDecs2203Factory() {
  function createAddInitializerMethod(e, t) {
    return function (r) {
      !function (e) {
        if (e.v) throw Error("attempted to call addInitializer after decoration was finished");
      }(t), assertCallable(r, "An initializer"), e.push(r);
    };
  }
  function memberDec(e, t, r, a, n, i, s, o) {
    var c;
    switch (n) {
      case 1:
        c = "accessor";
        break;
      case 2:
        c = "method";
        break;
      case 3:
        c = "getter";
        break;
      case 4:
        c = "setter";
        break;
      default:
        c = "field";
    }
    var l,
      u,
      f = {
        kind: c,
        name: s ? "#" + t : t,
        static: i,
        private: s
      },
      p = {
        v: !1
      };
    0 !== n && (f.addInitializer = createAddInitializerMethod(a, p)), 0 === n ? s ? (l = r.get, u = r.set) : (l = function () {
      return this[t];
    }, u = function (e) {
      this[t] = e;
    }) : 2 === n ? l = function () {
      return r.value;
    } : (1 !== n && 3 !== n || (l = function () {
      return r.get.call(this);
    }), 1 !== n && 4 !== n || (u = function (e) {
      r.set.call(this, e);
    })), f.access = l && u ? {
      get: l,
      set: u
    } : l ? {
      get: l
    } : {
      set: u
    };
    try {
      return e(o, f);
    } finally {
      p.v = !0;
    }
  }
  function assertCallable(e, t) {
    if ("function" != typeof e) throw new TypeError(t + " must be a function");
  }
  function assertValidReturnValue(e, t) {
    var r = typeof t;
    if (1 === e) {
      if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
      void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init");
    } else if ("function" !== r) throw new TypeError((0 === e ? "field" : 10 === e ? "class" : "method") + " decorators must return a function or void 0");
  }
  function applyMemberDec(e, t, r, a, n, i, s, o) {
    var c,
      l,
      u,
      f,
      p,
      d,
      h = r[0];
    if (s ? c = 0 === n || 1 === n ? {
      get: r[3],
      set: r[4]
    } : 3 === n ? {
      get: r[3]
    } : 4 === n ? {
      set: r[3]
    } : {
      value: r[3]
    } : 0 !== n && (c = Object.getOwnPropertyDescriptor(t, a)), 1 === n ? u = {
      get: c.get,
      set: c.set
    } : 2 === n ? u = c.value : 3 === n ? u = c.get : 4 === n && (u = c.set), "function" == typeof h) void 0 !== (f = memberDec(h, a, c, o, n, i, s, u)) && (assertValidReturnValue(n, f), 0 === n ? l = f : 1 === n ? (l = f.init, p = f.get || u.get, d = f.set || u.set, u = {
      get: p,
      set: d
    }) : u = f);else for (var v = h.length - 1; v >= 0; v--) {
      var g;
      void 0 !== (f = memberDec(h[v], a, c, o, n, i, s, u)) && (assertValidReturnValue(n, f), 0 === n ? g = f : 1 === n ? (g = f.init, p = f.get || u.get, d = f.set || u.set, u = {
        get: p,
        set: d
      }) : u = f, void 0 !== g && (void 0 === l ? l = g : "function" == typeof l ? l = [l, g] : l.push(g)));
    }
    if (0 === n || 1 === n) {
      if (void 0 === l) l = function (e, t) {
        return t;
      };else if ("function" != typeof l) {
        var y = l;
        l = function (e, t) {
          for (var r = t, a = 0; a < y.length; a++) r = y[a].call(e, r);
          return r;
        };
      } else {
        var m = l;
        l = function (e, t) {
          return m.call(e, t);
        };
      }
      e.push(l);
    }
    0 !== n && (1 === n ? (c.get = u.get, c.set = u.set) : 2 === n ? c.value = u : 3 === n ? c.get = u : 4 === n && (c.set = u), s ? 1 === n ? (e.push(function (e, t) {
      return u.get.call(e, t);
    }), e.push(function (e, t) {
      return u.set.call(e, t);
    })) : 2 === n ? e.push(u) : e.push(function (e, t) {
      return u.call(e, t);
    }) : Object.defineProperty(t, a, c));
  }
  function pushInitializers(e, t) {
    t && e.push(function (e) {
      for (var r = 0; r < t.length; r++) t[r].call(e);
      return e;
    });
  }
  return function (e, t, r) {
    var a = [];
    return function (e, t, r) {
      for (var a, n, i = new Map(), s = new Map(), o = 0; o < r.length; o++) {
        var c = r[o];
        if (Array.isArray(c)) {
          var l,
            u,
            f = c[1],
            p = c[2],
            d = c.length > 3,
            h = f >= 5;
          if (h ? (l = t, 0 != (f -= 5) && (u = n = n || [])) : (l = t.prototype, 0 !== f && (u = a = a || [])), 0 !== f && !d) {
            var v = h ? s : i,
              g = v.get(p) || 0;
            if (!0 === g || 3 === g && 4 !== f || 4 === g && 3 !== f) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + p);
            !g && f > 2 ? v.set(p, f) : v.set(p, !0);
          }
          applyMemberDec(e, l, c, p, f, h, d, u);
        }
      }
      pushInitializers(e, a), pushInitializers(e, n);
    }(a, e, t), function (e, t, r) {
      if (r.length > 0) {
        for (var a = [], n = t, i = t.name, s = r.length - 1; s >= 0; s--) {
          var o = {
            v: !1
          };
          try {
            var c = r[s](n, {
              kind: "class",
              name: i,
              addInitializer: createAddInitializerMethod(a, o)
            });
          } finally {
            o.v = !0;
          }
          void 0 !== c && (assertValidReturnValue(10, c), n = c);
        }
        e.push(n, function () {
          for (var e = 0; e < a.length; e++) a[e].call(n);
        });
      }
    }(a, e, r), a;
  };
}
var applyDecs2203Impl;
function _applyDecs2203(e, t, r) {
  return (applyDecs2203Impl = applyDecs2203Impl || applyDecs2203Factory())(e, t, r);
}
function applyDecs2203RFactory() {
  function createAddInitializerMethod(e, t) {
    return function (r) {
      !function (e) {
        if (e.v) throw Error("attempted to call addInitializer after decoration was finished");
      }(t), assertCallable(r, "An initializer"), e.push(r);
    };
  }
  function memberDec(e, t, r, n, a, i, o, s) {
    var c;
    switch (a) {
      case 1:
        c = "accessor";
        break;
      case 2:
        c = "method";
        break;
      case 3:
        c = "getter";
        break;
      case 4:
        c = "setter";
        break;
      default:
        c = "field";
    }
    var l,
      u,
      f = {
        kind: c,
        name: o ? "#" + t : _toPropertyKey(t),
        static: i,
        private: o
      },
      p = {
        v: !1
      };
    0 !== a && (f.addInitializer = createAddInitializerMethod(n, p)), 0 === a ? o ? (l = r.get, u = r.set) : (l = function () {
      return this[t];
    }, u = function (e) {
      this[t] = e;
    }) : 2 === a ? l = function () {
      return r.value;
    } : (1 !== a && 3 !== a || (l = function () {
      return r.get.call(this);
    }), 1 !== a && 4 !== a || (u = function (e) {
      r.set.call(this, e);
    })), f.access = l && u ? {
      get: l,
      set: u
    } : l ? {
      get: l
    } : {
      set: u
    };
    try {
      return e(s, f);
    } finally {
      p.v = !0;
    }
  }
  function assertCallable(e, t) {
    if ("function" != typeof e) throw new TypeError(t + " must be a function");
  }
  function assertValidReturnValue(e, t) {
    var r = typeof t;
    if (1 === e) {
      if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
      void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init");
    } else if ("function" !== r) throw new TypeError((0 === e ? "field" : 10 === e ? "class" : "method") + " decorators must return a function or void 0");
  }
  function applyMemberDec(e, t, r, n, a, i, o, s) {
    var c,
      l,
      u,
      f,
      p,
      d,
      h,
      v = r[0];
    if (o ? (0 === a || 1 === a ? (c = {
      get: r[3],
      set: r[4]
    }, u = "get") : 3 === a ? (c = {
      get: r[3]
    }, u = "get") : 4 === a ? (c = {
      set: r[3]
    }, u = "set") : c = {
      value: r[3]
    }, 0 !== a && (1 === a && _setFunctionName(r[4], "#" + n, "set"), _setFunctionName(r[3], "#" + n, u))) : 0 !== a && (c = Object.getOwnPropertyDescriptor(t, n)), 1 === a ? f = {
      get: c.get,
      set: c.set
    } : 2 === a ? f = c.value : 3 === a ? f = c.get : 4 === a && (f = c.set), "function" == typeof v) void 0 !== (p = memberDec(v, n, c, s, a, i, o, f)) && (assertValidReturnValue(a, p), 0 === a ? l = p : 1 === a ? (l = p.init, d = p.get || f.get, h = p.set || f.set, f = {
      get: d,
      set: h
    }) : f = p);else for (var g = v.length - 1; g >= 0; g--) {
      var y;
      void 0 !== (p = memberDec(v[g], n, c, s, a, i, o, f)) && (assertValidReturnValue(a, p), 0 === a ? y = p : 1 === a ? (y = p.init, d = p.get || f.get, h = p.set || f.set, f = {
        get: d,
        set: h
      }) : f = p, void 0 !== y && (void 0 === l ? l = y : "function" == typeof l ? l = [l, y] : l.push(y)));
    }
    if (0 === a || 1 === a) {
      if (void 0 === l) l = function (e, t) {
        return t;
      };else if ("function" != typeof l) {
        var m = l;
        l = function (e, t) {
          for (var r = t, n = 0; n < m.length; n++) r = m[n].call(e, r);
          return r;
        };
      } else {
        var b = l;
        l = function (e, t) {
          return b.call(e, t);
        };
      }
      e.push(l);
    }
    0 !== a && (1 === a ? (c.get = f.get, c.set = f.set) : 2 === a ? c.value = f : 3 === a ? c.get = f : 4 === a && (c.set = f), o ? 1 === a ? (e.push(function (e, t) {
      return f.get.call(e, t);
    }), e.push(function (e, t) {
      return f.set.call(e, t);
    })) : 2 === a ? e.push(f) : e.push(function (e, t) {
      return f.call(e, t);
    }) : Object.defineProperty(t, n, c));
  }
  function applyMemberDecs(e, t) {
    for (var r, n, a = [], i = new Map(), o = new Map(), s = 0; s < t.length; s++) {
      var c = t[s];
      if (Array.isArray(c)) {
        var l,
          u,
          f = c[1],
          p = c[2],
          d = c.length > 3,
          h = f >= 5;
        if (h ? (l = e, 0 != (f -= 5) && (u = n = n || [])) : (l = e.prototype, 0 !== f && (u = r = r || [])), 0 !== f && !d) {
          var v = h ? o : i,
            g = v.get(p) || 0;
          if (!0 === g || 3 === g && 4 !== f || 4 === g && 3 !== f) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + p);
          !g && f > 2 ? v.set(p, f) : v.set(p, !0);
        }
        applyMemberDec(a, l, c, p, f, h, d, u);
      }
    }
    return pushInitializers(a, r), pushInitializers(a, n), a;
  }
  function pushInitializers(e, t) {
    t && e.push(function (e) {
      for (var r = 0; r < t.length; r++) t[r].call(e);
      return e;
    });
  }
  return function (e, t, r) {
    return {
      e: applyMemberDecs(e, t),
      get c() {
        return function (e, t) {
          if (t.length > 0) {
            for (var r = [], n = e, a = e.name, i = t.length - 1; i >= 0; i--) {
              var o = {
                v: !1
              };
              try {
                var s = t[i](n, {
                  kind: "class",
                  name: a,
                  addInitializer: createAddInitializerMethod(r, o)
                });
              } finally {
                o.v = !0;
              }
              void 0 !== s && (assertValidReturnValue(10, s), n = s);
            }
            return [n, function () {
              for (var e = 0; e < r.length; e++) r[e].call(n);
            }];
          }
        }(e, r);
      }
    };
  };
}
function _applyDecs2203R(e, t, r) {
  return (_applyDecs2203R = applyDecs2203RFactory())(e, t, r);
}
function applyDecs2301Factory() {
  function createAddInitializerMethod(e, t) {
    return function (r) {
      !function (e) {
        if (e.v) throw Error("attempted to call addInitializer after decoration was finished");
      }(t), assertCallable(r, "An initializer"), e.push(r);
    };
  }
  function assertInstanceIfPrivate(e, t) {
    if (!e(t)) throw new TypeError("Attempted to access private element on non-instance");
  }
  function memberDec(e, t, r, n, a, i, s, o, c) {
    var u;
    switch (a) {
      case 1:
        u = "accessor";
        break;
      case 2:
        u = "method";
        break;
      case 3:
        u = "getter";
        break;
      case 4:
        u = "setter";
        break;
      default:
        u = "field";
    }
    var l,
      f,
      p = {
        kind: u,
        name: s ? "#" + t : _toPropertyKey(t),
        static: i,
        private: s
      },
      d = {
        v: !1
      };
    if (0 !== a && (p.addInitializer = createAddInitializerMethod(n, d)), s || 0 !== a && 2 !== a) {
      if (2 === a) l = function (e) {
        return assertInstanceIfPrivate(c, e), r.value;
      };else {
        var h = 0 === a || 1 === a;
        (h || 3 === a) && (l = s ? function (e) {
          return assertInstanceIfPrivate(c, e), r.get.call(e);
        } : function (e) {
          return r.get.call(e);
        }), (h || 4 === a) && (f = s ? function (e, t) {
          assertInstanceIfPrivate(c, e), r.set.call(e, t);
        } : function (e, t) {
          r.set.call(e, t);
        });
      }
    } else l = function (e) {
      return e[t];
    }, 0 === a && (f = function (e, r) {
      e[t] = r;
    });
    var v = s ? c.bind() : function (e) {
      return t in e;
    };
    p.access = l && f ? {
      get: l,
      set: f,
      has: v
    } : l ? {
      get: l,
      has: v
    } : {
      set: f,
      has: v
    };
    try {
      return e(o, p);
    } finally {
      d.v = !0;
    }
  }
  function assertCallable(e, t) {
    if ("function" != typeof e) throw new TypeError(t + " must be a function");
  }
  function assertValidReturnValue(e, t) {
    var r = typeof t;
    if (1 === e) {
      if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
      void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init");
    } else if ("function" !== r) throw new TypeError((0 === e ? "field" : 10 === e ? "class" : "method") + " decorators must return a function or void 0");
  }
  function curryThis2(e) {
    return function (t) {
      e(this, t);
    };
  }
  function applyMemberDec(e, t, r, n, a, i, s, o, c) {
    var u,
      l,
      f,
      p,
      d,
      h,
      v,
      y,
      g = r[0];
    if (s ? (0 === a || 1 === a ? (u = {
      get: (d = r[3], function () {
        return d(this);
      }),
      set: curryThis2(r[4])
    }, f = "get") : 3 === a ? (u = {
      get: r[3]
    }, f = "get") : 4 === a ? (u = {
      set: r[3]
    }, f = "set") : u = {
      value: r[3]
    }, 0 !== a && (1 === a && _setFunctionName(u.set, "#" + n, "set"), _setFunctionName(u[f || "value"], "#" + n, f))) : 0 !== a && (u = Object.getOwnPropertyDescriptor(t, n)), 1 === a ? p = {
      get: u.get,
      set: u.set
    } : 2 === a ? p = u.value : 3 === a ? p = u.get : 4 === a && (p = u.set), "function" == typeof g) void 0 !== (h = memberDec(g, n, u, o, a, i, s, p, c)) && (assertValidReturnValue(a, h), 0 === a ? l = h : 1 === a ? (l = h.init, v = h.get || p.get, y = h.set || p.set, p = {
      get: v,
      set: y
    }) : p = h);else for (var m = g.length - 1; m >= 0; m--) {
      var b;
      void 0 !== (h = memberDec(g[m], n, u, o, a, i, s, p, c)) && (assertValidReturnValue(a, h), 0 === a ? b = h : 1 === a ? (b = h.init, v = h.get || p.get, y = h.set || p.set, p = {
        get: v,
        set: y
      }) : p = h, void 0 !== b && (void 0 === l ? l = b : "function" == typeof l ? l = [l, b] : l.push(b)));
    }
    if (0 === a || 1 === a) {
      if (void 0 === l) l = function (e, t) {
        return t;
      };else if ("function" != typeof l) {
        var I = l;
        l = function (e, t) {
          for (var r = t, n = 0; n < I.length; n++) r = I[n].call(e, r);
          return r;
        };
      } else {
        var w = l;
        l = function (e, t) {
          return w.call(e, t);
        };
      }
      e.push(l);
    }
    0 !== a && (1 === a ? (u.get = p.get, u.set = p.set) : 2 === a ? u.value = p : 3 === a ? u.get = p : 4 === a && (u.set = p), s ? 1 === a ? (e.push(function (e, t) {
      return p.get.call(e, t);
    }), e.push(function (e, t) {
      return p.set.call(e, t);
    })) : 2 === a ? e.push(p) : e.push(function (e, t) {
      return p.call(e, t);
    }) : Object.defineProperty(t, n, u));
  }
  function applyMemberDecs(e, t, r) {
    for (var n, a, i, s = [], o = new Map(), c = new Map(), u = 0; u < t.length; u++) {
      var l = t[u];
      if (Array.isArray(l)) {
        var f,
          p,
          d = l[1],
          h = l[2],
          v = l.length > 3,
          y = d >= 5,
          g = r;
        if (y ? (f = e, 0 != (d -= 5) && (p = a = a || []), v && !i && (i = function (t) {
          return _checkInRHS(t) === e;
        }), g = i) : (f = e.prototype, 0 !== d && (p = n = n || [])), 0 !== d && !v) {
          var m = y ? c : o,
            b = m.get(h) || 0;
          if (!0 === b || 3 === b && 4 !== d || 4 === b && 3 !== d) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h);
          !b && d > 2 ? m.set(h, d) : m.set(h, !0);
        }
        applyMemberDec(s, f, l, h, d, y, v, p, g);
      }
    }
    return pushInitializers(s, n), pushInitializers(s, a), s;
  }
  function pushInitializers(e, t) {
    t && e.push(function (e) {
      for (var r = 0; r < t.length; r++) t[r].call(e);
      return e;
    });
  }
  return function (e, t, r, n) {
    return {
      e: applyMemberDecs(e, t, n),
      get c() {
        return function (e, t) {
          if (t.length > 0) {
            for (var r = [], n = e, a = e.name, i = t.length - 1; i >= 0; i--) {
              var s = {
                v: !1
              };
              try {
                var o = t[i](n, {
                  kind: "class",
                  name: a,
                  addInitializer: createAddInitializerMethod(r, s)
                });
              } finally {
                s.v = !0;
              }
              void 0 !== o && (assertValidReturnValue(10, o), n = o);
            }
            return [n, function () {
              for (var e = 0; e < r.length; e++) r[e].call(n);
            }];
          }
        }(e, r);
      }
    };
  };
}
function _applyDecs2301(e, t, r, n) {
  return (_applyDecs2301 = applyDecs2301Factory())(e, t, r, n);
}
function _applyDecs2305(e, t, r, n, o, a) {
  function i(e, t, r) {
    return function (n, o) {
      return r && r(n), e[t].call(n, o);
    };
  }
  function c(e, t) {
    for (var r = 0; r < e.length; r++) e[r].call(t);
    return t;
  }
  function s(e, t, r, n) {
    if ("function" != typeof e && (n || void 0 !== e)) throw new TypeError(t + " must " + (r || "be") + " a function" + (n ? "" : " or undefined"));
    return e;
  }
  function applyDec(e, t, r, n, o, a, c, u, l, f, p, d, h) {
    function m(e) {
      if (!h(e)) throw new TypeError("Attempted to access private element on non-instance");
    }
    var y,
      v = t[0],
      g = t[3],
      b = !u;
    if (!b) {
      r || Array.isArray(v) || (v = [v]);
      var w = {},
        S = [],
        A = 3 === o ? "get" : 4 === o || d ? "set" : "value";
      f ? (p || d ? w = {
        get: _setFunctionName(function () {
          return g(this);
        }, n, "get"),
        set: function (e) {
          t[4](this, e);
        }
      } : w[A] = g, p || _setFunctionName(w[A], n, 2 === o ? "" : A)) : p || (w = Object.getOwnPropertyDescriptor(e, n));
    }
    for (var P = e, j = v.length - 1; j >= 0; j -= r ? 2 : 1) {
      var D = v[j],
        E = r ? v[j - 1] : void 0,
        I = {},
        O = {
          kind: ["field", "accessor", "method", "getter", "setter", "class"][o],
          name: n,
          metadata: a,
          addInitializer: function (e, t) {
            if (e.v) throw Error("attempted to call addInitializer after decoration was finished");
            s(t, "An initializer", "be", !0), c.push(t);
          }.bind(null, I)
        };
      try {
        if (b) (y = s(D.call(E, P, O), "class decorators", "return")) && (P = y);else {
          var k, F;
          O.static = l, O.private = f, f ? 2 === o ? k = function (e) {
            return m(e), w.value;
          } : (o < 4 && (k = i(w, "get", m)), 3 !== o && (F = i(w, "set", m))) : (k = function (e) {
            return e[n];
          }, (o < 2 || 4 === o) && (F = function (e, t) {
            e[n] = t;
          }));
          var N = O.access = {
            has: f ? h.bind() : function (e) {
              return n in e;
            }
          };
          if (k && (N.get = k), F && (N.set = F), P = D.call(E, d ? {
            get: w.get,
            set: w.set
          } : w[A], O), d) {
            if ("object" == typeof P && P) (y = s(P.get, "accessor.get")) && (w.get = y), (y = s(P.set, "accessor.set")) && (w.set = y), (y = s(P.init, "accessor.init")) && S.push(y);else if (void 0 !== P) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
          } else s(P, (p ? "field" : "method") + " decorators", "return") && (p ? S.push(P) : w[A] = P);
        }
      } finally {
        I.v = !0;
      }
    }
    return (p || d) && u.push(function (e, t) {
      for (var r = S.length - 1; r >= 0; r--) t = S[r].call(e, t);
      return t;
    }), p || b || (f ? d ? u.push(i(w, "get"), i(w, "set")) : u.push(2 === o ? w[A] : i.call.bind(w[A])) : Object.defineProperty(e, n, w)), P;
  }
  function u(e, t) {
    return Object.defineProperty(e, Symbol.metadata || Symbol.for("Symbol.metadata"), {
      configurable: !0,
      enumerable: !0,
      value: t
    });
  }
  if (arguments.length >= 6) var l = a[Symbol.metadata || Symbol.for("Symbol.metadata")];
  var f = Object.create(null == l ? null : l),
    p = function (e, t, r, n) {
      var o,
        a,
        i = [],
        s = function (t) {
          return _checkInRHS(t) === e;
        },
        u = new Map();
      function l(e) {
        e && i.push(c.bind(null, e));
      }
      for (var f = 0; f < t.length; f++) {
        var p = t[f];
        if (Array.isArray(p)) {
          var d = p[1],
            h = p[2],
            m = p.length > 3,
            y = 16 & d,
            v = !!(8 & d),
            g = 0 == (d &= 7),
            b = h + "/" + v;
          if (!g && !m) {
            var w = u.get(b);
            if (!0 === w || 3 === w && 4 !== d || 4 === w && 3 !== d) throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h);
            u.set(b, !(d > 2) || d);
          }
          applyDec(v ? e : e.prototype, p, y, m ? "#" + h : _toPropertyKey(h), d, n, v ? a = a || [] : o = o || [], i, v, m, g, 1 === d, v && m ? s : r);
        }
      }
      return l(o), l(a), i;
    }(e, t, o, f);
  return r.length || u(e, f), {
    e: p,
    get c() {
      var t = [];
      return r.length && [u(applyDec(e, [r], n, e.name, 5, f, t), f), c.bind(null, t, e)];
    }
  };
}
function _classApplyDescriptorDestructureSet(e, t) {
  if (t.set) return "__destrObj" in t || (t.__destrObj = {
    set value(r) {
      t.set.call(e, r);
    }
  }), t.__destrObj;
  if (!t.writable) throw new TypeError("attempted to set read only private field");
  return t;
}
function _classApplyDescriptorGet(e, t) {
  return t.get ? t.get.call(e) : t.value;
}
function _classApplyDescriptorSet(e, t, l) {
  if (t.set) t.set.call(e, l);else {
    if (!t.writable) throw new TypeError("attempted to set read only private field");
    t.value = l;
  }
}
function _classCheckPrivateStaticAccess(s, a, r) {
  return _assertClassBrand(a, s, r);
}
function _classCheckPrivateStaticFieldDescriptor(t, e) {
  if (void 0 === t) throw new TypeError("attempted to " + e + " private static field before its declaration");
}
function _classExtractFieldDescriptor(e, t) {
  return _classPrivateFieldGet2(t, e);
}
function _classPrivateFieldDestructureSet(e, t) {
  var r = _classPrivateFieldGet2(t, e);
  return _classApplyDescriptorDestructureSet(e, r);
}
function _classPrivateFieldGet(e, t) {
  var r = _classPrivateFieldGet2(t, e);
  return _classApplyDescriptorGet(e, r);
}
function _classPrivateFieldSet(e, t, r) {
  var s = _classPrivateFieldGet2(t, e);
  return _classApplyDescriptorSet(e, s, r), r;
}
function _classPrivateMethodGet(s, a, r) {
  return _assertClassBrand(a, s), r;
}
function _classPrivateMethodSet() {
  throw new TypeError("attempted to reassign private method");
}
function _classStaticPrivateFieldDestructureSet(t, r, s) {
  return _assertClassBrand(r, t), _classCheckPrivateStaticFieldDescriptor(s, "set"), _classApplyDescriptorDestructureSet(t, s);
}
function _classStaticPrivateFieldSpecGet(t, s, r) {
  return _assertClassBrand(s, t), _classCheckPrivateStaticFieldDescriptor(r, "get"), _classApplyDescriptorGet(t, r);
}
function _classStaticPrivateFieldSpecSet(s, t, r, e) {
  return _assertClassBrand(t, s), _classCheckPrivateStaticFieldDescriptor(r, "set"), _classApplyDescriptorSet(s, r, e), e;
}
function _classStaticPrivateMethodSet() {
  throw new TypeError("attempted to set read only static private field");
}
function _defineEnumerableProperties(e, r) {
  for (var t in r) {
    var n = r[t];
    n.configurable = n.enumerable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, t, n);
  }
  if (Object.getOwnPropertySymbols) for (var a = Object.getOwnPropertySymbols(r), b = 0; b < a.length; b++) {
    var i = a[b];
    (n = r[i]).configurable = n.enumerable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, i, n);
  }
  return e;
}
function dispose_SuppressedError(r, e) {
  return "undefined" != typeof SuppressedError ? dispose_SuppressedError = SuppressedError : (dispose_SuppressedError = function (r, e) {
    this.suppressed = e, this.error = r, this.stack = Error().stack;
  }, dispose_SuppressedError.prototype = Object.create(Error.prototype, {
    constructor: {
      value: dispose_SuppressedError,
      writable: !0,
      configurable: !0
    }
  })), new dispose_SuppressedError(r, e);
}
function _dispose(r, e, s) {
  function next() {
    for (; r.length > 0;) try {
      var o = r.pop(),
        p = o.d.call(o.v);
      if (o.a) return Promise.resolve(p).then(next, err);
    } catch (r) {
      return err(r);
    }
    if (s) throw e;
  }
  function err(r) {
    return e = s ? new dispose_SuppressedError(e, r) : r, s = !0, next();
  }
  return next();
}
function _objectSpread(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? Object(arguments[r]) : {},
      o = Object.keys(t);
    "function" == typeof Object.getOwnPropertySymbols && o.push.apply(o, Object.getOwnPropertySymbols(t).filter(function (e) {
      return Object.getOwnPropertyDescriptor(t, e).enumerable;
    })), o.forEach(function (r) {
      _defineProperty(e, r, t[r]);
    });
  }
  return e;
}
function _regeneratorRuntime() {
  "use strict";

  var r = _regenerator(),
    e = r.m(_regeneratorRuntime),
    t = (Object.getPrototypeOf ? Object.getPrototypeOf(e) : e.__proto__).constructor;
  function n(r) {
    var e = "function" == typeof r && r.constructor;
    return !!e && (e === t || "GeneratorFunction" === (e.displayName || e.name));
  }
  var o = {
    throw: 1,
    return: 2,
    break: 3,
    continue: 3
  };
  function a(r) {
    var e, t;
    return function (n) {
      e || (e = {
        stop: function () {
          return t(n.a, 2);
        },
        catch: function () {
          return n.v;
        },
        abrupt: function (r, e) {
          return t(n.a, o[r], e);
        },
        delegateYield: function (r, o, a) {
          return e.resultName = o, t(n.d, _regeneratorValues(r), a);
        },
        finish: function (r) {
          return t(n.f, r);
        }
      }, t = function (r, t, o) {
        n.p = e.prev, n.n = e.next;
        try {
          return r(t, o);
        } finally {
          e.next = n.n;
        }
      }), e.resultName && (e[e.resultName] = n.v, e.resultName = void 0), e.sent = n.v, e.next = n.n;
      try {
        return r.call(this, e);
      } finally {
        n.p = e.prev, n.n = e.next;
      }
    };
  }
  return (_regeneratorRuntime = function () {
    return {
      wrap: function (e, t, n, o) {
        return r.w(a(e), t, n, o && o.reverse());
      },
      isGeneratorFunction: n,
      mark: r.m,
      awrap: function (r, e) {
        return new _OverloadYield(r, e);
      },
      AsyncIterator: _regeneratorAsyncIterator,
      async: function (r, e, t, o, u) {
        return (n(e) ? _regeneratorAsyncGen : _regeneratorAsync)(a(r), e, t, o, u);
      },
      keys: _regeneratorKeys,
      values: _regeneratorValues
    };
  })();
}
function _using(o, n, e) {
  if (null == n) return n;
  if (Object(n) !== n) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
  if (e) var r = n[Symbol.asyncDispose || Symbol.for("Symbol.asyncDispose")];
  if (null == r && (r = n[Symbol.dispose || Symbol.for("Symbol.dispose")]), "function" != typeof r) throw new TypeError("Property [Symbol.dispose] is not a function.");
  return o.push({
    v: n,
    d: r,
    a: e
  }), n;
}

/*!******************************************************************************
 * @license
 * Copyright 2015-2017 Thomas Schreiber
 * Copyright 2017-2019 Rundfunk und Telekom Regulierungs-GmbH (RTR-GmbH)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The source code for this project is available at
 * https://github.com/rtr-nettest/rmbtws
 *****************************************************************************!*/
"use strict";
function RMBTTest(rmbtTestConfig, rmbtControlServer) {
  var _server_override = "wss://developv4-rmbtws.netztest.at:19002";
  var _logger = log.getLogger("rmbtws");
  var _chunkSize = null;
  var MAX_CHUNK_SIZE = 4194304;
  var MIN_CHUNK_SIZE = 0;
  var DEFAULT_CHUNK_SIZE = 4096;
  var _changeChunkSizes = false;

  /**
   *  @type {RMBTTestConfig}
   **/
  var _rmbtTestConfig;

  /**
   * @type {RMBTControlServerCommunication}
   */
  var _rmbtControlServer;
  var _rmbtTestResult = null;
  var _errorCallback = null;
  var _stateChangeCallback = null;
  var _state = TestState.INIT;
  var _stateChangeMs = null;
  var _statesInfo = {
    durationInitMs: 2500,
    durationPingMs: 10000,
    //set dynamically
    durationUpMs: -1,
    durationDownMs: -1
  };
  var _intermediateResult = new RMBTIntermediateResult();
  var _threads = [];
  var _arrayBuffers = {};
  var _endArrayBuffers = {};
  var _cyclicBarrier = null;
  var _numThreadsAllowed = 0;
  var _numDownloadThreads = 0;
  var _numUploadThreads = 0;
  var _bytesPerSecsPretest = [];
  var _totalBytesPerSecsPretest = 0;

  //this is an observable/subject
  //http://addyosmani.com/resources/essentialjsdesignpatterns/book/#observerpatternjavascript
  //RMBTTest.prototype = new Subject();

  function construct(rmbtTestConfig, rmbtControlServer) {
    //init socket
    _rmbtTestConfig = rmbtTestConfig; // = new RMBTTestConfig();
    _rmbtControlServer = rmbtControlServer;
  }

  /**
   * Sets the state of the test, notifies the observers if
   * the state changed
   * @param {TestState} state
   */
  function setState(state) {
    if (_state === undefined || _state !== state) {
      _state = state;
      _stateChangeMs = nowMs();
      if (_stateChangeCallback) {
        _stateChangeCallback(state);
      }
    }
  }

  /**
   * Set the fallback function
   * in case the websocket-test
   * fails for any reason
   * @param {Function} fct
   */
  this.onError = function (fct) {
    _errorCallback = fct;
  };

  /**
   * Callback when the test changes execution state
   * @param {Function} callback
   */
  this.onStateChange = function (callback) {
    _stateChangeCallback = callback;
  };

  /**
   * Calls the error function (but only once!)
   * @param {RMBTError} error
   */
  var callErrorCallback = function callErrorCallback(error) {
    _logger.debug("error occurred during websocket test:", error);
    if (error !== RMBTError.NOT_SUPPORTED) {
      setState(TestState.ERROR);
    }
    if (_errorCallback !== null) {
      var t = _errorCallback;
      _errorCallback = null;
      t(error);
    }
  };
  this.startTest = function () {
    //see if websockets are supported
    if (globalThis.WebSocket === undefined) {
      callErrorCallback(RMBTError.NOT_SUPPORTED);
      return;
    }
    setState(TestState.INIT);
    _rmbtTestResult = new RMBTTestResult();
    //connect to control server
    _rmbtControlServer.getDataCollectorInfo();
    _rmbtControlServer.obtainControlServerRegistration(function (response) {
      _numThreadsAllowed = parseInt(response.test_numthreads);
      _cyclicBarrier = new CyclicBarrier(_numThreadsAllowed);
      _statesInfo.durationDownMs = response.test_duration * 1e3;
      _statesInfo.durationUpMs = response.test_duration * 1e3;

      //@TODO: Nicer
      //if there is testVisualization, make use of it!
      if (TestEnvironment.getTestVisualization() !== null) {
        TestEnvironment.getTestVisualization().updateInfo(response.test_server_name, response.client_remote_ip, response.provider, response.test_uuid, response.open_test_uuid);
      }
      var continuation = function continuation() {
        _logger.debug("got geolocation, obtaining token and websocket address");

        //wait if we have to
        var continuation = function continuation() {
          setState(TestState.INIT);
          _rmbtTestResult.beginTime = Date.now();
          //n threads
          for (var i = 0; i < _numThreadsAllowed; i++) {
            var thread = new RMBTTestThread(_cyclicBarrier);
            thread.id = i;
            _rmbtTestResult.addThread(thread.result);

            //only one thread will call after upload is finished
            conductTest(response, thread, function () {
              _logger.info("All tests finished");
              wsGeoTracker.stop();
              if (TestEnvironment.getTestVisualization().getGeoResults) {
                _rmbtTestResult.geoLocations = TestEnvironment.getTestVisualization().getGeoResults();
              } else {
                _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
              }
              _rmbtTestResult.calculateAll();
              _rmbtControlServer.submitResults(prepareResult(response), function () {
                setState(TestState.END);
              }, function () {
                callErrorCallback(RMBTError.SUBMIT_FAILED);
              });
            });
            _threads.push(thread);
          }
        };
        if (response.test_wait === 0) {
          continuation();
        } else {
          _logger.info("test scheduled for start in " + response.test_wait + " second(s)");
          setState(TestState.WAIT);
          self.setTimeout(function () {
            continuation();
          }, response.test_wait * 1e3);
        }
      };
      var wsGeoTracker;
      //get the user's geolocation
      if (TestEnvironment.getGeoTracker() !== null) {
        wsGeoTracker = TestEnvironment.getGeoTracker();

        //in case of legacy code, the geoTracker will already be started
        continuation();
      } else {
        wsGeoTracker = new GeoTracker();
        _logger.debug("getting geolocation");
        wsGeoTracker.start(function () {
          continuation();
        }, TestEnvironment.getTestVisualization());
      }
    }, function () {
      //no internet connection
      callErrorCallback(RMBTError.REGISTRATION_FAILED);
    });
  };

  /**
   *
   * @returns {RMBTIntermediateResult}
   */
  this.getIntermediateResult = function () {
    _intermediateResult.status = _state;
    var diffTime = nowNs() / 1e6 - _stateChangeMs;
    switch (_intermediateResult.status) {
      case TestState.WAIT:
        _intermediateResult.progress = 0;
        //_intermediateResult.remainingWait = params.getStartTime() - System.currentTimeMillis();
        break;
      case TestState.INIT:
      case TestState.INIT_DOWN:
      case TestState.INIT_UP:
        _intermediateResult.progress = diffTime / _statesInfo.durationInitMs;
        break;
      case TestState.PING:
        _intermediateResult.progress = diffTime / _statesInfo.durationPingMs;
        break;
      case TestState.DOWN:
        _intermediateResult.progress = diffTime / _statesInfo.durationDownMs;
        //downBitPerSec.set(Math.round(getAvgSpeed()));
        break;
      case TestState.UP:
        _intermediateResult.progress = diffTime / _statesInfo.durationUpMs;
        //upBitPerSec.set(Math.round(getAvgSpeed()));
        break;
      case TestState.END:
        _intermediateResult.progress = 1;
        break;
      case TestState.ERROR:
      case TestState.ABORTED:
        _intermediateResult.progress = 0;
        break;
    }
    if (isNaN(_intermediateResult.progress)) {
      _intermediateResult.progress = 0;
    }
    _intermediateResult.progress = Math.min(1, _intermediateResult.progress);
    if (_rmbtTestResult !== null) {
      if (_intermediateResult.status === TestState.PING || _intermediateResult.status === TestState.DOWN) {
        _intermediateResult.pingNano = _rmbtTestResult.ping_server_median;
        _intermediateResult.pings = _rmbtTestResult.pings;
      }
      if (_intermediateResult.status === TestState.DOWN || _intermediateResult.status == TestState.INIT_UP) {
        var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
          return thread.down;
        });
        _intermediateResult.downBitPerSec = results.speed;
        _intermediateResult.downBitPerSecLog = (Math.log10(_intermediateResult.downBitPerSec / 1e6) + 2) / 4;
      }
      if (_intermediateResult.status === TestState.UP || _intermediateResult.status == TestState.INIT_UP) {
        var _results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
          return thread.up;
        });
        _intermediateResult.upBitPerSec = _results.speed;
        _intermediateResult.upBitPerSecLog = (Math.log10(_intermediateResult.upBitPerSec / 1e6) + 2) / 4;
      }
    }
    return _intermediateResult;
  };

  /**
   * Conduct the test
   * @param {RMBTControlServerRegistrationResponse} registrationResponse
   * @param {RMBTTestThread} thread info about the thread/local thread data structures
   * @param {Function} callback as soon as all tests are finished
   */
  function conductTest(registrationResponse, thread, callback) {
    var server = (registrationResponse.test_server_encryption ? "wss://" : "ws://") + registrationResponse.test_server_address + ":" + registrationResponse.test_server_port;
    //server = server_override;
    _logger.debug(server);
    var errorFunctions = function () {
      return {
        IGNORE: function IGNORE() {
          //ignore error :)
        },
        CALLGLOBALHANDLER: function CALLGLOBALHANDLER(e) {
          if (e) {
            _logger.error("connection closed", e);
          }
          callErrorCallback(RMBTError.CONNECT_FAILED);
        },
        TRYRECONNECT: function TRYRECONNECT() {
          //@TODO: try to reconnect
          //@TODO: somehow restart the current phase
          callErrorCallback(RMBTError.CONNECT_FAILED);
        }
      };
    }();

    //register state enter events
    thread.onStateEnter(TestState.INIT_DOWN, function () {
      setState(TestState.INIT_DOWN);
      _logger.debug(thread.id + ": start short download");
      _chunkSize = MIN_CHUNK_SIZE;

      //all threads download, according to specification
      shortDownloadtest(thread, _rmbtTestConfig.pretestDurationMs);
    });
    thread.onStateEnter(TestState.PING, function () {
      setState(TestState.PING);
      _logger.debug(thread.id + ": starting ping");
      //only one thread pings
      if (thread.id === 0) {
        pingTest(thread);
      } else {
        thread.triggerNextState();
      }
    });
    thread.onStateEnter(TestState.DOWN, function () {
      setState(TestState.DOWN);

      //set threads and chunksize
      if (_bytesPerSecsPretest.length > 0) {
        var chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.downloadThreadsLimitsMbit, false);
        _numDownloadThreads = chunkSizes.numThreads;
        if (_changeChunkSizes) {
          _chunkSize = chunkSizes.chunkSize;
        }
        _bytesPerSecsPretest = [];
      }

      //maybe not all threads have to conduct a download speed test
      if (thread.id < _numDownloadThreads) {
        downloadTest(thread, registrationResponse.test_duration);
      } else {
        thread.socket.onerror = errorFunctions.IGNORE;
        thread.socket.onclose = errorFunctions.IGNORE;
        thread.triggerNextState();
      }
    });
    thread.onStateEnter(TestState.CONNECT_UPLOAD, function () {
      setState(TestState.INIT_UP);
      //terminate connection, reconnect
      thread.socket.onerror = errorFunctions.IGNORE;
      thread.socket.onclose = errorFunctions.IGNORE;
      thread.socket.close();
      connectToServer(thread, server, registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
    });
    thread.onStateEnter(TestState.INIT_UP, function () {
      //setState(TestState.INIT_UP);
      _chunkSize = MIN_CHUNK_SIZE;
      shortUploadtest(thread, _rmbtTestConfig.pretestDurationMs);
    });
    thread.onStateEnter(TestState.UP, function () {
      setState(TestState.UP);

      //set threads and chunksize
      if (_bytesPerSecsPretest.length > 0) {
        var chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.uploadThreadsLimitsMbit, true);
        _numUploadThreads = chunkSizes.numThreads;
        if (_changeChunkSizes) {
          _chunkSize = chunkSizes.chunkSize;
        }
        _bytesPerSecsPretest = [];
      }

      //maybe not all threads have to conduct an upload speed test
      if (thread.id < _numUploadThreads) {
        uploadTest(thread, registrationResponse.test_duration);
      } else {
        //the socket is not needed anymore,
        //close it to free up resources
        thread.socket.onerror = errorFunctions.IGNORE;
        thread.socket.onclose = errorFunctions.IGNORE;
        if (thread.socket.readyState !== WebSocket.CLOSED) {
          thread.socket.close();
        }
        thread.triggerNextState();
      }
    });
    thread.onStateEnter(TestState.END, function () {
      //close sockets, if not already closed
      if (thread.socket.readyState !== WebSocket.CLOSED) {
        thread.socket.close();
      }
      if (thread.id === 0) {
        callback();
      }
    });

    //Lifecycle states finished -> INIT, ESTABLISHED, SHORTDOWNLOAD
    //thread.state = TestState.INIT;
    thread.setState(TestState.INIT);
    setState(TestState.INIT);
    connectToServer(thread, server, registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
  }

  /**
   * Connect the given thread to the given websocket server
   * @param {RMBTTestThread} thread
   * @param {String} server server:port
   * @param {String} token
   * @param {Function} errorHandler initial error handler
   */
  function connectToServer(thread, server, token, errorHandler) {
    try {
      thread.socket = new WebSocket(server);
    } catch (e) {
      callErrorCallback(RMBTError.SOCKET_INIT_FAILED);
      return;
    }
    thread.socket.binaryType = "arraybuffer";
    thread.socket.onerror = errorHandler;
    thread.socket.onclose = errorHandler;
    thread.socket.onmessage = function (event) {
      //logger.debug("thread " + thread.id + " triggered, state " + thread.state + " event: " + event);

      //console.log(thread.id + ": Received: " + event.data);
      if (event.data.indexOf("CHUNKSIZE") === 0) {
        var parts = event.data.trim().split(" ");
        //chunksize min and max
        if (parts.length === 4) {
          DEFAULT_CHUNK_SIZE = parseInt(parts[1]);
          MIN_CHUNK_SIZE = parseInt(parts[2]);
          MAX_CHUNK_SIZE = parseInt(parts[3]);
        }
        //min chunksize, max chunksize
        else {
          DEFAULT_CHUNK_SIZE = parseInt(parts[1]);
          MIN_CHUNK_SIZE = DEFAULT_CHUNK_SIZE;
        }
        _logger.debug(thread.id + ": Chunksizes: min " + MIN_CHUNK_SIZE + ", max: " + MAX_CHUNK_SIZE + ", default: " + DEFAULT_CHUNK_SIZE);
      } else if (event.data.indexOf("RMBTv") === 0) {
        //get server version
        var version = event.data.substring(5).trim();
        _rmbtTestConfig.client_version = version;
        if (version.indexOf("1.") === 0) {
          _changeChunkSizes = true;
        } else if (version.indexOf("0.3") === 0) {
          _changeChunkSizes = false;
        } else {
          _logger.warn("unknown server version: " + version);
        }
      } else if (event.data === "ACCEPT TOKEN QUIT\n") {
        thread.socket.send("TOKEN " + token + "\n");
      } else if (event.data === "OK\n" && thread.state === TestState.INIT) {
        _logger.debug(thread.id + ": Token accepted");
      } else if (event.data === "ERR\n") {
        errorHandler();
        _logger.error("got error msg");
      } else if (event.data.indexOf("ACCEPT GETCHUNKS") === 0) {
        thread.triggerNextState();
      }
    };
  }

  /**
   * Calculate chunk size, total pretest bandwidth according
   * to single thread results during upload/download pre-test
   * @param bytesPerSecsPretest array containing single measurement results
   * @param threadLimits limits for determining how many threads to use
   * @param limitToExistingChunks only use chunk sizes that are buffered already (and delete all others)
   * @returns {{numThreads: number, chunkSize: number, bytesPerSecs: number}}
   */
  function calculateChunkSizes(bytesPerSecsPretest, threadLimits, limitToExistingChunks) {
    _totalBytesPerSecsPretest = bytesPerSecsPretest.reduce(function (acc, val) {
      return acc + val;
    });
    _logger.debug("total: circa " + _totalBytesPerSecsPretest / 1000 + " KB/sec");
    _logger.debug("total: circa " + _totalBytesPerSecsPretest * 8 / 1e6 + " MBit/sec");

    //set number of upload threads according to mbit/s measured
    var mbits = _totalBytesPerSecsPretest * 8 / 1e6;
    var threads = 0;
    Object.keys(threadLimits).forEach(function (thresholdMbit) {
      if (mbits > thresholdMbit) {
        threads = threadLimits[thresholdMbit];
      }
    });
    threads = Math.min(_numThreadsAllowed, threads);
    _logger.debug("set number of threads to be used in upcoming speed test to: " + threads);

    //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
    var calculatedChunkSize = _totalBytesPerSecsPretest / (1000 / (_rmbtTestConfig.measurementPointsTimespan / 2));

    //round to the nearest full KB
    calculatedChunkSize -= calculatedChunkSize % 1024;

    //but min 4KiB
    calculatedChunkSize = Math.max(MIN_CHUNK_SIZE, calculatedChunkSize);

    //and max MAX_CHUNKSIZE
    calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);
    _logger.debug("calculated chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");
    if (limitToExistingChunks) {
      //get closest chunk size where there are saved chunks available
      var closest = Number.POSITIVE_INFINITY;
      Object.keys(_arrayBuffers).forEach(function (key) {
        var diff = Math.abs(calculatedChunkSize - key);
        if (diff < Math.abs(calculatedChunkSize - closest)) {
          // Fix for strange bug, where key sometimes is a string
          // TODO: investigate source
          if (typeof key === "string") {
            key = parseInt(key);
          }
          closest = key;
        } else {
          //if there is already a closer chunk selected, we don't need this
          //anymore in this test and can dereference it to save heap memory
          delete _arrayBuffers[key];
          delete _endArrayBuffers[key];
        }
      });
      calculatedChunkSize = closest;
      _logger.debug("fallback to existing chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");
    }
    return {
      numThreads: threads,
      chunkSize: calculatedChunkSize,
      bytesPerSecs: _totalBytesPerSecsPretest
    };
  }

  /**
   * conduct the short pretest to recognize if the connection
   * is too slow for multiple threads
   * @param {RMBTTestThread} thread
   * @param {Number} durationMs
   */
  function shortDownloadtest(thread, durationMs) {
    var prevListener = thread.socket.onmessage;
    var startTime = nowMs(); //ms since page load
    var n = 1;
    var bytesReceived = 0;
    var chunksize = _chunkSize;
    var _loop = function loop() {
      downloadChunks(thread, n, chunksize, function (msg) {
        bytesReceived += n * chunksize;
        _logger.debug(thread.id + ": " + msg);
        var timeNs = parseInt(msg.substring(5));
        var now = nowMs();
        if (now - startTime > durationMs) {
          //save circa result
          _bytesPerSecsPretest.push(n * chunksize / (timeNs / 1e9));

          //"break"
          thread.socket.onmessage = prevListener;
        } else {
          if (n < 8 || !_changeChunkSizes) {
            n = n * 2;
            _loop();
          } else {
            chunksize = Math.min(chunksize * 2, MAX_CHUNK_SIZE);
            _loop();
          }
        }
      });
    };
    _loop();
  }

  /**
   * Download n Chunks from the test server
   * @param {RMBTTestThread} thread containing an open socket
   * @param {Number} total how many chunks to download
   * @param {Number} chunkSize size of single chunk in bytes
   * @param {Function} onsuccess expects one argument (String)
   */
  function downloadChunks(thread, total, chunkSize, onsuccess) {
    //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
    var socket = thread.socket;
    var remainingChunks = total;
    var expectBytes = _chunkSize * total;
    var totalRead = 0;
    var lastBuffer = null;

    // https://stackoverflow.com/questions/33702838/how-to-append-bytes-multi-bytes-and-buffer-to-arraybuffer-in-javascript
    var concatBuffer = function concatBuffer(a, b) {
      var c = new Uint8Array(a.length + b.length);
      c.set(a, 0);
      c.set(b, a.length);
      return c;
    };
    var downloadChunkListener = function downloadChunkListener(event) {
      if (typeof event.data === 'string') {
        return;
      }
      var fullChunk = false;
      if (lastBuffer === null) {
        lastBuffer = new Uint8Array(event.data);
      } else {
        lastBuffer = concatBuffer(lastBuffer, new Uint8Array(event.data));
      }

      //console.log("received chunk with " + line.length + " bytes");
      totalRead = totalRead + event.data.byteLength;
      if (lastBuffer.length === chunkSize) {
        remainingChunks--;
        fullChunk = true;
      }

      //zero junks remain - get time
      if (fullChunk && lastBuffer[lastBuffer.length - 1] === 0xFF) {
        //get info
        socket.onmessage = function (line) {
          var infomsg = line.data;
          onsuccess(infomsg);
        };
        socket.send("OK\n");
        _endArrayBuffers[chunkSize] = lastBuffer.buffer;
        lastBuffer = null;
      } else {
        if (!_arrayBuffers.hasOwnProperty(chunkSize)) {
          _arrayBuffers[chunkSize] = [];
        }
        if (fullChunk) {
          if (_arrayBuffers[chunkSize].length < _rmbtTestConfig.savedChunks) {
            _arrayBuffers[chunkSize].push(lastBuffer.buffer);
          }
          lastBuffer = null;
        }
      }
    };
    socket.onmessage = downloadChunkListener;
    _logger.debug(thread.id + ": downloading " + total + " chunks, " + expectBytes / 1000 + " KB");
    var send = "GETCHUNKS " + total + (chunkSize !== DEFAULT_CHUNK_SIZE ? " " + chunkSize : "") + "\n";
    socket.send(send);
  }
  function pingTest(thread) {
    var prevListener = thread.socket.onmessage;
    var pingsRemaining = _rmbtTestConfig.numPings;
    var startTime = performance.now();
    var _onsuccess = function onsuccess(pingResult) {
      thread.result.pings.push(pingResult);
      _rmbtTestResult.pings = _toConsumableArray(thread.result.pings);

      //use first two pings to do a better approximation of the remaining time
      if (pingsRemaining === _rmbtTestConfig.numPings - 1) {
        //PING -> PONG -> OK -> TIME -> ACCEPT ... -> PING -> ...
        _statesInfo.durationPingMs = (thread.result.pings[1].timeNs - thread.result.pings[0].timeNs) / 1e6 * _rmbtTestConfig.numPings;
        _logger.debug(thread.id + ": PING phase will take approx " + _statesInfo.durationPingMs + " ms");
      }
      _logger.debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");
      pingsRemaining--;

      //at least one, if we want to repeat ping for a certain interval
      if (_rmbtTestConfig.doPingIntervalMilliseconds > 0 && pingsRemaining === 0) {
        var currentTime = performance.now();
        if (currentTime - startTime < _rmbtTestConfig.doPingIntervalMilliseconds) {
          pingsRemaining = 1;
        }
      }
      if (pingsRemaining > 0) {
        //wait for new 'ACCEPT'-message
        thread.socket.onmessage = function (event) {
          if (event.data === "ACCEPT GETCHUNKS GETTIME PUT PUTNORESULT PING QUIT\n") {
            ping(thread, _onsuccess);
          } else {
            _logger.error("unexpected error during ping test");
          }
        };
      } else {
        //"break

        //median ping
        var tArrayClient = [];
        for (var i = 0; i < thread.result.pings.length; i++) {
          tArrayClient.push(thread.result.pings[i].client);
        }
        _rmbtTestResult.ping_client_median = Math.median(tArrayClient);
        _rmbtTestResult.ping_client_shortest = Math.min.apply(Math, tArrayClient);
        var tArrayServer = [];
        for (var _i = 0; _i < thread.result.pings.length; _i++) {
          tArrayServer.push(thread.result.pings[_i].server);
        }
        _rmbtTestResult.ping_server_median = Math.median(tArrayServer);
        _rmbtTestResult.ping_server_shortest = Math.min.apply(Math, tArrayServer);
        _logger.debug(thread.id + ": median client: " + Math.round(_rmbtTestResult.ping_client_median / 1e3) / 1e3 + " ms; " + "median server: " + Math.round(_rmbtTestResult.ping_server_median / 1e3) / 1e3 + " ms");
        _logger.debug(thread.id + ": shortest client: " + Math.round(_rmbtTestResult.ping_client_shortest / 1e3) / 1e3 + " ms; " + "shortest server: " + Math.round(_rmbtTestResult.ping_server_shortest / 1e3) / 1e3 + " ms");
        thread.socket.onmessage = prevListener;
      }
    };
    ping(thread, _onsuccess);
  }

  /**
   *
   * @param {RMBTTestThread} thread
   * @param {Function} onsuccess upon success
   */
  function ping(thread, onsuccess) {
    var begin;
    var clientDuration;
    var pingListener = function pingListener(event) {
      if (event.data === "PONG\n") {
        var end = nowNs();
        clientDuration = end - begin;
        thread.socket.send("OK\n");
      } else if (event.data.indexOf("TIME") === 0) {
        var result = new RMBTPingResult();
        result.client = clientDuration;
        result.server = parseInt(event.data.substring(5));
        result.timeNs = begin;
        onsuccess(result);
      }
    };
    thread.socket.onmessage = pingListener;
    begin = nowNs();
    thread.socket.send("PING\n");
  }

  /**
   *
   * @param {RMBTTestThread} thread
   * @param {Number} duration in seconds
   */
  function downloadTest(thread, duration) {
    var previousListener = thread.socket.onmessage;
    var totalRead = 0;
    var readChunks = 0;
    var lastReportedChunks = -1;
    var interval;
    var lastRead;
    var lastChunk = null;
    var lastTime = null;

    //read chunk only at some point in the future to save resources
    interval = setInterval(function () {
      if (lastChunk === null) {
        return;
      }

      //nothing new happened, do not simulate an accuracy that does not exist
      if (lastReportedChunks === readChunks) {
        return;
      }
      lastReportedChunks = readChunks;
      var now = nowNs();
      _logger.debug(thread.id + ": " + lastRead + "|" + _rmbtTestConfig.measurementPointsTimespan + "|" + now + "|" + readChunks);
      var lastByte = new Uint8Array(lastChunk, lastChunk.byteLength - 1, 1);

      //add result
      var duration = lastTime - start;
      thread.result.down.push({
        duration: duration,
        bytes: totalRead
      });

      //let now = nowNs();
      lastRead = now;
      if (lastByte[0] >= 0xFF) {
        _logger.debug(thread.id + ": received end chunk");
        clearInterval(interval);

        //last chunk received - get time
        thread.socket.onmessage = function (event) {
          //TIME
          _logger.debug(event.data);
          thread.socket.onmessage = previousListener;
        };
        thread.socket.send("OK\n");
      }
    }, _rmbtTestConfig.measurementPointsTimespan);
    var downloadListener = function downloadListener(event) {
      readChunks++;
      totalRead += event.data.byteLength; //arrayBuffer
      lastTime = nowNs();
      lastChunk = event.data;
    };
    thread.socket.onmessage = downloadListener;
    var start = nowNs();
    thread.socket.send("GETTIME " + duration + (_chunkSize !== DEFAULT_CHUNK_SIZE ? " " + _chunkSize : "") + "\n");
  }

  /**
  * conduct the short pretest to recognize if the connection
  * is too slow for multiple threads
  * @param {RMBTTestThread} thread
  * @param {Number} durationMs
  */
  function shortUploadtest(thread, durationMs) {
    var prevListener = thread.socket.onmessage;
    var startTime = nowMs(); //ms since page load
    var n = 1;
    var bytesSent = 0;
    var chunkSize = _chunkSize;
    setTimeout(function () {
      var endTime = nowMs();
      var duration = endTime - startTime;
      _logger.debug("diff:" + (duration - durationMs) + " (" + (duration - durationMs) / durationMs + " %)");
    }, durationMs);
    var _loop2 = function loop() {
      uploadChunks(thread, n, chunkSize, function (msg) {
        bytesSent += n * chunkSize;
        _logger.debug(thread.id + ": " + msg);
        var now = nowMs();
        if (now - startTime > durationMs) {
          //"break"
          thread.socket.onmessage = prevListener;
          var timeNs = parseInt(msg.substring(5)); //1e9

          //save circa result
          _bytesPerSecsPretest.push(n * chunkSize / (timeNs / 1e9));
        } else {
          //increase chunk size only if there are saved chunks for it!
          var newChunkSize = chunkSize * 2;
          if (n < 8 || !_endArrayBuffers.hasOwnProperty(newChunkSize) || !_changeChunkSizes) {
            n = n * 2;
            _loop2();
          } else {
            chunkSize = Math.min(chunkSize * 2, MAX_CHUNK_SIZE);
            _loop2();
          }
        }
      });
    };
    _loop2();
  }

  /**
   * Upload n Chunks to the test server
   * @param {RMBTTestThread} thread containing an open socket
   * @param {Number} total how many chunks to upload
   * @param {Number} chunkSize size of single chunk in bytes
   * @param {Function} onsuccess expects one argument (String)
   */
  function uploadChunks(thread, total, chunkSize, onsuccess) {
    //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
    var socket = thread.socket;
    socket.onmessage = function (event) {
      if (event.data.indexOf("OK") === 0) {
        //before we start the test
        return;
      } else if (event.data.indexOf("ACCEPT") === 0) {
        //status line after the test - ignore here for now
        return;
      } else {
        onsuccess(event.data); //TIME xxxx
      }
    };
    _logger.debug(thread.id + ": uploading " + total + " chunks, " + chunkSize * total / 1000 + " KB");
    socket.send("PUTNORESULT" + (_changeChunkSizes ? " " + chunkSize : "") + "\n"); //Put no result
    for (var i = 0; i < total; i++) {
      var blob = void 0;
      if (i === total - 1) {
        blob = _endArrayBuffers[chunkSize];
      } else {
        blob = _arrayBuffers[chunkSize][0];
      }
      socket.send(blob);
    }
  }

  /**
   *
   * @param {RMBTTestThread} thread
   * @param {Number} duration in seconds
   */
  function uploadTest(thread, duration) {
    var previousListener = thread.socket.onmessage;

    //if less than approx half a second is left in the buffer - resend!
    var fixedUnderrunBytesVisible = _totalBytesPerSecsPretest / 2 / _numUploadThreads;
    //if less than approx 1.5 seconds is left in the buffer - resend! (since browser limit setTimeout-intervals
    //  when pages are not in the foreground)
    var fixedUnderrunBytesHidden = _totalBytesPerSecsPretest * 1.5 / _numUploadThreads;
    var fixedUnderrunBytes = globalThis.document && globalThis.document.hidden ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;
    var visibilityChangeEventListener = function visibilityChangeEventListener() {
      fixedUnderrunBytes = globalThis.document && globalThis.document.hidden ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;
      globalThis.document && _logger.debug("document visibility changed to: " + globalThis.document.hidden);
    };
    globalThis.document && globalThis.document.addEventListener("visibilitychange", visibilityChangeEventListener);

    //send data for approx one second at once
    //@TODO adapt with changing connection speeds
    var sendAtOnceChunks = Math.ceil(_totalBytesPerSecsPretest / _numUploadThreads / _chunkSize);
    var receivedEndTime = false;
    var keepSendingData = true;
    var lastDurationInfo = -1;
    var timeoutExtensionsMs = 0;
    var _timeoutFunction = function timeoutFunction() {
      if (!receivedEndTime) {
        //check how far we are in
        _logger.debug(thread.id + ": is 7.2 sec in, got data for " + lastDurationInfo);
        //if measurements are for < 7sec, give it time
        if (lastDurationInfo < duration * 1e9 && timeoutExtensionsMs < 3000) {
          setTimeout(_timeoutFunction, 250);
          timeoutExtensionsMs += 250;
        } else {
          //kill it with force!
          _logger.debug(thread.id + ": didn't finish, timeout extended by " + timeoutExtensionsMs + " ms, last info for " + lastDurationInfo);
          thread.socket.onerror = function () {};
          thread.socket.onclose = function () {};

          //do nothing, we kill it on purpose
          thread.socket.close();
          thread.socket.onmessage = previousListener;
          _logger.debug(thread.id + ": socket now closed: " + thread.socket.readyState);
          globalThis.document && document.removeEventListener("visibilitychange", visibilityChangeEventListener);
          thread.triggerNextState();
        }
      }
    };

    /**
     * The upload function for a few chunks at a time, encoded as a callback instead of a loop.
     * https://github.com/ndt-project/ndt/blob/master/HTML5-frontend/ndt-browser-client.js
     */
    var _sendChunks = function sendChunks() {
      // Monitor the buffersize as it sends and refill if it gets too low.
      if (thread.socket.bufferedAmount < fixedUnderrunBytes) {
        //logger.debug(thread.id + ": buffer underrun");
        for (var i = 0; i < sendAtOnceChunks; i++) {
          thread.socket.send(_arrayBuffers[_chunkSize][i % _arrayBuffers[_chunkSize].length]);
        }
      } else {
        //logger.debug(thread.id + ": no buffer underrun");
      }
      if (keepSendingData) {
        setTimeout(_sendChunks, 0);
      } else {
        return false;
      }
    };

    //set timeout function after 7,2s to check if everything went according to plan
    setTimeout(_timeoutFunction, duration * 1e3 + 200);

    //send end blob after 7s, quit
    setTimeout(function () {
      keepSendingData = false;
      thread.socket.onclose = function () {};
      thread.socket.send(_endArrayBuffers[_chunkSize]);
      thread.socket.send("QUIT\n");
    }, duration * 1e3);
    _logger.debug(thread.id + ": set timeout");

    // ms -> ns
    var timespan = _rmbtTestConfig.measurementPointsTimespan * 1e6;
    var pattern = /TIME (\d+) BYTES (\d+)/;
    var patternEnd = /TIME (\d+)/;
    var uploadListener = function uploadListener(event) {
      //start conducting the test
      if (event.data === "OK\n") {
        _sendChunks();
      }

      //intermediate result - save it!
      //TIME 6978414829 BYTES 5738496
      //logger.debug(thread.id + ": rec: " + event.data);
      var matches = pattern.exec(event.data);
      if (matches !== null) {
        var data = {
          duration: parseInt(matches[1]),
          bytes: parseInt(matches[2])
        };
        if (data.duration - lastDurationInfo > timespan) {
          lastDurationInfo = data.duration;
          //debug(thread.id + ": " + JSON.stringify(data));
          thread.result.up.push(data);
        }
      } else {
        matches = patternEnd.exec(event.data);
        if (matches !== null) {
          //statistic for end match - upload phase complete
          receivedEndTime = true;
          _logger.debug("Upload duration: " + matches[1]);
          thread.socket.onmessage = previousListener;
          globalThis.document && document.removeEventListener("visibilitychange", visibilityChangeEventListener);
        }
      }
    };
    thread.socket.onmessage = uploadListener;
    thread.socket.send("PUT" + (_chunkSize !== DEFAULT_CHUNK_SIZE ? " " + _chunkSize : "") + "\n");
  }

  /**
   * Gather test result and prepare data to be sent to server
   *
   * @param {RMBTControlServerRegistrationResponse} registrationResponse
   * @return {Object} Test result to send to server
   */
  function prepareResult(registrationResponse) {
    return {
      client_language: "de",
      client_name: _rmbtTestConfig.client,
      client_uuid: _rmbtTestConfig.uuid,
      client_version: _rmbtTestConfig.client_version,
      client_software_version: _rmbtTestConfig.client_software_version,
      geoLocations: _rmbtTestResult.geoLocations,
      model: _rmbtTestConfig.model,
      network_type: 98,
      platform: _rmbtTestConfig.platform,
      product: _rmbtTestConfig.product,
      pings: _rmbtTestResult.pings,
      test_bytes_download: _rmbtTestResult.bytes_download,
      test_bytes_upload: _rmbtTestResult.bytes_upload,
      test_nsec_download: _rmbtTestResult.nsec_download,
      test_nsec_upload: _rmbtTestResult.nsec_upload,
      test_num_threads: _numDownloadThreads,
      num_threads_ul: _numUploadThreads,
      test_ping_shortest: _rmbtTestResult.ping_server_shortest,
      test_speed_download: _rmbtTestResult.speed_download,
      test_speed_upload: _rmbtTestResult.speed_upload,
      test_token: registrationResponse.test_token,
      test_uuid: registrationResponse.test_uuid,
      time: _rmbtTestResult.beginTime,
      timezone: _rmbtTestConfig.timezone,
      type: "DESKTOP",
      version_code: "1",
      speed_detail: _rmbtTestResult.speedItems,
      user_server_selection: _rmbtTestConfig.userServerSelection
    };
  }

  /**
   * Gets the current state of the test
   * @returns {String} enum [INIT, PING]
   */
  this.getState = function () {
    return "INIT";
  };
  construct(rmbtTestConfig, rmbtControlServer);
}
;
"use strict";
var curGeoPos;
var geo_callback, loc_timeout;
function runCallback() {
  if (geo_callback != undefined && typeof geo_callback === 'function') {
    setTimeout(function () {
      geo_callback();
    }, 1);
  }
}
function getCurLocation() {
  return curGeoPos;
}

/**
 * GetLocation, JSDoc from old Test
 * @param {Boolean} geoAccuracy enable high accuracy (i.e. GPS instead of AP)
 * @param {Numeric} geoTimeout maximal timeout before error function is called
 * @param {Numeric} geoMaxAge maximal allowed age in milliseconds
 * @param {Function} callback
 */
function getLocation(geoAccuracy, geoTimeout, geoMaxAge, callback) {
  var ausgabe = globalThis.document && globalThis.document.getElementById("infogeo");
  geo_callback = callback;
  if (!navigator.geolocation) {
    //maybe there is a position in a cookie
    //because the user had been asked for his address
    var coords = getCookie('coords');
    if (coords) {
      var tmpcoords = JSON.parse(coords);
      if (tmpcoords && tmpcoords['lat'] > 0 && tmpcoords['long'] > 0) {
        testVisualization.setLocation(tmpcoords['lat'], tmpcoords['long']);
      }
    } else if (ausgabe) {
      ausgabe.innerHTML = Lang.getString('NotSupported');
    }
    runCallback();
    return;
  }
  runCallback();
  //var TestEnvironment.getGeoTracker() = new GeoTracker();
  TestEnvironment.getGeoTracker().start(function (successful, error) {
    if (successful !== true && ausgabe) {
      //user did not allow geolocation or other reason
      if (error) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            ausgabe.innerHTML = Lang.getString('NoPermission');
            break;
          case error.TIMEOUT:
            //@TODO: Position is determined...
            //alert(1);
            break;
          case error.POSITION_UNAVAILABLE:
            ausgabe.innerHTML = Lang.getString('NotAvailable');
            break;
          case error.UNKNOWN_ERROR:
            ausgabe.innerHTML = Lang.getString('NotAvailable') + "(" + error.code + ")";
            break;
        }
      } else {
        //Internet Explorer 11 in some cases does not return an error code
        ausgabe.innerHTML = Lang.getString('NotAvailable');
      }
    }
  }, TestEnvironment.getTestVisualization());
}

//Geolocation tracking
var GeoTracker = function () {
  "use strict";

  var _errorTimeout = 2e3; //2 seconds error timeout
  var _maxAge = 60e3; //up to one minute old - don't do geoposition again

  var _positions;
  var _clientCallback;
  var _testVisualization = null;
  var _watcher;
  var _firstPositionIsInAccurate;
  function GeoTracker() {
    _positions = [];
    _firstPositionIsInAccurate = false;
  }

  /**
   * Start geolocating
   * @param {Function(Boolean)} callback expects param 'successful' (boolean, ErrorReason) and
   *      is called as soon as there is a result available or the user cancelled
   * @param {TestVisualization} testVisualization optional
   */
  GeoTracker.prototype.start = function (callback, testVisualization) {
    _clientCallback = callback;
    if (testVisualization !== undefined) {
      _testVisualization = testVisualization;
    }
    if (navigator.geolocation) {
      //try to get an rough first position
      navigator.geolocation.getCurrentPosition(function (success) {
        if (_positions.length === 0) {
          _firstPositionIsInAccurate = true;
          successFunction(success);
        }
      }, errorFunction, {
        enableHighAccuracy: false,
        timeout: _errorTimeout,
        //2 seconds
        maximumAge: _maxAge //one minute
      });
      //and refine this position later
      _watcher = navigator.geolocation.watchPosition(successFunction, errorFunction, {
        enableHighAccuracy: true,
        timeout: Infinity,
        maximumAge: 0 //one minute
      });
    } else {
      var t = _clientCallback;
      _clientCallback = null;
      t(false);
    }

    //Microsoft Edge does not adhere to the standard, and does not call the error
    //function after the specified callback, so we have to call it manually
    setTimeout(function () {
      errorFunction();
    }, _errorTimeout);
  };

  /**
   * Saves the given result
   * Is called when a geolocation query returns a result
   * @param {Position} position the result https://developer.mozilla.org/en-US/docs/Web/API/Position
   */
  var successFunction = function successFunction(position) {
    //rough first position and now more accurate one -> remove the inaccurate one
    if (_positions.length === 1 && _firstPositionIsInAccurate) {
      _positions = [];
      _firstPositionIsInAccurate = false;
    }
    _positions.push({
      geo_lat: position.coords.latitude,
      geo_long: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      bearing: position.coords.heading,
      speed: position.coords.speed,
      tstamp: position.timestamp,
      provider: 'Browser'
    });
    if (_clientCallback !== null) {
      //call client that we now have a result
      var t = _clientCallback;
      _clientCallback = null;
      t(true);
    }
    if (_testVisualization !== null) {
      _testVisualization.setLocation(position.coords.latitude, position.coords.longitude);
    }
    updateCookie(position);
  };
  var errorFunction = function errorFunction(reason) {
    //PositionError Object (https://developer.mozilla.org/en-US/docs/Web/API/PositionError)
    if (_clientCallback !== null) {
      //call client that we now have an error
      var t = _clientCallback;
      _clientCallback = null;
      t(false, reason);
    }
  };
  var updateCookie = function updateCookie(position) {
    var coords = {};
    coords['lat'] = position.coords.latitude;
    coords['long'] = position.coords.longitude;
    coords['accuracy'] = position.coords.accuracy;
    coords['altitude'] = position.coords.altitude;
    coords['heading'] = position.coords.heading;
    coords['speed'] = position.coords.speed;
    coords['tstamp'] = position.timestamp;
    //console.log("coords: "+coords);
    coords = JSON.stringify(coords);
    //console.log("tmpcoords: "+tmpcoords);
    setCookie('coords', coords, 3600);
  };
  GeoTracker.prototype.stop = function () {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(_watcher);
    }
  };

  /**
   *
   * @returns {Array} all results
   */
  GeoTracker.prototype.getResults = function () {
    //filter duplicate results that can occur when using hardware GPS devices
    //with certain Browsers
    var previousItem = null;
    _positions = _positions.filter(function (position) {
      if (previousItem == null) {
        previousItem = position;
        return true;
      }
      var equal = Object.keys(position).every(function (key) {
        return previousItem.hasOwnProperty(key) && previousItem[key] === position[key];
      });
      if (equal) {
        //remove this item
        return false;
      } else {
        previousItem = position;
        return true;
      }
    });
    return _positions;
  };
  return GeoTracker;
}();

/* getCookie polyfill */
if (typeof globalThis.setCookie === 'undefined' && globalThis.document) {
  globalThis.setCookie = function (cookie_name, cookie_value, cookie_exseconds) {
    //var exdate = new Date();
    //exdate.setDate(exdate.getDate() + cookie_exdays);

    var futuredate = new Date();
    var expdate = futuredate.getTime();
    expdate += cookie_exseconds * 1000;
    futuredate.setTime(expdate);

    //var c_value=escape(cookie_value) + ((cookie_exdays==null) ? ";" : "; expires="+exdate.toUTCString() +";");
    var c_value = encodeURIComponent(cookie_value) + (cookie_exseconds == null ? ";" : "; expires=" + futuredate.toUTCString() + ";");
    document.cookie = cookie_name + "=" + c_value + " path=/;";
  };
}

/**
 * Handles the communication with the ControlServer
 * @param rmbtTestConfig RMBT Test Configuratio
 * @param options additional options:
 *  'register': Function to be called after registration: function(event)
 *  'submit':  Function to be called after result submission: function(event)
 * @returns Object
 */
var RMBTControlServerCommunication = function RMBTControlServerCommunication(rmbtTestConfig, options) {
  var _rmbtTestConfig = rmbtTestConfig;
  var _logger = log.getLogger("rmbtws");
  options = options || {};
  var _registrationCallback = options.register || null;
  var _submissionCallback = options.submit || null;
  var headers = options.headers || {
    'Content-Type': 'application/json'
  };
  return {
    /**
     *
     * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
     */
    obtainControlServerRegistration: function obtainControlServerRegistration(onsuccess, onerror) {
      var json_data = {
        version: _rmbtTestConfig.version,
        language: _rmbtTestConfig.language,
        uuid: _rmbtTestConfig.uuid,
        type: _rmbtTestConfig.type,
        version_code: _rmbtTestConfig.version_code,
        client: _rmbtTestConfig.client,
        timezone: _rmbtTestConfig.timezone,
        time: new Date().getTime()
      };

      //add additional parameters from the configuration, if any
      Object.assign(json_data, _rmbtTestConfig.additionalRegistrationParameters);
      if (typeof userServerSelection !== "undefined" && userServerSelection > 0 && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
        json_data['prefer_server'] = UserConf.preferredServer;
        json_data['user_server_selection'] = userServerSelection;
      }
      var response;
      fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(json_data)
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        response = data;
        var config = new RMBTControlServerRegistrationResponse(data);
        onsuccess(config);
      })["catch"](function (reason) {
        response = reason;
        _logger.error("error getting testID");
        onerror();
      })["finally"](function () {
        if (_registrationCallback != null && typeof _registrationCallback === 'function') {
          _registrationCallback({
            response: response,
            request: json_data
          });
        }
      });
    },
    /**
     * get "data collector" metadata (like browser family) and update config
     *
     */
    getDataCollectorInfo: function getDataCollectorInfo() {
      fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerDataCollectorResource, {
        method: 'GET',
        headers: headers
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        _rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
        _rmbtTestConfig.model = data.product;
        _rmbtTestConfig.os_version = data.version;
      })["catch"](function () {
        _logger.error("error getting data collection response");
      });
    },
    /**
     *  Post test result
     *
     * @param {Object}  json_data Data to be sent to server
     * @param {Function} callback
     */
    submitResults: function submitResults(json_data, onsuccess, onerror) {
      //add additional parameters from the configuration, if any
      Object.assign(json_data, _rmbtTestConfig.additionalSubmissionParameters);
      var json = JSON.stringify(json_data);
      _logger.debug("Submit size: " + json.length);
      var response;
      fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource, {
        method: 'POST',
        headers: headers,
        body: json
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        response = data;
        _logger.debug(json_data.test_uuid);
        onsuccess(true);
      })["catch"](function (reason) {
        response = reason;
        _logger.error("error submitting results");
        onerror(false);
      })["finally"](function () {
        if (_submissionCallback !== null && typeof _submissionCallback === 'function') {
          _submissionCallback({
            response: response,
            request: json_data
          });
        }
      });
    }
  };
};
"use strict";
var TestEnvironment = function () {
  var testVisualization = null;
  var geoTracker = null;
  return {
    /**
     * gets the TestVisualization or null
     * @returns {TestVisualization}
     */
    getTestVisualization: function getTestVisualization() {
      return testVisualization;
    },
    /**
     * gets the GeoTracker or null
     * @returns {GeoTracker}
     */
    getGeoTracker: function getGeoTracker() {
      return geoTracker;
    },
    init: function init(tVisualization, gTracker) {
      if (typeof tVisualization === 'undefined') {
        tVisualization = new TestVisualization();
      }
      if (typeof gTracker === 'undefined') {
        gTracker = new GeoTracker();
      }
      testVisualization = tVisualization;
      geoTracker = gTracker;
    }
  };
}();

//States
var TestState = {
  WAIT: "WAIT",
  INIT: "INIT",
  INIT_DOWN: "INIT_DOWN",
  PING: "PING",
  DOWN: "DOWN",
  CONNECT_UPLOAD: "CONNECT_UPLOAD",
  INIT_UP: "INIT_UP",
  UP: "UP",
  END: "END",
  ERROR: "ERROR",
  ABORTED: "ABORTED",
  LOCATE: "LOCATE",
  LOCABORTED: "LOCABORTED",
  SPEEDTEST_END: "SPEEDTEST_END",
  QOS_TEST_RUNNING: "QOS_TEST_RUNNING",
  QOS_END: "QOS_END"
};

//Intermediate Result
function RMBTIntermediateResult() {}
RMBTIntermediateResult.prototype.setLogValues = function () {
  var toLog = function toLog(value) {
    if (value < 10000) {
      return 0;
    }
    return (2.0 + Math.log(value / 1e6 / Math.LN10)) / 4.0;
  };
  this.downBitPerSecLog = toLog(downBitPerSec);
  this.upBitPerSecLog = toLog(upBitPerSec);
};
RMBTIntermediateResult.prototype.pingNano = -1;
RMBTIntermediateResult.prototype.downBitPerSec = -1;
RMBTIntermediateResult.prototype.upBitPerSec = -1;
RMBTIntermediateResult.prototype.status = TestState.INIT;
RMBTIntermediateResult.prototype.progress = 0;
RMBTIntermediateResult.prototype.downBitPerSecLog = -1;
RMBTIntermediateResult.prototype.upBitPerSecLog = -1;
RMBTIntermediateResult.prototype.remainingWait = -1;
"use strict";

/**
 * About TestVisualization:
 *  setRMBTTest expects a object that implements {RMBTIntermediateResult}.getIntermediateResult()
 *      this will be called every xx ms (pull)
 *  The Animation loop will start as soon as "startTest()" is called
 *  The status can be set directly via setStatus or in the intermediateResult
 *  Information (provider, ip, uuid, etc.) has to be set via updateInformation
 *  As soon as the test reaches the "End"-State, the result page is called
 */
var TestVisualization = function () {
  function TestVisualization(successCallback, errorCallback) {
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
  }

  /**
   * Sets the RMBT Test object
   * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
   */
  TestVisualization.prototype.setRMBTTest = function (rmbtTest) {};

  /**
   * Will be called from Websockettest as soon as this information is available
   * @param serverName
   * @param remoteIp
   * @param providerName
   * @param testUUID
   */
  TestVisualization.prototype.updateInfo = function (serverName, remoteIp, providerName, testUUID, openTestUUID) {};

  /**
   * Will be called from Websockettest as soon as the current status changes
   * @param status
   */
  TestVisualization.prototype.setStatus = function (status) {
    if (status === "ERROR" || status === "ABORTED") {
      if (this.errorCallback) {
        var t = this.errorCallback;
        this.errorCallback = null;
        t();
      }
    } else if (status === "END") {
      // call callback that the test is finished
      if (_successCallback !== null) {
        var t = this.successCallback;
        this.successCallback = null;
        t();
      }
    }
  };

  /**
   * Will be called from GeoTracker as soon as a location is available
   * @param latitude
   * @param longitude
   */
  TestVisualization.prototype.setLocation = function (latitude, longitude) {};

  /**
   * Starts visualization
   */
  TestVisualization.prototype.startTest = function () {};
  return TestVisualization;
}();
"use strict";
var RMBTTestConfig = function () {
  RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
  RMBTTestConfig.prototype.language;
  RMBTTestConfig.prototype.uuid = "";
  RMBTTestConfig.prototype.type = "DESKTOP";
  RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
  RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
  RMBTTestConfig.prototype.client_software_version = "0.9.5";
  RMBTTestConfig.prototype.os_version = 1;
  RMBTTestConfig.prototype.platform = "RMBTws";
  RMBTTestConfig.prototype.model = "Websocket";
  RMBTTestConfig.prototype.product = "Chrome";
  RMBTTestConfig.prototype.client = "RMBTws";
  RMBTTestConfig.prototype.timezone = "Europe/Vienna";
  RMBTTestConfig.prototype.controlServerURL;
  RMBTTestConfig.prototype.controlServerRegistrationResource = "/testRequest";
  RMBTTestConfig.prototype.controlServerResultResource = "/result";
  RMBTTestConfig.prototype.controlServerDataCollectorResource = "/requestDataCollector";
  //?!? - from RMBTTestParameter.java
  RMBTTestConfig.prototype.pretestDurationMs = 2000;
  RMBTTestConfig.prototype.savedChunks = 4; //4*4 + 4*8 + 4*16 + ... + 4*MAX_CHUNK_SIZE -> O(8*MAX_CHUNK_SIZE)
  RMBTTestConfig.prototype.measurementPointsTimespan = 40; //1 measure point every 40 ms
  RMBTTestConfig.prototype.numPings = 10; //do 10 pings
  RMBTTestConfig.prototype.doPingIntervalMilliseconds = -1; //if enabled, ping tests will be conducted until the time limit is reached (min numPings)
  //max used threads for this test phase (upper limit: RegistrationResponse)
  RMBTTestConfig.prototype.downloadThreadsLimitsMbit = {
    0: 1,
    1: 3,
    100: 5
  };
  RMBTTestConfig.prototype.uploadThreadsLimitsMbit = {
    0: 1,
    30: 2,
    80: 3,
    150: 5
  };
  RMBTTestConfig.prototype.userServerSelection = typeof globalThis.userServerSelection !== 'undefined' ? userServerSelection : 0; //for QoSTest
  RMBTTestConfig.prototype.additionalRegistrationParameters = {}; //will be transmitted in ControlServer registration, if any
  RMBTTestConfig.prototype.additionalSubmissionParameters = {}; //will be transmitted in ControlServer result submission, if any

  function RMBTTestConfig(language, controlProxy, wsPath) {
    this.language = language;
    this.controlServerURL = controlProxy + "/" + wsPath;
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) {
      //we are based in Vienna :-)
      this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace("Europe/Berlin", "Europe/Vienna");
    }
  }
  return RMBTTestConfig;
}();
var RMBTControlServerRegistrationResponse = function () {
  RMBTControlServerRegistrationResponse.prototype.client_remote_ip;
  RMBTControlServerRegistrationResponse.prototype.provider;
  RMBTControlServerRegistrationResponse.prototype.test_server_encryption = "";
  RMBTControlServerRegistrationResponse.prototype.test_numthreads;
  RMBTControlServerRegistrationResponse.prototype.test_server_name;
  RMBTControlServerRegistrationResponse.prototype.test_uuid;
  RMBTControlServerRegistrationResponse.prototype.test_id;
  RMBTControlServerRegistrationResponse.prototype.test_token;
  RMBTControlServerRegistrationResponse.prototype.test_server_address;
  RMBTControlServerRegistrationResponse.prototype.test_duration;
  RMBTControlServerRegistrationResponse.prototype.result_url;
  RMBTControlServerRegistrationResponse.prototype.test_wait;
  RMBTControlServerRegistrationResponse.prototype.test_server_port;
  //test
  function RMBTControlServerRegistrationResponse(data) {
    Object.assign(this, data);
    this.test_duration = parseInt(data.test_duration);
  }
  return RMBTControlServerRegistrationResponse;
}();

/**
 * Control structure for a single websocket-test thread
 * @param {CyclicBarrier} cyclicBarrier
 * @returns {RMBTTestThread}
 */
function RMBTTestThread(cyclicBarrier) {
  var _logger = log.getLogger("rmbtws");
  var _callbacks = {};
  var _cyclicBarrier = cyclicBarrier;
  return {
    /**
     * Sets the state of the thread; triggers state transition callbacks
     * if there are any as soon as all threads in the cyclicbarrier reached
     * the state
     * @param {TestState} state
     */
    setState: function setState(state) {
      this.state = state;
      _logger.debug(this.id + ": reached state: " + state);
      var that = this;
      _cyclicBarrier["await"](function () {
        _logger.debug(that.id + ": all threads reached state: " + state);
        if (_callbacks[state] !== undefined && _callbacks[state] !== null) {
          var callback = _callbacks[state];
          //_callbacks[state] = null;
          callback();
        } else {
          _logger.info(that.id + ": no callback registered for state: " + state);
        }
      });
    },
    /**
     * Links a callback function to the state change
     * @param {TestState} state
     * @param {Function} callback the function that is called on state enter
     */
    onStateEnter: function onStateEnter(state, callback) {
      _callbacks[state] = callback;
    },
    retriggerState: function retriggerState() {
      //trigger state again since we received an 'ERROR'-Message
      setState(this.state);
    },
    /**
     * Triggers the next state in the thread
     */
    triggerNextState: function triggerNextState() {
      var states = [TestState.INIT, TestState.INIT_DOWN, TestState.PING, TestState.DOWN, TestState.CONNECT_UPLOAD, TestState.INIT_UP, TestState.UP, TestState.END];
      if (this.state !== TestState.END) {
        var nextState = states[states.indexOf(this.state) + 1];
        _logger.debug(this.id + ": triggered state " + nextState);
        this.setState(nextState);
      }
    },
    id: -1,
    socket: null,
    result: new RMBTThreadTestResult()
  };
}
function RMBTTestResult() {
  this.pings = [];
  this.speedItems = [];
  this.threads = [];
}
RMBTTestResult.prototype.addThread = function (rmbtThreadTestResult) {
  this.threads.push(rmbtThreadTestResult);
};
RMBTTestResult.prototype.ip_local = null;
RMBTTestResult.prototype.ip_server = null;
RMBTTestResult.prototype.port_remote = null;
RMBTTestResult.prototype.num_threads = null;
RMBTTestResult.prototype.encryption = "NONE";
RMBTTestResult.prototype.ping_shortest = -1;
RMBTTestResult.prototype.ping_median = -1;
RMBTTestResult.prototype.client_version = null;
RMBTTestResult.prototype.pings = [];
RMBTTestResult.prototype.speed_download = -1;
RMBTTestResult.prototype.speed_upload = -1;
RMBTTestResult.prototype.speedItems = [];
RMBTTestResult.prototype.bytes_download = -1;
RMBTTestResult.prototype.nsec_download = -1;
RMBTTestResult.prototype.bytes_upload = -1;
RMBTTestResult.prototype.nsec_upload = -1;
RMBTTestResult.prototype.totalDownBytes = -1;
RMBTTestResult.prototype.totalUpBytes = -1;
RMBTTestResult.prototype.beginTime = -1;
RMBTTestResult.prototype.geoLocations = [];
RMBTTestResult.calculateOverallSpeedFromMultipleThreads = function (threads, phaseResults) {
  //TotalTestResult.java:118 (Commit 7d5519ce6ad9121896866d4d8f30299c7c19910d)
  var numThreads = threads.length;
  var targetTime = Infinity;
  for (var i = 0; i < numThreads; i++) {
    var nsecs = phaseResults(threads[i]);
    if (nsecs.length > 0) {
      if (nsecs[nsecs.length - 1].duration < targetTime) {
        targetTime = nsecs[nsecs.length - 1].duration;
      }
    }
  }
  var totalBytes = 0;
  for (var _i2 = 0; _i2 < numThreads; _i2++) {
    var thread = threads[_i2];
    var phasedThread = phaseResults(thread);
    var phasedLength = phasedThread.length;
    if (thread !== null && phasedLength > 0) {
      var targetIdx = phasedLength;
      for (var j = 0; j < phasedLength; j++) {
        if (phasedThread[j].duration >= targetTime) {
          targetIdx = j;
          break;
        }
      }
      var calcBytes = void 0;
      if (phasedThread[targetIdx].duration === targetTime) {
        // nsec[max] == targetTime
        calcBytes = phasedThread[phasedLength - 1].bytes;
      } else {
        var bytes1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].bytes;
        var bytes2 = phasedThread[targetIdx].bytes;
        var bytesDiff = bytes2 - bytes1;
        var nsec1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].duration;
        var nsec2 = phasedThread[targetIdx].duration;
        var nsecDiff = nsec2 - nsec1;
        var nsecCompensation = targetTime - nsec1;
        var factor = nsecCompensation / nsecDiff;
        var compensation = Math.round(bytesDiff * factor);
        if (compensation < 0) {
          compensation = 0;
        }
        calcBytes = bytes1 + compensation;
      }
      totalBytes += calcBytes;
    }
  }
  return {
    bytes: totalBytes,
    nsec: targetTime,
    speed: totalBytes * 8 / (targetTime / 1e9)
  };
};
RMBTTestResult.prototype.calculateAll = function () {
  //speed items down
  for (var i = 0; i < this.threads.length; i++) {
    var down = this.threads[i].down;
    if (down.length > 0) {
      for (var j = 0; j < down.length; j++) {
        this.speedItems.push({
          direction: "download",
          thread: i,
          time: down[j].duration,
          bytes: down[j].bytes
        });
      }
    }
  }
  var total = 0;
  var targetTime = Infinity;

  //down
  var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
    return thread.down;
  });
  this.speed_download = results.speed / 1e3; //bps -> kbps
  this.bytes_download = results.bytes;
  this.nsec_download = results.nsec;

  //speed items up
  for (var _i3 = 0; _i3 < this.threads.length; _i3++) {
    var up = this.threads[_i3].up;
    if (up.length > 0) {
      for (var _j = 0; _j < up.length; _j++) {
        this.speedItems.push({
          direction: "upload",
          thread: _i3,
          time: up[_j].duration,
          bytes: up[_j].bytes
        });
      }
    }
  }

  //up
  results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
    return thread.up;
  });
  this.speed_upload = results.speed / 1e3; //bps -> kbps
  this.bytes_upload = results.bytes;
  this.nsec_upload = results.nsec;

  //ping
  var pings = this.threads[0].pings;
  var pingsResult = [];
  for (var _i4 = 0; _i4 < pings.length; _i4++) {
    pingsResult.push({
      value: pings[_i4].client,
      value_server: pings[_i4].server,
      time_ns: pings[_i4].timeNs
    });
  }
  this.pings = pingsResult;

  //add time_ns to geoLocations
  for (var _i5 = 0; _i5 < this.geoLocations.length; _i5++) {
    var geoLocation = this.geoLocations[_i5];
    geoLocation['time_ns'] = (geoLocation.tstamp - this.beginTime) * 1e6;
  }
};
function RMBTThreadTestResult() {
  this.down = []; //map of bytes/nsec
  this.up = [];
  this.pings = [];
}
//no inheritance(other than in Java RMBTClient)
//RMBTThreadTestResult.prototype = new RMBTTestResult();
RMBTThreadTestResult.prototype.down = null;
RMBTThreadTestResult.prototype.up = null;
RMBTThreadTestResult.prototype.pings = null;
RMBTThreadTestResult.prototype.totalDownBytes = -1;
RMBTThreadTestResult.prototype.totalUpBytes = -1;
function RMBTPingResult() {}
RMBTPingResult.prototype.client = -1;
RMBTPingResult.prototype.server = -1;
RMBTPingResult.prototype.timeNs = -1;

/**
 * @callback RMBTControlServerRegistrationResponseCallback
 * @param {RMBTControlServerRegistrationResponse} json
 */
var RMBTError = {
  NOT_SUPPORTED: "WebSockets are not supported",
  SOCKET_INIT_FAILED: "WebSocket initialization failed",
  CONNECT_FAILED: "connection to test server failed",
  SUBMIT_FAILED: "Error during submission of test results",
  REGISTRATION_FAILED: "Error during test registration"
};
"use strict";

//polyfill for microsecond-time
//https://gist.github.com/paulirish/5438650
(function () {
  if (!Date.now) {
    Date.now = function () {
      return new Date().getTime();
    };
  }

  // prepare base perf object
  if (typeof performance === 'undefined') {
    performance = {};
  }
  if (!performance.now || performance.now === undefined) {
    var nowOffset = Date.now();
    if (performance.timing && performance.timing.navigationStart) {
      nowOffset = performance.timing.navigationStart;
    }
    performance.now = function now() {
      return Date.now() - nowOffset;
    };
  }
})();
function nowMs() {
  return performance.now();
}
function nowNs() {
  return Math.round(performance.now() * 1e6); //from ms to ns
}

/**
 * Creates a new cyclic barrier
 * @param {number} parties the number of threads that must invoke await()
 *      before the barrier is tripped
 * @see http://docs.oracle.com/javase/7/docs/api/java/util/concurrent/CyclicBarrier.html
 */
function CyclicBarrier(parties) {
  "use strict";

  var _parties = parties;
  var _callbacks = [];
  var release = function release() {
    //first, copy and clear callbacks
    //to prohibit that a callback registers before all others are released
    var tmp = _callbacks.slice();
    _callbacks = [];
    self.setTimeout(function () {
      for (var i = 0; i < _parties; i++) {
        //prevent side effects in last function that called "await"
        tmp[i]();
      }
    }, 1);
  };
  return {
    /**
     * Waits until all parties have invoked await on this barrier
     * The current context is disabled in any case.
     *
     * As soon as all threads have called 'await', all callbacks will
     * be executed
     * @param {Function} callback
     */
    "await": function _await(callback) {
      _callbacks.push(callback);
      if (_callbacks.length === _parties) {
        release();
      }
    }
  };
}
;

/**
 * Finds the median number in the given array
 * http://caseyjustus.com/finding-the-median-of-an-array-with-javascript
 * @param {Array} values
 * @returns {Number} the median
 */
Math.median = function (values) {
  values.sort(function (a, b) {
    return a - b;
  });
  var half = Math.floor(values.length / 2);
  if (values.length % 2) {
    return values[half];
  } else {
    return (values[half - 1] + values[half]) / 2.0;
  }
};

// Polyfill log10 for internet explorer
// https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Math/log10#Polyfill
Math.log10 = Math.log10 || function (x) {
  return Math.log(x) / Math.LN10;
};
var Log = /*#__PURE__*/function () {
  function Log() {
    _classCallCheck(this, Log);
  }
  return _createClass(Log, [{
    key: "debug",
    value: function debug() {
      var _console;
      (_console = console).log.apply(_console, arguments);
    }
  }, {
    key: "trace",
    value: function trace() {
      console.trace();
    }
  }, {
    key: "info",
    value: function info() {
      var _console2;
      (_console2 = console).info.apply(_console2, arguments);
    }
  }, {
    key: "warn",
    value: function warn() {
      var _console3;
      (_console3 = console).warn.apply(_console3, arguments);
    }
  }, {
    key: "error",
    value: function error() {
      var _console4;
      (_console4 = console).error.apply(_console4, arguments);
    }
  }, {
    key: "disable",
    value: function disable() {
      this.debug = function () {};
      this.trace = function () {};
      this.info = function () {};
      this.warn = function () {};
    }
  }, {
    key: "setLevel",
    value: function setLevel() {}
  }, {
    key: "getLogger",
    value: function getLogger() {
      return this;
    }
  }]);
}();
self.log = self.log || new Log();
var log = self.log;

//Polyfill
if (typeof Object.assign != 'function') {
  Object.assign = function (target, varArgs) {
    // .length of function is 2
    'use strict';

    if (target == null) {
      // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }
    var to = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];
      if (nextSource != null) {
        // Skip over if undefined or null
        for (var nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

//"hidden" polyfill (in this case: always visible)
if (globalThis.document && typeof document.hidden === "undefined") {
  document.hidden = false;
}

