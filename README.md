![logo](weblas.png)

GPU accelerated Javascript. Numerical computing in your browser with performance [comparable to native](https://github.com/waylonflinn/weblas/wiki).

Currently includes hundreds of unit tests, which verify correctness on hundreds of millions
of data points.

# Operations
Our focus is on numerical operations useful for neural networks and machine learning.
So far, we've got 32-bit versions of each of these:

* sscal - Matrix (and Vector) Scale (with addition)
* sgemm - Matrix Multiply
* sdwns - Matrix (and Image) Downsample (for Max Pooling)
* sclmp - Matrix clamp (for ReLU)

Don't see what you need? Give a :+1: to an [existing issue](https://github.com/waylonflinn/weblas/issues?q=is%3Aissue+is%3Aopen+label%3Aoperation) or create a [new one](https://github.com/waylonflinn/weblas/issues)!

# Usage

First, include the `weblas.js` file (from a release or the `dist` directory).

```html
<script type="text/javascript" src="weblas.js"></script>
```

Then use it like this.

```html
<script>


var h1 = 1024, w1 = 1024,
    h2 = 1024, w2 = 1024;

var A = new Float32Array(h1 * w1);
var B = new Float32Array(h2 * w2);

// fill A and B with science

var M = h1,
	N = w2,
	K = h2; // must match w1

var alpha = 1.0;
var beta = 0.0;
var C = new Float32Array(w2)      // specialized for neural net bias calculation

// result will contain matrix multiply of A x B (times alpha)
result = weblas.sgemm(M, N, K, alpha, A, B, beta, C);

</script>
```

## Pipeline Mode
Pipeline mode gives (sometimes very large) increases in performance by leaving
data in GPU memory. A demo illustrating performance on a deep neural net can be
found [here](http://waylonflinn.github.io/DeepBeliefSDK/).

Here's a basic example:
```javascript
// create Tensor containers for interacting directly with GPU memory
var t0 = weblas.pipeline.Tensor([M, K], data0);
// second matrix must be transposed
var t1 = weblas.pipeline.Tensor([N, K], weblas.util.transpose(K, N, data1));
var t2 = weblas.pipeline.Tensor([1, N], data2);
var alpha = 1.0;
var beta = 0.5;

/* NOTE: pipeline.sgemm takes a transpose matrix in the
  second slot (t1 here)
  (this requirement allows for improved performance)
 */
var t3 = weblas.pipeline.sgemm(alpha, t0, t1, beta, t2);

// result is a Float32Array
var result = t3.transfer();
```

More information can be found on the wiki [Pipeline](https://github.com/waylonflinn/weblas/wiki/Pipeline)
page.

# Testing
Unit tests and benchmarks both require `browserify` and `testling`.

Install with:

```
npm install -g browserify
npm install -g testling
```


## Unit Tests
All operations have unit test coverage. Unit tests use data generated outside
the browser (to verify correctness). Generating the data requires `python` and
the modules in `requirements.txt`.

With `pip` installed run:

```
pip install -r requirements.txt
```

Then, to generate the data, run:

```
npm run data
```

Then, run the unit tests with:
```
npm test
```

### OS Setup
If the tests won't run, try this (it restores the default [npm browser setting](https://docs.npmjs.com/misc/config#browser))

#### OSX
```
npm config set browser open
```
#### Linux
```
npm config set browser xdg-open
```
#### Windows
```
npm config set browser start
```


## Benchmarks
After installing `browserify` and `testling`, run the benchmarks with:
```
npm run benchmark
```

### results
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


# Donations

Want to see more happen here?
Contribute on

[![Patreon](https://s3.amazonaws.com/patreon_public_assets/toolbox/patreon.png)](https://patreon.com/waylonflinn)
