import * as THREE from 'three';
import { damp } from '../core/util';

// PLACEHOLDER ART: every person in the game is this one procedural low-poly
// figure, varied by colour, hat, build and height. Faces are two dots.

export interface Look {
  robe: number; trim?: number; skin?: number; hat?: 'hood' | 'cap' | 'wide' | 'tall' | 'scarf' | 'none';
  hatColor?: number; scale?: number; girth?: number; staff?: boolean; lamp?: boolean;
  kind?: 'person' | 'shining' | 'shadow'; satchel?: boolean; apron?: boolean;
}

export const OLD_ROBE = 0x6f6354;
export const NEW_ROBE = 0xf1e8d2;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let _soft: THREE.Texture | null = null;
export const softTex = () => (_soft ||= softTexture());

export class Character {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  robeMat: THREE.MeshStandardMaterial;
  phase = 0;
  t = Math.random() * 10;
  lean = 0;
  headDown = 0;
  talking = false;
  sit = false;
  /** Arm pose overrides (x rotation; negative reaches forward/up). null = swing naturally. */
  armLT: number | null = null;
  armRT: number | null = null;
  burden = new THREE.Group();
  shadowBurden = new THREE.Group();
  plank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 1), new THREE.MeshStandardMaterial({ color: 0x8a6a42, flatShading: true, roughness: 1 }));
  private sitK = 0;
  private stride = 0;

  constructor(public look: Look) {
    const kind = look.kind || 'person';
    const mk = (color: number): THREE.MeshStandardMaterial => {
      if (kind === 'shining') return new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe6a8, emissiveIntensity: 0.75, roughness: 0.6, flatShading: true });
      if (kind === 'shadow') return new THREE.MeshStandardMaterial({ color: 0x0b0910, roughness: 1, flatShading: true, transparent: true, opacity: 0.9 });
      return new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });
    };
    const g = look.girth || 1;
    const robe = (this.robeMat = mk(look.robe));
    const trim = mk(look.trim ?? 0x3a3028);
    const skin = mk(look.skin ?? 0xc79a72);
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = kind === 'person';
      parent.add(m);
      return m;
    };

    // legs (pivot at the hip)
    const legGeo = new THREE.BoxGeometry(0.17, 0.82, 0.19).translate(0, -0.41, 0);
    this.legL.position.set(0.11, 0.82, 0);
    this.legR.position.set(-0.11, 0.82, 0);
    part(legGeo, trim, this.legL);
    part(legGeo, trim, this.legR);
    if (kind === 'shadow') this.legL.visible = this.legR.visible = false;

    // torso
    this.body.position.y = 0.8;
    part(new THREE.CylinderGeometry(0.2 * g, 0.33 * g, 0.74, 7), robe, this.body, 0, 0.35, 0);
    part(new THREE.CylinderGeometry(0.33 * g, kind === 'person' ? 0.4 * g : 0.5 * g, kind === 'person' ? 0.4 : 0.86, 7), robe, this.body, 0, kind === 'person' ? -0.2 : -0.43, 0);
    if (kind === 'person') part(new THREE.CylinderGeometry(0.335 * g, 0.345 * g, 0.07, 7), trim, this.body, 0, 0.03, 0);
    if (look.apron) part(new THREE.BoxGeometry(0.36 * g, 0.62, 0.04), mk(0xe6dcc6), this.body, 0, 0.12, 0.3 * g);
    if (look.satchel) part(new THREE.BoxGeometry(0.3, 0.26, 0.14), mk(0x7a5a36), this.body, 0.36 * g, 0.02, 0.05);

    // arms (pivot at the shoulder)
    const armGeo = new THREE.BoxGeometry(0.13, 0.62, 0.13).translate(0, -0.31, 0);
    const handGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    for (const [arm, side] of [[this.armL, 1], [this.armR, -1]] as [THREE.Group, number][]) {
      arm.position.set(side * (0.2 * g + 0.085), 0.66, 0);
      arm.rotation.z = side * 0.1;
      part(armGeo, robe, arm);
      part(handGeo, skin, arm, 0, -0.66, 0);
      this.body.add(arm);
    }

    // head
    this.head.position.y = 0.9;
    part(new THREE.IcosahedronGeometry(0.19, 1), skin, this.head);
    if (kind === 'person') {
      const eye = new THREE.MeshBasicMaterial({ color: 0x1a1512 });
      const eg = new THREE.SphereGeometry(0.026, 6, 5);
      part(eg, eye, this.head, 0.072, 0.025, 0.172).castShadow = false;
      part(eg, eye, this.head, -0.072, 0.025, 0.172).castShadow = false;
    } else if (kind === 'shadow') {
      const eye = new THREE.MeshBasicMaterial({ color: 0xd8d2ff });
      const eg = new THREE.SphereGeometry(0.03, 6, 5);
      part(eg, eye, this.head, 0.07, 0.02, 0.17);
      part(eg, eye, this.head, -0.07, 0.02, 0.17);
    }
    const hc = mk(look.hatColor ?? look.robe);
    switch (look.hat) {
      case 'hood':
        part(new THREE.SphereGeometry(0.235, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), hc, this.head, 0, 0.01, -0.035);
        break;
      case 'scarf':
        part(new THREE.SphereGeometry(0.225, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hc, this.head, 0, 0.02, -0.03);
        break;
      case 'cap':
        part(new THREE.CylinderGeometry(0.17, 0.2, 0.11, 8), hc, this.head, 0, 0.16, 0);
        break;
      case 'wide':
        part(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 10), hc, this.head, 0, 0.13, 0);
        part(new THREE.CylinderGeometry(0.15, 0.19, 0.16, 8), hc, this.head, 0, 0.21, 0);
        break;
      case 'tall':
        part(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), hc, this.head, 0, 0.14, 0);
        part(new THREE.CylinderGeometry(0.16, 0.18, 0.34, 8), hc, this.head, 0, 0.31, 0);
        break;
    }
    this.body.add(this.head);

    if (look.staff) {
      const st = part(new THREE.CylinderGeometry(0.025, 0.032, 1.95, 5), mk(0x5a4630), this.root, -0.46 * g, 0.98, 0.16);
      st.rotation.z = 0.04;
      if (look.lamp) {
        const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
        lamp.position.set(-0.46 * g - 0.04, 2.0, 0.16);
        this.root.add(lamp);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xffd98a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.setScalar(1.6);
        glow.position.copy(lamp.position);
        this.root.add(glow);
      }
    }
    if (kind === 'shining') {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xfff0c0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(3.4, 4.6, 1);
      halo.position.y = 1.1;
      this.root.add(halo);
    }

    // The burden: a lumpy roped sack, far too big for the back that carries it.
    const sack = new THREE.MeshStandardMaterial({ color: 0x2b241f, roughness: 1, flatShading: true });
    const rope = new THREE.MeshStandardMaterial({ color: 0x8c7650, roughness: 1, flatShading: true });
    const lump = (r: number, x: number, y: number, z: number, parent: THREE.Object3D, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      m.position.set(x, y, z);
      m.rotation.set(x * 3, y * 5, z * 7);
      m.castShadow = mat === sack;
      parent.add(m);
    };
    for (const [grp, mat] of [[this.burden, sack], [this.shadowBurden, new THREE.MeshBasicMaterial({ color: 0x07050c, transparent: true, opacity: 0.42, depthWrite: false })]] as [THREE.Group, THREE.Material][]) {
      lump(0.4, 0, 0.5, -0.42, grp, mat);
      lump(0.31, 0.12, 0.86, -0.36, grp, mat);
      lump(0.27, -0.16, 0.22, -0.4, grp, mat);
      lump(0.2, -0.1, 1.08, -0.3, grp, mat);
      this.body.add(grp);
      grp.visible = false;
    }
    for (const sx of [0.13, -0.13]) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.04), rope);
      s1.position.set(sx, 0.45, 0.26 * g);
      s1.rotation.x = -0.16;
      this.burden.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.5), rope);
      s2.position.set(sx, 0.72, 0);
      this.burden.add(s2);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.022, 4, 10), rope);
    band.position.set(0, 0.5, -0.42);
    band.rotation.y = Math.PI / 2;
    this.burden.add(band);

    this.plank.position.set(0.3, 0.74, -0.05);
    this.plank.rotation.x = 0.12;
    this.plank.visible = false;
    this.body.add(this.plank);

    this.root.add(this.legL, this.legR, this.body);
    this.root.scale.setScalar(look.scale || 1);
  }

  setBurden(mode: 'real' | 'none' | 'shadow') {
    this.burden.visible = mode === 'real';
    this.shadowBurden.visible = mode === 'shadow';
  }

  setRobe(color: number) { this.robeMat.color.setHex(color); }

  setCarry(len: number) {
    this.plank.visible = len > 0;
    if (len > 0) this.plank.scale.z = len;
  }

  setOpacity(o: number) {
    this.root.traverse((n: any) => {
      if (n.material && n.material.transparent) n.material.opacity = (n.material.userData.base ??= n.material.opacity) * o;
    });
  }

  update(dt: number, speed: number, leanT = 0, headT = 0) {
    this.t += dt;
    const moving = speed > 0.15;
    this.stride = damp(this.stride, moving ? Math.min(1, 0.35 + speed / 5) : 0, 10, dt);
    if (moving) this.phase += dt * (2.2 + speed * 1.9);
    const sw = Math.sin(this.phase) * 0.62 * this.stride;
    this.sitK = damp(this.sitK, this.sit ? 1 : 0, 6, dt);
    const sk = this.sitK;
    this.legL.rotation.x = sw * (1 - sk) - 1.45 * sk;
    this.legR.rotation.x = -sw * (1 - sk) - 1.45 * sk;
    const armSwing = sw * 0.8;
    const aL = this.armLT ?? -armSwing, aR = this.armRT ?? armSwing;
    this.armL.rotation.x = damp(this.armL.rotation.x, aL, 12, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, aR, 12, dt);
    this.lean = damp(this.lean, leanT, 4, dt);
    this.headDown = damp(this.headDown, headT, 4, dt);
    const breathe = Math.sin(this.t * 1.7) * 0.012;
    this.body.position.y = 0.8 + Math.abs(Math.sin(this.phase)) * 0.035 * this.stride - 0.52 * sk;
    this.legL.position.y = this.legR.position.y = 0.82 - 0.52 * sk;
    this.body.rotation.x = this.lean + breathe + Math.sin(this.phase * 2) * 0.02 * this.stride;
    this.body.rotation.z = Math.sin(this.phase) * 0.035 * this.stride * (1 + leanT * 2);
    const nod = this.talking ? Math.sin(this.t * 7) * 0.06 + Math.sin(this.t * 2.3) * 0.05 : 0;
    this.head.rotation.x = this.headDown + nod;
    this.head.rotation.y = this.talking ? Math.sin(this.t * 1.3) * 0.12 : 0;
    if (this.shadowBurden.visible) {
      const w = 1 + Math.sin(this.t * 2.1) * 0.05;
      this.shadowBurden.scale.set(w, 2 - w, w);
    }
  }
}
