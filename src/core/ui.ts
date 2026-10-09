import type { Game } from '../game/game';

export interface MenuItem {
  label: string;
  value?: () => string;
  act?: () => void;
  left?: () => void;
  right?: () => void;
  disabled?: boolean;
}
export interface MenuDef {
  title: string; sub?: string; body?: string; items: MenuItem[];
  back?: () => void; big?: boolean; wide?: boolean; foot?: string;
}

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** DOM overlay: dialogue, subtitles, prompts, readable papers, menus, fades. */
export class UI {
  root = $('ui');
  menuDef: MenuDef | null = null;
  private menuSel = 0;
  private subs: { el: HTMLElement; until: number }[] = [];
  private toastUntil = 0;
  private hintUntil = 0;
  private cardUntil = 0;
  // dialogue line
  private lineFull = '';
  private lineShown = 0;
  private lineResolve: (() => void) | null = null;
  // choices
  private choiceResolve: ((i: number) => void) | null = null;
  private choiceEls: HTMLElement[] = [];
  private choiceSel = 0;
  // paper
  private paperResolve: (() => void) | null = null;
  private real = 0;

  constructor(private g: Game) {}

  get dialogueOpen() { return !!(this.lineResolve || this.choiceResolve); }
  get paperOpen() { return !!this.paperResolve; }
  get menuOpen() { return !!this.menuDef; }

  applySettings() {
    const s = this.g.settings;
    this.root.style.setProperty('--text-scale', String([0.86, 1, 1.2, 1.42][s.textSize] ?? 1));
    this.root.classList.toggle('contrast', s.contrast);
  }

  setObjective(html: string) {
    const el = $('objective');
    if (el.dataset.t === html) return;
    el.dataset.t = html;
    el.innerHTML = html;
    el.classList.toggle('on', !!html);
  }

  prompt(html: string | null) {
    const el = $('prompt');
    if (html) { if (el.dataset.t !== html) { el.dataset.t = html; el.innerHTML = html; } el.classList.add('on'); }
    else el.classList.remove('on');
  }

  toast(text: string) {
    $('toast').textContent = text;
    $('toast').classList.add('on');
    this.toastUntil = this.real + 2.6;
  }

  hint(html: string, dur = 9) {
    $('hint').innerHTML = html;
    $('hint').classList.add('on');
    this.hintUntil = this.real + dur;
  }

  card(title: string, sub = '', dur = 4.5) {
    $('card-title').textContent = title;
    $('card-sub').textContent = sub;
    $('card').classList.add('on');
    this.cardUntil = this.real + dur;
  }

  /** A passing subtitle (ambient speech, a thought, narration, or a sound caption). */
  caption(kind: 'say' | 'thought' | 'dream' | 'sound', text: string, who = '', color = '', dur = 0) {
    if (kind === 'sound' && !this.g.settings.captions) return;
    const el = document.createElement('div');
    el.className = 'sub ' + kind;
    el.innerHTML = (who ? `<span class="who" style="color:${color}">${esc(who)}</span>` : '') + esc(text);
    const box = $('subs');
    box.appendChild(el);
    while (box.children.length > 3) {
      box.removeChild(box.firstChild!);
      this.subs.shift();
    }
    this.subs.push({ el, until: this.g.time + (dur || Math.max(3.2, text.length * 0.065)) });
  }

  fade(on: boolean, sec = 0.6) {
    const el = $('fade');
    el.style.transitionDuration = sec + 's';
    el.style.opacity = on ? '1' : '0';
    return this.g.wait(sec + 0.05);
  }

  setVignette(v: number) { $('vignette').style.opacity = String(v); }
  setMud(v: number) { $('mud').style.opacity = String(v); }

  line(name: string, color: string, text: string, kind: string): Promise<void> {
    const box = $('dlg');
    box.className = 'on ' + kind;
    $('dlg-name').textContent = name;
    $('dlg-name').style.color = color;
    $('dlg-name').style.display = name ? '' : 'none';
    $('dlg-choices').innerHTML = '';
    $('dlg-next').style.display = '';
    this.lineFull = text;
    this.lineShown = this.g.settings.typewriter ? 0 : text.length;
    $('dlg-text').textContent = text.slice(0, this.lineShown);
    $('subs').style.display = 'none';
    return new Promise((res) => (this.lineResolve = res));
  }

  choose(opts: string[]): Promise<number> {
    const box = $('dlg');
    box.classList.add('on');
    $('dlg-next').style.display = 'none';
    const list = $('dlg-choices');
    list.innerHTML = '';
    this.choiceEls = opts.map((t, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="n">${i + 1}</span>${esc(t)}`;
      b.addEventListener('click', () => this.pick(i));
      b.addEventListener('mouseenter', () => { this.choiceSel = i; this.paintChoices(); });
      list.appendChild(b);
      return b;
    });
    this.choiceSel = 0;
    this.paintChoices();
    $('subs').style.display = 'none';
    return new Promise((res) => (this.choiceResolve = res));
  }

  private paintChoices() { this.choiceEls.forEach((e, i) => e.classList.toggle('sel', i === this.choiceSel)); }

  private pick(i: number) {
    const r = this.choiceResolve;
    if (!r) return;
    this.choiceResolve = null;
    this.choiceEls = [];
    $('dlg-choices').innerHTML = '';
    this.g.audio.blip();
    r(i);
  }

  /** For the dialogue runner: hide the box once a conversation is over. */
  closeDialogue() {
    $('dlg').className = '';
    $('subs').style.display = '';
  }

  /** A readable object: notice, slip, board, roll. */
  read(title: string, bodyHtml: string): Promise<void> {
    $('paper-title').textContent = title;
    $('paper-body').innerHTML = bodyHtml;
    $('paper').classList.add('on');
    return new Promise((res) => (this.paperResolve = res));
  }

  /** Drop every transient element (used when loading a save mid-scene). */
  reset() {
    this.lineResolve = null;
    this.choiceResolve = null;
    this.paperResolve = null;
    this.closeDialogue();
    $('paper').classList.remove('on');
    $('subs').innerHTML = '';
    this.subs = [];
    $('card').classList.remove('on');
    $('hint').classList.remove('on');
    this.prompt(null);
    this.setVignette(0);
    this.setMud(0);
  }

  // ---- menus -------------------------------------------------------------

  openMenu(def: MenuDef) {
    this.menuDef = def;
    this.menuSel = Math.max(0, def.items.findIndex((i) => !i.disabled));
    this.renderMenu();
  }

  closeMenu() {
    this.menuDef = null;
    $('menu').className = '';
    $('menu').innerHTML = '';
  }

  private renderMenu() {
    const def = this.menuDef!;
    const m = $('menu');
    m.className = 'on' + (def.big ? ' title' : '');
    m.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'panel' + (def.big ? '' : ' wide');
    p.innerHTML = (def.big ? `<h1>${def.title}</h1>` : `<h2>${def.title}</h2>`) +
      (def.sub ? `<div class="sub">${def.sub}</div>` : '') + (def.body ? `<div class="body">${def.body}</div>` : '');
    def.items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'mi' + (i === this.menuSel ? ' sel' : '');
      b.disabled = !!it.disabled;
      b.innerHTML = esc(it.label) + (it.value ? `<span class="val">◂ ${esc(it.value())} ▸</span>` : '');
      b.addEventListener('mouseenter', () => { if (!it.disabled && this.menuSel !== i) { this.menuSel = i; this.renderMenu(); } });
      b.addEventListener('click', () => this.menuAct(i, 1));
      p.appendChild(b);
    });
    const f = document.createElement('div');
    f.className = 'foot';
    f.textContent = def.foot ?? '↑ ↓ choose · Enter select · ← → adjust · Esc back';
    p.appendChild(f);
    m.appendChild(p);
  }

  private menuAct(i: number, dir: number) {
    const def = this.menuDef;
    if (!def) return;
    const it = def.items[i];
    if (!it || it.disabled) return;
    this.g.audio.init();
    this.g.audio.blip();
    if (dir < 0 && it.left) it.left();
    else if (it.right && !it.act) it.right();
    else if (it.act) it.act();
    if (this.menuDef === def) this.renderMenu();
  }

  // ---- per-frame ---------------------------------------------------------

  update(dt: number) {
    this.real += dt;
    const inp = this.g.input;
    if (this.toastUntil && this.real > this.toastUntil) { $('toast').classList.remove('on'); this.toastUntil = 0; }
    if (this.hintUntil && this.real > this.hintUntil) { $('hint').classList.remove('on'); this.hintUntil = 0; }
    if (this.cardUntil && this.real > this.cardUntil) { $('card').classList.remove('on'); this.cardUntil = 0; }
    while (this.subs.length && this.subs[0].until < this.g.time) this.subs.shift()!.el.remove();

    if (this.menuDef) {
      const def = this.menuDef, n = def.items.length;
      const stepSel = (d: number) => {
        for (let k = 0; k < n; k++) {
          this.menuSel = (this.menuSel + d + n) % n;
          if (!def.items[this.menuSel].disabled) break;
        }
        this.renderMenu();
      };
      if (inp.pressed('up')) stepSel(-1);
      else if (inp.pressed('down')) stepSel(1);
      else if (inp.pressed('navL')) this.menuAct(this.menuSel, -1);
      else if (inp.pressed('navR')) { const it = def.items[this.menuSel]; if (it.right) { it.right(); this.g.audio.blip(); this.renderMenu(); } }
      else if (inp.hit.has('Enter') || inp.hit.has('Space') || inp.hit.has('Pad0')) this.menuAct(this.menuSel, 1);
      else if (inp.pressed('pause') && def.back) def.back();
      return;
    }

    if (this.paperResolve) {
      if (inp.pressed('confirm') || inp.pressed('pause') || inp.clicked) {
        const r = this.paperResolve;
        this.paperResolve = null;
        $('paper').classList.remove('on');
        r();
      }
      return;
    }

    if (this.choiceResolve) {
      const n = this.choiceEls.length;
      const d = inp.digit();
      if (d >= 1 && d <= n) this.pick(d - 1);
      else if (inp.pressed('up')) { this.choiceSel = (this.choiceSel - 1 + n) % n; this.paintChoices(); }
      else if (inp.pressed('down')) { this.choiceSel = (this.choiceSel + 1) % n; this.paintChoices(); }
      else if (inp.pressed('confirm')) this.pick(this.choiceSel);
      return;
    }

    if (this.lineResolve) {
      const full = this.lineFull.length;
      if (this.lineShown < full) {
        this.lineShown = Math.min(full, this.lineShown + dt * 70);
        $('dlg-text').textContent = this.lineFull.slice(0, Math.floor(this.lineShown));
      }
      if (inp.pressed('confirm') || inp.clicked) {
        if (this.lineShown < full) {
          this.lineShown = full;
          $('dlg-text').textContent = this.lineFull;
        } else {
          const r = this.lineResolve;
          this.lineResolve = null;
          r();
        }
      }
    }
  }

  // ---- hooks for automated play-testing ----------------------------------
  testAdvance(choice = 0) {
    if (this.paperResolve) { const r = this.paperResolve; this.paperResolve = null; $('paper').classList.remove('on'); r(); return 'paper'; }
    if (this.choiceResolve) { this.pick(Math.min(choice, this.choiceEls.length - 1)); return 'choice'; }
    if (this.lineResolve) { const r = this.lineResolve; this.lineResolve = null; r(); return 'line'; }
    return '';
  }
  testChoices() { return this.choiceEls.map((e) => e.textContent || ''); }
}
