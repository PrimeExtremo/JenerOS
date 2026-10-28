// Generated from the "JenerOS Glass" design files by port.py. Edit the designs, then regenerate.

(() => {

class Component extends DCLogic {
  componentDidMount(){
    if (typeof window === 'undefined') return;
    this._mv = (e) => { const root = document.documentElement; const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      root.style.setProperty('--cx', (x * 5).toFixed(2) + 'deg'); root.style.setProperty('--cy', (-y * 4).toFixed(2) + 'deg'); };
    window.addEventListener('mousemove', this._mv);
  }
  wEl(k){ return typeof document !== 'undefined' ? document.querySelector('[data-wk="' + k + '"]') : null; }
  flipSnap(newKey){
    this.flipNew = newKey; this.flipPre = {};
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-wk]').forEach((el) => { this.flipPre[el.getAttribute('data-wk')] = el.getBoundingClientRect(); });
  }
  componentDidUpdate(){
    const pre = this.flipPre; if (!pre) return; this.flipPre = null;
    const newKey = this.flipNew; this.flipNew = null;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-wk]').forEach((el) => {
      el.getAnimations().forEach((a) => { if (!(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation)) a.cancel(); });
      el.style.pointerEvents = '';
      if (reduce) return;
      const k = el.getAttribute('data-wk'); const b = el.getBoundingClientRect(); const a = pre[k];
      if (k === newKey || !a) {
        el.animate([{ transform: 'translateY(40px) scale(.6)', opacity: 0, filter: 'blur(8px)' }, { transform: 'scale(1.04)', opacity: 1, filter: 'blur(0)', offset: .6 }, { transform: 'none', opacity: 1 }],
          { duration: 560, easing: 'cubic-bezier(.2,.9,.3,1)' });
        return;
      }
      const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
      el.animate([{ transformOrigin: '0 0', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' },
                  { transformOrigin: '0 0', transform: 'none' }],
        { duration: 620, easing: 'cubic-bezier(.3,1.25,.5,1)' });
    });
  }
  componentWillUnmount(){ if (this._mv) window.removeEventListener('mousemove', this._mv); clearTimeout(this.animT); clearTimeout(this.paintT); clearTimeout(this.paintT2); }
  constructor(p){ super(p); this.state = { on: { Ceiling: true, Lamp: false, TV: true }, icons: null, theme: null, menu: false, frost: null, wall: 'ribbon', store: false, editing: false, gallery: false, temp: 21.5, target: 22, widgets: [{ k: 'room', w: 2 }, { k: 'climate', w: 1 }, { k: 'energy', w: 1 }], installed: ['home-assistant', 'immich', 'jellyfin', 'nextcloud'] }; }
  renderVals() {
    const on = this.state.on;
    const lights = ['Ceiling','Lamp','TV'].map((n) => ({
      name: n,
      label: on[n] ? 'On' : 'Off',
      toggle: () => this.setState({ on: { ...on, [n]: !on[n] } }),
      style: 'border: none; border-radius: 22px; padding: 16px; min-height: 120px; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; text-align: left; ' +
        (on[n] ? 'background: #f6f1e7; color: #1f1913; box-shadow: 0 0 30px rgba(217,119,87,.55);' : 'background: rgba(255,255,255,.14); color: inherit;')
    }));
    const ICONS = {
      'home-assistant': ['Home Assistant', 'glass-assets/ba43b73a9007a33633148d33045ea823.svg'], immich: ['Immich', 'glass-assets/850a3b77b38eaaf67832e7c5b3cac656.svg'],
      jellyfin: ['Jellyfin', 'glass-assets/7b68198886e47c08abc49df0511448fb.svg'], nextcloud: ['Nextcloud', 'glass-assets/e9847bdb7d92bb1500a456cc20476a95.svg'],
      vaultwarden: ['Vaultwarden', 'glass-assets/e970bc8bb9875cca9587f67badb17b28.svg'], 'adguard-home': ['AdGuard Home', 'glass-assets/ae03b88e4a1b8bf4cd73abe00cdcd60d.svg'],
      'pi-hole': ['Pi-hole', 'glass-assets/77b34d719cf302e5220bf6e28849e9fb.png'], plex: ['Plex', 'glass-assets/84ef001f0c5180e44276b236c9feea47.svg'],
      'paperless-ngx': ['Paperless-ngx', 'glass-assets/afdec13d385d2e15e82d8031c373a4d4.svg'], 'uptime-kuma': ['Uptime Kuma', 'glass-assets/642d685ac31c195e6dc5a6fd4e83719b.svg'],
      frigate: ['Frigate', 'glass-assets/9410922bf922f4cfaecb4c23d9cce782.svg'], 'node-red': ['Node-RED', 'glass-assets/cc1f14d215db0c3eca817162f928d6f5.svg'],
      esphome: ['ESPHome', 'glass-assets/434352c361d38dfed91522286d6ba91f.svg'], zigbee2mqtt: ['Zigbee2MQTT', 'glass-assets/eb28108ec613aed31d011b0ad9e0fed3.png'],
      mosquitto: ['Mosquitto', 'glass-assets/13248d3343030443e9c85e46514228e7.svg'], audiobookshelf: ['Audiobookshelf', 'glass-assets/ecddcd33a019413960d3e561bcc3d4bb.png'],
      navidrome: ['Navidrome', 'glass-assets/a0fa23c12e839a467306c4ad85b41578.png'], mealie: ['Mealie', 'glass-assets/3f2a6b14c27a904bd3839605b403d355.png']
    };
    const openStore = () => this.setState({ store: true });
    const WDEF = {
      room: { name: 'Living room', desc: 'Lights from Home Assistant', app: 'home-assistant' },
      climate: { name: 'Climate', desc: 'Temperature and heating', app: 'home-assistant' },
      energy: { name: 'Energy', desc: 'Today\'s energy use', app: 'home-assistant' },
      system: { name: 'This box', desc: 'CPU, memory and storage' },
      clock: { name: 'Clock', desc: 'Time and date' },
      immich: { name: 'Immich', desc: 'Photo backup status', app: 'immich', big: '[photos]', small: 'Backed up [time] ago' },
      jellyfin: { name: 'Jellyfin', desc: 'Continue watching', app: 'jellyfin', big: '[title]', small: 'Continue watching · [time] left' },
      nextcloud: { name: 'Nextcloud', desc: 'Your cloud drive', app: 'nextcloud', big: '[used]', small: 'of [total] used' },
      'adguard-home': { name: 'AdGuard Home', desc: 'Ads and trackers blocked', app: 'adguard-home', big: '[blocked]', small: 'Blocked today' },
      'uptime-kuma': { name: 'Uptime Kuma', desc: 'Are your services up?', app: 'uptime-kuma', big: 'All up', small: '[n] monitors' },
      vaultwarden: { name: 'Vaultwarden', desc: 'Password health', app: 'vaultwarden', big: '[items]', small: 'Items in your vault' }
    };
    const st = this.state;
    const editing = st.editing;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pulse = (k, kind, extra) => { this.flipSnap(kind === 'in' ? k : null); this.setState(extra); };
    const moveW = (i, d) => { const a = st.widgets.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; pulse(a[j].k, d < 0 ? 'move-l' : 'move-r', { widgets: a }); };
    const widgets = st.widgets.map((w, i) => {
      const def = WDEF[w.k] || {};
      const is = { room: w.k === 'room', climate: w.k === 'climate', energy: w.k === 'energy', system: w.k === 'system', clock: w.k === 'clock' };
      is.app = !Object.values(is).some(Boolean);
      return { is, name: def.name, img: def.app && ICONS[def.app] ? ICONS[def.app][1] : '', big: def.big, small: def.small,
        cls: 'jg-glass jg-widget' + (editing ? ' jg-wiggle' : ''), wk: w.k,
        style: 'position: relative; grid-column: span ' + w.w + '; border-radius: 28px; padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; animation-delay: ' + (i % 2 ? '-.16s' : '0s') + ';',
        remove: () => {
          if (this.removing) return;
          const el = this.wEl(w.k);
          const done = () => { this.removing = false; this.flipSnap(null); this.setState({ widgets: this.state.widgets.filter((x) => x.k !== w.k) }); };
          if (!el || reduce || !el.animate) return done();
          this.removing = true;
          el.style.pointerEvents = 'none';
          el.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(1.05)', opacity: 1, offset: .25 }, { transform: 'scale(.35) rotate(-5deg)', opacity: 0, filter: 'blur(10px)' }],
            { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).onfinish = done;
        },
        left: () => moveW(i, -1), right: () => moveW(i, 1),
        resize: () => pulse(w.k, 'size', { widgets: st.widgets.map((x, j) => (j === i ? { ...x, w: x.w === 2 ? 1 : 2 } : x)) }),
        sizeIcon: w.w === 2 ? '▭' : '▢', removeLabel: 'Remove ' + def.name, leftLabel: 'Move ' + def.name + ' left', rightLabel: 'Move ' + def.name + ' right', sizeLabel: w.w === 2 ? 'Make ' + def.name + ' small' : 'Make ' + def.name + ' wide' };
    });
    const gallery = Object.keys(WDEF).filter((k) => !WDEF[k].app || st.installed.includes(WDEF[k].app)).map((k) => {
      const added = st.widgets.some((w) => w.k === k);
      return { name: WDEF[k].name, desc: WDEF[k].desc, img: WDEF[k].app && ICONS[WDEF[k].app] ? ICONS[WDEF[k].app][1] : '', added, label: added ? 'On home' : 'Add',
        add: () => { if (!added) pulse(k, 'in', { widgets: [...this.state.widgets, { k, w: k === 'room' ? 2 : 1 }], gallery: false }); },
        btn: 'min-height: 36px; border-radius: 18px; border: none; font-size: 13px; font-weight: 800; ' + (added ? 'background: rgba(255,255,255,.1); opacity: .6;' : 'background: #b9562f; color: #fff;') };
    });
    const now = new Date();
    const meters = [['CPU', 12], ['Memory', 38], ['Storage', 41]].map(([name, v]) => ({ name, value: v + '%', bar: 'display: block; height: 100%; border-radius: 3px; background: #d97757; width: ' + v + '%;' }));
    const dockStyle = 'width: 56px; height: 56px; border-radius: 17px; border: none; padding: 0; display: flex; align-items: center; justify-content: center; '
      + 'background: linear-gradient(160deg, rgba(255,255,255,.2), rgba(255,255,255,.06)); box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 6px 14px rgba(0,0,0,.25);';
    const dock = [
      { name: 'Files', img: '', isFiles: true, open: () => {} },
      { name: 'Home Assistant', img: 'glass-assets/ba43b73a9007a33633148d33045ea823.svg', open: () => {} },
      { name: 'Immich', img: 'glass-assets/850a3b77b38eaaf67832e7c5b3cac656.svg', open: () => {} },
      { name: 'Jellyfin', img: 'glass-assets/7b68198886e47c08abc49df0511448fb.svg', open: () => {} },
      { name: 'App Store', img: '', isStore: true, open: openStore },
      { name: 'Settings', img: '', isSettings: true, open: () => this.setState({ menu: true }) }
    ].map((d) => ({ ...d, style: dockStyle }));
    const apps = this.state.installed.filter((id) => ICONS[id]).map((id) => ({ name: ICONS[id][0], img: ICONS[id][1], open: () => {} }))
      .concat([{ name: 'App Store', img: '', isStore: true, open: openStore }, { name: 'Files', img: '', isFiles: true, open: () => {} }]);
    const mode = 'Original';
    const light = (this.state.theme || this.props.theme || 'Dark') === 'Light';
    const ink = light ? '#1f1913' : '#f6f1e7';
    const seg = (on) => 'border: none; min-height: 36px; border-radius: 18px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: background .3s, color .3s; ' +
      (on ? 'background: rgba(255,255,255,.32); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 2px 8px rgba(0,0,0,.12); color: ' + ink + ';' : 'background: transparent; color: ' + ink + ';');
    const frost = this.state.frost ?? this.props.frost ?? 15;
    const blurPx = (2 + frost * 0.28).toFixed(1);
    const fill = (0.03 + frost * 0.0015).toFixed(3);
    const lensScale = Math.round((100 - frost) * 0.45);
    const glassVars = ' --gfill: ' + fill + '; --gfx: ' + (lensScale > 0 ? 'url(#jg-lens) ' : '') + 'blur(' + blurPx + 'px) saturate(160%); --gfxw: blur(' + blurPx + 'px) saturate(160%);';
    const rootStyle = 'position: relative; width: 1440px; height: 900px; overflow: hidden; border-radius: 28px; font-family: "Bricolage Grotesque", system-ui, sans-serif; transition: background .5s, color .5s; color: ' + ink + '; background: ' + (light ? '#f6f1e7' : '#1f1913') + ';' + glassVars;
    const wallUrl = { ribbon: light ? 'glass-assets/6f5f5dbf18010018d7b7e9e71bc02e48.svg' : 'glass-assets/a660d335a6a1a88e203551e9f8742a06.svg', dune: 'glass-assets/16e9d19b899ffc6f6c5a2a1c1807bc1d.svg', plain: '' }[this.state.wall];
    const wallStyle = 'position: absolute; inset: -6%; background-image: ' + (wallUrl ? 'url(' + wallUrl + ')' : 'none') + '; background-size: cover; background-position: center; transition: opacity .5s;';
    const styles = ['Tinted','Original'].map((label) => ({
      label, on: mode === label ? 'true' : 'false',
      pick: () => this.setState({ icons: label }),
      style: seg(mode === label) + ' padding: 0 16px;'
    }));
    const glassIcon = ' drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 -1px 0 rgba(0,0,0,.18)) drop-shadow(0 4px 8px rgba(0,0,0,.22)); opacity: .9;';
    const base = 'width: 50px; height: 50px; object-fit: contain; transition: filter .5s ease, opacity .5s; ';
    const imgStyle = base + 'filter: none;';
    const tileBase = 'width: 84px; height: 84px; border-radius: 26px; display: flex; align-items: center; justify-content: center; transition: background .5s ease, box-shadow .5s ease; ';
    const tileStyle = tileBase;
    return { sceneCls: 'cm-scene' + (st.store || st.menu || st.gallery ? ' cm-away' : ''), lights, apps, styles, imgStyle, tileStyle, rootStyle, wallStyle,
      widgets, gallery, editing, editingStr: editing ? 'true' : 'false', meters,
      editLabel: editing ? 'Done' : 'Edit', toggleEdit: () => this.setState({ editing: !editing, gallery: false }),
      editStyle: 'min-height: 44px; padding: 0 18px; border-radius: 22px; font-size: 14px; font-weight: 700; ' + (editing ? 'background: #b9562f; color: #fff;' : ''),
      editBtn: 'width: 32px; height: 32px; border-radius: 16px; border: none; background: rgba(40,32,26,.85); color: #fff; font-size: 16px; font-weight: 700;',
      galleryOpen: st.gallery, openGallery: () => this.setState({ gallery: true }), closeGallery: () => this.setState({ gallery: false }),
      temp: st.temp.toFixed(1), target: st.target, cooler: () => this.setState({ target: st.target - 0.5 }), warmer: () => this.setState({ target: st.target + 0.5 }),
      timeText: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dateText: now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
      flowOpacity: light ? '.35' : '1',
      no: false, storeOpen: this.state.store, installed: this.state.installed, closeStore: () => this.setState({ store: false }),
      addApp: (id) => this.setState({ installed: this.state.installed.includes(id) ? this.state.installed : [...this.state.installed, id] }),
      removeApp: (id) => this.setState({ installed: this.state.installed.filter((x) => x !== id) }),
      wall: this.state.wall, setWall: (w) => this.setState({ wall: w }),
      setTheme: (t) => {
        if (this.state.paint || t === this.state.theme) { this.setState({ theme: t }); return; }
        clearTimeout(this.paintT); clearTimeout(this.paintT2);
        this.setState({ paint: t });
        this.paintT = setTimeout(() => this.setState({ theme: t }), 720);
        this.paintT2 = setTimeout(() => this.setState({ paint: null }), 1500);
      },
      painting: !!st.paint,
      paintStrokes: [0, 1, 2, 3, 4, 5].map((n) => {
        const ink = st.paint === 'Light' ? ['#f6f1e7', '#efe6d6'] : ['#1f1913', '#2a211a'];
        return 'top: ' + (-8 + n * 19) + '%; animation-delay: ' + (n * 0.07) + 's; background: linear-gradient(180deg, ' + ink[1] + ', ' + ink[0] + ' 40%, ' + ink[0] + ' 70%, ' + ink[1] + '), ' + ink[0] + ';';
      }),
      paintDrips: [12, 31, 48, 67, 84].map((x, n) => 'left: ' + x + '%; top: ' + (88 - (n % 2) * 6) + '%; height: ' + (40 + (n * 23) % 70) + 'px; background: ' + (st.paint === 'Light' ? '#f6f1e7' : '#1f1913') + ';'), setFrostVal: (v) => this.setState({ frost: v }),
      frost, lensScale, setFrost: (e) => this.setState({ frost: Number(e.target.value) }),
      light, dark: !light, menuOpen: this.state.menu,
      toggleMenu: () => this.setState({ menu: !this.state.menu }),
      setLight: () => this.setState({ theme: 'Light' }), setDark: () => this.setState({ theme: 'Dark' }),
      setTinted: () => this.setState({ icons: 'Tinted' }), setOriginal: () => this.setState({ icons: 'Original' }),
      lightBtn: seg(light), darkBtn: seg(!light),
      tintedBtn: seg(mode === 'Tinted'), originalBtn: seg(mode === 'Original') };
  }
}

DC.define("Main", "<div style=\"{{rootStyle}}\">\n  <svg width=\"0\" height=\"0\" style=\"position: absolute\" aria-hidden=\"true\"><filter id=\"jg-lens\" x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" color-interpolation-filters=\"sRGB\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.006 0.009\" numOctaves=\"2\" seed=\"7\" result=\"n\"></feTurbulence><feGaussianBlur in=\"n\" stdDeviation=\"3\" result=\"m\"></feGaussianBlur><feDisplacementMap in=\"SourceGraphic\" in2=\"m\" scale=\"{{lensScale}}\" xChannelSelector=\"R\" yChannelSelector=\"G\"></feDisplacementMap></filter></svg>\n  <div class=\"jg-wall\" style=\"{{wallStyle}}\"></div>\n  <div class=\"jg-blob1\" style=\"position: absolute; right: -120px; top: -160px; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(217,119,87,.45) 0%, rgba(217,119,87,0) 70%)\"></div>\n  <div class=\"jg-grain\" style=\"position: absolute; inset: 0\"></div>\n\n  <div class=\"{{sceneCls}}\" style=\"position: relative; height: 100%; box-sizing: border-box; padding: 36px 56px; display: flex; flex-direction: column; gap: 22px\">\n    <div class=\"jg-rise\" style=\"position: absolute; top: 36px; right: 56px; z-index: 20; display: flex; align-items: center; gap: 10px\">\n      <div style=\"display: flex; gap: 10px; align-items: center\">\n        <button class=\"jg-glass jg-btn jg-press\" onClick=\"{{toggleEdit}}\" aria-pressed=\"{{editingStr}}\" style=\"{{editStyle}}\">{{editLabel}}</button>\n        <button class=\"jg-glass jg-btn jg-press\" aria-label=\"Search\" style=\"width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m20 20-3.5-3.5\"></path></svg></button>\n        <div style=\"position: relative\">\n        <button class=\"jg-glass jg-btn jg-press\" aria-label=\"Settings\" aria-haspopup=\"true\" aria-expanded=\"{{menuOpen}}\" onClick=\"{{toggleMenu}}\" style=\"width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"></path></svg></button>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"jg-rise\" style=\"animation-delay: .08s\">\n      <div style=\"font-size: 15px; font-weight: 600; opacity: .8\">Monday, 27 October</div>\n      <h1 style=\"margin: 4px 0 0; font-size: 52px; font-weight: 800; letter-spacing: -0.035em\">Good evening, Jener</h1>\n    </div>\n\n    <div class=\"jg-rise\" style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 210px; gap: 18px; animation-delay: .18s\">\n      <sc-for list=\"{{widgets}}\" as=\"w\" hint-placeholder-count=\"3\">\n        <div class=\"{{w.cls}}\" data-wk=\"{{w.wk}}\" style=\"{{w.style}}\">\n          <sc-if value=\"{{w.is.room}}\" hint-placeholder-val=\"{{false}}\">\n            <div style=\"display: flex; justify-content: space-between; align-items: center\">\n              <span style=\"font-size: 17px; font-weight: 700\">Living room</span>\n              <a href=\"#\" style=\"font-size: 13px; font-weight: 600; text-decoration: none; opacity: .85\">Open Home \u203a</a>\n            </div>\n            <div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; flex: 1\">\n              <sc-for list=\"{{lights}}\" as=\"l\" hint-placeholder-count=\"3\">\n                <button class=\"jg-btn jg-press\" onClick=\"{{l.toggle}}\" style=\"{{l.style}}\">\n                  <svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z\"></path></svg>\n                  <span style=\"font-size: 14px; font-weight: 700\">{{l.name}}</span>\n                  <span style=\"font-size: 12px; font-weight: 600; opacity: .75\">{{l.label}}</span>\n                </button>\n              </sc-for>\n            </div>\n          </sc-if>\n          <sc-if value=\"{{w.is.climate}}\" hint-placeholder-val=\"{{false}}\">\n            <span style=\"font-size: 15px; font-weight: 700; opacity: .9\">Climate</span>\n            <div style=\"font-size: 64px; font-weight: 800; letter-spacing: -0.04em; line-height: 1\">{{temp}}\u00b0</div>\n            <div style=\"display: flex; justify-content: space-between; align-items: center\">\n              <span style=\"font-size: 13px; font-weight: 600; opacity: .8\">Heating to {{target}}\u00b0</span>\n              <div style=\"display: flex; gap: 8px\">\n                <button class=\"jg-btn jg-press\" aria-label=\"Cooler\" onClick=\"{{cooler}}\" style=\"width: 44px; height: 44px; border-radius: 22px; border: none; background: rgba(255,255,255,.18); font-size: 22px\">\u2212</button>\n                <button class=\"jg-btn jg-press\" aria-label=\"Warmer\" onClick=\"{{warmer}}\" style=\"width: 44px; height: 44px; border-radius: 22px; border: none; background: rgba(255,255,255,.18); font-size: 22px\">+</button>\n              </div>\n            </div>\n          </sc-if>\n          <sc-if value=\"{{w.is.energy}}\" hint-placeholder-val=\"{{false}}\">\n            <span style=\"font-size: 15px; font-weight: 700; opacity: .9\">Energy today</span>\n            <div><span style=\"font-size: 48px; font-weight: 800; letter-spacing: -0.04em\">[kWh]</span></div>\n            <div style=\"display: flex; align-items: flex-end; gap: 6px; height: 48px\"><div style=\"flex: 1; border-radius: 6px; background: rgba(255,255,255,.35); height: 30%\"></div><div style=\"flex: 1; border-radius: 6px; background: rgba(255,255,255,.35); height: 55%\"></div><div style=\"flex: 1; border-radius: 6px; background: rgba(255,255,255,.35); height: 40%\"></div><div style=\"flex: 1; border-radius: 6px; background: rgba(255,255,255,.35); height: 80%\"></div><div style=\"flex: 1; height: 100%; border-radius: 6px; background: #d97757\"></div></div>\n          </sc-if>\n          <sc-if value=\"{{w.is.system}}\" hint-placeholder-val=\"{{false}}\">\n            <span style=\"font-size: 15px; font-weight: 700; opacity: .9\">This box</span>\n            <sc-for list=\"{{meters}}\" as=\"m\" hint-placeholder-count=\"3\">\n              <div style=\"display: flex; flex-direction: column; gap: 6px\">\n                <div style=\"display: flex; justify-content: space-between; font-size: 13px; font-weight: 600\"><span>{{m.name}}</span><span style=\"opacity: .8\">{{m.value}}</span></div>\n                <span style=\"display: block; height: 6px; border-radius: 3px; background: rgba(255,255,255,.14); overflow: hidden\"><span style=\"{{m.bar}}\"></span></span>\n              </div>\n            </sc-for>\n          </sc-if>\n          <sc-if value=\"{{w.is.clock}}\" hint-placeholder-val=\"{{false}}\">\n            <span style=\"font-size: 15px; font-weight: 700; opacity: .9\">{{dateText}}</span>\n            <div style=\"font-size: 68px; font-weight: 800; letter-spacing: -0.04em; line-height: 1\">{{timeText}}</div>\n            <span style=\"font-size: 13px; font-weight: 600; opacity: .75\">Local time</span>\n          </sc-if>\n          <sc-if value=\"{{w.is.app}}\" hint-placeholder-val=\"{{false}}\">\n            <div style=\"display: flex; align-items: center; gap: 10px\">\n              <img src=\"{{w.img}}\" alt=\"\" style=\"width: 28px; height: 28px; object-fit: contain\">\n              <span style=\"font-size: 15px; font-weight: 700\">{{w.name}}</span>\n            </div>\n            <div style=\"font-size: 40px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05\">{{w.big}}</div>\n            <span style=\"font-size: 13px; font-weight: 600; opacity: .78\">{{w.small}}</span>\n          </sc-if>\n          <sc-if value=\"{{editing}}\" hint-placeholder-val=\"{{false}}\">\n            <button class=\"jg-btn\" aria-label=\"{{w.removeLabel}}\" onClick=\"{{w.remove}}\" style=\"position: absolute; top: -10px; left: -10px; width: 30px; height: 30px; border-radius: 15px; border: none; background: rgba(40,32,26,.92); color: #fff; font-size: 20px; line-height: 1; box-shadow: 0 2px 8px rgba(0,0,0,.4)\">\u2212</button>\n            <div style=\"position: absolute; bottom: 10px; right: 10px; display: flex; gap: 6px\">\n              <button class=\"jg-btn jg-press\" aria-label=\"{{w.leftLabel}}\" onClick=\"{{w.left}}\" style=\"{{editBtn}}\">\u2039</button>\n              <button class=\"jg-btn jg-press\" aria-label=\"{{w.sizeLabel}}\" onClick=\"{{w.resize}}\" style=\"{{editBtn}}\">{{w.sizeIcon}}</button>\n              <button class=\"jg-btn jg-press\" aria-label=\"{{w.rightLabel}}\" onClick=\"{{w.right}}\" style=\"{{editBtn}}\">\u203a</button>\n            </div>\n          </sc-if>\n        </div>\n      </sc-for>\n      <sc-if value=\"{{editing}}\" hint-placeholder-val=\"{{false}}\">\n        <button class=\"jg-btn jg-press\" onClick=\"{{openGallery}}\" style=\"border-radius: 28px; border: 2px dashed rgba(255,255,255,.35); background: rgba(255,255,255,.05); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 700\">\n          <span style=\"font-size: 34px; line-height: 1\">+</span>Add widget\n        </button>\n      </sc-if>\n    </div>\n\n    <div class=\"jg-rise\" style=\"animation-delay: .32s\">\n      <div style=\"font-size: 15px; font-weight: 700; opacity: .85; margin-bottom: 14px\">Apps</div>\n      <div style=\"display: flex; gap: 40px 26px; flex-wrap: wrap\">\n        <sc-for list=\"{{apps}}\" as=\"a\" hint-placeholder-count=\"6\">\n          <button class=\"jg-btn jg-tile\" onClick=\"{{a.open}}\" aria-label=\"{{a.name}}\" style=\"display: flex; flex-direction: column; align-items: center; gap: 10px; width: 96px; padding: 0; border: none; background: transparent\">\n            <div class=\"jg-glass jg-press jg-reflect jg-glow\" style=\"{{tileStyle}}\">\n              <sc-if value=\"{{a.img}}\" hint-placeholder-val=\"{{true}}\"><img src=\"{{a.img}}\" alt=\"\" style=\"{{imgStyle}}\"></sc-if>\n              <sc-if value=\"{{a.isStore}}\" hint-placeholder-val=\"{{false}}\"><svg width=\"44\" height=\"44\" viewBox=\"0 0 512 512\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z\"></path><path fill=\"currentColor\" d=\"M144 208H176V240H144Z\"></path></svg></sc-if>\n              <sc-if value=\"{{a.isFiles}}\" hint-placeholder-val=\"{{false}}\"><svg width=\"42\" height=\"42\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path></svg></sc-if>\n            </div>\n            <span style=\"font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 96px\">{{a.name}}</span>\n          </button>\n        </sc-for>\n      </div>\n    </div>\n\n    <div class=\"jg-glass jg-rise\" style=\"margin-top: auto; align-self: center; border-radius: 26px; padding: 12px 22px; display: flex; gap: 28px; align-items: center; font-size: 13px; font-weight: 600; animation-delay: .4s\">\n      <span>Storage 41% used</span>\n      <span style=\"opacity: .5\">\u2022</span>\n      <span>CPU 12%</span>\n      <span style=\"opacity: .5\">\u2022</span>\n      <span>Up to date</span>\n    </div>\n  </div>\n  <svg role=\"img\" aria-label=\"JenerOS\" width=\"28\" height=\"28\" viewBox=\"0 0 512 512\" style=\"position: absolute; right: 40px; bottom: 36px; opacity: .85\"><path fill=\"currentColor\" d=\"M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z\"></path><path fill=\"currentColor\" d=\"M144 208H176V240H144Z\"></path></svg>\n  <sc-if value=\"{{galleryOpen}}\" hint-placeholder-val=\"{{false}}\">\n    <div class=\"cm-portal\" style=\"position: absolute; inset: 0; z-index: 40; display: flex; align-items: flex-end; justify-content: center; background: rgba(15,10,6,.4)\">\n      <div class=\"jg-sheet\" role=\"dialog\" aria-label=\"Add widget\" style=\"width: 980px; max-height: 560px; overflow-y: auto; scrollbar-width: none; margin-bottom: 30px; padding: 26px 28px; border-radius: 32px; background: rgba(30,23,17,.6); backdrop-filter: blur(30px) saturate(170%); -webkit-backdrop-filter: blur(30px) saturate(170%); border: 1px solid rgba(255,255,255,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 40px 90px rgba(0,0,0,.5)\">\n        <div style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px\">\n          <h2 style=\"margin: 0; font-size: 24px; font-weight: 800\">Add a widget</h2>\n          <button class=\"jg-btn jg-press\" aria-label=\"Close\" onClick=\"{{closeGallery}}\" style=\"width: 40px; height: 40px; border-radius: 20px; border: none; background: rgba(255,255,255,.12); font-size: 16px\">\u2715</button>\n        </div>\n        <div style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px\">\n          <sc-for list=\"{{gallery}}\" as=\"g\" hint-placeholder-count=\"6\">\n            <div style=\"display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 22px; background: rgba(255,255,255,.07); box-shadow: inset 0 1px 0 rgba(255,255,255,.14)\">\n              <div style=\"display: flex; align-items: center; gap: 10px\">\n                <sc-if value=\"{{g.img}}\" hint-placeholder-val=\"{{true}}\"><img src=\"{{g.img}}\" alt=\"\" style=\"width: 32px; height: 32px; object-fit: contain\"></sc-if>\n                <span style=\"font-size: 15px; font-weight: 800\">{{g.name}}</span>\n              </div>\n              <span style=\"font-size: 12px; opacity: .72; min-height: 32px\">{{g.desc}}</span>\n              <button class=\"jg-btn jg-press\" onClick=\"{{g.add}}\" disabled=\"{{g.added}}\" style=\"{{g.btn}}\">{{g.label}}</button>\n            </div>\n          </sc-for>\n        </div>\n        <p style=\"margin: 16px 0 0; font-size: 13px; opacity: .65\">Apps you install from the App Store add their own widgets here.</p>\n      </div>\n    </div>\n  </sc-if>\n  <sc-if value=\"{{storeOpen}}\" hint-placeholder-val=\"{{false}}\">\n    <div class=\"cm-portal\" style=\"position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(15,10,6,.35)\">\n      <dc-import name=\"Store\" backdrop=\"{{no}}\" light=\"{{light}}\" installed=\"{{installed}}\" on-install=\"{{addApp}}\" on-remove=\"{{removeApp}}\" on-close=\"{{closeStore}}\" hint-size=\"1100px,720px\"></dc-import>\n    </div>\n  </sc-if>\n  <sc-if value=\"{{menuOpen}}\" hint-placeholder-val=\"{{false}}\">\n    <div class=\"cm-portal\" style=\"position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(15,10,6,.35)\">\n      <dc-import name=\"Settings\" backdrop=\"{{no}}\" light=\"{{light}}\" frost=\"{{frost}}\" wallpaper=\"{{wall}}\" on-theme=\"{{setTheme}}\" on-frost=\"{{setFrostVal}}\" on-wallpaper=\"{{setWall}}\" on-close=\"{{toggleMenu}}\" hint-size=\"1000px,660px\"></dc-import>\n    </div>\n  </sc-if>\n  <sc-if value=\"{{painting}}\" hint-placeholder-val=\"{{false}}\">\n    <div class=\"jp-wrap\" aria-hidden=\"true\" style=\"position: absolute; inset: 0; z-index: 60; overflow: hidden\">\n      <sc-for list=\"{{paintStrokes}}\" as=\"p\" hint-placeholder-count=\"6\">\n        <div class=\"jp-s\" style=\"{{p}}\"></div>\n      </sc-for>\n      <sc-for list=\"{{paintDrips}}\" as=\"d\" hint-placeholder-count=\"5\">\n        <div class=\"jp-d\" style=\"{{d}}\"></div>\n      </sc-for>\n    </div>\n  </sc-if>\n</div>", Component, {"theme": "Dark", "frost": 15});
})();

(() => {

class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.state = {
      section: 'general', boxName: 'JenerOS', owner: 'Jener', tz: 'local', h24: true, notice: '',
      avatar: 'orange', members: [], ha: true, checking: false, updateText: 'Up to date', confirm: '',
      t: { standby: true, ups: false, motion: false, rooms: true, climate: true, energy: true, remote: false, appUpdates: true,
           twoStep: false, rateLimit: true, firewall: true, ssh: false, autoUpdate: true },
      running: { 'Home Assistant': true, Immich: true, Jellyfin: false, Nextcloud: true },
      sessions: [{ id: 1, device: 'Chrome on Windows', when: 'Now', self: true }, { id: 2, device: 'Safari on iPhone', when: 'Yesterday', self: false }],
      light: null, icons: null, frost: null, wallpaper: null
    };
  }
  say(msg) { this.setState({ notice: msg }); clearTimeout(this._n); this._n = setTimeout(() => this.setState({ notice: '' }), 3200); }
  componentWillUnmount() { clearTimeout(this._n); clearTimeout(this._u); }
  renderVals() {
    const st = this.state, p = this.props;
    const light = st.light ?? !!p.light;
    const frost = st.frost ?? p.frost ?? 15;
    const wallpaper = st.wallpaper ?? p.wallpaper ?? 'ribbon';
    const ink = light ? '#1f1913' : '#f6f1e7';
    const sub = light ? 'rgba(31,25,19,.06)' : 'rgba(255,255,255,.06)';
    const call = (fn, v) => { if (typeof fn === 'function') fn(v); };
    const seg = (on, pick) => ({ on: on ? 'true' : 'false', pick,
      style: 'min-height: 36px; padding: 0 16px; border-radius: 18px; font-size: 13px; font-weight: 700; ' +
        (on ? 'background: ' + (light ? '#ffffff' : 'rgba(255,255,255,.22)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 1px 4px rgba(0,0,0,.15);' : 'background: transparent;') });
    const t = {};
    Object.keys(st.t).forEach((k) => {
      const on = st.t[k];
      t[k] = { on: on ? 'true' : 'false',
        flip: () => this.setState({ t: { ...this.state.t, [k]: !this.state.t[k] } }),
        track: 'position: relative; width: 52px; height: 32px; border-radius: 16px; padding: 0; flex: none; background: ' + (on ? '#b9562f' : (light ? 'rgba(31,25,19,.18)' : 'rgba(255,255,255,.2)')) + ';',
        knob: 'position: absolute; top: 3px; left: ' + (on ? '23px' : '3px') + '; width: 26px; height: 26px; border-radius: 13px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,.25); transition: left .25s cubic-bezier(.3,1.4,.5,1);' };
    });
    const icon = {
      general: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.4-1.4M5.6 18.4 7 17M17 17l1.4 1.4M5.6 5.6 7 7',
      appearance: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8.5-9-8.5zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
      home: 'M3 10l9-7 9 7M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M9 21v-7h6v7',
      storage: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
      network: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 19.5h.01',
      apps: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7',
      security: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
      updates: 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
      account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
      power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0'
    };
    const names = { general: 'General', appearance: 'Appearance', storage: 'Storage', network: 'Network', apps: 'Apps', security: 'Security', updates: 'Updates', account: 'Account', power: 'Power' };
    const sections = Object.keys(names).map((k) => ({
      label: names[k], icon: icon[k], current: st.section === k ? 'page' : 'false',
      go: () => this.setState({ section: k, confirm: '' }),
      style: 'display: flex; align-items: center; gap: 12px; width: 100%; min-height: 40px; padding: 0 12px; border-radius: 12px; font-size: 14px; font-weight: 600; text-align: left; ' +
        (st.section === k ? 'background: ' + (light ? 'rgba(31,25,19,.08)' : 'rgba(255,255,255,.14)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.25);' : 'background: transparent; opacity: .82;') +
        (k === 'power' ? ' margin-top: auto;' : '')
    }));
    const is = {}; Object.keys(names).forEach((k) => { is[k] = st.section === k; });
    const avatarColor = { orange: '#d97757', sage: '#7f9f7a', clay: '#a76440' };
    const pill = 'min-height: 40px; padding: 0 18px; border-radius: 20px; font-size: 14px; font-weight: 700; background: ' + (light ? 'rgba(31,25,19,.08)' : 'rgba(255,255,255,.14)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.3);';
    const wallImg = { ribbon: light ? 'glass-assets/6f5f5dbf18010018d7b7e9e71bc02e48.svg' : 'glass-assets/a660d335a6a1a88e203551e9f8742a06.svg', dune: 'glass-assets/16e9d19b899ffc6f6c5a2a1c1807bc1d.svg', plain: '' };
    const walls = [['ribbon','Ember ribbons'],['dune','Quiet dunes'],['plain','Plain']].map(([k, label]) => ({
      label, on: wallpaper === k ? 'true' : 'false',
      pick: () => { this.setState({ wallpaper: k }); call(p.onWallpaper, k); },
      style: 'display: flex; flex-direction: column; gap: 8px; padding: 6px; border-radius: 16px; background: transparent; ' + (wallpaper === k ? 'box-shadow: 0 0 0 2px #d97757;' : 'box-shadow: 0 0 0 1px rgba(127,127,127,.3);'),
      swatch: 'display: block; height: 72px; border-radius: 11px; background: ' + (light ? '#f6f1e7' : '#1f1913') + (wallImg[k] ? ' url(' + wallImg[k] + ') center / cover' : '') + ';'
    }));
    const appImg = { 'Home Assistant': 'glass-assets/ba43b73a9007a33633148d33045ea823.svg', Immich: 'glass-assets/850a3b77b38eaaf67832e7c5b3cac656.svg', Jellyfin: 'glass-assets/7b68198886e47c08abc49df0511448fb.svg', Nextcloud: 'glass-assets/e9847bdb7d92bb1500a456cc20476a95.svg' };
    const META = { 'Home Assistant': ['2026.10.3', 8123, '612 MB', '3.1 GB'], Immich: ['1.142.0', 2283, '894 MB', '48.2 GB'], Jellyfin: ['10.11.2', 8096, '0 MB', '6.4 GB'], Nextcloud: ['31.0.4', 8081, '402 MB', '12.7 GB'] };
    const cfgOf = (n) => ({ auto: true, upd: true, remote: false, limit: 1024, port: (META[n] || [])[1] || 8080, ...((st.appCfg || {})[n] || {}) });
    const setCfg = (n, patch) => this.setState({ appCfg: { ...(this.state.appCfg || {}), [n]: { ...cfgOf(n), ...((this.state.appCfg || {})[n] || {}), ...patch } } });
    const look = (on) => ({ track: 'position: relative; width: 52px; height: 32px; border-radius: 16px; padding: 0; flex: none; background: ' + (on ? '#b9562f' : (light ? 'rgba(31,25,19,.18)' : 'rgba(255,255,255,.2)')) + ';',
      knob: 'position: absolute; top: 3px; left: ' + (on ? '23px' : '3px') + '; width: 26px; height: 26px; border-radius: 13px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,.25); transition: left .25s cubic-bezier(.3,1.4,.5,1);' });
    const soft = light ? 'rgba(31,25,19,.06)' : 'rgba(255,255,255,.08)';
    this._appStyles = { statBox: 'display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: ' + soft + ';',
      inputStyle: 'min-height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid rgba(127,127,127,.25); font: inherit; color: inherit; background: ' + soft + ';',
      logStyle: 'margin: 0; padding: 10px 12px; border-radius: 12px; font: 12px/1.6 ui-monospace, monospace; white-space: pre-wrap; background: ' + (light ? 'rgba(31,25,19,.08)' : 'rgba(0,0,0,.3)') + ';' };
    const confirmBtn = (k, idle, sure, done) => ({ label: st.confirm === k ? sure : idle, run: () => { if (this.state.confirm === k) { this.setState({ confirm: '' }); done(); } else this.setState({ confirm: k }); } });
    const apps = Object.keys(st.running).map((n) => {
      const m = META[n] || ['1.0.0', 8080, '—', '—'];
      const c = cfgOf(n);
      const open = st.openApp === n;
      const run = st.running[n];
      const tg = (key) => { const tt = look(c[key]); return { on: c[key] ? 'true' : 'false', flip: () => setCfg(n, { [key]: !c[key] }), track: tt.track, knob: tt.knob }; };
      const au = tg('auto'), up = tg('upd'), re = tg('remote');
      const rk = confirmBtn('reset-' + n, 'Reset settings', 'Tap again to reset', () => { setCfg(n, { auto: true, upd: true, remote: false, limit: 1024, port: m[1] }); this.say(n + ' settings reset'); });
      const keep = confirmBtn('rm-' + n, 'Remove app', 'Tap again to remove', () => { const r = { ...this.state.running }; delete r[n]; this.setState({ running: r, openApp: null }); this.say(n + ' removed. Its data is kept.'); });
      const all = confirmBtn('rmall-' + n, 'Remove app and data', 'This deletes ' + m[3] + '. Tap again', () => { const r = { ...this.state.running }; delete r[n]; this.setState({ running: r, openApp: null }); this.say(n + ' and its data were deleted'); });
      return {
        name: n, img: appImg[n], status: run ? 'Running' : 'Stopped', action: run ? 'Stop' : 'Start', version: 'v' + m[0],
        open, expanded: open ? 'true' : 'false', manageLabel: 'Manage ' + n,
        expand: () => this.setState({ openApp: open ? null : n, confirm: '' }),
        chev: 'margin-left: 4px; opacity: .55; transition: transform .25s; transform: rotate(' + (open ? 90 : 0) + 'deg);',
        panel: 'display: flex; flex-direction: column; gap: 14px; margin: 4px 0 10px; padding: 16px; border-radius: 18px; background: ' + (light ? 'rgba(31,25,19,.05)' : 'rgba(255,255,255,.06)') + ';',
        toggle: () => { const r = { ...this.state.running, [n]: !this.state.running[n] }; this.setState({ running: r }); this.say(n + (r[n] ? ' started' : ' stopped')); },
        openApp: () => this.say('Opening ' + n + ' at jeneros.local:' + c.port),
        restart: () => this.say(n + ' restarted'),
        updateLabel: n === 'Immich' ? 'Update to 1.143.0' : 'Check for updates',
        update: () => this.say(n === 'Immich' ? 'Immich updated. The old version is kept for rollback.' : n + ' is up to date'),
        backup: () => this.say(n + ' backed up to the system disk'),
        mem: run ? m[2] : '0 MB', disk: m[3], addr: ':' + c.port,
        autoOn: au.on, autoFlip: au.flip, autoTrack: au.track, autoKnob: au.knob,
        updOn: up.on, updFlip: up.flip, updTrack: up.track, updKnob: up.knob,
        remoteOn: re.on, remoteFlip: re.flip, remoteTrack: re.track, remoteKnob: re.knob,
        limit: c.limit, setLimit: (e) => setCfg(n, { limit: +e.target.value }),
        port: c.port, setPort: (e) => setCfg(n, { port: +e.target.value || m[1] }),
        log: run ? '23:14:02  started ' + n + ' ' + m[0] + '\n23:14:05  listening on :' + c.port + '\n23:18:40  health check ok' : '23:20:11  stopped by you',
        dangerKeep: 'min-height: 40px; padding: 0 18px; border-radius: 20px; font-size: 14px; font-weight: 700; color: ' + (st.confirm === 'rm-' + n ? '#fff; background: #b42318;' : '#d4462f; background: ' + soft + ';'),
        dangerAll: 'min-height: 40px; padding: 0 18px; border-radius: 20px; font-size: 14px; font-weight: 700; color: ' + (st.confirm === 'rmall-' + n ? '#fff; background: #b42318;' : '#d4462f; background: ' + soft + ';'),
        resetLabel: rk.label, reset: rk.run, removeKeepLabel: keep.label, removeKeep: keep.run, removeAllLabel: all.label, removeAll: all.run
      };
    });
    const meterTrack = 'display: block; height: 8px; border-radius: 4px; overflow: hidden; background: ' + (light ? 'rgba(31,25,19,.1)' : 'rgba(255,255,255,.12)') + ';';
    const disks = [
      { name: 'System disk', kind: 'Built-in eMMC · 32 GB', used: '41%', note: 'JenerOS, apps and settings live here.', bar: 'display: block; height: 100%; width: 41%; border-radius: 4px; background: #d97757;' },
      { name: 'USB disk', kind: 'Not connected', used: '—', note: 'Plug in a USB drive to keep photos and files off the system disk.', bar: 'display: block; height: 100%; width: 0;' }
    ];
    const sessions = st.sessions.map((x) => ({ ...x, other: !x.self,
      end: () => { this.setState({ sessions: this.state.sessions.filter((y) => y.id !== x.id) }); this.say(x.device + ' signed out'); } }));
    const avatars = Object.keys(avatarColor).map((k) => ({
      label: k + ' avatar', on: st.avatar === k ? 'true' : 'false', pick: () => this.setState({ avatar: k }),
      style: 'width: 36px; height: 36px; border-radius: 18px; background: ' + avatarColor[k] + '; ' + (st.avatar === k ? 'box-shadow: 0 0 0 3px ' + (light ? '#f6f1e7' : '#2b241c') + ', 0 0 0 5px ' + avatarColor[k] + ';' : '')
    }));
    const members = st.members.map((m) => ({ name: m.name, remove: () => this.setState({ members: this.state.members.filter((y) => y.id !== m.id) }) }));
    const twoStep = (k, word) => () => {
      if (this.state.confirm === k) { this.setState({ confirm: '' }); this.say(word); }
      else { this.setState({ confirm: k }); }
    };
    return {
      stageStyle: this.props.backdrop === false ? 'display: contents;' : 'overflow: hidden; width: 1000px; height: 660px; background: ' + (light ? '#f6f1e7 url(glass-assets/6f5f5dbf18010018d7b7e9e71bc02e48.svg)' : '#1f1913 url(glass-assets/a660d335a6a1a88e203551e9f8742a06.svg)') + ' center / cover;',
      winStyle: 'box-sizing: border-box; display: flex; width: 1000px; height: 660px; border-radius: 30px; overflow: hidden; font-family: "Bricolage Grotesque", system-ui, sans-serif; color: ' + ink + '; background: ' + (light ? 'rgba(250,246,238,.62)' : 'rgba(30,23,17,.55)') + '; backdrop-filter: blur(26px) saturate(170%); -webkit-backdrop-filter: blur(26px) saturate(170%); border: 1px solid rgba(255,255,255,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 40px 90px rgba(0,0,0,.45);',
      sideStyle: 'width: 236px; flex: none; display: flex; flex-direction: column; gap: 2px; padding: 20px 12px; background: ' + sub + ';',
      avatarStyle: 'width: 40px; height: 40px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #ffffff; background: ' + avatarColor[st.avatar] + ';',
      initial: (st.owner || '?').slice(0, 1).toUpperCase(), ownerName: st.owner,
      sections, is, title: names[st.section],
      close: () => call(p.onClose),
      iconBtn: 'width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: ' + (light ? 'rgba(31,25,19,.08)' : 'rgba(255,255,255,.12)') + ';',
      notice: st.notice, noticeStyle: 'margin: 0 28px 10px; padding: 10px 14px; border-radius: 14px; font-size: 14px; font-weight: 600; background: rgba(217,119,87,.18);',
      card: 'background: ' + (light ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.06)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,' + (light ? '.9' : '.12') + ');',
      segWrap: 'display: flex; gap: 2px; padding: 3px; border-radius: 21px; background: ' + (light ? 'rgba(31,25,19,.07)' : 'rgba(255,255,255,.08)') + ';',
      ...this._appStyles, pill, pillAccent: pill.replace(/background: [^;]+;/, 'background: #b9562f; color: #ffffff;'),
      pillDanger: pill + (st.confirm === 'shutdown' ? ' background: #b42318; color: #ffffff;' : ''),
      okTag: 'font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 10px; background: rgba(127,159,122,.25);',
      meterTrack, t,
      boxName: st.boxName, setBoxName: (e) => this.setState({ boxName: e.target.value }),
      hostname: (st.boxName || 'jeneros').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.local',
      tz: st.tz, setTz: (e) => this.setState({ tz: e.target.value }),
      h24: seg(st.h24, () => this.setState({ h24: true })), h12: seg(!st.h24, () => this.setState({ h24: false })),
      lightSeg: seg(light, () => { this.setState({ light: true }); call(p.onTheme, 'Light'); }),
      darkSeg: seg(!light, () => { this.setState({ light: false }); call(p.onTheme, 'Dark'); }),
      frost, setFrost: (e) => { const v = Number(e.target.value); this.setState({ frost: v }); call(p.onFrost, v); },
      walls,
      haStatus: st.ha ? 'Connected · 24 devices' : 'Not connected', haAction: st.ha ? 'Disconnect' : 'Connect',
      haToggle: () => { this.setState({ ha: !st.ha }); this.say(st.ha ? 'Home Assistant disconnected' : 'Home Assistant connected'); },
      disks, createStorage: () => this.say('Plug in a disk first, then create storage on it.'), refreshDisks: () => this.say('Disks checked. Nothing new found.'),
      apps, sessions,
      changePassword: () => this.say('A password form opens here in the real dashboard.'),
      updateText: st.updateText, checking: st.checking,
      checkUpdates: () => { this.setState({ checking: true, updateText: 'Checking…' }); clearTimeout(this._u); this._u = setTimeout(() => this.setState({ checking: false, updateText: 'Up to date · checked just now' }), 1400); },
      rollbackLabel: st.confirm === 'rollback' ? 'Restart into it?' : 'Start previous version', rollback: twoStep('rollback', 'Restarting into the previous version…'),
      ownerName: st.owner, setOwner: (e) => this.setState({ owner: e.target.value }),
      avatars, members, addMember: () => { const n = this.state.members.length + 1; this.setState({ members: [...this.state.members, { id: Date.now(), name: 'Family member ' + n }] }); },
      signOut: () => this.say('Signed out.'),
      restartLabel: st.confirm === 'restart' ? 'Restart now?' : 'Restart', restart: twoStep('restart', 'Restarting…'),
      shutdownLabel: st.confirm === 'shutdown' ? 'Shut down now?' : 'Shut down', shutdown: twoStep('shutdown', 'Shutting down…')
    };
  }
}

DC.define("Settings", "<div style=\"{{stageStyle}}\">\n<div class=\"st-win\" style=\"{{winStyle}}\">\n  <nav aria-label=\"Settings sections\" style=\"{{sideStyle}}\">\n    <div style=\"display: flex; align-items: center; gap: 12px; padding: 4px 8px 14px\">\n      <div style=\"{{avatarStyle}}\">{{initial}}</div>\n      <div style=\"display: flex; flex-direction: column\">\n        <span style=\"font-size: 15px; font-weight: 800\">{{ownerName}}</span>\n        <span style=\"font-size: 12px; opacity: .65\">Owner</span>\n      </div>\n    </div>\n    <sc-for list=\"{{sections}}\" as=\"s\" hint-placeholder-count=\"10\">\n      <button class=\"st-btn\" onClick=\"{{s.go}}\" aria-current=\"{{s.current}}\" style=\"{{s.style}}\">\n        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"{{s.icon}}\"></path></svg>\n        <span>{{s.label}}</span>\n      </button>\n    </sc-for>\n  </nav>\n\n  <div style=\"flex: 1; min-width: 0; display: flex; flex-direction: column\">\n    <header style=\"display: flex; align-items: center; justify-content: space-between; padding: 22px 28px 12px\">\n      <h2 style=\"margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em\">{{title}}</h2>\n      <button class=\"st-btn\" aria-label=\"Close settings\" onClick=\"{{close}}\" style=\"{{iconBtn}}\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6 6 18\"></path></svg></button>\n    </header>\n    <sc-if value=\"{{notice}}\" hint-placeholder-val=\"{{false}}\">\n      <p role=\"status\" style=\"{{noticeStyle}}\">{{notice}}</p>\n    </sc-if>\n    <div class=\"noscroll\" style=\"flex: 1; overflow-y: auto; scrollbar-width: none; padding: 4px 28px 28px\">\n\n      <sc-if value=\"{{is.general}}\" hint-placeholder-val=\"{{true}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\">\n              <label for=\"st-name\" style=\"font-weight: 700\">Box name</label>\n              <input id=\"st-name\" class=\"st-sel\" value=\"{{boxName}}\" onInput=\"{{setBoxName}}\" style=\"width: 220px\">\n            </div>\n            <p class=\"st-help\">Home Assistant Green \u00b7 reachable at {{hostname}} on your home network.</p>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><label for=\"st-lang\">Language</label><select id=\"st-lang\" class=\"st-sel\" disabled><option>English</option></select></div>\n            <div class=\"st-row\"><label for=\"st-tz\">Time zone</label>\n              <select id=\"st-tz\" class=\"st-sel\" value=\"{{tz}}\" onChange=\"{{setTz}}\">\n                <option value=\"local\">This browser</option><option value=\"UTC\">UTC</option><option value=\"America/New_York\">America / New York</option><option value=\"America/Chicago\">America / Chicago</option><option value=\"America/Los_Angeles\">America / Los Angeles</option><option value=\"Europe/London\">Europe / London</option><option value=\"Europe/Paris\">Europe / Paris</option><option value=\"Asia/Tokyo\">Asia / Tokyo</option>\n              </select>\n            </div>\n            <div class=\"st-row\"><span>Time format</span>\n              <div role=\"group\" aria-label=\"Time format\" style=\"{{segWrap}}\">\n                <button class=\"st-btn\" aria-pressed=\"{{h24.on}}\" onClick=\"{{h24.pick}}\" style=\"{{h24.style}}\">24-hour</button>\n                <button class=\"st-btn\" aria-pressed=\"{{h12.on}}\" onClick=\"{{h12.pick}}\" style=\"{{h12.style}}\">12-hour</button>\n              </div>\n            </div>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span>Disk standby</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.standby.on}}\" aria-label=\"Disk standby\" onClick=\"{{t.standby.flip}}\" style=\"{{t.standby.track}}\"><span style=\"{{t.standby.knob}}\"></span></button></div>\n            <div class=\"st-row\"><span>Battery backup (UPS)</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.ups.on}}\" aria-label=\"Battery backup\" onClick=\"{{t.ups.flip}}\" style=\"{{t.ups.track}}\"><span style=\"{{t.ups.knob}}\"></span></button></div>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.appearance}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Appearance</span>\n              <div role=\"group\" aria-label=\"Appearance\" style=\"{{segWrap}}\">\n                <button class=\"st-btn\" aria-pressed=\"{{lightSeg.on}}\" onClick=\"{{lightSeg.pick}}\" style=\"{{lightSeg.style}}\">Light</button>\n                <button class=\"st-btn\" aria-pressed=\"{{darkSeg.on}}\" onClick=\"{{darkSeg.pick}}\" style=\"{{darkSeg.style}}\">Dark</button>\n              </div>\n            </div>\n            <span style=\"font-weight: 700\">Wallpaper</span>\n            <div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px\">\n              <sc-for list=\"{{walls}}\" as=\"w\" hint-placeholder-count=\"3\">\n                <button class=\"st-btn\" aria-pressed=\"{{w.on}}\" onClick=\"{{w.pick}}\" style=\"{{w.style}}\">\n                  <span style=\"{{w.swatch}}\"></span>\n                  <span style=\"font-size: 13px; font-weight: 600\">{{w.label}}</span>\n                </button>\n              </sc-for>\n            </div>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\">\n              <label for=\"st-glass\" style=\"font-weight: 700\">Glass</label>\n              <div style=\"display: flex; align-items: center; gap: 10px; width: 300px\">\n                <span style=\"font-size: 12px; opacity: .7\">Liquid</span>\n                <input id=\"st-glass\" type=\"range\" min=\"0\" max=\"100\" value=\"{{frost}}\" onInput=\"{{setFrost}}\" style=\"flex: 1; accent-color: #d97757; min-height: 28px\">\n                <span style=\"font-size: 12px; opacity: .7\">Blurred</span>\n              </div>\n            </div>\n            <p class=\"st-help\">Liquid glass bends the wallpaper behind it and uses more processing power. On the Green, keep it toward Blurred if the screen feels slow.</p>\n            <div class=\"st-row\"><span>Reduce motion</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.motion.on}}\" aria-label=\"Reduce motion\" onClick=\"{{t.motion.flip}}\" style=\"{{t.motion.track}}\"><span style=\"{{t.motion.knob}}\"></span></button></div>\n          </div>\n        </div>\n      </sc-if>\n\n\n      <sc-if value=\"{{is.storage}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <sc-for list=\"{{disks}}\" as=\"d\" hint-placeholder-count=\"2\">\n            <div class=\"st-card\" style=\"{{card}}\">\n              <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">{{d.name}}</span><span style=\"font-size: 13px; opacity: .7\">{{d.kind}}</span></div><strong>{{d.used}}</strong></div>\n              <span style=\"{{meterTrack}}\"><span style=\"{{d.bar}}\"></span></span>\n              <p class=\"st-help\">{{d.note}}</p>\n            </div>\n          </sc-for>\n          <div style=\"display: flex; gap: 10px\">\n            <button class=\"st-btn\" onClick=\"{{createStorage}}\" style=\"{{pillAccent}}\">Create storage</button>\n            <button class=\"st-btn\" onClick=\"{{refreshDisks}}\" style=\"{{pill}}\">Refresh disks</button>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.network}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Ethernet</span><span style=\"{{okTag}}\">Connected</span></div>\n            <div class=\"st-row\"><span>Address</span><span style=\"opacity: .75\">[box IP]</span></div>\n            <div class=\"st-row\"><span>Name on your network</span><span style=\"opacity: .75\">{{hostname}}</span></div>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Access away from home</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.remote.on}}\" aria-label=\"Access away from home\" onClick=\"{{t.remote.flip}}\" style=\"{{t.remote.track}}\"><span style=\"{{t.remote.knob}}\"></span></button></div>\n            <p class=\"st-help\">A private, encrypted tunnel to your box. Nothing is opened on your router.</p>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.apps}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <sc-for list=\"{{apps}}\" as=\"a\" hint-placeholder-count=\"4\">\n              <div class=\"st-row\">\n                <button class=\"st-btn\" aria-expanded=\"{{a.expanded}}\" aria-label=\"{{a.manageLabel}}\" onClick=\"{{a.expand}}\" style=\"display: flex; align-items: center; gap: 12px; flex: 1; background: none; border: none; padding: 0; text-align: left\">\n                  <img src=\"{{a.img}}\" alt=\"\" style=\"width: 32px; height: 32px; object-fit: contain\">\n                  <span style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">{{a.name}}</span><span style=\"font-size: 13px; opacity: .7\">{{a.status}} \u00b7 {{a.version}}</span></span>\n                  <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\" style=\"{{a.chev}}\"><path d=\"M9 6l6 6-6 6\"></path></svg>\n                </button>\n                <button class=\"st-btn\" onClick=\"{{a.toggle}}\" style=\"{{pill}}\">{{a.action}}</button>\n              </div>\n              <sc-if value=\"{{a.open}}\" hint-placeholder-val=\"{{false}}\">\n                <div class=\"st-app\" style=\"{{a.panel}}\">\n                  <div style=\"display: flex; flex-wrap: wrap; gap: 8px\">\n                    <button class=\"st-btn\" onClick=\"{{a.openApp}}\" style=\"{{pillAccent}}\">Open</button>\n                    <button class=\"st-btn\" onClick=\"{{a.restart}}\" style=\"{{pill}}\">Restart</button>\n                    <button class=\"st-btn\" onClick=\"{{a.update}}\" style=\"{{pill}}\">{{a.updateLabel}}</button>\n                    <button class=\"st-btn\" onClick=\"{{a.backup}}\" style=\"{{pill}}\">Back up now</button>\n                  </div>\n                  <div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px\">\n                    <div style=\"{{statBox}}\"><span style=\"font-size: 12px; opacity: .65\">Memory</span><strong>{{a.mem}}</strong></div>\n                    <div style=\"{{statBox}}\"><span style=\"font-size: 12px; opacity: .65\">Storage</span><strong>{{a.disk}}</strong></div>\n                    <div style=\"{{statBox}}\"><span style=\"font-size: 12px; opacity: .65\">Address</span><strong>{{a.addr}}</strong></div>\n                  </div>\n                  <div class=\"st-row\"><span>Start when JenerOS starts</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{a.autoOn}}\" aria-label=\"Start automatically\" onClick=\"{{a.autoFlip}}\" style=\"{{a.autoTrack}}\"><span style=\"{{a.autoKnob}}\"></span></button></div>\n                  <div class=\"st-row\"><span>Update automatically</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{a.updOn}}\" aria-label=\"Update automatically\" onClick=\"{{a.updFlip}}\" style=\"{{a.updTrack}}\"><span style=\"{{a.updKnob}}\"></span></button></div>\n                  <div class=\"st-row\"><span>Reach it from outside home</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{a.remoteOn}}\" aria-label=\"Remote access\" onClick=\"{{a.remoteFlip}}\" style=\"{{a.remoteTrack}}\"><span style=\"{{a.remoteKnob}}\"></span></button></div>\n                  <label style=\"display: flex; flex-direction: column; gap: 8px\">\n                    <span style=\"display: flex; justify-content: space-between\"><span>Memory limit</span><strong>{{a.limit}} MB</strong></span>\n                    <input type=\"range\" min=\"256\" max=\"4096\" step=\"256\" value=\"{{a.limit}}\" onInput=\"{{a.setLimit}}\" style=\"width: 100%; accent-color: #d97757\">\n                  </label>\n                  <label style=\"display: flex; flex-direction: column; gap: 6px\">\n                    <span>Port</span>\n                    <input class=\"st-in\" type=\"number\" value=\"{{a.port}}\" onInput=\"{{a.setPort}}\" style=\"{{inputStyle}}\">\n                  </label>\n                  <div style=\"display: flex; flex-direction: column; gap: 6px\">\n                    <span>Recent log</span>\n                    <pre style=\"{{logStyle}}\">{{a.log}}</pre>\n                  </div>\n                  <div style=\"display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; border-top: 1px solid rgba(127,127,127,.2)\">\n                    <button class=\"st-btn\" onClick=\"{{a.reset}}\" style=\"{{pill}}\">{{a.resetLabel}}</button>\n                    <button class=\"st-btn\" onClick=\"{{a.removeKeep}}\" style=\"{{a.dangerKeep}}\">{{a.removeKeepLabel}}</button>\n                    <button class=\"st-btn\" onClick=\"{{a.removeAll}}\" style=\"{{a.dangerAll}}\">{{a.removeAllLabel}}</button>\n                  </div>\n                </div>\n              </sc-if>\n            </sc-for>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span>Update apps automatically</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.appUpdates.on}}\" aria-label=\"Update apps automatically\" onClick=\"{{t.appUpdates.flip}}\" style=\"{{t.appUpdates.track}}\"><span style=\"{{t.appUpdates.knob}}\"></span></button></div>\n            <p class=\"st-help\">Removing an app keeps its data unless you choose to delete it.</p>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.security}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Password</span><button class=\"st-btn\" onClick=\"{{changePassword}}\" style=\"{{pill}}\">Change password</button></div>\n            <div class=\"st-row\"><span>Two-step sign-in</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.twoStep.on}}\" aria-label=\"Two-step sign-in\" onClick=\"{{t.twoStep.flip}}\" style=\"{{t.twoStep.track}}\"><span style=\"{{t.twoStep.knob}}\"></span></button></div>\n            <div class=\"st-row\"><span>Slow down repeated wrong passwords</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.rateLimit.on}}\" aria-label=\"Slow down repeated wrong passwords\" onClick=\"{{t.rateLimit.flip}}\" style=\"{{t.rateLimit.track}}\"><span style=\"{{t.rateLimit.knob}}\"></span></button></div>\n            <div class=\"st-row\"><span>Firewall</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.firewall.on}}\" aria-label=\"Firewall\" onClick=\"{{t.firewall.flip}}\" style=\"{{t.firewall.track}}\"><span style=\"{{t.firewall.knob}}\"></span></button></div>\n            <div class=\"st-row\"><span>Developer access (SSH)</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.ssh.on}}\" aria-label=\"Developer access SSH\" onClick=\"{{t.ssh.flip}}\" style=\"{{t.ssh.track}}\"><span style=\"{{t.ssh.knob}}\"></span></button></div>\n            <p class=\"st-help\">Leave SSH off unless you need a terminal on the box.</p>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <span style=\"font-weight: 700\">Signed in</span>\n            <sc-for list=\"{{sessions}}\" as=\"x\" hint-placeholder-count=\"2\">\n              <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span>{{x.device}}</span><span style=\"font-size: 13px; opacity: .7\">{{x.when}}</span></div>\n                <sc-if value=\"{{x.other}}\" hint-placeholder-val=\"{{true}}\"><button class=\"st-btn\" onClick=\"{{x.end}}\" style=\"{{pill}}\">Sign out</button></sc-if>\n                <sc-if value=\"{{x.self}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 13px; opacity: .7\">This device</span></sc-if>\n              </div>\n            </sc-for>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Encrypted connection</span><span style=\"{{okTag}}\">HTTPS on</span></div>\n            <p class=\"st-help\">Certificate fingerprint: [fingerprint]. Check it matches the one on your box's screen the first time you connect.</p>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.updates}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">JenerOS [version]</span><span style=\"font-size: 13px; opacity: .7\">{{updateText}}</span></div>\n              <button class=\"st-btn\" onClick=\"{{checkUpdates}}\" disabled=\"{{checking}}\" style=\"{{pill}}\">Check now</button></div>\n            <div class=\"st-row\"><span>Install updates automatically</span><button class=\"st-btn\" role=\"switch\" aria-checked=\"{{t.autoUpdate.on}}\" aria-label=\"Install updates automatically\" onClick=\"{{t.autoUpdate.flip}}\" style=\"{{t.autoUpdate.track}}\"><span style=\"{{t.autoUpdate.knob}}\"></span></button></div>\n            <p class=\"st-help\">Updates are signed and checked before they install. If one fails to start, JenerOS goes back to the previous version by itself.</p>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">Previous version</span><span style=\"font-size: 13px; opacity: .7\">Still installed, ready to start</span></div>\n              <button class=\"st-btn\" onClick=\"{{rollback}}\" style=\"{{pill}}\">{{rollbackLabel}}</button></div>\n          </div>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.account}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><label for=\"st-owner\" style=\"font-weight: 700\">Your name</label><input id=\"st-owner\" class=\"st-sel\" value=\"{{ownerName}}\" onInput=\"{{setOwner}}\" style=\"width: 220px\"></div>\n            <div class=\"st-row\"><span>Colour</span>\n              <div role=\"group\" aria-label=\"Avatar colour\" style=\"display: flex; gap: 10px\">\n                <sc-for list=\"{{avatars}}\" as=\"v\" hint-placeholder-count=\"3\">\n                  <button class=\"st-btn\" aria-label=\"{{v.label}}\" aria-pressed=\"{{v.on}}\" onClick=\"{{v.pick}}\" style=\"{{v.style}}\"></button>\n                </sc-for>\n              </div>\n            </div>\n          </div>\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><span style=\"font-weight: 700\">Family members</span><button class=\"st-btn\" onClick=\"{{addMember}}\" style=\"{{pill}}\">Add member</button></div>\n            <sc-for list=\"{{members}}\" as=\"m\" hint-placeholder-count=\"1\">\n              <div class=\"st-row\"><span>{{m.name}}</span><button class=\"st-btn\" onClick=\"{{m.remove}}\" style=\"{{pill}}\">Remove</button></div>\n            </sc-for>\n            <p class=\"st-help\">Everyone gets their own sign-in. No paid limits.</p>\n          </div>\n          <button class=\"st-btn\" onClick=\"{{signOut}}\" style=\"{{pill}}\">Sign out</button>\n        </div>\n      </sc-if>\n\n      <sc-if value=\"{{is.power}}\" hint-placeholder-val=\"{{false}}\">\n        <div class=\"st-page\" style=\"display: flex; flex-direction: column; gap: 14px\">\n          <div class=\"st-card\" style=\"{{card}}\">\n            <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">Restart</span><span style=\"font-size: 13px; opacity: .7\">Apps stop and start again in about a minute</span></div><button class=\"st-btn\" onClick=\"{{restart}}\" style=\"{{pill}}\">{{restartLabel}}</button></div>\n            <div class=\"st-row\"><div style=\"display: flex; flex-direction: column\"><span style=\"font-weight: 700\">Shut down</span><span style=\"font-size: 13px; opacity: .7\">Unplug and replug the power to start again</span></div><button class=\"st-btn\" onClick=\"{{shutdown}}\" style=\"{{pillDanger}}\">{{shutdownLabel}}</button></div>\n          </div>\n        </div>\n      </sc-if>\n\n    </div>\n  </div>\n</div>\n</div>", Component, {"light": false, "frost": 15, "wallpaper": "ribbon", "backdrop": true});
})();

(() => {

const CATALOG = [
  { id: 'home-assistant', name: 'Home Assistant', cat: 'Smart home', size: '1.1 GB', img: 'glass-assets/ba43b73a9007a33633148d33045ea823.svg', desc: 'Control lights, climate and every device in your home.' },
  { id: 'immich', name: 'Immich', cat: 'Photos', size: '820 MB', img: 'glass-assets/850a3b77b38eaaf67832e7c5b3cac656.svg', desc: 'Back up photos and videos from every phone, privately.' },
  { id: 'jellyfin', name: 'Jellyfin', cat: 'Media', size: '410 MB', img: 'glass-assets/7b68198886e47c08abc49df0511448fb.svg', desc: 'Stream your movies, shows and music to any screen.' },
  { id: 'nextcloud', name: 'Nextcloud', cat: 'Files', size: '650 MB', img: 'glass-assets/e9847bdb7d92bb1500a456cc20476a95.svg', desc: 'Your own cloud drive, calendar and contacts.' },
  { id: 'vaultwarden', name: 'Vaultwarden', cat: 'Security', size: '90 MB', img: 'glass-assets/e970bc8bb9875cca9587f67badb17b28.svg', desc: 'A password manager that works with the Bitwarden apps.' },
  { id: 'adguard-home', name: 'AdGuard Home', cat: 'Network', size: '60 MB', img: 'glass-assets/ae03b88e4a1b8bf4cd73abe00cdcd60d.svg', desc: 'Block ads and trackers for every device on your network.' },
  { id: 'pi-hole', name: 'Pi-hole', cat: 'Network', size: '120 MB', img: 'glass-assets/77b34d719cf302e5220bf6e28849e9fb.png', desc: 'Network-wide ad blocking with detailed stats.' },
  { id: 'plex', name: 'Plex', cat: 'Media', size: '380 MB', img: 'glass-assets/84ef001f0c5180e44276b236c9feea47.svg', desc: 'Organise and stream your media library.' },
  { id: 'paperless-ngx', name: 'Paperless-ngx', cat: 'Files', size: '540 MB', img: 'glass-assets/afdec13d385d2e15e82d8031c373a4d4.svg', desc: 'Scan, index and search all your paper documents.' },
  { id: 'uptime-kuma', name: 'Uptime Kuma', cat: 'Tools', size: '150 MB', img: 'glass-assets/642d685ac31c195e6dc5a6fd4e83719b.svg', desc: 'Watch your sites and services and get alerts.' },
  { id: 'frigate', name: 'Frigate', cat: 'Smart home', size: '1.4 GB', img: 'glass-assets/9410922bf922f4cfaecb4c23d9cce782.svg', desc: 'Security camera recorder with object detection.' },
  { id: 'node-red', name: 'Node-RED', cat: 'Smart home', size: '230 MB', img: 'glass-assets/cc1f14d215db0c3eca817162f928d6f5.svg', desc: 'Build automations by wiring blocks together.' },
  { id: 'esphome', name: 'ESPHome', cat: 'Smart home', size: '310 MB', img: 'glass-assets/434352c361d38dfed91522286d6ba91f.svg', desc: 'Make your own smart sensors and switches.' },
  { id: 'zigbee2mqtt', name: 'Zigbee2MQTT', cat: 'Smart home', size: '140 MB', img: 'glass-assets/eb28108ec613aed31d011b0ad9e0fed3.png', desc: 'Use Zigbee devices without the brand hubs.' },
  { id: 'mosquitto', name: 'Mosquitto', cat: 'Smart home', size: '20 MB', img: 'glass-assets/13248d3343030443e9c85e46514228e7.svg', desc: 'The message broker many smart devices talk through.' },
  { id: 'audiobookshelf', name: 'Audiobookshelf', cat: 'Media', size: '200 MB', img: 'glass-assets/ecddcd33a019413960d3e561bcc3d4bb.png', desc: 'Your audiobooks and podcasts, synced across devices.' },
  { id: 'navidrome', name: 'Navidrome', cat: 'Media', size: '70 MB', img: 'glass-assets/a0fa23c12e839a467306c4ad85b41578.png', desc: 'Stream your own music collection anywhere.' },
  { id: 'mealie', name: 'Mealie', cat: 'Tools', size: '260 MB', img: 'glass-assets/3f2a6b14c27a904bd3839605b403d355.png', desc: 'Save recipes and plan meals for the week.' },
  { id: 'syncthing', name: 'Syncthing', cat: 'Files', size: '45 MB', img: 'glass-assets/4403cae89b2b1066148f15aaaf953406.png', desc: 'Keep folders in sync between your devices, no cloud.' },
  { id: 'photoprism', name: 'PhotoPrism', cat: 'Photos', size: '700 MB', img: 'glass-assets/b33f2d3b2256877ce274f57a1870c88b.png', desc: 'Browse and search your photos with smart tagging.' },
  { id: 'gitea', name: 'Gitea', cat: 'Developer', size: '160 MB', img: 'glass-assets/13e848a4dd7696eeb71e881309de9b58.png', desc: 'Host your own Git repositories.' },
  { id: 'forgejo', name: 'Forgejo', cat: 'Developer', size: '170 MB', img: 'glass-assets/95c60feb4e04b21a9c07c33679e762c2.png', desc: 'A community-run Git forge for your code.' },
  { id: 'code-server', name: 'code-server', cat: 'Developer', size: '520 MB', img: 'glass-assets/0d5d22526961ec7ea758341ba27607fb.png', desc: 'A full code editor in your browser.' },
  { id: 'grafana', name: 'Grafana', cat: 'Tools', size: '330 MB', img: 'glass-assets/8ef83c24f4dfa150a33d12ccf0b26645.png', desc: 'Beautiful dashboards for any data.' },
  { id: 'portainer', name: 'Portainer', cat: 'Developer', size: '260 MB', img: 'glass-assets/4ba1736afe792cc32a8d543b189f4732.png', desc: 'Manage containers with a friendly interface.' },
  { id: 'dockge', name: 'Dockge', cat: 'Developer', size: '120 MB', img: 'glass-assets/5692998b61413db3add23038556a2bcf.png', desc: 'Write and run compose stacks from a simple page.' },
  { id: 'tailscale', name: 'Tailscale', cat: 'Network', size: '80 MB', img: 'glass-assets/4efacf7957a9ed5630a1f5dd8588c9e4.png', desc: 'Reach your box from anywhere, safely.' },
  { id: 'wireguard', name: 'WireGuard', cat: 'Network', size: '30 MB', img: 'glass-assets/6a4c18ba2f67f9791446b3c12323ed9c.png', desc: 'A fast, simple VPN into your home network.' },
  { id: 'nginx-proxy-manager', name: 'Nginx Proxy Manager', cat: 'Network', size: '190 MB', img: 'glass-assets/1a638a54e2372eec349c4c9013d0eca2.png', desc: 'Give apps nice addresses with HTTPS.' },
  { id: 'bitcoin', name: 'Bitcoin Node', cat: 'Finance', size: '1.2 GB', img: 'glass-assets/c37eb659692c8553a47de1301349ef59.png', desc: 'Run your own Bitcoin node and verify for yourself.' },
  { id: 'sonarr', name: 'Sonarr', cat: 'Media', size: '210 MB', img: 'glass-assets/54b6bb96233ead71b71271a5f2811d22.png', desc: 'Track and organise your TV shows.' },
  { id: 'radarr', name: 'Radarr', cat: 'Media', size: '210 MB', img: 'glass-assets/c4e45bf8bc0dd1ca792395d8384e88c2.png', desc: 'Track and organise your movie collection.' },
  { id: 'prowlarr', name: 'Prowlarr', cat: 'Media', size: '180 MB', img: 'glass-assets/ab0758ab26e6763c4213afd50b6346b6.png', desc: 'One place to manage your media indexers.' },
  { id: 'qbittorrent', name: 'qBittorrent', cat: 'Media', size: '95 MB', img: 'glass-assets/3bbe444c144a94d34045324824b9e1cc.png', desc: 'A light download client with a web interface.' },
  { id: 'transmission', name: 'Transmission', cat: 'Media', size: '40 MB', img: 'glass-assets/02d1a4dc64106744cbe26e4cb8dd655f.png', desc: 'A simple, tiny download client.' },
  { id: 'calibre-web', name: 'Calibre-Web', cat: 'Media', size: '230 MB', img: 'glass-assets/510d0ad0a08f345f22951f5c6fe5507a.png', desc: 'Your ebook library, readable in the browser.' },
  { id: 'kavita', name: 'Kavita', cat: 'Media', size: '150 MB', img: 'glass-assets/b0ee15aa83cdd19e714666a3807f35dc.png', desc: 'Read comics, manga and books from your library.' },
  { id: 'linkding', name: 'linkding', cat: 'Tools', size: '60 MB', img: 'glass-assets/73ef86afbf710f7b03dbc3b80374d42a.png', desc: 'Save and tag bookmarks in one place.' },
  { id: 'miniflux', name: 'Miniflux', cat: 'Tools', size: '35 MB', img: 'glass-assets/de78cf5a6cefaec46fe0836bc7defb30.png', desc: 'A minimal, fast news reader.' },
  { id: 'freshrss', name: 'FreshRSS', cat: 'Tools', size: '90 MB', img: 'glass-assets/5a5e340f5ecd278e25176ec5584c49b8.png', desc: 'Follow your favourite sites with RSS.' },
  { id: 'actual-budget', name: 'Actual Budget', cat: 'Finance', size: '110 MB', img: 'glass-assets/38f32ae84ea92fa9b5bd24f4f2f6724f.png', desc: 'Simple, private budgeting that you own.' },
  { id: 'firefly-iii', name: 'Firefly III', cat: 'Finance', size: '380 MB', img: 'glass-assets/728eee990bb97578899cb5e2940059fd.png', desc: 'Track spending, budgets and bills.' },
  { id: 'n8n', name: 'n8n', cat: 'Tools', size: '480 MB', img: 'glass-assets/bdd8155287218511d576420ad485b210.png', desc: 'Automate anything by connecting your apps.' },
  { id: 'homebox', name: 'Homebox', cat: 'Tools', size: '40 MB', img: 'glass-assets/ac9ff18a2550c4adf0d76300e3b028c9.png', desc: 'Keep an inventory of everything you own.' },
  { id: 'stirling-pdf', name: 'Stirling PDF', cat: 'Files', size: '420 MB', img: 'glass-assets/1036c6d93118ca929e2fa923e15763b8.png', desc: 'Merge, split, sign and convert PDFs privately.' },
  { id: 'filebrowser', name: 'File Browser', cat: 'Files', size: '30 MB', img: 'glass-assets/0104fd4c4e4c04de54fc953a7e72a2f1.png', desc: 'Browse and share files on your box.' },
  { id: 'duplicati', name: 'Duplicati', cat: 'Files', size: '240 MB', img: 'glass-assets/de485d1fb58e8d8e93ed5559e545a780.png', desc: 'Encrypted backups to any cloud or disk.' },
  { id: 'ollama', name: 'Ollama', cat: 'AI', size: '1.8 GB', img: 'glass-assets/7aba76e6c2a281c58c67c6e34787a72c.png', desc: 'Run AI language models on your own box.' },
  { id: 'open-webui', name: 'Open WebUI', cat: 'AI', size: '900 MB', img: 'glass-assets/9d7525917863d2bc6b1b68dda5c6dd14.png', desc: 'A chat interface for your local AI models.' },
  { id: 'searxng', name: 'SearXNG', cat: 'Security', size: '150 MB', img: 'glass-assets/257b0c57705c44ab218718d0f61f9008.png', desc: 'Private search that keeps your searches to yourself.' },
  { id: 'changedetection', name: 'changedetection.io', cat: 'Tools', size: '260 MB', img: 'glass-assets/aabac73592d9b081b6ae6ce17eef3cf2.png', desc: 'Get told when a web page changes.' },
  { id: 'memos', name: 'Memos', cat: 'Tools', size: '50 MB', img: 'glass-assets/e1571b35899e3c4fb3f0194c7f5cda56.png', desc: 'Quick private notes, like a personal timeline.' }
];
const STAGES = ['Checking the package', 'Downloading', 'Setting up', 'Starting'];
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { cat: 'All', query: '', jobs: {}, local: null, slide: 0 }; this.timers = {}; }
  componentDidMount() { this.rot = setInterval(() => this.setState({ slide: (this.state.slide + 1) % 3 }), 5000); }
  componentWillUnmount() { Object.values(this.timers).forEach(clearInterval); clearInterval(this.rot); }
  installedList() { return this.state.local ?? (Array.isArray(this.props.installed) ? this.props.installed : ['home-assistant', 'immich', 'jellyfin', 'nextcloud']); }
  install(id) {
    if (this.timers[id]) return;
    this.setState({ jobs: { ...this.state.jobs, [id]: 0 } });
    this.timers[id] = setInterval(() => {
      const p = (this.state.jobs[id] ?? 0) + 7;
      if (p >= 100) {
        clearInterval(this.timers[id]); delete this.timers[id];
        const jobs = { ...this.state.jobs }; delete jobs[id];
        this.setState({ jobs, local: [...this.installedList(), id] });
        if (typeof this.props.onInstall === 'function') this.props.onInstall(id);
      } else {
        this.setState({ jobs: { ...this.state.jobs, [id]: p } });
      }
    }, 140);
  }
  remove(id) {
    this.setState({ local: this.installedList().filter((x) => x !== id) });
    if (typeof this.props.onRemove === 'function') this.props.onRemove(id);
  }
  renderVals() {
    const light = !!this.props.light;
    const ink = light ? '#1f1913' : '#f6f1e7';
    const soft = light ? 'rgba(31,25,19,.07)' : 'rgba(255,255,255,.08)';
    const installed = this.installedList();
    const CI = { All: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z', 'Smart home': 'M3 10l9-7 9 7M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9', Media: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 9l5 3-5 3z',
      Photos: 'M3 5h18v14H3zM3 16l5-5 5 6 3-3 5 5', Files: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', Network: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0',
      Security: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', AI: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z', Developer: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14', Finance: 'M12 3v18M16.5 7.5c-.8-1.2-2.5-2-4.5-2-2.5 0-4 1.2-4 3s1.6 2.5 4 3 4 1.3 4 3.2-1.6 3.3-4.2 3.3c-2 0-3.7-.8-4.6-2.2', Tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z' };
    const cats = ['All', 'Smart home', 'Media', 'Photos', 'Files', 'Network', 'Security', 'AI', 'Developer', 'Finance', 'Tools'].map((label) => ({
      label: label === 'All' ? 'Discover' : label, icon: CI[label], on: this.state.cat === label ? 'true' : 'false', pick: () => this.setState({ cat: label }),
      style: 'flex: none; display: flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 14px; border-radius: 18px; font-size: 13px; font-weight: 700; white-space: nowrap; ' +
        (this.state.cat === label ? 'background: ' + (light ? '#ffffff' : 'rgba(255,255,255,.2)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 8px rgba(0,0,0,.2);' : 'background: ' + soft + ';')
    }));
    const q = this.state.query.trim().toLowerCase();
    const list = CATALOG.filter((a) => (this.state.cat === 'All' || a.cat === this.state.cat) && (!q || (a.name + ' ' + a.desc + ' ' + a.cat).toLowerCase().includes(q)));
    const pillBase = 'flex: none; min-height: 32px; padding: 0 14px; border-radius: 18px; font-size: 13px; font-weight: 800; ';
    const view = (a) => {
      const has = installed.includes(a.id);
      const job = this.state.jobs[a.id];
      const busy = job !== undefined;
      return { ...a, busy, idle: !busy,
        stage: busy ? STAGES[Math.min(3, Math.floor(job / 25))] + '…' : '',
        bar: 'display: block; height: 100%; border-radius: 3px; background: #d97757; transition: width .14s linear; width: ' + (job || 0) + '%;',
        label: busy ? 'Installing' : (has ? 'Open' : 'Install'), aria: (has ? 'Open ' : 'Install ') + a.name,
        act: () => (busy ? null : has ? (typeof this.props.onClose === 'function' && this.props.onClose()) : this.install(a.id)),
        btn: pillBase + (has ? 'background: ' + soft + ';' : 'background: #b9562f; color: #ffffff;')
      };
    };
    const apps = list.slice().sort((x, y) => x.name.localeCompare(y.name)).map(view);
    const pick = (ids) => ids.map((id) => CATALOG.find((a) => a.id === id)).filter(Boolean).map(view);
    const popular = pick(['home-assistant', 'immich', 'jellyfin', 'vaultwarden', 'adguard-home', 'frigate', 'nextcloud']);
    const HERO = [
      { id: 'home-assistant', title: 'Your whole home, on one screen', art: 'linear-gradient(120deg, #0b3c5d, #18bcf2 55%, #8fe3ff)' },
      { id: 'immich', title: 'Every photo, backed up privately', art: 'linear-gradient(120deg, #3a0d2e, #ed79b5 50%, #ffb400)' },
      { id: 'jellyfin', title: 'Your movies, on every screen', art: 'linear-gradient(120deg, #1d0f3a, #aa5cc3 50%, #00a4dc)' }
    ];
    const slides = HERO.map((h, i) => {
      const a = view(CATALOG.find((c) => c.id === h.id));
      const on = this.state.slide === i;
      return { ...a, title: h.title,
        style: 'position: absolute; inset: 0; color: #ffffff; background: ' + h.art + '; transition: opacity .8s ease, transform 1.2s cubic-bezier(.2,.8,.2,1); opacity: ' + (on ? 1 : 0) + '; transform: scale(' + (on ? 1 : 1.06) + '); pointer-events: ' + (on ? 'auto' : 'none') + ';',
        btn: 'align-self: flex-start; margin-top: 8px; min-height: 36px; padding: 0 18px; border-radius: 18px; font-size: 13px; font-weight: 800; color: #1f1913; background: rgba(255,255,255,.92);' };
    });
    const dots = HERO.map((h, i) => ({ label: 'Show slide ' + (i + 1), go: () => this.setState({ slide: i }),
      style: 'height: 6px; border-radius: 3px; padding: 0; transition: width .3s, background .3s; width: ' + (this.state.slide === i ? '24px' : '6px') + '; background: ' + (this.state.slide === i ? ink : (light ? 'rgba(31,25,19,.25)' : 'rgba(255,255,255,.3)')) + ';' }));
    const most = pick(['home-assistant', 'immich', 'nextcloud', 'jellyfin', 'pi-hole', 'vaultwarden', 'plex', 'paperless-ngx', 'uptime-kuma']);
    return {
      winStyle: 'box-sizing: border-box; display: flex; flex-direction: column; width: 1100px; height: 720px; border-radius: 30px; overflow: hidden; font-family: "Bricolage Grotesque", system-ui, sans-serif; color: ' + ink + '; background: ' + (light ? 'rgba(250,246,238,.62)' : 'rgba(30,23,17,.55)') + '; backdrop-filter: blur(26px) saturate(170%); -webkit-backdrop-filter: blur(26px) saturate(170%); border: 1px solid rgba(255,255,255,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 40px 90px rgba(0,0,0,.45);',
      searchStyle: 'position: relative; width: 260px; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 20px; background: ' + soft + ';',
      iconBtn: 'width: 40px; height: 40px; flex: none; border-radius: 20px; display: flex; align-items: center; justify-content: center; background: ' + soft + ';',
      featureStyle: 'display: flex; align-items: center; gap: 20px; padding: 22px 24px; margin-bottom: 16px; border-radius: 24px; background: linear-gradient(120deg, rgba(24,188,242,.22), rgba(217,119,87,.18)); box-shadow: inset 0 1px 0 rgba(255,255,255,.25);',
      showFeature: this.state.cat === 'All' && !q,
      card: 'display: flex; flex-direction: column; gap: 12px; min-height: 172px; padding: 18px; border-radius: 22px; box-sizing: border-box; background: ' + (light ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.06)') + '; box-shadow: inset 0 1px 0 rgba(255,255,255,' + (light ? '.9' : '.12') + ');',
      track: 'display: block; height: 6px; border-radius: 3px; overflow: hidden; background: ' + soft + ';',
      stageStyle: this.props.backdrop === false ? 'display: contents;' : 'overflow: hidden; width: 1100px; height: 720px; background: ' + (light ? '#f6f1e7 url(glass-assets/6f5f5dbf18010018d7b7e9e71bc02e48.svg)' : '#1f1913 url(glass-assets/a660d335a6a1a88e203551e9f8742a06.svg)') + ' center / cover;',
      pageTitle: this.state.cat === 'All' ? 'Discover' : this.state.cat,
      sideStyle: 'width: 236px; flex: none; display: flex; flex-direction: column; padding: 20px 12px; background: ' + (light ? 'rgba(31,25,19,.05)' : 'rgba(255,255,255,.05)') + ';',
      slides, dots, prev: () => this.setState({ slide: (this.state.slide + 2) % 3 }), next: () => this.setState({ slide: (this.state.slide + 1) % 3 }),
      popular, most, listTitle: this.state.cat === 'All' && !q ? 'All apps' : (q ? 'Results' : this.state.cat),
      popCard: 'display: flex; flex-direction: column; align-items: center; padding: 18px 8px 16px; border-radius: 20px; background: ' + soft + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.14);',
      panel: 'padding: 20px 22px; border-radius: 24px; background: ' + soft + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.12);',
      cats, apps, empty: apps.length === 0, query: this.state.query,
      setQuery: (e) => this.setState({ query: e.target.value }),
      close: () => { if (typeof this.props.onClose === 'function') this.props.onClose(); }
    };
  }
}

DC.define("Store", "<div style=\"{{stageStyle}}\">\n<div class=\"sa-win\" style=\"{{winStyle}}\">\n  <header style=\"display: flex; align-items: center; gap: 16px; padding: 24px 32px 12px\">\n    <h2 style=\"margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; flex: 1\">App Store</h2>\n    <label style=\"{{searchStyle}}\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"m20 20-3.5-3.5\"></path></svg>\n      <span style=\"position: absolute; width: 1px; height: 1px; overflow: hidden\">Search apps</span>\n      <input class=\"sa-in\" type=\"search\" placeholder=\"Search apps\" value=\"{{query}}\" onInput=\"{{setQuery}}\">\n    </label>\n    <button class=\"sa-btn\" aria-label=\"Close App Store\" onClick=\"{{close}}\" style=\"{{iconBtn}}\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6 6 18\"></path></svg></button>\n  </header>\n  <div role=\"tablist\" aria-label=\"Categories\" class=\"noscroll\" style=\"display: flex; gap: 6px; padding: 0 32px 16px; overflow-x: auto; scrollbar-width: none; flex: none\">\n    <sc-for list=\"{{cats}}\" as=\"c\" hint-placeholder-count=\"8\">\n      <button class=\"sa-btn\" role=\"tab\" aria-selected=\"{{c.on}}\" onClick=\"{{c.pick}}\" style=\"{{c.style}}\">\n        <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"{{c.icon}}\"></path></svg>\n        <span>{{c.label}}</span>\n      </button>\n    </sc-for>\n  </div>\n  <div class=\"noscroll\" style=\"flex: 1; overflow-y: auto; scrollbar-width: none; padding: 0 32px 32px\">\n    <sc-if value=\"{{showFeature}}\" hint-placeholder-val=\"{{true}}\">\n      <div style=\"position: relative; height: 250px; border-radius: 26px; overflow: hidden; margin-bottom: 12px\">\n        <sc-for list=\"{{slides}}\" as=\"h\" hint-placeholder-count=\"3\">\n          <div style=\"{{h.style}}\">\n            <div style=\"position: absolute; inset: 0; background: linear-gradient(90deg, rgba(10,7,5,.75), rgba(10,7,5,.1) 70%)\"></div>\n            <img src=\"{{h.img}}\" alt=\"\" class=\"sa-float\" style=\"position: absolute; right: 70px; top: 50%; width: 150px; height: 150px; object-fit: contain; margin-top: -75px; filter: drop-shadow(0 24px 40px rgba(0,0,0,.5))\">\n            <div style=\"position: relative; max-width: 460px; padding: 40px 40px; display: flex; flex-direction: column; gap: 10px\">\n              <span style=\"font-size: 13px; font-weight: 700; opacity: .85\">{{h.name}}</span>\n              <span style=\"font-size: 30px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em\">{{h.title}}</span>\n              <button class=\"sa-btn\" onClick=\"{{h.act}}\" style=\"{{h.btn}}\">{{h.label}}</button>\n            </div>\n          </div>\n        </sc-for>\n      </div>\n      <div style=\"display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px\">\n        <div style=\"display: flex; gap: 6px\">\n          <sc-for list=\"{{dots}}\" as=\"o\" hint-placeholder-count=\"3\">\n            <button class=\"sa-btn\" aria-label=\"{{o.label}}\" onClick=\"{{o.go}}\" style=\"{{o.style}}\"></button>\n          </sc-for>\n        </div>\n        <div style=\"display: flex; gap: 8px\">\n          <button class=\"sa-btn\" aria-label=\"Previous\" onClick=\"{{prev}}\" style=\"{{iconBtn}}\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M15 6l-6 6 6 6\"></path></svg></button>\n          <button class=\"sa-btn\" aria-label=\"Next\" onClick=\"{{next}}\" style=\"{{iconBtn}}\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"></path></svg></button>\n        </div>\n      </div>\n      <span style=\"font-size: 11px; font-weight: 800; letter-spacing: .08em; opacity: .55\">FEATURED</span>\n      <h3 style=\"margin: 2px 0 14px; font-size: 18px; font-weight: 800\">Loved on JenerOS</h3>\n      <div style=\"display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px\">\n        <sc-for list=\"{{popular}}\" as=\"a\" hint-placeholder-count=\"7\">\n          <button class=\"sa-btn sa-card\" onClick=\"{{a.act}}\" aria-label=\"{{a.aria}}\" style=\"{{popCard}}\">\n            <img src=\"{{a.img}}\" alt=\"\" class=\"sa-reflect\" style=\"width: 52px; height: 52px; object-fit: contain\">\n            <span style=\"font-size: 13px; font-weight: 800; margin-top: 10px\">{{a.name}}</span>\n            <span style=\"font-size: 11px; opacity: .6\">{{a.cat}}</span>\n          </button>\n        </sc-for>\n      </div>\n      <div style=\"{{panel}}\">\n        <span style=\"font-size: 11px; font-weight: 800; letter-spacing: .08em; opacity: .55\">MOST INSTALLED</span>\n        <h3 style=\"margin: 2px 0 10px; font-size: 18px; font-weight: 800\">Everyone's favourites</h3>\n        <div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 22px\">\n          <sc-for list=\"{{most}}\" as=\"a\" hint-placeholder-count=\"9\">\n          <div style=\"display: flex; align-items: center; gap: 12px; min-height: 64px\">\n            <img src=\"{{a.img}}\" alt=\"\" class=\"sa-reflect\" style=\"width: 44px; height: 44px; object-fit: contain; flex: none\">\n            <div style=\"display: flex; flex-direction: column; min-width: 0; flex: 1\">\n              <span style=\"font-size: 14px; font-weight: 800\">{{a.name}}</span>\n              <span style=\"font-size: 12px; opacity: .65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap\">{{a.desc}}</span>\n              <sc-if value=\"{{a.busy}}\" hint-placeholder-val=\"{{false}}\"><span style=\"{{track}} margin-top: 6px\"><span style=\"{{a.bar}}\"></span></span></sc-if>\n            </div>\n            <button class=\"sa-btn\" onClick=\"{{a.act}}\" aria-label=\"{{a.aria}}\" disabled=\"{{a.busy}}\" style=\"{{a.btn}}\">{{a.label}}</button>\n          </div>\n          </sc-for>\n        </div>\n      </div>\n    </sc-if>\n    <div style=\"display: flex; align-items: center; justify-content: space-between; margin: 26px 0 8px\">\n      <h3 style=\"margin: 0; font-size: 18px; font-weight: 800\">{{listTitle}}</h3>\n      <span style=\"font-size: 12px; opacity: .6\">A to Z</span>\n    </div>\n    <div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 22px\">\n      <sc-for list=\"{{apps}}\" as=\"a\" hint-placeholder-count=\"9\">\n          <div style=\"display: flex; align-items: center; gap: 12px; min-height: 64px\">\n            <img src=\"{{a.img}}\" alt=\"\" class=\"sa-reflect\" style=\"width: 44px; height: 44px; object-fit: contain; flex: none\">\n            <div style=\"display: flex; flex-direction: column; min-width: 0; flex: 1\">\n              <span style=\"font-size: 14px; font-weight: 800\">{{a.name}}</span>\n              <span style=\"font-size: 12px; opacity: .65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap\">{{a.desc}}</span>\n              <sc-if value=\"{{a.busy}}\" hint-placeholder-val=\"{{false}}\"><span style=\"{{track}} margin-top: 6px\"><span style=\"{{a.bar}}\"></span></span></sc-if>\n            </div>\n            <button class=\"sa-btn\" onClick=\"{{a.act}}\" aria-label=\"{{a.aria}}\" disabled=\"{{a.busy}}\" style=\"{{a.btn}}\">{{a.label}}</button>\n          </div>\n      </sc-for>\n    </div>\n    <sc-if value=\"{{empty}}\" hint-placeholder-val=\"{{false}}\">\n      <p style=\"margin: 40px 0; text-align: center; font-size: 15px; opacity: .7\">No apps match \u201c{{query}}\u201d.</p>\n    </sc-if>\n  </div>\n</div>\n</div>", Component, {"light": false, "backdrop": true});
})();

(() => {

const STEPS = ['Waking up', 'Checking the system', 'Starting your apps', 'Connecting Home Assistant', 'Almost home'];
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { step: 0 }; }
  componentDidMount() { this.t = setInterval(() => this.setState({ step: (this.state.step + 1) % STEPS.length }), 2000); }
  componentWillUnmount() { clearInterval(this.t); }
  renderVals() {
    const letters = (word, gap, rot) => [...word].map((ch, i) => ({ ch, style: '--d: ' + (i * gap).toFixed(2) + 's; --r: ' + ((i - word.length / 2) * rot) + 'deg;' }));
    const shards = Array.from({ length: 12 }, (_, i) => {
      const a = i * 2.4, r = 380 + (i % 4) * 140;
      const w = 40 + (i * 37) % 90, h = 30 + (i * 53) % 110;
      return 'width: ' + w + 'px; height: ' + h + 'px; margin: ' + (-h / 2) + 'px 0 0 ' + (-w / 2) + 'px; --x: ' + Math.round(Math.cos(a) * r) + 'px; --y: ' + Math.round(Math.sin(a) * r * .55) + 'px; --z: ' + (-200 - (i * 97) % 700) + 'px; --rx: ' + ((i * 47) % 90) + 'deg; --ry: ' + ((i * 71) % 120 - 60) + 'deg; --t: ' + (5 + (i % 4)) + 's; --d: ' + (-(i * .7)).toFixed(1) + 's; opacity: ' + (.35 + (i % 3) * .2).toFixed(2) + ';';
    });
    const slices = [-18, -12, -6, 0, 6, 12].map((z) => '--z: ' + z + 'px;');
    const bursts = Array.from({ length: 56 }, (_, i) => { const a = i * 2.39996, r = 520 + (i * 131) % 700; return '--x: ' + Math.round(Math.cos(a) * r) + 'px; --y: ' + Math.round(Math.sin(a) * r * .7) + 'px; --z: ' + ((i * 173) % 1200 - 400) + 'px; animation-delay: ' + (-(i % 5) * .01).toFixed(2) + 's;'; });
    const shocks = [0, .12, .26].map((d) => '--d: ' + d + 's;');
    const jdepth = Array.from({ length: 14 }, (_, i) => { const t = i / 13; const c = (a, b) => Math.round(a + (b - a) * t); return 'transform: translateZ(' + (20 + i * 2.2).toFixed(1) + 'px); color: rgb(' + c(110, 247) + ',' + c(70, 247) + ',' + c(52, 249) + ');' + (i === 13 ? ' filter: drop-shadow(0 0 12px rgba(255,214,190,.8));' : ''); });
    return { bursts, shocks, jdepth, w1: letters('PRIVATE.', .045, 0), w2: letters('YOURS.', .06, 40), mark: letters('JenerOS', .05, 0), shards, slices, status: STEPS[this.state.step] + '…' };
  }
}

DC.define("Splash", "<div class=\"cm-bars\" style=\"position: relative; width: 1440px; height: 900px; overflow: hidden; border-radius: 28px; background: #0d0907; font-family: 'Bricolage Grotesque', system-ui, sans-serif; color: #f6f1e7\">\n  <div class=\"cm-wall\"></div>\n  <div class=\"cm-aurora\"></div>\n  <div style=\"position: absolute; inset: 0; background: radial-gradient(60% 60% at 50% 46%, rgba(13,9,7,0), rgba(13,9,7,.8))\"></div>\n  <div class=\"cm-cam\">\n    <div class=\"cm-world\">\n      <div class=\"cm-floor\"></div>\n      <sc-for list=\"{{shards}}\" as=\"s\" hint-placeholder-count=\"10\">\n        <span class=\"cm-shard\" style=\"{{s}}\"></span>\n      </sc-for>\n      <div class=\"cm-morph\"></div>\n      <div class=\"cm-flare\"></div>\n      <sc-for list=\"{{shocks}}\" as=\"k\" hint-placeholder-count=\"3\"><span class=\"cm-shock\" style=\"{{k}}\"></span></sc-for>\n      <sc-for list=\"{{bursts}}\" as=\"b\" hint-placeholder-count=\"20\"><span class=\"cm-burst\" style=\"{{b}}\"></span></sc-for>\n      <div class=\"cm-word cm-w1\" aria-hidden=\"true\">\n        <sc-for list=\"{{w1}}\" as=\"c\" hint-placeholder-count=\"8\"><span class=\"cm-ch\" style=\"{{c.style}}\">{{c.ch}}</span></sc-for>\n      </div>\n      <div class=\"cm-word cm-w2\" aria-hidden=\"true\">\n        <sc-for list=\"{{w2}}\" as=\"c\" hint-placeholder-count=\"6\"><span class=\"cm-ch\" style=\"{{c.style}}\">{{c.ch}}</span></sc-for>\n      </div>\n      <div class=\"cm-tile\">\n        <sc-for list=\"{{slices}}\" as=\"z\" hint-placeholder-count=\"6\"><span class=\"cm-slice\" style=\"{{z}}\"></span></sc-for>\n        <sc-for list=\"{{jdepth}}\" as=\"j\" hint-placeholder-count=\"14\"><svg class=\"cm-jx\" viewBox=\"0 0 512 512\" aria-hidden=\"true\" style=\"{{j}}\"><path fill=\"currentColor\" d=\"M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z\"></path><path fill=\"currentColor\" d=\"M144 208H176V240H144Z\"></path></svg></sc-for>\n        <div class=\"cm-face\">\n          <svg class=\"cm-j\" viewBox=\"0 0 512 512\" aria-hidden=\"true\">\n            <path class=\"cm-draw\" pathLength=\"1\" d=\"M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z\" style=\"filter: drop-shadow(0 0 10px rgba(255,214,190,.9))\"></path>\n            <path class=\"cm-draw\" pathLength=\"1\" d=\"M144 208H176V240H144Z\"></path>\n            <g class=\"cm-jfill\" style=\"display: none\"><path fill=\"#F7F7F9\" d=\"M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z\"></path><path fill=\"#F7F7F9\" d=\"M144 208H176V240H144Z\"></path></g>\n          </svg>\n        </div>\n      </div>\n      <div class=\"cm-mark\" role=\"img\" aria-label=\"JenerOS\">\n        <sc-for list=\"{{mark}}\" as=\"c\" hint-placeholder-count=\"7\"><span class=\"cm-ch\" aria-hidden=\"true\" style=\"{{c.style}}\">{{c.ch}}</span></sc-for>\n      </div>\n      <div class=\"cm-ui\">\n        <div class=\"cm-track\"><div class=\"cm-bar\"></div></div>\n        <div role=\"status\" style=\"font-size: 14px; font-weight: 600; opacity: .75; min-height: 20px\">{{status}}</div>\n      </div>\n    </div>\n  </div>\n  <div class=\"cm-flash\"></div>\n  <div class=\"cm-grain\"></div>\n</div>", Component, {});
})();
