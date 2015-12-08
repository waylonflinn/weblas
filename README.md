![logo](weblas.png)

GPU accelerated BLAS for your browser, no add-ons required.


# Extra Super Alpha

This is mostly a preview to whet your appetite for the soon-to-be-released (in a week or so)
real thing.

## Example
First, include the `weblas.js` file (from a release or the `dist` directory).

```html
<script src="./weblas.js"></script>
```

Then use it like this (in another `script` tag).

```javascript

var gl = new weblas.WebGL(),
	gemm = new weblas.GEMMFloatCalculator(gl);


var h1 = 1024, w1 = 1024,
    h2 = 1024, w2 = 1024;

var A = new Float32Array(h1 * w1);
var B = new Float32Array(h2 * w2);

// fill A and B with stuff

var alpha = 1.0; // not yet implemented
var beta = 0.0;  // not yet implemented
var C = {};      // not yet implemented

// result will contain matrix multiply of A x B
result = gemm.calculate(h1, w1, h2, w2, alpha, beta, A, B, C);


```
