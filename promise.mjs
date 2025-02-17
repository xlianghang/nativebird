class NPromise extends Promise {
  delay(ms = 0) {
    return this.then((value) => NPromise.delay(ms, value));
  }

  map(fn) {
    return this.then((arr) => NPromise.map(arr, fn));
  }

  mapSeries(fn) {
    return this.then((arr) => NPromise.mapSeries(arr, fn));
  }

  each(fn) {
    return this.then((arr) => NPromise.each(arr, fn));
  }

  timeout(ms = 0, msg) {
    const timeoutPromise = new NPromise((_, reject) => {
      setTimeout(() => reject(new Error(msg || "Request timed out")), ms);
    });
    return NPromise.race([this, timeoutPromise]);
  }

  tap(fn) {
    return new NPromise((resolve, reject) => {
      this.then(async (val) => {
        await fn(val);
        resolve(val);
      }).catch(reject);
    });
  }

  all() {
    return this.then((arr) => NPromise.all(arr));
  }

  spread(fn) {
    return this.then(function () {
      if (typeof fn !== "function") {
        throw new TypeError("Promise.spread requires function");
      }

      if (!arguments || arguments.length === 0) {
        return fn.apply();
      }
      return fn.apply(null, arguments[0]);
    });
  }
}

NPromise.delay = function delay(ms = 0, value) {
  return new NPromise((resolve) => setTimeout(() => resolve(value), ms));
};

NPromise.try = function (fn) {
  return new NPromise(function (resolve, reject) {
    if (typeof fn !== "function") {
      reject(new TypeError("Promise.try requires function"));
    }
    resolve(fn());
  });
};

NPromise.each = async function each(arr, fn) {
  if (!Array.isArray(arr)) throw new TypeError("Promise.each requires array");
  const values = [];
  for (let i = 0; i < arr.length; i++) {
    const val = await NPromise.resolve(arr[i]);
    values.push(val);
    await fn(val, i, arr.length);
  }
  return values;
};

NPromise.mapSeries = function mapSeries(arr, fn) {
  if (!Array.isArray(arr)) {
    throw new TypeError("Promise.mapSeries requires array");
  }
  return new NPromise(async (resolve) => {
    const results = [];
    for (let i = 0; i < arr.length; i++) {
      const val = await NPromise.resolve(arr[i]);
      results[i] = fn(val, i, arr.length);
    }
    resolve(results);
  });
};

NPromise.map = function map(iterable, fn, options) {
  options = options || {};
  let concurrency = options.concurrency || Infinity;

  let index = 0;
  const results = [];

  if ("then" in iterable) {
    return iterable.then((arr) => {
      if (!Array.isArray(arr)) {
        throw new TypeError("Promise.map requires array");
      }
      return NPromise.map(arr, fn, options);
    });
  }

  const iterator = iterable[Symbol.iterator]();
  const promises = [];

  while (concurrency-- > 0) {
    const promise = wrappedMapper();
    if (promise) promises.push(promise);
    else break;
  }

  return NPromise.all(promises).then(() => results);

  function wrappedMapper() {
    const next = iterator.next();
    if (next.done) return null;
    const i = index++;
    return Promise.resolve(next.value).then(async (unwrapped) => {
      const mapped = await fn(unwrapped, i);
      results[i] = mapped;
      return wrappedMapper(mapped);
    });
  }
};

NPromise.defer = function defer() {
  let resolve, reject;
  const promise = new NPromise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    resolve,
    reject,
    promise,
  };
};

export default NPromise;
