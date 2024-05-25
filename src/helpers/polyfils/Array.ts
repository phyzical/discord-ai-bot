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

const last = (): void => {
  Object.defineProperty(Array.prototype, 'last', {
    // eslint-disable-next-line no-restricted-syntax
    value: function () {
      return this[this.length - 1];
    },
  });
};

export const initArrayPolyfills = (): void => {
  shuffle();
  last();
};

declare global {
  interface Array<T> {
    shuffle(): Array<T>;
    last(): T;
  }
}
