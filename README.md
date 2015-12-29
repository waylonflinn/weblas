![logo](weblas.png)

GPU accelerated BLAS for your browser, no add-ons required.

# Includes
* SGEMM - 32-bit Floating Point Matrix Multiply

Don't see what you need? Give a :+1: to an [existing issue](https://github.com/waylonflinn/weblas/issues?q=is%3Aissue+is%3Aopen+label%3Aoperation) or create a [new one](https://github.com/waylonflinn/weblas/issues)!

# Usage

First, include the `weblas.js` file (from a release or the `dist` directory).

```html
<script type="text/javascript" src="weblas.js"></script>
```

Then use it like this.

```html
<script>

var gl = new weblas.WebGL(),
	gemm = new weblas.GEMMFloatCalculator(gl);


var h1 = 1024, w1 = 1024,
    h2 = 1024, w2 = 1024;

var A = new Float32Array(h1 * w1);
var B = new Float32Array(h2 * w2);

// fill A and B with science

var M = h1,
	N = w2,
	K = h2; // must match w1

var alpha = 1.0;
var beta = 0.0;  // not yet implemented
var C = {};      // not yet implemented

// result will contain matrix multiply of A x B (times alpha)
result = gemm.calculate(M, N, K, alpha, A, B, beta, C);

</script>
```

# Testing
Unit tests and benchmarks both require `browserify` and `testling`.

Install with:

```
npm install -g browserify
npm install -g testling
```

on OS X, you also need to symlink to chrome:
```
ln -s /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome /usr/local/bin/google-chrome
```

## Unit Tests
Unit tests use data generated outside the browser (to verify correctness).
Generating the data requires `python` and `numpy`.

With those installed, generate the data by running:

```
cd test/data/
./generate small.json
cd ../../
```

Then, run the unit tests with:
```
npm test
```

## Benchmarks
After installing `browserify` and `testling`, run the benchmarks with:
```
npm run benchmark
```

## results
weblas@0.6.0

```
TAP version 13
ok 1 128x128 . 128x128
# 316 ops/sec  ±4.80%  n = 51 µ = 3ms
ok 2 128x256 . 256x128
# 280 ops/sec  ±6.15%  n = 40 µ = 4ms
ok 3 256x256 . 256x256
# 171 ops/sec  ±14.79%  n = 47 µ = 6ms
ok 4 512x256 . 256x512
# 101 ops/sec  ±6.68%  n = 50 µ = 10ms
ok 5 256x512 . 512x256
# 139 ops/sec  ±3.64%  n = 49 µ = 7ms
ok 6 512x512 . 512x512
# 61.61 ops/sec  ±3.14%  n = 42 µ = 16ms
ok 7 513x513 . 513x513
# 52.92 ops/sec  ±8.82%  n = 49 µ = 19ms
ok 8 1024x512 . 512x1024
# 34.99 ops/sec  ±4.86%  n = 38 µ = 29ms
ok 9 512x1024 . 1024x512
# 52.03 ops/sec  ±2.66%  n = 47 µ = 19ms
ok 10 1024x1024 . 1024x1024
# 23.27 ops/sec  ±12.70%  n = 34 µ = 43ms
ok 11 2048x2048 . 2048x2048
# 4.89 ops/sec  ±1.82%  n = 17 µ = 204ms

1..11
# tests 11
# pass  11

# ok
```

more information about benchmarks (including test configuration) can be found on the [wiki](https://github.com/waylonflinn/weblas/wiki).
