/* SHA-256 helper (WebCrypto with a pure-JS fallback for non-secure contexts) */
(function () {
  'use strict';
  // Pure-JS fallback for non-secure contexts where WebCrypto is unavailable
  function sha256Fallback(str) {
    var bytes = Array.from(new TextEncoder().encode(str));
    var K = [], H = [], p = 2, n = 0;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    while (n < 64) {
      var prime = true;
      for (var d = 2; d * d <= p; d++) if (p % d === 0) { prime = false; break; }
      if (prime) { if (n < 8) H[n] = frac(Math.pow(p, 0.5)); K[n++] = frac(Math.pow(p, 1 / 3)); }
      p++;
    }
    var l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    function rr(x, c) { return (x >>> c) | (x << (32 - c)); }
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (var t = 0; t < 16; t++) w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + dd) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve(sha256Fallback(text));
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  window.sha256 = sha256;
})();
