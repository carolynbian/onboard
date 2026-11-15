/* ============================================================
   初见 Onboard · 密码摘要（本机演示用）
   ------------------------------------------------------------
   作用：把“盐值 + 密码”算成一串摘要再保存，页面上不存明文密码。
   说明：这是本机演示环境的做法，不等同于线上系统的账号安全方案。
   ============================================================ */
(function () {
  'use strict';

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  var INIT = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  function rotr(value, amount) {
    return ((value >>> amount) | (value << (32 - amount))) >>> 0;
  }

  function toHex(buffer) {
    var out = '';
    for (var i = 0; i < buffer.length; i++) {
      out += (buffer[i] < 16 ? '0' : '') + buffer[i].toString(16);
    }
    return out;
  }

  // 极老的浏览器没有 TextEncoder 时用的兜底转换
  function utf8Fallback(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
        var next = text.charCodeAt(i + 1);
        var cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function sha256Hex(input) {
    var text = String(input == null ? '' : input);
    var bytes = (typeof TextEncoder !== 'undefined')
      ? new TextEncoder().encode(text)
      : utf8Fallback(text);

    var length = bytes.length;
    var total = (((length + 8) >> 6) + 1) * 64;
    var buffer = new Uint8Array(total);
    buffer.set(bytes);
    buffer[length] = 0x80;

    var bitHigh = Math.floor(length / 536870912);
    var bitLow = (length * 8) >>> 0;
    buffer[total - 8] = (bitHigh >>> 24) & 0xff;
    buffer[total - 7] = (bitHigh >>> 16) & 0xff;
    buffer[total - 6] = (bitHigh >>> 8) & 0xff;
    buffer[total - 5] = bitHigh & 0xff;
    buffer[total - 4] = (bitLow >>> 24) & 0xff;
    buffer[total - 3] = (bitLow >>> 16) & 0xff;
    buffer[total - 2] = (bitLow >>> 8) & 0xff;
    buffer[total - 1] = bitLow & 0xff;

    var hash = new Uint32Array(INIT);
    var w = new Uint32Array(64);

    for (var offset = 0; offset < total; offset += 64) {
      for (var i = 0; i < 16; i++) {
        var p = offset + i * 4;
        w[i] = ((buffer[p] << 24) | (buffer[p + 1] << 16) | (buffer[p + 2] << 8) | buffer[p + 3]) >>> 0;
      }
      for (var j = 16; j < 64; j++) {
        var x = w[j - 15];
        var y = w[j - 2];
        var s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
        var s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }

      var a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      var e = hash[4], f = hash[5], g = hash[6], h = hash[7];

      for (var k = 0; k < 64; k++) {
        var s1e = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + s1e + ch + K[k] + w[k]) >>> 0;
        var s0a = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (s0a + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + temp1) >>> 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) >>> 0;
      }

      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }

    var digest = new Uint8Array(32);
    for (var n = 0; n < 8; n++) {
      digest[n * 4] = (hash[n] >>> 24) & 0xff;
      digest[n * 4 + 1] = (hash[n] >>> 16) & 0xff;
      digest[n * 4 + 2] = (hash[n] >>> 8) & 0xff;
      digest[n * 4 + 3] = hash[n] & 0xff;
    }
    return toHex(digest);
  }

  window.OnboardCrypto = {
    sha256Hex: sha256Hex
  };
})();
