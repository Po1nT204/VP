const Utils = {
  rand(min, max) {
    return Math.random() * (max - min) + min;
  },
  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
};
