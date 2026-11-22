import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Opcode table, one char per opcode byte 0..83: charCode-33 = pops*4+pushes.
// A space (32) marks an unknown opcode. 0x1f is unassigned, so it is a space.
const T = `!""%'+,0        *******&***&*** ***             !%%!!           &)              %%"%`;

function run(p: Uint8Array, q: Uint8Array): { o: Uint8Array; e: number } {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, st = 0;
  const n = p.length;
  const end = (e: number) => ({ o: O.subarray(0, ol), e });
  for (;;) {
    if (st === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc], c = T.charCodeAt(op);
    if (!(c > 32)) return end(5);
    const t = c - 33, im = op === 1 ? 1 : op === 2 ? 4 : op > 47 && op < 52 ? 2 : 0;
    if (pc + im >= n) return end(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < (t >> 2)) return end(2);
    if (sp - (t >> 2) + (t & 3) > 256) return end(3);
    pc = nx;
    if (op > 15 && op < 35) {
      if (op === 23) { D[sp - 1] = -D[sp - 1] | 0; continue; }
      if (op === 27) { D[sp - 1] = ~D[sp - 1]; continue; }
      const b = D[sp - 1], a = D[sp - 2];
      let r: number;
      if (op === 16) r = (a + b) | 0;
      else if (op === 17) r = (a - b) | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
      else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
      else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
      else if (op === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
      else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2; D[sp++] = r;
      continue;
    }
    switch (op) {
      case 0: return end(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const x = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = x; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const x = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = x; break; }
      case 48: pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16); break;
      case 49:
      case 50: { const v = D[--sp]; if ((op === 49) === (v === 0)) pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16); break; }
      case 51: if (cp === 64) return end(7); C[cp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52: if (!cp) return end(8); pc = C[--cp]; break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a > 255) return end(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1]; if (a < 0 || a > 255) return end(6); sp -= 2; M[a] = D[sp]; break; }
      case 80: { const s = String(D[sp - 1]); if (ol + s.length > 65536) return end(11); sp--; for (let i = 0; i < s.length; i++) O[ol++] = s.charCodeAt(i); break; }
      case 81: if (ol + 1 > 65536) return end(11); O[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < q.length ? q[ip++] : -1; break;
      default: return end(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, "program.bin")), readFileSync(join(I, id, "input.bin")));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "stdout.bin"), r.o);
  writeFileSync(join(O, id, "exit.txt"), r.e + "\n");
}
