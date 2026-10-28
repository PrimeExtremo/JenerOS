// Small runtime for the JenerOS Glass design files. It understands the subset the
// designs use: {{path}} values, <sc-for>, <sc-if>, <dc-import> and on* handlers.
// Elements made by different <sc-if> branches never patch into each other, so a
// newly shown branch remounts and its entrance animation plays.
// Templates are parsed inert in <template>; handlers are set as properties, so
// nothing inline ever runs and the box's CSP stays strict.
(() => {
  'use strict';
  const defs = {};
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      if (typeof patch === 'function') patch = patch(this.state);
      this.state = { ...this.state, ...patch };
      if (this.__host) this.__host.schedule();
    }
  }
  window.DCLogic = DCLogic;

  const FULL = /^\{\{\s*([\w$.]+)\s*\}\}$/;
  const PART = /\{\{\s*([\w$.]+)\s*\}\}/g;
  const get = (scope, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), scope);
  const text = v => (v === false || v == null ? '' : String(v));
  const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  class Host {
    constructor(name, props) {
      const def = defs[name];
      this.name = name; this.def = def; this.queued = false; this.mounted = false;
      this.el = document.createElement('div');
      this.el.style.display = 'contents';
      this.el.dataset.dc = name;
      this.children = new Map();
      this.inst = new def.Component({ ...def.defaults, ...props });
      this.inst.__host = this;
    }
    update(props) { this.inst.props = { ...this.def.defaults, ...props }; this.render(); }
    schedule() {
      if (this.queued) return;
      this.queued = true;
      queueMicrotask(() => { this.queued = false; if (!this.dead) this.render(); });
    }
    render() {
      const vals = this.inst.renderVals();
      this.used = new Set(); this.count = {};
      const fresh = document.createDocumentFragment();
      build(this.def.template.content.childNodes, vals, fresh, this);
      morphChildren(this.el, [...fresh.childNodes]);
      for (const [key, child] of this.children) if (!this.used.has(key)) { child.destroy(); this.children.delete(key); }
      if (!this.mounted) { this.mounted = true; this.inst.componentDidMount?.(); }
      else this.inst.componentDidUpdate?.();
    }
    destroy() {
      this.dead = true;
      for (const child of this.children.values()) child.destroy();
      this.inst.componentWillUnmount?.();
      this.el.remove();
    }
  }

  function build(nodes, scope, out, host, branch) {
    for (const node of nodes) {
      if (node.nodeType === 3) { out.append(node.data.includes('{{') ? node.data.replace(PART, (_, p) => text(get(scope, p))) : node.data); continue; }
      if (node.nodeType !== 1) continue;
      const tag = node.localName;
      if (tag === 'sc-if') {
        if (get(scope, FULL.exec(node.getAttribute('value'))[1])) build(node.childNodes, scope, out, host, node);
        continue;
      }
      if (tag === 'sc-for') {
        const list = get(scope, FULL.exec(node.getAttribute('list'))[1]) || [];
        const as = node.getAttribute('as');
        for (const item of list) { const s = Object.create(scope); s[as] = item; build(node.childNodes, s, out, host); }
        continue;
      }
      if (tag === 'dc-import') {
        const name = node.getAttribute('name'), props = {};
        for (const a of node.attributes) {
          if (a.name === 'name' || a.name.startsWith('hint-')) continue;
          const m = FULL.exec(a.value);
          props[camel(a.name)] = m ? get(scope, m[1]) : a.value;
        }
        const n = host.count[name] = (host.count[name] || 0) + 1, key = name + '#' + n;
        let child = host.children.get(key);
        if (!child) { child = new Host(name, props); host.children.set(key, child); child.render(); }
        else child.update(props);
        host.used.add(key);
        const slot = document.createElement('dc-slot');
        slot.__host = child;
        out.append(slot);
        continue;
      }
      const el = node.namespaceURI === 'http://www.w3.org/1999/xhtml' ? document.createElement(tag) : document.createElementNS(node.namespaceURI, node.tagName);
      el.__ev = {}; el.__if = branch;
      for (const a of node.attributes) {
        if (a.name.startsWith('hint-')) continue;
        const m = FULL.exec(a.value);
        if (m && /^on./.test(a.name)) { const fn = get(scope, m[1]); if (typeof fn === 'function') el.__ev[a.name.slice(2).toLowerCase()] = fn; continue; }
        const v = m ? get(scope, m[1]) : a.value.includes('{{') ? a.value.replace(PART, (_, p) => text(get(scope, p))) : a.value;
        if (v === false || v == null) continue;
        el.setAttribute(a.name, v === true ? '' : String(v));
        if (a.name === 'value') el.__value = String(v);
      }
      build(node.childNodes, scope, el, host);
      out.append(el);
    }
  }

  function same(l, f) {
    return l.nodeType === f.nodeType && (l.nodeType === 3 || (l.namespaceURI === f.namespaceURI && l.localName === f.localName && l.__if === f.__if));
  }
  function patch(l, f) {
    if (l.nodeType === 3) { if (l.data !== f.data) l.data = f.data; return; }
    for (const a of [...l.attributes]) if (!f.hasAttribute(a.name)) l.removeAttribute(a.name);
    for (const a of f.attributes) if (l.getAttribute(a.name) !== a.value) l.setAttribute(a.name, a.value);
    const old = l.__ev || {};
    for (const ev of Object.keys(old)) if (!f.__ev[ev]) l['on' + ev] = null;
    for (const [ev, fn] of Object.entries(f.__ev)) l['on' + ev] = fn;
    l.__ev = f.__ev;
    morphChildren(l, [...f.childNodes]);
    if (f.__value !== undefined && 'value' in l && l.value !== f.__value && !(document.activeElement === l && l.type === 'text')) l.value = f.__value;
  }
  function fresh(f) {
    if (f.__host) return f.__host.el;
    if (f.nodeType === 1) {
      for (const [ev, fn] of Object.entries(f.__ev || {})) f['on' + ev] = fn;
      f.querySelectorAll('*').forEach(el => { for (const [ev, fn] of Object.entries(el.__ev || {})) el['on' + ev] = fn; });
      f.querySelectorAll('dc-slot').forEach(s => s.replaceWith(s.__host.el));
      if (f.__value !== undefined && 'value' in f) queueMicrotask(() => { f.value = f.__value; });
      f.querySelectorAll('select, input').forEach(el => { if (el.__value !== undefined) queueMicrotask(() => { el.value = el.__value; }); });
    }
    return f;
  }
  function morphChildren(parent, list) {
    let i = 0;
    for (; i < list.length; i++) {
      const f = list[i], l = parent.childNodes[i];
      if (f.__host) {
        if (l !== f.__host.el) parent.insertBefore(f.__host.el, l || null);
        continue;
      }
      if (!l) parent.append(fresh(f));
      else if (l.dataset?.dc || !same(l, f)) parent.insertBefore(fresh(f), l);
      else patch(l, f);
    }
    while (parent.childNodes.length > i) parent.lastChild.remove();
  }

  window.DC = {
    define(name, html, Component, defaults) {
      const template = document.createElement('template');
      template.innerHTML = html;
      defs[name] = { template, Component, defaults: defaults || {} };
    },
    mount(name, target, props) {
      const host = new Host(name, props || {});
      target.append(host.el);
      host.render();
      return host;
    },
  };
})();
