const shuffle = (): void => {
  Object.defineProperty(Array.prototype, 'shuffle', {
    // eslint-disable-next-line no-restricted-syntax
    value: function () {
      for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this[i], this[j]] = [this[j], this[i]];
      }

      return this;
    },
  });
};

export const initArrayPolyfills = (): void => {
  shuffle();
};

declare global {
  interface Array<T> {
    shuffle(): Array<T>;
  }
}
