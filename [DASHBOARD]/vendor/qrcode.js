/*
 * Minimal offline QR encoder, written for JenerOS. Version 5, byte mode,
 * error correction L (106 UTF-8 bytes). One Reed-Solomon block; fixed mask 0.
 * No network access, canvas, dependencies, or external assets.
 *
 * MIT License
 * Copyright (c) 2026 JenerOS contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(() => {
  'use strict';
  function multiply(a, b) {
    let product = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) product ^= a;
      b >>>= 1; a <<= 1;
      if (a & 256) a ^= 0x11d;
    }
    return product;
  }
  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > 106) throw new Error('This address is too long for the QR code.');
    const bits = [];
    const put = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    put(4, 4); put(bytes.length, 8);
    for (const byte of bytes) put(byte, 8);
    put(0, Math.min(4, 864 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => n * 2 + b, 0));
    for (let i = 0; data.length < 108; i++) data.push(i % 2 ? 0x11 : 0xec);
    // g(x) = product (x + alpha^i), i = 0..25, over GF(256).
    let generator = [1], root = 1;
    for (let i = 0; i < 26; i++) {
      const next = Array(generator.length + 1).fill(0);
      generator.forEach((coefficient, j) => { next[j] ^= coefficient; next[j + 1] ^= multiply(coefficient, root); });
      generator = next; root = multiply(root, 2);
    }
    const remainder = Array(26).fill(0);
    for (const byte of data) {
      const factor = byte ^ remainder.shift(); remainder.push(0);
      for (let i = 0; i < 26; i++) remainder[i] ^= multiply(generator[i + 1], factor);
    }
    return [...data, ...remainder];
  }
  function matrix(text) {
    const n = 37, cells = Array.from({ length: n }, () => Array(n).fill(null));
    const finder = (row, col) => {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        if (row + y < 0 || row + y >= n || col + x < 0 || col + x >= n) continue;
        cells[row + y][col + x] = (y >= 0 && y <= 6 && (x === 0 || x === 6)) || (x >= 0 && x <= 6 && (y === 0 || y === 6)) || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    // Version 5 has one alignment pattern away from the three finders.
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) cells[30 + y][30 + x] = Math.max(Math.abs(y), Math.abs(x)) !== 1;
    for (let i = 8; i < n - 8; i++) { cells[6][i] = i % 2 === 0; cells[i][6] = i % 2 === 0; }
    // L + mask 0: BCH-encoded, XOR-masked format word 111011111000100.
    const format = 0x77c4;
    for (let i = 0; i < 15; i++) {
      const dark = Boolean((format >>> i) & 1);
      cells[i < 6 ? i : i < 8 ? i + 1 : n - 15 + i][8] = dark;
      cells[8][i < 8 ? n - i - 1 : i === 8 ? 7 : 14 - i] = dark;
    }
    cells[n - 8][8] = true;
    const data = encode(text);
    let row = n - 1, direction = -1, bit = 0;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let offset = 0; offset < 2; offset++) {
          const x = col - offset;
          if (cells[row][x] !== null) continue;
          const value = bit < data.length * 8 && Boolean((data[bit >>> 3] >>> (7 - bit % 8)) & 1);
          cells[row][x] = value !== ((row + x) % 2 === 0);
          bit++;
        }
        row += direction;
        if (row < 0 || row >= n) { row -= direction; direction = -direction; break; }
      }
    }
    return cells;
  }
  function QRCode(element, options) {
    const cells = matrix(options.text), ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 45 45');
    svg.setAttribute('width', options.width || 196); svg.setAttribute('height', options.height || 196);
    svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
    const background = document.createElementNS(ns, 'rect');
    background.setAttribute('width', '45'); background.setAttribute('height', '45'); background.setAttribute('fill', '#fff');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', '#16161d');
    path.setAttribute('d', cells.flatMap((row, y) => row.map((dark, x) => dark ? `M${x + 4},${y + 4}h1v1h-1z` : '')).join(''));
    svg.append(background, path); element.append(svg);
  }
  QRCode.CorrectLevel = { L: 'L' };
  window.QRCode = QRCode;
})();
