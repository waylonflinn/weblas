(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Benchmark = require('benchmark'),
	weblas = require('../index');

//console.log(weblas);

var suite = new Benchmark.Suite();

var pass = 0,
	fail = 0;


function createBenchmark(M, N, K){

	//var sgemm = weblas.pipeline.sgemm;

	// default to square matrices, if only one length is provided
	N = N || M;
	K = K || M;
	var name = "pipeline.sgemm: " + M + "x" + K + " . " + K + "x" + N;

	var bm = new Benchmark(name, function(){
		try{
			result = this.sgemm(this.alpha, this.t0, this.t1, null, null)
		} catch (err){
			console.log("exception");
			console.log(err.message);
		}
	})// add listeners
	.on('start', function(event){

		a = weblas.test.randomArray(M, K);
		A = weblas.util.fromArray(a);
		b = weblas.test.randomArray(N, K);
		B = weblas.util.fromArray(b);

		this.alpha = 1;
		this.t0 = new weblas.pipeline.Tensor([M, K], A);
		this.t1 = new weblas.pipeline.Tensor([N, K], B);
		this.sgemm = weblas.pipeline.sgemm;

	})
	.on('cycle', function(event) {
	})
	.on('complete', function(event) {

		this.t0.delete();
		this.t1.delete();

		var pm = '\xb1',
			mu = '\xb5'
			size = this.stats.sample.length;

        if(this.error){
        	console.log("not ok " + event.currentTarget.id + " " + this.name);
        	// show error
        	console.log("  ---");
        	console.log("  error: " + this.error);
        	console.log("  ...");

        	fail++;
        } else {
			var gflops = this.hz * 2 * M * N * K / 1e9;

			var info = Benchmark.formatNumber(gflops.toFixed(3)) + ' GFlops/sec ' +
				' ' + pm + this.stats.rme.toFixed(2) + '% ' +
	         	' n = ' + size +
	        	' ' + mu + " = " + (this.stats.mean * 1000).toFixed(0) + 'ms';

			console.log("ok " + event.currentTarget.id + " " + this.name);
			console.log("# " + info);

			pass++;
        }


	});

	return bm;
}

console.log("TAP version 13");

suite.add(createBenchmark(128));
suite.add(createBenchmark(128,  128,  256));
suite.add(createBenchmark(256));
suite.add(createBenchmark(512,  512,  256));
suite.add(createBenchmark(256,  256,  512));
suite.add(createBenchmark(512));
suite.add(createBenchmark(513,  513,  513));
suite.add(createBenchmark(1024, 1024, 512));
suite.add(createBenchmark(512,  512, 1024));
suite.add(createBenchmark(1024));
suite.add(createBenchmark(2048));

suite.on('complete', function(){
	console.log("\n1.." + suite.length);
	console.log("# tests " + suite.length);
	console.log("# pass  " + pass);
	if(fail)
		console.log("# fail  " + fail);
	else
		console.log("\n# ok\n");
});

// run async
suite.run({ 'async': true });

},{"../index":2,"benchmark":16}],2:[function(require,module,exports){
var globals = require('./lib/globals'),
	pipeline = require("./lib/pipeline"),
	SGEMMCalculator = require("./lib/sgemmcalculator"),
	SAXPYCalculator = require("./lib/saxpycalculator"),
	SSCALCalculator = require("./lib/sscalcalculator"),
	SDWNSCalculator = require("./lib/sdwnscalculator"),
	SCLMPCalculator = require("./lib/sclmpcalculator"),
	test = require("./lib/test");

var gl = globals.gl,
	sgemmcalculator = new SGEMMCalculator(gl),
	saxpycalculator = new SAXPYCalculator(gl),
	sscalcalculator = new SSCALCalculator(gl),
	sdwnscalculator = new SDWNSCalculator(gl),
	sclmpcalculator = new SCLMPCalculator(gl);

module.exports = {
	// level one
	"saxpy" : saxpy,
	"sscal" : sscal,   // single precision matrix scale
	// level two
	// level three
	"sgemm" : sgemm,   // single precision generalized matrix multiply
	// extra
	"sstd" : sstd,     // single precision Standard Score normalization
	"sdwns": sdwns,
	"sclmp": sclmp,
	// pipeline
	"pipeline" : pipeline,
	// internals
	"gpu" : {	"gl": gl,
	 			"sgemm": pipeline.sgemmcalculator.calculate.bind(pipeline.sgemmcalculator),
				"sscal" : pipeline.sscalcalculator.calculate.bind(pipeline.sscalcalculator),
				"sclmp" : pipeline.sclmpcalculator.calculate.bind(pipeline.sclmpcalculator),
				"sdwns" : pipeline.sdwnscalculator.calculate.bind(pipeline.sdwnscalculator),
				"encode" : gl.encode.bind(gl)
			},
	"util" : { "fromArray" : fromArray, "transpose" : transpose},
	"test" : test
};


/* Wrap the GL calculation object in a (relatively) user friendly function that
	accepts TypedArrays

	* convert the data to (padded) textures in GPU memory
	* execute calculation
	* read result into an array, and return
 */
function sgemm(M, N, K, alpha, A, B, beta, C){

	if(C != null && C.length != N){
		throw new Error("Only vector C with length matching rows in A is currently supported.");
	}

	// pack each matrix into a single RGBA texel array, with the second transposed
	var texels0 = A,
		texels1,
		texels2 = C;


	texels1 = transpose(K, N, B);

	// create input textures from data
	var texture0 = gl.createDataTexture(M, K, texels0);
	var texture1 = gl.createDataTexture(N, K, texels1);
	var texture2 = null;
	if(texels2 != null){
		texture2 = gl.createDataTexture(1, N, texels2);
	}

	var texture3 = gl.createOutputTexture(M, N);

	sgemmcalculator.calculate(M, N, K, alpha, texture0, texture1, beta, texture2, texture3);

	// retrieve data
	rawBuffer = gl.readData(M, N);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture1);
	if(texture2 != null){
		gl.context.deleteTexture(texture2);
	}
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);

}

function saxpy(N, a, X, Y){

	var rawBuffer;


	var texels0 = X,
		texels1;

	// TODO: special shader for constant Y
	if(isFloat32Array(Y)){
		texels1 = Y;
	} else {
		texels1 = new Float32Array(N);
		texels1.fill(Y);
	}

	// create input textures from data
	var texture0 = gl.createDataTexture(1, N, texels0);
	var texture1 = gl.createDataTexture(1, N, texels1);

	var texture3 = gl.createOutputTexture(1, N);

	saxpycalculator.calculate(N, a, texture0, texture1, texture3);

	// retrieve data
	rawBuffer = gl.readData(1, N);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture1);
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);

}

function isFloat32Array(obj){
	return Object.prototype.toString.call(obj) === "[object Float32Array]";
}
/* a more general version of the BLAS Level 1 scale, that works on matrices
   and includes an elementwise scalar addition

   a * X + b

   a - multiplicative scalar
   b - additive scalar
   X - matrix (M x N)

   to get the standard BLAS scal set M = 1 and b = 0

   this function is generally only cost effective to use in a pipeline
*/
function sscal(M, N, a, b, X){

	var rawBuffer;

	var texels0 = X;
	var texture0 = gl.createDataTexture(M, N, texels0);

	var texture3 = gl.createOutputTexture(M, N);

	sscalcalculator.calculate(M, N, a, b, texture0, texture3);

	// retrieve data
	rawBuffer = gl.readData(M, N);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);
}

/* Calculate the Standard Score normalization (subtract mean
   ,divide by standard deviation).
 */
function sstd(M, N, mu, sigma, X){

	var rawBuffer;

	var texels0 = X;
	var texture0 = gl.createDataTexture(M, N, texels0);

	var texture3 = gl.createOutputTexture(M, N);

	// adjust the parameters (for inverse) and call the standard score normalization
	sscalcalculator.calculate(M, N, 1.0/sigma, -1.0 * mu/sigma, texture0, texture3);

	// retrieve data
	rawBuffer = gl.readData(M, N);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);
}

/* downsample an image (taking the max) for Pooling

	M - rows in input
	N - columns in input
	c - channels in input
	factor - the downsample factor (width of patch to sample)
	stride - width between pooling regions
	X - input image
 */
function sdwns(M, N, channels, factor, stride, X){


	var texels0 = X;

	var texture0 = gl.createDataTexture(M, N * channels, X);

	var N_out = Math.floor((N - factor) / stride) + 1;
	var M_out = Math.floor((M - factor) / stride) + 1;

	var texture3 = gl.createOutputTexture(M_out, N_out * channels);

	sdwnscalculator.calculate(M, N, channels, factor, stride, texture0, texture3);

	// retrieve data
	rawBuffer = gl.readData(M_out, N_out * channels);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);
}
/*  Elementwise clamp function for matrices on the interval [a, b]. Can also be
	used for min or max, by passing Number.MIN_VALUE for the first parameter and
	Number.MAX_VALUE for the second parameter, respectively.

	Passing `null` for either of these parameters will default to it's
	respective min or max value.

	M - number of rows in X
	N - number of columns in X
	a - lower bound (inclusize)
	b - upper bound (inclusive)
	X - matrix

   to get the standard BLAS scal set M = 1 and b = 0

   this function is generally only cost effective to use in a pipeline
*/
function sclmp(M, N, a, b, X){

	a = (a != null) ? a : Number.MIN_VALUE;
	b = (b != null) ? b : Number.MAX_VALUE;

	var rawBuffer;

	var texels0 = X;
	var texture0 = gl.createDataTexture(M, N, texels0);

	var texture3 = gl.createOutputTexture(M, N);

	sclmpcalculator.calculate(M, N, a, b, texture0, texture3);

	// retrieve data
	rawBuffer = gl.readData(M, N);

	// clean up
	gl.context.deleteTexture(texture0);
	gl.context.deleteTexture(texture3);

	// return result
	return new Float32Array(rawBuffer);
}
/*
function saxpy(n, a, x, y){
	var i = 0,
		result = new Float32Array(n);

	// assert n = x.length
	// assert a is scalar
	// assert x is Float32Array

	if(isNumeric(y)){
		// shortcut for scalar y
		for(; i < n; i++){
			result[i] = a * x[i] + y;
		}
	} else {

		for(; i < n; i++){
			result[i] = a * x[i] + y[i];
		}
	}

	return result;

}*/

// add a String.format method, if none exists
if (!String.prototype.format) {
  String.prototype.format = function() {
	var args = arguments;
	return this.replace(/{(\d+)}/g, function(match, number) {
	  return typeof args[number] != 'undefined'
		? args[number]
		: match
	  ;
	});
  };
}

function isNumeric( obj ) { return (obj - parseFloat( obj ) + 1) >= 0; }

/* create a typed array from a 2D javascript array */
function fromArray(array, type, tranpose) {
	var shape = [],
			data,
			c;   // number of columns

	if(!tranpose){
		shape[0] = array.length;
		shape[1] = array[0].length;
	} else {
		shape[1] = array.length;
		shape[0] = array[0].length;
	}
	c = shape[1];

	type = type || Float32Array;

	data = new type(shape[0]*shape[1]);

	for (var ii = 0; ii < shape[0]; ++ii)
		for (var jj = 0; jj < shape[1]; ++jj)
		if(!tranpose)
			data[ii*c + jj] = array[ii][jj];
		else
			data[ii*c + jj] = array[jj][ii];

	return data;
};

// tranpose a typed array in row major order, with the given row and column
// numers
function transpose(r, c, typedArray){
	var result = new typedArray.constructor(r*c);

	for(var i = 0; i < r; i++){
		for(var j = 0; j < c; j++){
			result[j * r + i] = typedArray[i * c + j];
		}
	}

	return result;
}

},{"./lib/globals":3,"./lib/pipeline":4,"./lib/saxpycalculator":5,"./lib/sclmpcalculator":6,"./lib/sdwnscalculator":7,"./lib/sgemmcalculator":8,"./lib/sscalcalculator":10,"./lib/test":12}],3:[function(require,module,exports){
var WebGL = require("./webgl");

var gl = new WebGL();

module.exports = {
	"gl" : gl
}

},{"./webgl":13}],4:[function(require,module,exports){
var globals = require('./globals'),
	SGEMMCalculator = require("./sgemmcalculator"),
	SAXPYCalculator = require("./saxpycalculator"),
	SSCALCalculator = require("./sscalcalculator"),
	SDWNSCalculator = require("./sdwnscalculator"),
	SCLMPCalculator = require("./sclmpcalculator"),
	SLOKNCalculator = require("./slokncalculator"),
	Tensor = require('./tensor');


var gl = globals.gl,
	sgemmcalculator = new SGEMMCalculator(gl, false),
	saxpycalculator = new SAXPYCalculator(gl, false),
	sscalcalculator = new SSCALCalculator(gl, false),
	sdwnscalculator = new SDWNSCalculator(gl, false),
	sclmpcalculator = new SCLMPCalculator(gl, false),
	slokncalculator = new SLOKNCalculator(gl, false);

module.exports = {
	"Tensor" : Tensor,
	"sscal" : sscal,
	"sgemm" : sgemm,
	"sdwns" : sdwns,
	"sclmp" : sclmp,
	"slokn" : slokn,

	"sgemmcalculator" : sgemmcalculator,
	"saxpycalculator" : saxpycalculator,
	"sscalcalculator" : sscalcalculator,
	"sdwnscalculator" : sdwnscalculator,
	"sclmpcalculator" : sclmpcalculator,
	"slokncalculator" : slokncalculator
}

/* scale (and optionally offset) a Tensor, elementwise
 */
function sscal(a, b, t0){

	var M = t0.shape[0],
		N = t0.shape[1];

	// create an empty output Tensor
	var tOut = new Tensor([M, N], null);

	sscalcalculator.calculate(M, N, a, b, t0.texture, tOut.texture);

	return tOut;
}

/* matrix multiply on t0 and t1 with additive t2. t1 must be transposed
 */
function sgemm(alpha, t0, t1, beta, t2){

	if(t1.shape[1] !== t0.shape[1])
		throw new Error("Second dimension must be of same size for input Tensors (second Tensor is transposed).");

	var M = t0.shape[0],
		N = t1.shape[0],
		K = t0.shape[1];

	var texture2;

	if(t2){
		texture2 = t2.texture;
	} else {
		texture2 = null;
	}

	// create an empty output Tensor
	var tOut = new Tensor([M, N], null);

	sgemmcalculator.calculate(M, N, K, alpha, t0.texture, t1.texture, beta, texture2, tOut.texture);

	return tOut;
}

function sdwns(channels, factor, stride, t0){

	if(t0.shape[1] % channels !== 0)
		throw new Error("Second dimension of tensor must be a multiple of channels");

	var M = t0.shape[0],
		N = t0.shape[1] / channels;

	var M_out = Math.floor((M - factor) / stride) + 1;
	var N_out = Math.floor((N - factor) / stride) + 1;

	// create an empty output Tensor
	var tOut = new Tensor([M_out, N_out * channels], null);

	sdwnscalculator.calculate(M, N, channels, factor, stride, t0.texture, tOut.texture);

	return tOut;
}

function sclmp(a, b, t0){

	a = (a != null) ? a : Number.MIN_VALUE;
	b = (b != null) ? b : Number.MAX_VALUE;

	var M = t0.shape[0],
		N = t0.shape[1];

	// create an empty output Tensor
	var tOut = new Tensor([M, N], null);

	sclmpcalculator.calculate(M, N, a, b, t0.texture, tOut.texture);

	return tOut;
}

/* Linearize onto Kernels, Transform input into one row per patch, for use in
	convolution.

	channels - number of channels in the input
	factor - width (and height) of kernels (and patches)
	stride - number of elements between patches
	t0 - the input Tensor
 */
function slokn(channels, factor, stride, margin, t0){

	if(t0.shape[1] % channels !== 0)
		throw new Error("Second dimension of tensor must be a multiple of channels");

	var M = t0.shape[0],
		N = t0.shape[1] / channels;

	var N_p, M_p;

	// number of patches (columns and rows)
	if(!margin){
		margin = 0;
		N_p = Math.ceil((N - factor) / stride) + 1;
		M_p = Math.ceil((M - factor) / stride) + 1;
	} else {
		N_p = Math.ceil((N + (2 * margin) - factor) / stride) + 1;
		M_p = Math.ceil((M + (2 * margin) - factor) / stride) + 1;
	}

	var P_p = factor * factor * channels; // elements per kernel
	var M_out = (M_p * N_p),
	 	N_out = P_p;

	// create an empty output Tensor
	var tOut = new Tensor([M_out, N_out], null);

	slokncalculator.calculate(M, N, channels, M_out, N_out, N_p, factor, stride, margin, t0.texture, tOut.texture);

	return tOut;
}

},{"./globals":3,"./saxpycalculator":5,"./sclmpcalculator":6,"./sdwnscalculator":7,"./sgemmcalculator":8,"./slokncalculator":9,"./sscalcalculator":10,"./tensor":11}],5:[function(require,module,exports){
var WebGL = require('./webgl');

/* A calculator object for the Float texture based AXPY

	a times X plus Y (AXPY):

	Y = a * X + Y

	where X + Y is elementwise matrix addition


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SAXPYCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = standalone || true; // default to standalone mode


	var s = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded A\nuniform sampler2D Y;\t\t// texture with data from padded transpose of B\nuniform int       N;\nuniform float     a; \t\t// coefficient to multiplication\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1604150559(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n \tfloat row = outTex.y;\n\tfloat col = outTex.x;\n\n\t// direct usage of col requires output be padded exactly like input\n\tvec4 x = texture2D( X, vec2(col, row));\n\tvec4 y = texture2D( Y, vec2(col, row));\n\tvec4 sum_v = (a * x) + y;\n\tint channel = int(mod(col * float(N), 4.0 ));\n\tfloat sum = select_index_1604150559(sum_v, channel);\n\n\tif (sum == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n \t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1540259130(sum);\n}\n";
	//	p = glslify('./glsl/saxpy/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SAXPYCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SAXPYCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SAXPYCalculator.TEXTURE_UNIFORM_NAME_1 = "Y";
SAXPYCalculator.LENGTH_UNIFORM_NAME = "N";
SAXPYCalculator.COEFFICIENT_UNIFORM_NAME = "a";


/* Calculate the AXPY, with the given data.

	N - number of elements in X and Y
	a - scalar coefficient to X
	X - left hand vector (texture)
	Y - right hand vector (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SAXPYCalculator.prototype.calculate = function(N, a, X, Y, out){

	var gl = this.webgl.context;

	/*
	var h1 = M, w1 = K,
		h2 = K, w2 = N;
	*/

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SAXPYCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(Y, gl.TEXTURE1, SAXPYCalculator.TEXTURE_UNIFORM_NAME_1);


	var pad = this.webgl.getPad(N);
	// set the data specific variables in our shader program
	this.bindUniforms(N + pad, a);

	// create our destination texture
	this.webgl.bindOutputTexture(1, N + pad, out);


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);
	this.webgl.unbindInputTexture(gl.TEXTURE1);

};

/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SAXPYCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SAXPYCalculator.prototype.bindUniforms = function(N, a) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SAXPYCalculator.LENGTH_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SAXPYCalculator.COEFFICIENT_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1f(a_gl, a);

};

},{"./webgl":13}],6:[function(require,module,exports){
var WebGL = require('./webgl');

/*  Elementwise clamp function for matrices on the interval [a, b]. Can also be
	used for min or max, by passing Number.MIN_VALUE for the first parameter and
	Number.MAX_VALUE for the second parameter, respectively.

	Passing `null` for either of these parameters will default to it's
	respective min or max value.

	max(a, min(b, x)) for each x in X

	where X is a matrix, a and b are scalars


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SCLMPCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded A\nuniform int       N;\t\t// number of columns\nuniform int       pad;\t\t// additional columns to nearest multiple of four\nuniform float     a; \t\t// lower bound\nuniform float     b; \t\t// upper bound\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1604150559(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row = outTex.y;\n\tfloat col = outTex.x;\n\n\t// return 0.0 if in padded region of output texture\n\tif(col * float(N + pad) > float(N) ) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n\t// direct usage of col requires output be padded exactly like input\n\tvec4 x = texture2D( X, vec2(col, row));\n\tvec4 val = clamp(x, a, b);\n\n\t// select and output channel (standalone version only)\n\tint channel = int(mod(col * float(N + pad), 4.0));\n\tfloat sum = select_index_1604150559(val, channel);\n\n\tif (sum == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n\t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1540259130(sum);\n}\n",
		p = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded A\nuniform int       N;\t\t// number of columns\nuniform int       pad;\t\t// additional columns to nearest multiple of four\nuniform float     a; \t\t// lower bound\nuniform float     b; \t\t// upper bound\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1540259130(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tfloat col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)\n\n\t// direct usage of col requires output be padded exactly like input\n\tvec4 x = texture2D( X, vec2(col_t, row_t));\n\tvec4 val_v = clamp(x, a, b);\n\n\t// is last element in pixel past row length?\n\tif(pad > 0 && (col + 4.0) > float(N) ) {\n\t\t// fix elements in padded region\n\t\tfix_pad_1540259130(val_v, pad);\n\t}\n\n\tgl_FragColor = val_v;\n}\n";

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SCLMPCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SCLMPCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SCLMPCalculator.LENGTH_UNIFORM_NAME = "N";
SCLMPCalculator.LOWER_UNIFORM_NAME = "a";
SCLMPCalculator.UPPER_UNIFORM_NAME = "b";


/* Elementwise clamp a matrix to the interval [a, b]

	M - number of rows in X
	N - number of columns in X
	a - lower bound (inclusize)
	b - upper bound (inclusive)
	X - matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SCLMPCalculator.prototype.calculate = function(M, N, a, b, X, out){

	a = (a != null) ? a : Number.MIN_VALUE;
	b = (b != null) ? b : Number.MAX_VALUE;

	var gl = this.webgl.context;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SCLMPCalculator.TEXTURE_UNIFORM_NAME_0);

	var nPad = this.webgl.getPad(N);
	// set the data specific variables in our shader program
	this.bindUniforms(N, nPad, a, b);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + nPad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + nPad)/ 4, out);
	}

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SCLMPCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SCLMPCalculator.prototype.bindUniforms = function(N, pad, a, b) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SCLMPCalculator.LENGTH_UNIFORM_NAME),
		b_gl = gl.getUniformLocation(this.program, SCLMPCalculator.UPPER_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SCLMPCalculator.LOWER_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad");

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);
	gl.uniform1f(a_gl, a);
	gl.uniform1f(b_gl, b);

};

},{"./webgl":13}],7:[function(require,module,exports){
var WebGL = require('./webgl');

/*  Downsample an image (useful in pooling layers).



	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function DownsampleCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = "// TODO: unroll loop for stride == factor and small values (2, 3)\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;  // texture coords of row/column to calculate\nuniform sampler2D X;       // texture with data from padded A\nuniform int       factor;  // width of image patch\nuniform float     stride;  // width between image patches\nuniform float     C;       // number of channels\nuniform float     M;\nuniform float     N;\nuniform float     N_out;\nuniform float     M_out;\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1604150559(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate and translate to output pixel space.\n\tfloat row = floor(outTex.y * M_out);   // row on output texture (matrix space)\n\tfloat col = floor(outTex.x * N_out); // column on output texture (matrix space)\n\tfloat vcol = floor(col / C);   // virtual column on output texture (matrix space)\n\tfloat vchannel = floor(mod(col, C)); // virtual channel on output texture\n\n\tconst float min = -1.0e+08;\n\tvec4 currentMax = vec4(min, min, min, min);\n\n\tfloat deltaY = 1.0/M;\n\tfloat deltaX = 1.0/N;\n\tfloat y = ((row * stride) + 0.5)*deltaY; // texture position of input row\n\tfloat x;\n\tfloat z = vchannel * deltaX;\n\tfor (int i = 0; i < 100; i += 1) {\n\t\tif (i >= factor) {\n\t\t\tbreak;\n\t\t}\n\t\tx = ((vcol * stride * C) + 0.5) * deltaX; // texture position of input column\n\n\t\tfor (int j = 0; j < 100; j += 1) {\n\t\t\tif (j >= factor) {\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tvec2 coords = vec2(x + z, y);\n\t\t\tvec4 x_v = texture2D(X, coords);\n\t\t\tcurrentMax = max(currentMax, x_v);\n\n\t\t\tx += (deltaX * C);\n\t\t}\n\t\ty += deltaY;\n\t}\n\tint chan = int(mod(outTex.x * N_out, 4.0 ));\n\tfloat val = select_index_1604150559(currentMax, int(chan));\n\tif (val == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n\tgl_FragColor = encode_float_1540259130(val);\n}\n";
		p = "// TODO: unroll loop for stride == factor and small values (2, 3)\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;  // texture coords of row/column to calculate\nuniform sampler2D X;       // texture with data from padded A\nuniform int       factor;  // width of image patch\nuniform float     stride;  // width between image patches\nuniform float     C;       // number of channels\nuniform float     M;\nuniform float     N;\nuniform float     N_out;\nuniform float     M_out;\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate and translate to output pixel space.\n\tfloat row = floor(outTex.y * M_out);   // row on output texture (pixel space)\n\tfloat col = floor(outTex.x * N_out); // column on output texture (matrix space)\n\tfloat vcol = floor(col / C);   // virtual column on output texture (matrix space)\n\tfloat vchannel = floor(mod(col, C)); // virtual channel on output texture\n\n\tconst float min = -1.0e+08;\n\tvec4 currentMax = vec4(min, min, min, min);\n\n\tfloat deltaY = 1.0/M;\n\tfloat deltaX = 1.0/N;\n\tfloat y = ((row * stride) + 0.5)*deltaY; // texture position of input row\n\tfloat x;\n\tfloat z = vchannel * deltaX;\n\tfor (int i = 0; i < 100; i += 1) {\n\t\tif (i >= factor) {\n\t\t\tbreak;\n\t\t}\n\t\tx = ((vcol * stride * C) + 0.5) * deltaX; // texture position of input column\n\n\t\tfor (int j = 0; j < 100; j += 1) {\n\t\t\tif (j >= factor) {\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tvec2 coords = vec2(x + z, y);\n\t\t\tvec4 x_v = texture2D(X, coords);\n\t\t\tcurrentMax = max(currentMax, x_v);\n\n\t\t\tx += (deltaX * C);\n\t\t}\n\t\ty += deltaY;\n\t}\n\n\tgl_FragColor = currentMax;\n}\n";

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = DownsampleCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
DownsampleCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
DownsampleCalculator.INPUT_ROW_COUNT_UNIFORM_NAME = "M";
DownsampleCalculator.INPUT_COLUMN_COUNT_UNIFORM_NAME = "N";
DownsampleCalculator.OUTPUT_ROW_COUNT_UNIFORM_NAME = "M_out";
DownsampleCalculator.OUTPUT_COLUMN_COUNT_UNIFORM_NAME = "N_out";
DownsampleCalculator.FACTOR_UNIFORM_NAME = "factor";
DownsampleCalculator.STRIDE_UNIFORM_NAME = "stride";
DownsampleCalculator.CHANNEL_COUNT_UNIFORM_NAME = "C";


/* Downsample (pool) the input using the maximum for each channel.

	M - rows in X
	N - columns in X
	c - (channels / 4) in X
	factor - the number of pixels (width and height) to combine
	stride - amount between groups of pixels
	X - input matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
DownsampleCalculator.prototype.calculate = function(M, N, channels, factor, stride, X, out){

	if(channels % WebGL.COMPONENTS_PER_TEXEL != 0){
		throw new Error("Channel count must be a multiple of " + WebGL.COMPONENTS_PER_TEXEL);
	}
	var gl = this.webgl.context;

    var N_out = (Math.floor((N - factor) / stride) + 1) * channels;
    var M_out = Math.floor((M - factor) / stride) + 1;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, DownsampleCalculator.TEXTURE_UNIFORM_NAME_0);


	// set the data specific variables in our shader program
	this.bindUniforms(M, N * channels, M_out, N_out, factor, stride, channels);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M_out, N_out, out);
	} else {
		this.webgl.bindOutputTexture(M_out, N_out/WebGL.COMPONENTS_PER_TEXEL, out);
	}


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	texture - texture containing input values to bind
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
DownsampleCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
DownsampleCalculator.prototype.bindUniforms = function(M, N, M_out, N_out, factor, stride, c) {
	var gl = this.webgl.context;

	// get var locations
	var M_gl = gl.getUniformLocation(this.program, DownsampleCalculator.INPUT_ROW_COUNT_UNIFORM_NAME),
		N_gl = gl.getUniformLocation(this.program, DownsampleCalculator.INPUT_COLUMN_COUNT_UNIFORM_NAME),
		M_out_gl = gl.getUniformLocation(this.program, DownsampleCalculator.OUTPUT_ROW_COUNT_UNIFORM_NAME),
		N_out_gl = gl.getUniformLocation(this.program, DownsampleCalculator.OUTPUT_COLUMN_COUNT_UNIFORM_NAME),
		factor_gl = gl.getUniformLocation(this.program, DownsampleCalculator.FACTOR_UNIFORM_NAME),
		stride_gl = gl.getUniformLocation(this.program, DownsampleCalculator.STRIDE_UNIFORM_NAME),
		channel_count_gl = gl.getUniformLocation(this.program, DownsampleCalculator.CHANNEL_COUNT_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1f(M_gl, M);
	gl.uniform1f(N_gl, N);
	gl.uniform1f(M_out_gl, M_out);
	gl.uniform1f(N_out_gl, N_out);
	gl.uniform1i(factor_gl, factor);
	gl.uniform1f(stride_gl, stride);
	gl.uniform1f(channel_count_gl, c);

};

},{"./webgl":13}],8:[function(require,module,exports){
var WebGL = require('./webgl');

/* A calculator object for the Float texture based GEMM

	Generalized Matrix Multiply (GEMM):

	C = alpha * A * B + beta * C

	where A * B is matrix multiplication


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SGEMMCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	// read GLSL files
	var s = "// fragment shader that calculates the matrix product and renders each\n// element to the bytes representing a 32-bit IEEE754 floating point in\n// the output RGBA canvas.\n// readPixel is used to read the bytes.\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform sampler2D B_t;\t\t// texture with data from padded transpose of B\nuniform int       K;\t\t// number of elements in shared dimension\nuniform int       N;\t\t// number of columns in output\nuniform int       pad;\t\t//\nuniform float     alpha; \t// coefficient to multiplication\n\n// sum of products between elements in row i (from A) x col j (from B)\n\n// Calculate the dot product between the row (from A) and column (from B)\n// identified by the passed indeces (output texture coordinate space).\n// We loop over elements in the row and column and sum the product\n// using the glsl `dot` function to process four elements at a time.\n// This four element optimization requires that the matrix B be\n// transposed before texel packing and that both matrices be padded\n// (with zeros) to a multiple of four (4) in their shared dimension.\nfloat dot_rowcol_1604150559(float y, float x, sampler2D A, sampler2D B_t, int K) {\n\tfloat delta_t = 1./float(K);// space (on texture) between elements\n\tfloat sum = 0.;\t\t\t// sum for this row/column pair\n\tfloat z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures\n\n\tfor (int l=0 ; l<4096 ; ++l) {\n\t\tif(l >= K / 4) break;    // stop when we finish the row/column\n\t\t// l is in pixel space, so we divide by four\n\n\t\t// retrieve next four elements from each texture\n\t\tvec4 a_ik = texture2D(  A, vec2(z, y));\n\t\tvec4 b_kj = texture2D(B_t, vec2(z, x));\n\n\t// use `dot` to process four elements at a time\n\t\tsum +=  dot(a_ik, b_kj);\n\t\tz += (4.0 * delta_t);      // (z + 0.5)*delta\n\t}\n\treturn sum;\n}\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\t// sum row x col for the passed pixel\n\tfloat sum = alpha * dot_rowcol_1604150559(row_t, col_t * float(N + pad)/float(N), A, B_t, K);\n\n\tif (sum == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n\t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1540259130(sum);\n}\n",
		s_c = "// fragment shader that calculates the matrix product (with additive 'C' term)\n// and renders each element to the bytes representing a 32-bit IEEE754 floating\n// point in the output RGBA canvas.\n// readPixel is used to read the bytes.\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform sampler2D B_t;\t\t// texture with data from padded transpose of B\nuniform sampler2D C;\t\t// texture with data from C\nuniform int       K;\t\t// number of elements in shared dimension\nuniform int       N;\t\t// number of columns in output\nuniform int       pad;\t\t//\nuniform float     alpha; \t// coefficient to multiplication\nuniform float     beta; \t// coefficient to additive term\n\n// sum of products between elements in row i (from A) x col j (from B)\n\n// Calculate the dot product between the row (from A) and column (from B)\n// identified by the passed indeces (output texture coordinate space).\n// We loop over elements in the row and column and sum the product\n// using the glsl `dot` function to process four elements at a time.\n// This four element optimization requires that the matrix B be\n// transposed before texel packing and that both matrices be padded\n// (with zeros) to a multiple of four (4) in their shared dimension.\nfloat dot_rowcol_1540259130(float y, float x, sampler2D A, sampler2D B_t, int K) {\n\tfloat delta_t = 1./float(K);// space (on texture) between elements\n\tfloat sum = 0.;\t\t\t// sum for this row/column pair\n\tfloat z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures\n\n\tfor (int l=0 ; l<4096 ; ++l) {\n\t\tif(l >= K / 4) break;    // stop when we finish the row/column\n\t\t// l is in pixel space, so we divide by four\n\n\t\t// retrieve next four elements from each texture\n\t\tvec4 a_ik = texture2D(  A, vec2(z, y));\n\t\tvec4 b_kj = texture2D(B_t, vec2(z, x));\n\n\t// use `dot` to process four elements at a time\n\t\tsum +=  dot(a_ik, b_kj);\n\t\tz += (4.0 * delta_t);      // (z + 0.5)*delta\n\t}\n\treturn sum;\n}\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1604150559(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1117569599(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tvec4 c_vec = texture2D(C, vec2(col_t, 0.5));\n\n\t// should be -0.5, but that subtly breaks at zero\n\tfloat col = col_t * float(N + pad); // index of first element in pixel (matrix space)\n\tint channel = int(mod(col, 4.0 ));\n\tfloat c = select_index_1117569599(c_vec, channel);\n\n\t// sum row x col for the passed pixel\n\tfloat sum = alpha * dot_rowcol_1540259130(row_t, col_t * float(N + pad)/float(N), A, B_t, K);\n\tsum += beta * c;\n\n\tif (sum == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n\t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1604150559(sum);\n}\n",
		p = "// fragment shader that calculates the matrix product and writes each\n// element to a pixel component in a floating point texture.\n// the output RGBA canvas.\n// readPixel is used to read the bytes.\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform sampler2D B_t;\t\t// texture with data from padded transpose of B\nuniform int       K;\t\t// number of elements in shared dimension\nuniform int       N;\t\t// number of columns in output\nuniform int       pad;\t\t//\nuniform float     alpha; \t// coefficient to multiplication\n\n// sum of products between elements in row i (from A) x col j (from B)\n\n// Calculate the dot product between the row (from A) and column (from B)\n// identified by the passed indeces (output texture coordinate space).\n// We loop over elements in the row and column and sum the product\n// using the glsl `dot` function to process four elements at a time.\n// This four element optimization requires that the matrix B be\n// transposed before texel packing and that both matrices be padded\n// (with zeros) to a multiple of four (4) in their shared dimension.\nfloat dot_rowcol_1540259130(float y, float x, sampler2D A, sampler2D B_t, int K) {\n\tfloat delta_t = 1./float(K);// space (on texture) between elements\n\tfloat sum = 0.;\t\t\t// sum for this row/column pair\n\tfloat z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures\n\n\tfor (int l=0 ; l<4096 ; ++l) {\n\t\tif(l >= K / 4) break;    // stop when we finish the row/column\n\t\t// l is in pixel space, so we divide by four\n\n\t\t// retrieve next four elements from each texture\n\t\tvec4 a_ik = texture2D(  A, vec2(z, y));\n\t\tvec4 b_kj = texture2D(B_t, vec2(z, x));\n\n\t// use `dot` to process four elements at a time\n\t\tsum +=  dot(a_ik, b_kj);\n\t\tz += (4.0 * delta_t);      // (z + 0.5)*delta\n\t}\n\treturn sum;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\tvec4 sum_v = vec4(0.0, 0.0, 0.0, 0.0);\n\tfloat col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)\n\tsum_v.r = alpha * dot_rowcol_1540259130(row_t, (col + 0.5)/float(N), A, B_t, K);\n\t// is last element in pixel past row length?\n\tif(pad > 0 && (col + 4.0) > float(N) ) {\n\t\t// compute elements in padded region\n\t\tif(pad < 3){\n\t\t\tsum_v.g = alpha * dot_rowcol_1540259130(row_t, (col + 1.5)/float(N), A, B_t, K);\n\t\t}\n\t\tif(pad < 2){\n\t\t\tsum_v.b = alpha * dot_rowcol_1540259130(row_t, (col + 2.5)/float(N), A, B_t, K);\n\t\t}\n\t} else {\n\t\tsum_v.g = alpha * dot_rowcol_1540259130(row_t, (col + 1.5)/float(N), A, B_t, K);\n\t\tsum_v.b = alpha * dot_rowcol_1540259130(row_t, (col + 2.5)/float(N), A, B_t, K);\n\t\tsum_v.a = alpha * dot_rowcol_1540259130(row_t, (col + 3.5)/float(N), A, B_t, K);\n\t}\n\n\tgl_FragColor = sum_v;\n}\n",
		p_c = "// fragment shader that calculates the matrix product and writes each\n// element to a pixel component in a floating point texture.\n// the output RGBA canvas.\n// readPixel is used to read the bytes.\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform sampler2D B_t;\t\t// texture with data from padded transpose of B\nuniform sampler2D C;\t\t// texture with data from C\nuniform int       K;\t\t// number of elements in shared dimension\nuniform int       N;\t\t// number of columns in output\nuniform int       pad;\t\t//\nuniform float     alpha; \t// coefficient to multiplication\nuniform float     beta; \t// coefficient to addition\n\n// sum of products between elements in row i (from A) x col j (from B)\n\n// Calculate the dot product between the row (from A) and column (from B)\n// identified by the passed indeces (output texture coordinate space).\n// We loop over elements in the row and column and sum the product\n// using the glsl `dot` function to process four elements at a time.\n// This four element optimization requires that the matrix B be\n// transposed before texel packing and that both matrices be padded\n// (with zeros) to a multiple of four (4) in their shared dimension.\nfloat dot_rowcol_1540259130(float y, float x, sampler2D A, sampler2D B_t, int K) {\n\tfloat delta_t = 1./float(K);// space (on texture) between elements\n\tfloat sum = 0.;\t\t\t// sum for this row/column pair\n\tfloat z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures\n\n\tfor (int l=0 ; l<4096 ; ++l) {\n\t\tif(l >= K / 4) break;    // stop when we finish the row/column\n\t\t// l is in pixel space, so we divide by four\n\n\t\t// retrieve next four elements from each texture\n\t\tvec4 a_ik = texture2D(  A, vec2(z, y));\n\t\tvec4 b_kj = texture2D(B_t, vec2(z, x));\n\n\t// use `dot` to process four elements at a time\n\t\tsum +=  dot(a_ik, b_kj);\n\t\tz += (4.0 * delta_t);      // (z + 0.5)*delta\n\t}\n\treturn sum;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tvec4 c_v = texture2D(C, vec2(col_t, 0.5));\n\n\tvec4 sum_v = vec4(0.0, 0.0, 0.0, 0.0);\n\tfloat col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)\n\tsum_v.r = alpha * dot_rowcol_1540259130(row_t, (col + 0.5)/float(N), A, B_t, K);\n\t// in the padding region?\n\tif(pad > 0 && (col + 4.0) > float(N) ) {\n\t\t// pad\n\t\tif(pad < 3){\n\t\t\tsum_v.g = alpha * dot_rowcol_1540259130(row_t, (col + 1.5)/float(N), A, B_t, K);\n\t\t}\n\t\tif(pad < 2){\n\t\t\tsum_v.b = alpha * dot_rowcol_1540259130(row_t, (col + 2.5)/float(N), A, B_t, K);\n\t\t}\n\t} else {\n\t\tsum_v.g = alpha * dot_rowcol_1540259130(row_t, (col + 1.5)/float(N), A, B_t, K);\n\t\tsum_v.b = alpha * dot_rowcol_1540259130(row_t, (col + 2.5)/float(N), A, B_t, K);\n\t\tsum_v.a = alpha * dot_rowcol_1540259130(row_t, (col + 3.5)/float(N), A, B_t, K);\n\t}\n\n\tgl_FragColor = sum_v + beta*c_v;\n}\n";

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program_ = this.webgl.createProgram(s);
		this.program_c = this.webgl.createProgram(s_c);
	} else {
		this.program_ = this.webgl.createProgram(p);
		this.program_c = this.webgl.createProgram(p_c);
	}

}

module.exports = SGEMMCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SGEMMCalculator.TEXTURE_UNIFORM_NAME_0 = "A";
SGEMMCalculator.TEXTURE_UNIFORM_NAME_1 = "B_t";
SGEMMCalculator.TEXTURE_UNIFORM_NAME_2 = "C";
SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME = "K";
SGEMMCalculator.COLUMN_COUNT_UNIFORM_NAME = "N";
SGEMMCalculator.PAD_UNIFORM_NAME = "pad";
SGEMMCalculator.ALPHA_UNIFORM_NAME = "alpha";
SGEMMCalculator.BETA_UNIFORM_NAME = "beta";

/* Calculate the GEMM, with the given data.

	M - number of rows in A
	N - number of columns in B
	K - number of elements in shared dimension (including padding)
	alpha - scalar for A
	A - left hand matrix (as padded texture)
	B - transpose of right hand matrix (as padded texture)
	beta - scalar for C
	C - additive matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 TODO: signature should look like this:
 ( TRANSA, TRANSB, M, N, K, ALPHA, A, LDA, B, LDB, BETA, C, LDC )
 http://www.math.utah.edu/software/lapack/lapack-blas/dgemm.html
 */
SGEMMCalculator.prototype.calculate = function(M, N, K, alpha, A, B, beta, C, out){

	var gl = this.webgl.context;

	/*
	var h1 = M, w1 = K,
		h2 = K, w2 = N;
	*/

	// set this calculator program as the active program
	if(C != null){
		this.program = this.program_c;
	} else {
		beta = null;
		this.program = this.program_;
		//console.log("no C");
	}
	this.webgl.selectProgram(this.program);

	//  bind our input textures containing matrix data
	this.bindInputTexture(A, gl.TEXTURE0, SGEMMCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(B, gl.TEXTURE1, SGEMMCalculator.TEXTURE_UNIFORM_NAME_1);
	if(C != null){
		this.bindInputTexture(C, gl.TEXTURE2, SGEMMCalculator.TEXTURE_UNIFORM_NAME_2);
	}

	var kPad = this.webgl.getPad(K),
		nPad = this.webgl.getPad(N);

	// set the data specific variables in our shader program
	this.bindUniforms(N, K + kPad, nPad, alpha, beta);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + nPad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + nPad)/ 4, out);
	}

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);
	this.webgl.unbindInputTexture(gl.TEXTURE1);
	this.webgl.unbindInputTexture(gl.TEXTURE2);

	// result can now be read with gl.readResult, or more operations can be
	// performed on destination texture (in pipeline mode)
};


/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SGEMMCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};


/* Set up inputs for the texture shader

	K - size of shared dimension for multiplied matrices
 */
SGEMMCalculator.prototype.bindUniforms = function(N, K, pad, alpha, beta) {
	var gl = this.webgl.context;

	// get var locations
	var K_gl	 = gl.getUniformLocation(this.program, SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME),
		alpha_gl = gl.getUniformLocation(this.program, SGEMMCalculator.ALPHA_UNIFORM_NAME),
		beta_gl = gl.getUniformLocation(this.program, SGEMMCalculator.BETA_UNIFORM_NAME),
		N_gl = gl.getUniformLocation(this.program, SGEMMCalculator.COLUMN_COUNT_UNIFORM_NAME),
		pad_gl = pad_gl = gl.getUniformLocation(this.program, SGEMMCalculator.PAD_UNIFORM_NAME);

	gl.uniform1f(beta_gl, beta);
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);

	// bind length of shared dimension
	gl.uniform1i(K_gl, K);
	// bind alpha
	gl.uniform1f(alpha_gl, alpha);

};

},{"./webgl":13}],9:[function(require,module,exports){
var WebGL = require('./webgl');

/*  Linearize onto Kernels, a transformation similar to im2col, which
	transforms the input to a convolution kernel into a row.

	X - input data
	k - kernal width
	stride - number of elements between beginnings of patches


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SLOKNCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var p = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;  // texture coords of row/column to calculate\nuniform sampler2D X;       // texture with data from padded A\nuniform float     factor;  // width of image patch\nuniform float     stride;  // width between image patches\nuniform float     margin;\nuniform float     N_p;     // patches across\nuniform float     M;\nuniform float     N;\nuniform float     pad;\nuniform float     M_in;\nuniform float     N_in;\nuniform float     C;       // number of channels in input\nuniform float     pad_in;\n\n// select an element from a vector based on index\nfloat select_index_1540259130(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\n// translate a linear index into x, y coordinates for a matrix\nvec2 linear_index_coords_1604150559(float linear_index, float row_length){\n\tvec2 coords;\n\n\tcoords.x = floor(mod(linear_index + 0.5, row_length)); // column\n\tcoords.y = floor((linear_index + 0.5) / row_length); // row\n\n\treturn coords;\n}\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1117569599(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\t// row corresponds to patch\n\tfloat row = floor(row_t * M) + 0.5;\n\t// column corresponds to placement in patch\n\tfloat col_0 = floor(col_t * (N + pad) - 1.5); // index of first element in output pixel (matrix space)\n\n\t// N_p = patches across\n\tfloat col_patch = floor(mod(row, N_p)); // column index in grid of patches\n\tfloat row_patch = floor(row / N_p); // row index in grid of patches\n\tfloat col_in_0 = (col_patch * stride - margin) * C; // input column index of left element in patch\n\tfloat row_in_0 = row_patch * stride - margin; // input row index of top element in patch\n\n\tvec4 pixel_in;\n\tvec4 result = vec4(0.0, 0.0, 0.0, 0.0);\n\tvec2 coords = linear_index_coords_1604150559(col_0, factor * C); // coords inside patch\n\tvec2 ncoords;\n\tint channel_in = int(mod(col_in_0 + coords.x, 4.0));\n\tvec2 scale_in = vec2(1.0/(N_in + pad_in), 1.0/M_in); // scale from matrix to input texture coords\n\tvec2 offset_in = vec2(col_in_0 + 2.0 - float(channel_in), row_in_0 + 0.5); // offset into patch (and pixel)\n\n\tconst vec2 pixel_scale = vec2(1.0/4.0, 1.0); // scale from matrix to pixel coords\n\n\tpixel_in = texture2D(X, (coords + offset_in) * scale_in);\n\n\t// go through channels for current output pixel\n\tfor(int channel = 0; channel < 4; channel++){\n\n\t\t// are we on a new input pixel?\n\t\tncoords = linear_index_coords_1604150559(col_0 + float(channel), factor * C);\n\n\t\t// are we in the margin or outside the input texture?\n\t\tif((col_in_0 + ncoords.x + 0.5 < 0.0) || (row_in_0 + ncoords.y + 0.5 < 0.0) ||\n\t\t   (col_in_0 + ncoords.x + 0.5) > (N_in) || row_in_0 + ncoords.y + 0.5 > M_in){\n\t\t\t// yes, create a virtual pixel\n\t\t\tpixel_in = vec4(0.0, 0.0, 0.0, 0.0);\n\t\t} else if(floor(ncoords * pixel_scale) != floor(coords * pixel_scale)){\n\t\t\t// no, get the get the next real pixel\n\t\t\tcoords = ncoords;\n\t\t\toffset_in.x += float(channel_in);\n\t\t\tchannel_in = 0;\n\t\t\tpixel_in = texture2D(X, (coords + offset_in) * scale_in);\n\t\t}\n\n\t\tif(channel == 0){\n\t\t\tresult.r = select_index_1540259130(pixel_in, channel_in);\n\t\t} else if(channel == 1){\n\t\t\tresult.g = select_index_1540259130(pixel_in, channel_in);\n\t\t} else if(channel == 2){\n\t\t\tresult.b = select_index_1540259130(pixel_in, channel_in);\n\t\t} else {\n\t\t\tresult.a = select_index_1540259130(pixel_in, channel_in);\n\t\t}\n\n\t\tchannel_in++;\n\t\toffset_in.x -= 1.0;\n\t}\n\n\t// fix padded region\n\tif(pad > 0.0 && col_0 + 4.0 > N ) {\n\t\tfix_pad_1117569599(result, int(pad));\n\t}\n\n\t//gl_FragColor = vec4(row_in_0, col_in_0, channel_in, N_p);\n\tgl_FragColor = result;\n}\n";

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SLOKNCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SLOKNCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SLOKNCalculator.STRIDE_UNIFORM_NAME = "stride";
SLOKNCalculator.KERNEL_WIDTH_UNIFORM_NAME = "factor";

/* Elementwise scale and offset a matrix

	M - number of rows in X
	N - number of columns in X
	a - scalar coefficient to X
	b - scalar offset of X
	X - matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SLOKNCalculator.prototype.calculate = function(M, N, channels, M_out, N_out, N_p, factor, stride, margin, X, out){

	var gl = this.webgl.context;

	var pad = this.webgl.getPad(N * channels),
		pad_out = this.webgl.getPad(N_out);

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SLOKNCalculator.TEXTURE_UNIFORM_NAME_0);

	// set the data specific variables in our shader program
	this.bindUniforms(M_out, N_out, pad_out, M, N * channels, channels, pad, N_p, factor, stride, margin);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M_out, N_out + pad_out, out);
	} else {
		this.webgl.bindOutputTexture(M_out, (N_out + pad_out)/ 4, out);
	}


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	texture - texture containing the data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SLOKNCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SLOKNCalculator.prototype.bindUniforms = function(M, N, pad, M_in, N_in, channels, pad_in, N_p, factor, stride, margin) {
	var gl = this.webgl.context;

	// get var locations
	var M_gl = gl.getUniformLocation(this.program, "M"),
		N_gl = gl.getUniformLocation(this.program, "N"),
		c_gl = gl.getUniformLocation(this.program, "C"),
		M_in_gl = gl.getUniformLocation(this.program, "M_in"),
		N_in_gl = gl.getUniformLocation(this.program, "N_in"),
		stride_gl = gl.getUniformLocation(this.program, SLOKNCalculator.STRIDE_UNIFORM_NAME),
		factor_gl = gl.getUniformLocation(this.program, SLOKNCalculator.KERNEL_WIDTH_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad"),
		pad_in_gl = gl.getUniformLocation(this.program, "pad_in"),
		N_p_gl = gl.getUniformLocation(this.program, "N_p");
		margin_gl = gl.getUniformLocation(this.program, "margin");

	// bind length of shared dimension
	gl.uniform1f(M_gl, M);
	gl.uniform1f(N_gl, N);
	gl.uniform1f(pad_gl, pad);
	gl.uniform1f(M_in_gl, M_in);
	gl.uniform1f(N_in_gl, N_in);
	gl.uniform1f(c_gl, channels);
	gl.uniform1f(pad_in_gl, pad_in);
	gl.uniform1f(N_p_gl, N_p);
	gl.uniform1f(factor_gl, factor);
	gl.uniform1f(stride_gl, stride);
	gl.uniform1f(margin_gl, margin);

};

},{"./webgl":13}],10:[function(require,module,exports){
var WebGL = require('./webgl');

/*  a more general version of the BLAS Level 1 scale that works on matrices
    and includes an elementwise scalar addition

    a * X + b

	where X is a matrix, a and b are scalars and operations are elementwise

    to get the standard BLAS scal set M = 1 and b = 0


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SSCALCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded X\nuniform int       N;\t\t// number of columns\nuniform int       pad;\t\t// additional columns to nearest multiple of four\nuniform float     b; \t\t// additive term\nuniform float     a; \t\t// multiplicative term\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1604150559(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n \tfloat row = outTex.y;\n\tfloat col = outTex.x;\n\n\t// direct usage of col requires output be padded exactly like input\n\tvec4 x = texture2D( X, vec2(col, row));\n\tvec4 sum_v = (a * x) + b;\n\tint channel = int(mod(col * float(N + pad), 4.0 ));\n\tfloat sum = select_index_1604150559(sum_v, channel);\n\n\tif (sum == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n \t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1540259130(sum);\n}\n",
		p = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded X\nuniform int       N;\t\t// number of columns\nuniform int       pad;\t\t// additional columns to nearest multiple of four\nuniform float     b; \t\t// additive term\nuniform float     a; \t\t// multiplicative term\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1540259130(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tfloat col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)\n\n\t// direct usage of col requires output be padded exactly like input\n\tvec4 x = texture2D( X, vec2(col_t, row_t));\n\tvec4 sum_v = (a * x) + b;\n\n\t// fix padded region\n\tif(pad > 0 && col + 4.0 > float(N) ) {\n\t\tfix_pad_1540259130(sum_v, pad);\n\t}\n\n\tgl_FragColor = sum_v;\n}\n";

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SSCALCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SSCALCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SSCALCalculator.LENGTH_UNIFORM_NAME = "N";
SSCALCalculator.ADD_UNIFORM_NAME = "b";
SSCALCalculator.MUL_UNIFORM_NAME = "a";

/* Elementwise scale and offset a matrix

	M - number of rows in X
	N - number of columns in X
	a - scalar coefficient to X
	b - scalar offset of X
	X - matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SSCALCalculator.prototype.calculate = function(M, N, a, b, X, out){

	var gl = this.webgl.context;

	var pad = this.webgl.getPad(N);

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SSCALCalculator.TEXTURE_UNIFORM_NAME_0);

	// set the data specific variables in our shader program
	this.bindUniforms(N, pad, a, b);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + pad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + pad)/ 4, out);
	}


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	texture - texture containing the data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SSCALCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SSCALCalculator.prototype.bindUniforms = function(N, pad, a, b) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SSCALCalculator.LENGTH_UNIFORM_NAME),
		b_gl = gl.getUniformLocation(this.program, SSCALCalculator.ADD_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SSCALCalculator.MUL_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad");

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);
	gl.uniform1f(a_gl, a);
	gl.uniform1f(b_gl, b);

};

},{"./webgl":13}],11:[function(require,module,exports){
var globals = require("./globals");

var gl = globals.gl;

function Tensor(shape, data){
	if(shape.length != 2)
		throw new Error("Only Tensor of order two (matrix) is supported right now.");

	var M = shape[0],
		N = shape[1];

	this.texture = gl.createDataTexture(M, N, data);

	this.shape = [M, N];
}

module.exports = Tensor;

Tensor.prototype.delete = function(){
	gl.context.deleteTexture(this.texture);
	this.texture = null;
	this.shape = null;
};

Tensor.prototype.transfer = function(keep){

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result;

	// create output texture
	out = gl.createOutputTexture(M, N);

	// float extraction
	gl.encode(M, N, this.texture, out);

	result = new Float32Array(gl.readData(M, N));

	// clean up
	gl.context.deleteTexture(out);

	if(!keep){
		this.delete();
	}

	return result;
};

Tensor.prototype.reshape = function(shape, keep){

	var M = this.shape[0],
		N = this.shape[1],
		M_out = shape[0],
		N_out = shape[1];

	// create new texture to hold tranpose
	var t0 = new Tensor(shape, null);

	// invoke shader
	gl.reshape(M, N, M_out, N_out, this.texture, t0.texture);

	if(!keep){
		this.delete();
	}

	return t0;
};

Tensor.prototype.transpose = function(keep){

	var M = this.shape[0],
		N = this.shape[1];

	// create new texture to hold tranpose
	var tT = new Tensor([N, M], null);

	// invoke shader
	gl.transpose(M, N, this.texture, tT.texture);

	if(!keep){
		this.delete();
	}

	return tT;
};

Tensor.prototype.split = function(stride, keep){

	var M = this.shape[0],
		N = this.shape[1];

	if(N % 2 !== 0)
		throw new Error("row count must be multiple of two.");


	// create new texture to hold tranpose
	var t0 = new Tensor([M, N/2], null),
		t1 = new Tensor([M, N/2], null);

	gl.submatrix(N, M, N/2, stride, 0, this.texture, t0.texture);
	gl.submatrix(N, M, N/2, stride, 1, this.texture, t1.texture);

	if(!keep){
		this.delete();
	}

	return [t0, t1];
}

Tensor.combine = function(t0, t1, stride, keep){

	var M = t0.shape[0],
		N = t0.shape[1];

	if(t0.shape[1] !== t1.shape[1] || t0.shape[0] !== t1.shape[0])
		throw new Error("row and column counts must be equal.");

	if(stride % 4 !== 0)
		throw new Error("stride must be a multiple of four");

	// create new texture to hold tranpose
	var t2 = new Tensor([M, N * 2], null);

	gl.combine(M, N, stride, t0.texture, t1.texture, t2.texture);

	if(!keep){
		t0.delete();
		t1.delete();
	}

	return t2;
}

},{"./globals":3}],12:[function(require,module,exports){
var async = require('async'),
	loader = require('arrayloader'); // browserify aware file loader (xhr in browser)

/* Collection of helper methods for testing numerical computation
 */
test = {};

/* Check all entries in two TypedArrays of identical length for approximate
	equality.
	If the following equation is element-wise true, returns true

	absolute(a - b) <= (atol + rtol * absolute(b))

	from numpy.allclose
 */
test.allclose = function(a, b, RTOL, ATOL){
	RTOL= RTOL || 1e-05;  // for 32 bit precision: 1e-06
	ATOL= ATOL || 1e-08;

	if(a.length != b.length){
		console.log("lengths not equal: " + a.length + ", " + b.length);
		return {"result" : false, "index": null};
	}

	var result;
	for(var i = 0; i < a.length; i++){

		result = Math.abs(a[i] - b[i]) <= ATOL + RTOL * Math.abs(b[i]);

		if(!result) {
			return {"result": false, "index": i};
		}
	}

	return {"result": true, "index": i};
};

test.randomArray = function(N, M){

	var data = [];

	for(var i = 0; i < N; i++){
		var row = [];
		for(var j = 0; j < M; j++){
			row[j] = Math.random() / Math.sqrt(N);
		}
		data.push(row);
	}

	return data;
};
// pad rows with zeros
test.padData = function(M, N, pad, data){

	var padded = new Float32Array(M * (N + pad)); // new array of specified length filled with zeros
	for(var i = 0; i < M; i++){
		padded.set(data.subarray(i * N, (i + 1) * N), i * (N + pad));
	}
	return padded;
};

test.submatrix = function(N, M, N_out, offset, data){
	var result = new data.constructor(M * N_out);

	for(var i = 0; i < M; i++){
		for(var j = 0; j < N_out; j++){
			result[i * N_out + j] = data[i * N + j + offset];
		}
	}

	return result;
};


function loadFloat32Array(path, cb){
	return loader.load(path, Float32Array, cb);
}

/* Load test matrices from JSON data, works in a browser (with XHR)
	assumes three files 'a.json', 'b.json' and 'c.json' in nested Array format.

 callback = function(err, a, b, c)
 */
test.load = function(testDirectory, matrixFiles, callback){

	// array of paths to matrix data files for current test
	var testFiles = matrixFiles.map(function(item){ return testDirectory + item;});

	//console.log(testFiles);
	async.map(testFiles, loadFloat32Array,
		function(err, results){

			if(err) return callback(err);

			callback(err, results);
		}
	);
};

test.assert = {};

/* create a tape compatible assert */
test.assert.allclose = function(t, a, b, msg, RTOL, ATOL) {

	var ok = test.allclose(a, b, RTOL, ATOL),
		actual = "[",
		expected = "[";

	if(!ok.result){

		if(ok.index > 1){
			actual += "..., ";
			expected += "..., ";
		}
		if(ok.index > 0){
			actual += a[ok.index - 1] + ", ";
			expected += b[ok.index - 1] + ", ";
		}
		actual += "-->";
		expected += "-->";

		for(var i = ok.index; i < ok.index + 4 && i < a.length; i++ ){
			actual += a[i] + ", ";
			expected += b[i] + ", ";
		}
		if(i < a.length){
			actual += "...]";
			expected += "...]";
		} else {
			actual += "]";
			expected += "]";
		}
		msg = msg || 'should be allclose at ' + ok.index;
	}

    t._assert(ok.result, {
        message : msg || 'should be allclose',
        operator : 'allclose',
        actual : actual,
        expected : expected,
        extra : null
    });
}

module.exports = test;

},{"arrayloader":14,"async":15}],13:[function(require,module,exports){

/*
Copyright (c) 2015 Waylon Flinn

webgl.js

multiply matrices up to 4096 x 4096 on GPUs that support OES_texture_float
extension. input is encoded into the red and green channels of an input texture and
calculations are done using a custom fragment shader.

*/


/*
	A WebGL context associated with a specific canvas element.

	* creates a canvas
	* sets up webgl context
	* translates numbers into textures
	* compiles shader programs for executing math (when supplied with an
		operation specific fragment shader)
 */
function WebGL(options) {

	var glOptions,
		ext;

	options = options || {};

	// canvas
	if(typeof options.canvas === 'undefined')
		this.canvas = document.createElement('canvas');
	else
		this.canvas = options.canvas;

	// context
	glOptions = { premultipliedAlpha: false, preserveDrawingBuffer: false };
	this.context = this.canvas.getContext("experimental-webgl", glOptions);

	if (typeof this.context === 'undefined')
		throw new Error("No support for Webgl.");

	// float texture extension
	try {
		ext = this.context.getExtension('OES_texture_float');
	} catch(e) {

	}
	if ( !ext ) {
		console.log("No support for OES_texture_float extension.");
		this.hasFloat = false;
	} else {
		this.hasFloat = true;
	}

	var highp = this.context.getShaderPrecisionFormat(this.context.FRAGMENT_SHADER, this.context.HIGH_FLOAT);
	this.hasHighPrecision = highp.precision != 0;
	if(this.hasHighPrecision) this.highp = highp;

	// create pass through vertex shader
	var passThrough = "// vertex shader for a single quad\n// work is performed in the operation specific texture shader\n\nprecision highp float;\n#define GLSLIFY 1\n\nattribute vec3 pos;\nattribute vec2 tex;\nvarying vec2   outTex;\nvoid main(void)\n{\n\t// just pass the position and texture coords\n\tgl_Position = vec4(pos, 1.0);\n\toutTex = tex;\n}\n";
	this.vertexShader = this.context.createShader(this.context.VERTEX_SHADER);
	this.context.shaderSource(this.vertexShader, passThrough);
	this.context.compileShader(this.vertexShader);

	var encode = "\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform int       N;\t\t// number of columns in output\nuniform int       pad;\t\t//\n\n// Render float to bytes according to IEEE 754 Floating Point\nvec4 encode_float_1540259130(float val) {\n\n\t// TODO: correctly handle denormal numbers\n\t// http://www.2ality.com/2012/04/number-encoding.html\n\tfloat a = abs(val);                           // encode absolute value + sign\n\tfloat exp = floor(log2(a));                 // number of powers of 2\n\tfloat mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)\n\tfloat mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa\n\tfloat mant2 = mod(floor(mant / 256.),256.); // second 8 bits\n\tfloat mant3 = mod(mant,256.);               // third 8 bits\n\n\thighp float sign = 128.-128.*(a/val);\t\t\t// sign bit is 256 or 0\n\thighp float e = (sign+exp+127.)/510.;\t\t// exponent and sign\n\thighp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit\n\thighp float m2 = (mant2)/255.;\t\t\t\t// middle part\n\thighp float m3 = (mant3+.5)/255.;\t\t\t// scale to 0 - 255\n\n\treturn vec4(m3,m2,m1,e);\n}\n\n// select an element from a vector based on index\nfloat select_index_1604150559(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\tvec4 val_v = texture2D(A, vec2(col_t * float(N)/float(N + pad), row_t));\n\tint channel = int(mod(col_t * float(N), 4.0 ));\n\tfloat val = select_index_1604150559(val_v, channel);\n\n\tif (val == 0.) {\n\t\tgl_FragColor = vec4(0.,0.,0.,0.);\n\t\treturn;\n\t}\n\n \t// output vec4 with bytes for an IEEE754 32-bit floating point number\n\tgl_FragColor = encode_float_1540259130(val);\n}\n",
		transpose = "\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform int       M;\t\t// number of rows in output\nuniform int       N;\t\t// number of columns in output\nuniform int       mpad;\t\t//\nuniform int       npad;\t\t//\n\n// select an element from a vector based on index\nfloat select_index_1540259130(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tfloat col = (col_t * float(N + npad) - 2.0); // index of first element in pixel (matrix space)\n\n\t// get rows in the input, each containing one element in the output\n\tvec4 row_1 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 0.5)/float(N)));\n\tvec4 row_2 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 1.5)/float(N)));\n\tvec4 row_3 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 2.5)/float(N)));\n\tvec4 row_4 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 3.5)/float(N)));\n\n\t// package into output vector\n\tint channel = int(mod(row_t * float(M), 4.0 ));\n\n\tvec4 col_v = vec4(0.0, 0.0, 0.0, 0.0); // vec4 representing four elements in a column in the input\n\n\t// extract relevent element from each input row\n\tcol_v.r = select_index_1540259130(row_1, channel);\n\tif(npad > 0 && (col + 4.0) > float(N) ) {\n\t\t// compute elements in padded region\n\t\tif(npad < 3){\n\t\t\tcol_v.g = select_index_1540259130(row_2, channel);\n\t\t}\n\t\tif(npad < 2){\n\t\t\tcol_v.b = select_index_1540259130(row_3, channel);\n\t\t}\n\t} else {\n\t\tcol_v.g = select_index_1540259130(row_2, channel);\n\t\tcol_v.b = select_index_1540259130(row_3, channel);\n\t\tcol_v.a = select_index_1540259130(row_4, channel);\n\t}\n\n\tgl_FragColor = col_v;\n}\n",
		reshape = "\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform float     M;\t\t// number of rows in output\nuniform float     N;\t\t// number of columns in output\nuniform float     pad;\t\t// column padding in output\nuniform float     M_in;\t\t// number of rows in input\nuniform float     N_in;\t\t// number of columns in input\nuniform float     pad_in;\t// column padding in input\n\n/* number of input pixels\n   origin index (channel) for each\n   termination index (channel) for each\n   destination origin index (channel) for each\n */\n// select an element from a vector based on index\nfloat select_index_1540259130(vec4 v, int index){\n\tfloat val;\n\tif (index == 0) {\n\t\tval = v.r;\n\t} else if(index == 1) {\n\t\tval = v.g;\n\t} else if(index == 2) {\n\t\tval = v.b;\n\t} else if(index == 3){\n\t\tval = v.a;\n\t} else {\n\t\t// should never be here\n\t\tval = 0.0;\n\t}\n\n\treturn val;\n}\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1604150559(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\n// translate a linear index into x, y coordinates for a matrix\nvec2 linear_index_coords_1117569599(float linear_index, float row_length){\n\tvec2 coords;\n\n\tcoords.x = floor(mod(linear_index + 0.5, row_length)); // column\n\tcoords.y = floor((linear_index + 0.5) / row_length); // row\n\n\treturn coords;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\tfloat row = floor(row_t * M);\n\tfloat col_0 = (col_t * (N + pad) - 2.0); // index of first element in pixel (matrix space)\n\t//float col_0 = floor(col_t * (N + pad)/4.0)*4.0; // index of first element in pixel (matrix space)\n\tfloat lin_index_0 = row * N + col_0; // linearized index of first element in pixel in output\n\n\tvec4 pixel_in = vec4(0.0, 0.0, 0.0, 0.0);\n\tvec4 result = vec4(0.0, 0.0, 0.0, 0.0);\n\tvec2 coords = linear_index_coords_1117569599(lin_index_0, N_in);\n\tvec2 ncoords;\n\tint channel_in = int(mod(coords.x, 4.0));\n\n\tvec2 scale_in = vec2(1.0/(N_in + pad_in), 1.0/M_in); // scale from matrix to input texture coords\n\tvec2 offset_in = vec2(0.5, 0.5); // move away from edge of pixel\n\tconst vec2 pixel_scale = vec2(1.0/4.0, 1.0); // scale from matrix to pixel coords\n\n\tpixel_in = texture2D(A, (coords + offset_in) * scale_in);\n\n\t// go through channels for current output pixel\n\tfor(int channel = 0; channel < 4; channel++){\n\n\t\t// are we on a new input pixel?\n\t\tncoords = linear_index_coords_1117569599(lin_index_0 + float(channel), N_in);\n\t\tif(floor(ncoords * pixel_scale) != floor(coords * pixel_scale)){\n\t\t\tcoords = ncoords;\n\t\t\tpixel_in = texture2D(A, (coords + offset_in) * scale_in);\n\t\t\tchannel_in = 0;\n\t\t}\n\n\t\tif(channel == 0){\n\t\t\tresult.r = select_index_1540259130(pixel_in, channel_in);\n\t\t} else if(channel == 1){\n\t\t\tresult.g = select_index_1540259130(pixel_in, channel_in);\n\t\t} else if(channel == 2){\n\t\t\tresult.b = select_index_1540259130(pixel_in, channel_in);\n\t\t} else {\n\t\t\tresult.a = select_index_1540259130(pixel_in, channel_in);\n\t\t}\n\n\t\tchannel_in++;\n\t}\n\n\t// are we in the padded (output) region?\n\tif(pad > 0.0 && col_0 + 3.5 > N ) {\n\t\tfix_pad_1604150559(result, int(pad));\n\t}\n\n\tgl_FragColor = result;\n}\n",
		reshape_simple = "\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform float     M;\t\t// number of rows in output\nuniform float     N;\t\t// number of columns in output\nuniform float     M_in;\t\t// number of rows in input\nuniform float     N_in;\t\t// number of columns in input\n\n// translate a linear index into x, y coordinates for a matrix\nvec2 linear_index_coords_1540259130(float linear_index, float row_length){\n\tvec2 coords;\n\n\tcoords.x = floor(mod(linear_index + 0.5, row_length)); // column\n\tcoords.y = floor((linear_index + 0.5) / row_length); // row\n\n\treturn coords;\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\n\tfloat row = floor(row_t * M);\n\tfloat col_0 = floor(col_t * N - 1.5); // index of first element in pixel (matrix space)\n\tfloat lin_index_0 = row * N + col_0; // linearized index of first element in pixel in output\n\n\tvec4 result;\n\tvec2 coords = linear_index_coords_1540259130(lin_index_0, N_in);\n\n\tvec2 scale_in = vec2(1.0/N_in, 1.0/M_in); // scale from matrix to input texture coords\n\tvec2 offset_in = vec2(0.5, 0.5); // move away from edge of pixel\n\n\tresult = texture2D(A, (coords + offset_in) * scale_in);\n\n\tgl_FragColor = result;\n}\n",
		submatrix = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D X;\t\t// texture with data from padded X\nuniform float     N;\t\t// number of columns\nuniform float     pad;\t\t// additional columns to nearest multiple of four\nuniform float     N_in;\t\t// number of columns (input)\nuniform float     pad_in;\t// additional columns to nearest multiple of four (input)\nuniform float     stride;\nuniform float     offset;   // zero or one\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1540259130(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\n/* join parts of two pixels into one, selecting four continguous elements\n  starting at channel.\n*/\nvoid join_pixels_1604150559(inout vec4 x, vec4 x0, vec4 x1, float channel){\n\tif(channel == 1.0){\n\t\tx.rgb = x0.gba;\n\t\tx.a = x1.r;\n\t} else if(channel == 2.0){\n\t\tx.rg = x0.ba;\n\t\tx.ba = x1.rg;\n\t} else if(channel == 3.0){\n\t\tx.r = x0.a;\n\t\tx.gba = x1.rgb;\n\t}\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tfloat col = floor(col_t * (N + pad) - 1.5); // index of first element in pixel (output matrix space)\n\n\tfloat stripe = floor(col / stride);\n\tfloat sub_col = floor(mod(col, stride));\n\n\tfloat col_in = (offset + (2.0 * stripe)) * stride + sub_col;\n\n\tvec4 x;\n\tfloat channel = mod(col_in, 4.0); // channel in the input of first element in output\n\n\t// are we at the beggining of an input pixel?\n\tif(channel == 0.0){\n\t\t// yes, select the whole thing\n\t\tx = texture2D( X, vec2((col_in + 2.0 - channel) / (N_in + pad_in) , row_t));\n\t} else {\n\t\t// no, select parts from two pixels\n\t\tvec4 x0, x1;\n\t\tx0 = texture2D( X, vec2((col_in + 2.0 - channel) / (N_in + pad_in) , row_t));\n\t\tx1 = texture2D( X, vec2((col_in + 6.0 - channel) / (N_in + pad_in) , row_t));\n\n\t\tjoin_pixels_1604150559(x, x0, x1, channel);\n\n\t}\n\n\t// fix padded region\n\tif(pad > 0.0 && col + 4.0 > N ) {\n\t\tfix_pad_1540259130(x, int(pad));\n\t}\n\n\tgl_FragColor = x;\n}\n",
		combine = "precision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\nuniform sampler2D A;\t\t// texture with data from padded A\nuniform sampler2D B;\t\t// texture with data from padded B\nuniform float     N_in;\t\t// number of columns\nuniform float     pad_in;\t// additional columns to nearest multiple of four\nuniform float     stride;\n\n// set pad values to 0.0, if in padded region of output texture\nvoid fix_pad_1540259130(inout vec4 v, int pad){\n\tv.a = 0.0;\n\tif(pad == 2){\n\t\tv.b = 0.0;\n\t} else if(pad == 3){\n\t\tv.b = 0.0;\n\t\tv.g = 0.0;\n\t}\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\n\t// texture coordinate. These map directly to input texture space when\n\t// the relevant dimensions are the same.\n\tfloat row_t = outTex.y;\n\tfloat col_t = outTex.x;\n\tfloat N = N_in * 2.0;\n\tfloat pad = mod(N, 4.0);\n\tfloat col = floor(col_t * (N + pad) - 1.5); // index of first element in pixel (output matrix space)\n\n\tfloat stripe = floor(col / stride);\n\tfloat sub_col = floor(mod(col, stride));\n\n\tfloat tex_select = mod(stripe, 2.0);\n\tfloat col_in = floor(stripe / 2.0) * stride + sub_col;\n\n\tvec4 x;\n\tfloat channel = mod(col_in, 4.0); // channel in the input of first element in output\n\n\t// which input texture are we getting this pixel from?\n\tif(tex_select == 0.0){\n\t\tx = texture2D( A, vec2((col_in + 2.0) / (N_in + pad_in) , row_t));\n\t} else {\n\t\tx = texture2D( B, vec2((col_in + 2.0) / (N_in + pad_in) , row_t));\n\t}\n\n\t// fix padded region\n\tif(pad > 0.0 && col + 4.0 > N ) {\n\t\tfix_pad_1540259130(x, int(pad));\n\t}\n\n\tgl_FragColor = x;\n}\n";

	this.encode_program = this.createProgram(encode);
	this.transpose_program = this.createProgram(transpose);
	this.reshape_program = this.createProgram(reshape);
	this.reshape_simple_program = this.createProgram(reshape_simple);
	this.submatrix_program = this.createProgram(submatrix);
	this.combine_program = this.createProgram(combine);
};

module.exports = WebGL;

// RGBA is the standard input/ouput texture
WebGL.COMPONENTS_PER_TEXEL = 4;

WebGL.POSITION_UNIFORM_NAME = "pos";
WebGL.TEXTURE_UNIFORM_NAME = "tex";


WebGL.prototype.encode = function(M, N, texture0, out){

	this.program = this.encode_program;
	this.selectProgram(this.program);

	var pad = this.getPad(N);

	var N_gl = this.context.getUniformLocation(this.program, "N"),
		pad_gl = this.context.getUniformLocation(this.program, "pad");

	this.context.uniform1i(N_gl, N);
	this.context.uniform1i(pad_gl, pad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(M, N, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose = function(M, N, texture0, out){

	this.program = this.transpose_program;
	this.selectProgram(this.program);

	var npad = this.getPad(N),
		mpad = this.getPad(M);

	// in the shader M and N describe rows and columns in the *output*, respectively
	var N_gl = this.context.getUniformLocation(this.program, "N"),
		npad_gl = this.context.getUniformLocation(this.program, "npad"),
		M_gl = this.context.getUniformLocation(this.program, "M"),
		mpad_gl = this.context.getUniformLocation(this.program, "mpad");

	this.context.uniform1i(N_gl, M);
	this.context.uniform1i(npad_gl, mpad);
	this.context.uniform1i(M_gl, N);
	this.context.uniform1i(mpad_gl, npad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(N, (M + mpad)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.reshape = function(M, N, M_out, N_out, texture0, out){

	var pad = this.getPad(N),
		pad_out = this.getPad(N_out);

	if(pad == 0 && pad_out == 0){
		this.program = this.reshape_simple_program;
	} else {
		this.program = this.reshape_program;
		console.log("# WARNING: using slow reshape shader.");
	}

	this.selectProgram(this.program);


	// in the shader M and N describe rows and columns in the *output*, respectively
	var M_gl = this.context.getUniformLocation(this.program, "M"),
		N_gl = this.context.getUniformLocation(this.program, "N"),
		pad_gl = this.context.getUniformLocation(this.program, "pad"),
		M_in_gl = this.context.getUniformLocation(this.program, "M_in"),
		N_in_gl = this.context.getUniformLocation(this.program, "N_in"),
		pad_in_gl = this.context.getUniformLocation(this.program, "pad_in");

	this.context.uniform1f(M_gl, M_out);
	this.context.uniform1f(N_gl, N_out);
	this.context.uniform1f(pad_gl, pad_out);
	this.context.uniform1f(M_in_gl, M);
	this.context.uniform1f(N_in_gl, N);
	this.context.uniform1f(pad_in_gl, pad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(M_out, (N_out + pad_out)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

/* extract a portion of a texture into another texture
 */
WebGL.prototype.submatrix = function(N, M_out, N_out, stride, offset, texture0, out){

	this.program = this.submatrix_program;
	this.selectProgram(this.program);

	var pad = this.getPad(N),
		pad_out = this.getPad(N_out);

	// in the shader M and N describe rows and columns in the *output*, respectively
	var N_gl = this.context.getUniformLocation(this.program, "N"),
		pad_gl = this.context.getUniformLocation(this.program, "pad"),
		N_in_gl = this.context.getUniformLocation(this.program, "N_in"),
		pad_in_gl = this.context.getUniformLocation(this.program, "pad_in"),
		offset_gl = this.context.getUniformLocation(this.program, "offset");
		stride_gl = this.context.getUniformLocation(this.program, "stride");

	this.context.uniform1f(N_gl, N_out);
	this.context.uniform1f(pad_gl, pad_out);
	this.context.uniform1f(N_in_gl, N);
	this.context.uniform1f(pad_in_gl, pad);
	this.context.uniform1f(stride_gl, stride);
	this.context.uniform1f(offset_gl, offset);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "X");

	this.bindOutputTexture(M_out, (N_out + pad_out)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

/* combine two smaller textures into a larger texture
   M - input rows
   N - input columns
 */
WebGL.prototype.combine = function(M, N, stride, texture0, texture1, out){

	this.program = this.combine_program;
	this.selectProgram(this.program);

	var N_out = N * 2,
		pad = this.getPad(N),
		pad_out = this.getPad(N_out); // = (pad * 2) % 4

	// in the shader M and N describe rows and columns in the *output*, respectively
	var N_in_gl = this.context.getUniformLocation(this.program, "N_in"),
		pad_in_gl = this.context.getUniformLocation(this.program, "pad_in"),
		stride_gl = this.context.getUniformLocation(this.program, "stride");

	this.context.uniform1f(N_in_gl, N);
	this.context.uniform1f(pad_in_gl, pad);
	this.context.uniform1f(stride_gl, stride);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");
	this.bindInputTexture(texture1, this.context.TEXTURE1, "B");

	this.bindOutputTexture(M, (N_out + pad_out)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

WebGL.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/*  Create a shader program based on a pass through vertex shader and
	the supplied operation specific fragment shader.

	fragmentShaderSource - string containing the fragment shader source code.
	shader will recieve `vec2 outTex` with texture coordinates from the pass
	through vertex shader.
 */
WebGL.prototype.createProgram = function(fragmentShaderSource){
	var gl = this.context,
		fragmentShader;

	// compile the provided fragment/texture shader
	fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// did it compile correctly?
	if (gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) == 0)
		throw new Error(gl.getShaderInfoLog(fragmentShader));

	// link the program specific fragment shader and the generic pass through
	// shader into a program
	var program = gl.createProgram();
	gl.attachShader(program, this.vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	return program;
};

WebGL.prototype.selectProgram = function(program){

	var gl = this.context;

	// set calculator program to current shader program
	gl.useProgram(program);

	this.bindVertices(program);
};

/* setup required to draw a square to our vertex shader and have
   fragment shader called for each pixel
 */
WebGL.prototype.bindVertices = function(program) {
	var gl = this.context,
		renderer = program;

	// bind vertices
	var position = gl.getAttribLocation(renderer, WebGL.POSITION_UNIFORM_NAME);
	var vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

	// define a square that covers the screen
	var vertices = [-1.0, -1.0, 0.0,	// bottom left
					 1.0, -1.0, 0.0,	// bottom right
					 1.0,  1.0, 0.0,	// top right
					-1.0,  1.0, 0.0];	// top left
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(position, /*item size*/3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(position);

	// bind texture cords
	var texture = gl.getAttribLocation(renderer, WebGL.TEXTURE_UNIFORM_NAME);
	var texCoords = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
	var textureCoords = [0.0, 0.0,
						 1.0, 0.0,
						 1.0, 1.0,
						 0.0, 1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
	gl.vertexAttribPointer(texture, /*item size*/2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(texture);

	// index to vertices
	var indices = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
	// tesselate square into triangles
	// indeces into vertex array creating triangles, with counter-clockwise winding
	var vertexIndices = [0, 1, 2,	// bottom right triangle
						 0, 2, 3];	// top left triangle
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
};

/* create RGBA texture of width w/4 from given texels
   padding the width of each row to a multiple of 4, where necessary.

   if texels is null, an empty texture is created.

   alternative to textures?
   http://stackoverflow.com/questions/17203508/webgl-hardware-skinning-with-a-bone-texture
 */
WebGL.prototype.createDataTexture = function(h, w, texels){

	var gl = this.context;

	var PAD_TEMPLATE = [0.0, 0.0, 0.0, 0.0]; // value to pad remainder with

	var rem = (w % WebGL.COMPONENTS_PER_TEXEL),
		pad = rem == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - rem;

	// create the texture from our floats
	var texture = gl.createTexture();

	gl.bindTexture(	  gl.TEXTURE_2D, texture);
	/*
	// https://www.opengl.org/wiki/GLAPI/glPixelStore
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w/4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

	see also: https://www.opengl.org/wiki/Common_Mistakes#Creating_a_complete_texture
	*/
	if(pad == 0 || texels == null || typeof texels === 'undefined'){
		// no padding required, write directly from input array
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, (w + pad) / WebGL.COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, texels);

	} else {
		// must pad each row

		// create empty texture
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, (w + pad) / WebGL.COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, null);

		var full_texel_row_len = w - rem,
			full_row_texture_width = full_texel_row_len / WebGL.COMPONENTS_PER_TEXEL;

		var row_start = 0;
		var last_texel = new Float32Array(PAD_TEMPLATE);
		var row, remainder;

		// set texture data, one row at a time, padding each row to a multiple
		// of the texel length
		for(var i = 0; i < h; i++){
			row_start = i * w;
			full_texel_row_end = row_start + full_texel_row_len;
			row = new Float32Array(texels.buffer, row_start * texels.BYTES_PER_ELEMENT, full_texel_row_len);
			if(full_texel_row_len > 0){
				// https://www.khronos.org/registry/webgl/specs/latest/1.0/index.html#TEXSUBIMAGE2D
				gl.texSubImage2D(gl.TEXTURE_2D,
					 0,					// mip-map level
					 0,					// x-offset
					 i,					// y-offset
					 full_row_texture_width,	// width
					 1,					// height
					 gl.RGBA,			// format
					 gl.FLOAT,			// type
					 row			// data
				 );
			}

			remainder = new Float32Array(texels.buffer, full_texel_row_end * texels.BYTES_PER_ELEMENT, rem);
			last_texel.set(remainder); // copy remaining data

			gl.texSubImage2D(gl.TEXTURE_2D,
				 0,				// mip-map level
				 full_row_texture_width, // x-offset
				 i,				// y-offset
				 1,				// width
				 1,				// height
				 gl.RGBA,		// format
				 gl.FLOAT,		// type
				 last_texel		// data
			 );
		}
	}

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return texture;
};

/* Create a (padded) texture suitable for reading into an array with readPixels.
	UNSIGNED_BYTE
   Can be passed to bindDestinationTexture.

   Returns an unsigned byte RGBA texture (other formats are not yet supported
	on most platforms, see WEBGL_color_buffer_float extension)
 */
WebGL.prototype.createOutputTexture = function(h, w) {
	var gl = this.context;

	var pad = this.getPad(w);

	// create and bind texture to render to
	var destTexture = gl.createTexture();
	//gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, destTexture);
	gl.texImage2D(gl.TEXTURE_2D,/*level*/0, gl.RGBA, w + pad, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return destTexture;
};

/* Set up output

	M - number of rows in output
	N - number of columns in output
	dstTex - texture for holding the output
 */
WebGL.prototype.bindOutputTexture = function(M, N, texture) {
	var gl = this.context;

	// set canvas and viewport size
	this.canvas.height = M;
	this.canvas.width = N;
	gl.viewport(0, 0, N, M);

	// create and bind framebuffer
	this.framebuffer = this.framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, /*level*/0);


	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
		throw new Error("Bound framebuffer is not complete.");

	return this.framebuffer;
};

WebGL.prototype.unbindInputTexture = function(textureUnit){
	var gl = this.context;

	gl.activeTexture(textureUnit);
	gl.bindTexture(gl.TEXTURE_2D, null);
};

/* Read data out as unsigned bytes */
WebGL.prototype.readData = function(M, N){
	var gl = this.context;

	// create destination buffer
	rawbuffer = new ArrayBuffer(M*N*Float32Array.BYTES_PER_ELEMENT);

	// read the result into our buffer, as bytes
	prod = new Uint8Array(rawbuffer);
	gl.readPixels(0, 0, N, M, gl.RGBA, gl.UNSIGNED_BYTE, prod);

	// return raw result bytes
	return rawbuffer; // M x N
};

// how many extra elements do we need to fill up a pixel?
WebGL.prototype.getPad = function(N){

	var rem = (N % WebGL.COMPONENTS_PER_TEXEL),
		pad = rem == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - rem;

	return pad;
};

},{}],14:[function(require,module,exports){
exports.load = function(url, type, callback) {
	var xhr = new XMLHttpRequest();

	xhr.onreadystatechange = function() {
		if (xhr.readyState !== 4) {
			return;
		}

		if (xhr.status >= 200 && xhr.status < 300) {
			var arrayBuffer = xhr.response;
			if (arrayBuffer) {
				try{

					// parse according to type
					var data = new type(arrayBuffer);

					// return result
					return callback(null, data);
				} catch (e){
					return callback(e);
				}
			} else {
				return callback("empty response");
			}

		} else {
			var err = new Error("failed to request file '" + url + "'");
			// follow Node.js error signature
			err.errno = 34;
			callback(err);
		}
	};

	try {
		xhr.open('GET', url, true);
		xhr.responseType = "arraybuffer";
		xhr.send(null);
	} catch (err) {
		callback(err);
	}
};

},{}],15:[function(require,module,exports){
(function (process,global){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
(function () {

    var async = {};
    function noop() {}
    function identity(v) {
        return v;
    }
    function toBool(v) {
        return !!v;
    }
    function notId(v) {
        return !v;
    }

    // global on the server, window in the browser
    var previous_async;

    // Establish the root object, `window` (`self`) in the browser, `global`
    // on the server, or `this` in some virtual machines. We use `self`
    // instead of `window` for `WebWorker` support.
    var root = typeof self === 'object' && self.self === self && self ||
            typeof global === 'object' && global.global === global && global ||
            this;

    if (root != null) {
        previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        return function() {
            if (fn === null) throw new Error("Callback was already called.");
            fn.apply(this, arguments);
            fn = null;
        };
    }

    function _once(fn) {
        return function() {
            if (fn === null) return;
            fn.apply(this, arguments);
            fn = null;
        };
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    // Ported from underscore.js isObject
    var _isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    function _isArrayLike(arr) {
        return _isArray(arr) || (
            // has a positive integer length property
            typeof arr.length === "number" &&
            arr.length >= 0 &&
            arr.length % 1 === 0
        );
    }

    function _arrayEach(arr, iterator) {
        var index = -1,
            length = arr.length;

        while (++index < length) {
            iterator(arr[index], index, arr);
        }
    }

    function _map(arr, iterator) {
        var index = -1,
            length = arr.length,
            result = Array(length);

        while (++index < length) {
            result[index] = iterator(arr[index], index, arr);
        }
        return result;
    }

    function _range(count) {
        return _map(Array(count), function (v, i) { return i; });
    }

    function _reduce(arr, iterator, memo) {
        _arrayEach(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    }

    function _forEachOf(object, iterator) {
        _arrayEach(_keys(object), function (key) {
            iterator(object[key], key);
        });
    }

    function _indexOf(arr, item) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === item) return i;
        }
        return -1;
    }

    var _keys = Object.keys || function (obj) {
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    function _keyIterator(coll) {
        var i = -1;
        var len;
        var keys;
        if (_isArrayLike(coll)) {
            len = coll.length;
            return function next() {
                i++;
                return i < len ? i : null;
            };
        } else {
            keys = _keys(coll);
            len = keys.length;
            return function next() {
                i++;
                return i < len ? keys[i] : null;
            };
        }
    }

    // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
    // This accumulates the arguments passed into an array, after a given index.
    // From underscore.js (https://github.com/jashkenas/underscore/pull/2140).
    function _restParam(func, startIndex) {
        startIndex = startIndex == null ? func.length - 1 : +startIndex;
        return function() {
            var length = Math.max(arguments.length - startIndex, 0);
            var rest = Array(length);
            for (var index = 0; index < length; index++) {
                rest[index] = arguments[index + startIndex];
            }
            switch (startIndex) {
                case 0: return func.call(this, rest);
                case 1: return func.call(this, arguments[0], rest);
            }
            // Currently unused but handle cases outside of the switch statement:
            // var args = Array(startIndex + 1);
            // for (index = 0; index < startIndex; index++) {
            //     args[index] = arguments[index];
            // }
            // args[startIndex] = rest;
            // return func.apply(this, args);
        };
    }

    function _withoutIndex(iterator) {
        return function (value, index, callback) {
            return iterator(value, callback);
        };
    }

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////

    // capture the global reference to guard against fakeTimer mocks
    var _setImmediate = typeof setImmediate === 'function' && setImmediate;

    var _delay = _setImmediate ? function(fn) {
        // not a direct alias for IE10 compatibility
        _setImmediate(fn);
    } : function(fn) {
        setTimeout(fn, 0);
    };

    if (typeof process === 'object' && typeof process.nextTick === 'function') {
        async.nextTick = process.nextTick;
    } else {
        async.nextTick = _delay;
    }
    async.setImmediate = _setImmediate ? _delay : async.nextTick;


    async.forEach =
    async.each = function (arr, iterator, callback) {
        return async.eachOf(arr, _withoutIndex(iterator), callback);
    };

    async.forEachSeries =
    async.eachSeries = function (arr, iterator, callback) {
        return async.eachOfSeries(arr, _withoutIndex(iterator), callback);
    };


    async.forEachLimit =
    async.eachLimit = function (arr, limit, iterator, callback) {
        return _eachOfLimit(limit)(arr, _withoutIndex(iterator), callback);
    };

    async.forEachOf =
    async.eachOf = function (object, iterator, callback) {
        callback = _once(callback || noop);
        object = object || [];

        var iter = _keyIterator(object);
        var key, completed = 0;

        while ((key = iter()) != null) {
            completed += 1;
            iterator(object[key], key, only_once(done));
        }

        if (completed === 0) callback(null);

        function done(err) {
            completed--;
            if (err) {
                callback(err);
            }
            // Check key is null in case iterator isn't exhausted
            // and done resolved synchronously.
            else if (key === null && completed <= 0) {
                callback(null);
            }
        }
    };

    async.forEachOfSeries =
    async.eachOfSeries = function (obj, iterator, callback) {
        callback = _once(callback || noop);
        obj = obj || [];
        var nextKey = _keyIterator(obj);
        var key = nextKey();
        function iterate() {
            var sync = true;
            if (key === null) {
                return callback(null);
            }
            iterator(obj[key], key, only_once(function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    key = nextKey();
                    if (key === null) {
                        return callback(null);
                    } else {
                        if (sync) {
                            async.setImmediate(iterate);
                        } else {
                            iterate();
                        }
                    }
                }
            }));
            sync = false;
        }
        iterate();
    };



    async.forEachOfLimit =
    async.eachOfLimit = function (obj, limit, iterator, callback) {
        _eachOfLimit(limit)(obj, iterator, callback);
    };

    function _eachOfLimit(limit) {

        return function (obj, iterator, callback) {
            callback = _once(callback || noop);
            obj = obj || [];
            var nextKey = _keyIterator(obj);
            if (limit <= 0) {
                return callback(null);
            }
            var done = false;
            var running = 0;
            var errored = false;

            (function replenish () {
                if (done && running <= 0) {
                    return callback(null);
                }

                while (running < limit && !errored) {
                    var key = nextKey();
                    if (key === null) {
                        done = true;
                        if (running <= 0) {
                            callback(null);
                        }
                        return;
                    }
                    running += 1;
                    iterator(obj[key], key, only_once(function (err) {
                        running -= 1;
                        if (err) {
                            callback(err);
                            errored = true;
                        }
                        else {
                            replenish();
                        }
                    }));
                }
            })();
        };
    }


    function doParallel(fn) {
        return function (obj, iterator, callback) {
            return fn(async.eachOf, obj, iterator, callback);
        };
    }
    function doParallelLimit(fn) {
        return function (obj, limit, iterator, callback) {
            return fn(_eachOfLimit(limit), obj, iterator, callback);
        };
    }
    function doSeries(fn) {
        return function (obj, iterator, callback) {
            return fn(async.eachOfSeries, obj, iterator, callback);
        };
    }

    function _asyncMap(eachfn, arr, iterator, callback) {
        callback = _once(callback || noop);
        arr = arr || [];
        var results = _isArrayLike(arr) ? [] : {};
        eachfn(arr, function (value, index, callback) {
            iterator(value, function (err, v) {
                results[index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }

    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = doParallelLimit(_asyncMap);

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.inject =
    async.foldl =
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachOfSeries(arr, function (x, i, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };

    async.foldr =
    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, identity).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };

    async.transform = function (arr, memo, iterator, callback) {
        if (arguments.length === 3) {
            callback = iterator;
            iterator = memo;
            memo = _isArray(arr) ? [] : {};
        }

        async.eachOf(arr, function(v, k, cb) {
            iterator(memo, v, k, cb);
        }, function(err) {
            callback(err, memo);
        });
    };

    function _filter(eachfn, arr, iterator, callback) {
        var results = [];
        eachfn(arr, function (x, index, callback) {
            iterator(x, function (v) {
                if (v) {
                    results.push({index: index, value: x});
                }
                callback();
            });
        }, function () {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    }

    async.select =
    async.filter = doParallel(_filter);

    async.selectLimit =
    async.filterLimit = doParallelLimit(_filter);

    async.selectSeries =
    async.filterSeries = doSeries(_filter);

    function _reject(eachfn, arr, iterator, callback) {
        _filter(eachfn, arr, function(value, cb) {
            iterator(value, function(v) {
                cb(!v);
            });
        }, callback);
    }
    async.reject = doParallel(_reject);
    async.rejectLimit = doParallelLimit(_reject);
    async.rejectSeries = doSeries(_reject);

    function _createTester(eachfn, check, getResult) {
        return function(arr, limit, iterator, cb) {
            function done() {
                if (cb) cb(getResult(false, void 0));
            }
            function iteratee(x, _, callback) {
                if (!cb) return callback();
                iterator(x, function (v) {
                    if (cb && check(v)) {
                        cb(getResult(true, x));
                        cb = iterator = false;
                    }
                    callback();
                });
            }
            if (arguments.length > 3) {
                eachfn(arr, limit, iteratee, done);
            } else {
                cb = iterator;
                iterator = limit;
                eachfn(arr, iteratee, done);
            }
        };
    }

    async.any =
    async.some = _createTester(async.eachOf, toBool, identity);

    async.someLimit = _createTester(async.eachOfLimit, toBool, identity);

    async.all =
    async.every = _createTester(async.eachOf, notId, notId);

    async.everyLimit = _createTester(async.eachOfLimit, notId, notId);

    function _findGetResult(v, x) {
        return x;
    }
    async.detect = _createTester(async.eachOf, identity, _findGetResult);
    async.detectSeries = _createTester(async.eachOfSeries, identity, _findGetResult);
    async.detectLimit = _createTester(async.eachOfLimit, identity, _findGetResult);

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                callback(null, _map(results.sort(comparator), function (x) {
                    return x.value;
                }));
            }

        });

        function comparator(left, right) {
            var a = left.criteria, b = right.criteria;
            return a < b ? -1 : a > b ? 1 : 0;
        }
    };

    async.auto = function (tasks, concurrency, callback) {
        if (typeof arguments[1] === 'function') {
            // concurrency is optional, shift the args.
            callback = concurrency;
            concurrency = null;
        }
        callback = _once(callback || noop);
        var keys = _keys(tasks);
        var remainingTasks = keys.length;
        if (!remainingTasks) {
            return callback(null);
        }
        if (!concurrency) {
            concurrency = remainingTasks;
        }

        var results = {};
        var runningTasks = 0;

        var hasError = false;

        var listeners = [];
        function addListener(fn) {
            listeners.unshift(fn);
        }
        function removeListener(fn) {
            var idx = _indexOf(listeners, fn);
            if (idx >= 0) listeners.splice(idx, 1);
        }
        function taskComplete() {
            remainingTasks--;
            _arrayEach(listeners.slice(0), function (fn) {
                fn();
            });
        }

        addListener(function () {
            if (!remainingTasks) {
                callback(null, results);
            }
        });

        _arrayEach(keys, function (k) {
            if (hasError) return;
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = _restParam(function(err, args) {
                runningTasks--;
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _forEachOf(results, function(val, rkey) {
                        safeResults[rkey] = val;
                    });
                    safeResults[k] = args;
                    hasError = true;

                    callback(err, safeResults);
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            });
            var requires = task.slice(0, task.length - 1);
            // prevent dead-locks
            var len = requires.length;
            var dep;
            while (len--) {
                if (!(dep = tasks[requires[len]])) {
                    throw new Error('Has nonexistent dependency in ' + requires.join(', '));
                }
                if (_isArray(dep) && _indexOf(dep, k) >= 0) {
                    throw new Error('Has cyclic dependencies');
                }
            }
            function ready() {
                return runningTasks < concurrency && _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            }
            if (ready()) {
                runningTasks++;
                task[task.length - 1](taskCallback, results);
            }
            else {
                addListener(listener);
            }
            function listener() {
                if (ready()) {
                    runningTasks++;
                    removeListener(listener);
                    task[task.length - 1](taskCallback, results);
                }
            }
        });
    };



    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var DEFAULT_INTERVAL = 0;

        var attempts = [];

        var opts = {
            times: DEFAULT_TIMES,
            interval: DEFAULT_INTERVAL
        };

        function parseTimes(acc, t){
            if(typeof t === 'number'){
                acc.times = parseInt(t, 10) || DEFAULT_TIMES;
            } else if(typeof t === 'object'){
                acc.times = parseInt(t.times, 10) || DEFAULT_TIMES;
                acc.interval = parseInt(t.interval, 10) || DEFAULT_INTERVAL;
            } else {
                throw new Error('Unsupported argument type for \'times\': ' + typeof t);
            }
        }

        var length = arguments.length;
        if (length < 1 || length > 3) {
            throw new Error('Invalid arguments - must be either (task), (task, callback), (times, task) or (times, task, callback)');
        } else if (length <= 2 && typeof times === 'function') {
            callback = task;
            task = times;
        }
        if (typeof times !== 'function') {
            parseTimes(opts, times);
        }
        opts.callback = callback;
        opts.task = task;

        function wrappedTask(wrappedCallback, wrappedResults) {
            function retryAttempt(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            }

            function retryInterval(interval){
                return function(seriesCallback){
                    setTimeout(function(){
                        seriesCallback(null);
                    }, interval);
                };
            }

            while (opts.times) {

                var finalAttempt = !(opts.times-=1);
                attempts.push(retryAttempt(opts.task, finalAttempt));
                if(!finalAttempt && opts.interval > 0){
                    attempts.push(retryInterval(opts.interval));
                }
            }

            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || opts.callback)(data.err, data.result);
            });
        }

        // If a callback is passed, run this as a controll flow
        return opts.callback ? wrappedTask() : wrappedTask;
    };

    async.waterfall = function (tasks, callback) {
        callback = _once(callback || noop);
        if (!_isArray(tasks)) {
            var err = new Error('First argument to waterfall must be an array of functions');
            return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        function wrapIterator(iterator) {
            return _restParam(function (err, args) {
                if (err) {
                    callback.apply(null, [err].concat(args));
                }
                else {
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    ensureAsync(iterator).apply(null, args);
                }
            });
        }
        wrapIterator(async.iterator(tasks))();
    };

    function _parallel(eachfn, tasks, callback) {
        callback = callback || noop;
        var results = _isArrayLike(tasks) ? [] : {};

        eachfn(tasks, function (task, key, callback) {
            task(_restParam(function (err, args) {
                if (args.length <= 1) {
                    args = args[0];
                }
                results[key] = args;
                callback(err);
            }));
        }, function (err) {
            callback(err, results);
        });
    }

    async.parallel = function (tasks, callback) {
        _parallel(async.eachOf, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel(_eachOfLimit(limit), tasks, callback);
    };

    async.series = function(tasks, callback) {
        _parallel(async.eachOfSeries, tasks, callback);
    };

    async.iterator = function (tasks) {
        function makeCallback(index) {
            function fn() {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            }
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        }
        return makeCallback(0);
    };

    async.apply = _restParam(function (fn, args) {
        return _restParam(function (callArgs) {
            return fn.apply(
                null, args.concat(callArgs)
            );
        });
    });

    function _concat(eachfn, arr, fn, callback) {
        var result = [];
        eachfn(arr, function (x, index, cb) {
            fn(x, function (err, y) {
                result = result.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, result);
        });
    }
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        callback = callback || noop;
        if (test()) {
            var next = _restParam(function(err, args) {
                if (err) {
                    callback(err);
                } else if (test.apply(this, args)) {
                    iterator(next);
                } else {
                    callback.apply(null, [null].concat(args));
                }
            });
            iterator(next);
        } else {
            callback(null);
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        var calls = 0;
        return async.whilst(function() {
            return ++calls <= 1 || test.apply(this, arguments);
        }, iterator, callback);
    };

    async.until = function (test, iterator, callback) {
        return async.whilst(function() {
            return !test.apply(this, arguments);
        }, iterator, callback);
    };

    async.doUntil = function (iterator, test, callback) {
        return async.doWhilst(iterator, function() {
            return !test.apply(this, arguments);
        }, callback);
    };

    async.during = function (test, iterator, callback) {
        callback = callback || noop;

        var next = _restParam(function(err, args) {
            if (err) {
                callback(err);
            } else {
                args.push(check);
                test.apply(this, args);
            }
        });

        var check = function(err, truth) {
            if (err) {
                callback(err);
            } else if (truth) {
                iterator(next);
            } else {
                callback(null);
            }
        };

        test(check);
    };

    async.doDuring = function (iterator, test, callback) {
        var calls = 0;
        async.during(function(next) {
            if (calls++ < 1) {
                next(null, true);
            } else {
                test.apply(this, arguments);
            }
        }, iterator, callback);
    };

    function _queue(worker, concurrency, payload) {
        if (concurrency == null) {
            concurrency = 1;
        }
        else if(concurrency === 0) {
            throw new Error('Concurrency must not be zero');
        }
        function _insert(q, data, pos, callback) {
            if (callback != null && typeof callback !== "function") {
                throw new Error("task callback must be a function");
            }
            q.started = true;
            if (!_isArray(data)) {
                data = [data];
            }
            if(data.length === 0 && q.idle()) {
                // call drain immediately if there are no tasks
                return async.setImmediate(function() {
                    q.drain();
                });
            }
            _arrayEach(data, function(task) {
                var item = {
                    data: task,
                    callback: callback || noop
                };

                if (pos) {
                    q.tasks.unshift(item);
                } else {
                    q.tasks.push(item);
                }

                if (q.tasks.length === q.concurrency) {
                    q.saturated();
                }
            });
            async.setImmediate(q.process);
        }
        function _next(q, tasks) {
            return function(){
                workers -= 1;

                var removed = false;
                var args = arguments;
                _arrayEach(tasks, function (task) {
                    _arrayEach(workersList, function (worker, index) {
                        if (worker === task && !removed) {
                            workersList.splice(index, 1);
                            removed = true;
                        }
                    });

                    task.callback.apply(task, args);
                });
                if (q.tasks.length + workers === 0) {
                    q.drain();
                }
                q.process();
            };
        }

        var workers = 0;
        var workersList = [];
        var q = {
            tasks: [],
            concurrency: concurrency,
            payload: payload,
            saturated: noop,
            empty: noop,
            drain: noop,
            started: false,
            paused: false,
            push: function (data, callback) {
                _insert(q, data, false, callback);
            },
            kill: function () {
                q.drain = noop;
                q.tasks = [];
            },
            unshift: function (data, callback) {
                _insert(q, data, true, callback);
            },
            process: function () {
                while(!q.paused && workers < q.concurrency && q.tasks.length){

                    var tasks = q.payload ?
                        q.tasks.splice(0, q.payload) :
                        q.tasks.splice(0, q.tasks.length);

                    var data = _map(tasks, function (task) {
                        return task.data;
                    });

                    if (q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    workersList.push(tasks[0]);
                    var cb = only_once(_next(q, tasks));
                    worker(data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            workersList: function () {
                return workersList;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                q.paused = true;
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                var resumeCount = Math.min(q.concurrency, q.tasks.length);
                // Need to call q.process once per concurrent
                // worker to preserve full concurrency after pause
                for (var w = 1; w <= resumeCount; w++) {
                    async.setImmediate(q.process);
                }
            }
        };
        return q;
    }

    async.queue = function (worker, concurrency) {
        var q = _queue(function (items, cb) {
            worker(items[0], cb);
        }, concurrency, 1);

        return q;
    };

    async.priorityQueue = function (worker, concurrency) {

        function _compareTasks(a, b){
            return a.priority - b.priority;
        }

        function _binarySearch(sequence, item, compare) {
            var beg = -1,
                end = sequence.length - 1;
            while (beg < end) {
                var mid = beg + ((end - beg + 1) >>> 1);
                if (compare(item, sequence[mid]) >= 0) {
                    beg = mid;
                } else {
                    end = mid - 1;
                }
            }
            return beg;
        }

        function _insert(q, data, priority, callback) {
            if (callback != null && typeof callback !== "function") {
                throw new Error("task callback must be a function");
            }
            q.started = true;
            if (!_isArray(data)) {
                data = [data];
            }
            if(data.length === 0) {
                // call drain immediately if there are no tasks
                return async.setImmediate(function() {
                    q.drain();
                });
            }
            _arrayEach(data, function(task) {
                var item = {
                    data: task,
                    priority: priority,
                    callback: typeof callback === 'function' ? callback : noop
                };

                q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

                if (q.tasks.length === q.concurrency) {
                    q.saturated();
                }
                async.setImmediate(q.process);
            });
        }

        // Start with a normal queue
        var q = async.queue(worker, concurrency);

        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
            _insert(q, data, priority, callback);
        };

        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        return _queue(worker, 1, payload);
    };

    function _console_fn(name) {
        return _restParam(function (fn, args) {
            fn.apply(null, args.concat([_restParam(function (err, args) {
                if (typeof console === 'object') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _arrayEach(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            })]));
        });
    }
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        var has = Object.prototype.hasOwnProperty;
        hasher = hasher || identity;
        var memoized = _restParam(function memoized(args) {
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (has.call(memo, key)) {   
                async.setImmediate(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (has.call(queues, key)) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([_restParam(function (args) {
                    memo[key] = args;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                        q[i].apply(null, args);
                    }
                })]));
            }
        });
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
        return function () {
            return (fn.unmemoized || fn).apply(null, arguments);
        };
    };

    function _times(mapper) {
        return function (count, iterator, callback) {
            mapper(_range(count), iterator, callback);
        };
    }

    async.times = _times(async.map);
    async.timesSeries = _times(async.mapSeries);
    async.timesLimit = function (count, limit, iterator, callback) {
        return async.mapLimit(_range(count), limit, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return _restParam(function (args) {
            var that = this;

            var callback = args[args.length - 1];
            if (typeof callback == 'function') {
                args.pop();
            } else {
                callback = noop;
            }

            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([_restParam(function (err, nextargs) {
                    cb(err, nextargs);
                })]));
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        });
    };

    async.compose = function (/* functions... */) {
        return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };


    function _applyEach(eachfn) {
        return _restParam(function(fns, args) {
            var go = _restParam(function(args) {
                var that = this;
                var callback = args.pop();
                return eachfn(fns, function (fn, _, cb) {
                    fn.apply(that, args.concat([cb]));
                },
                callback);
            });
            if (args.length) {
                return go.apply(this, args);
            }
            else {
                return go;
            }
        });
    }

    async.applyEach = _applyEach(async.eachOf);
    async.applyEachSeries = _applyEach(async.eachOfSeries);


    async.forever = function (fn, callback) {
        var done = only_once(callback || noop);
        var task = ensureAsync(fn);
        function next(err) {
            if (err) {
                return done(err);
            }
            task(next);
        }
        next();
    };

    function ensureAsync(fn) {
        return _restParam(function (args) {
            var callback = args.pop();
            args.push(function () {
                var innerArgs = arguments;
                if (sync) {
                    async.setImmediate(function () {
                        callback.apply(null, innerArgs);
                    });
                } else {
                    callback.apply(null, innerArgs);
                }
            });
            var sync = true;
            fn.apply(this, args);
            sync = false;
        });
    }

    async.ensureAsync = ensureAsync;

    async.constant = _restParam(function(values) {
        var args = [null].concat(values);
        return function (callback) {
            return callback.apply(this, args);
        };
    });

    async.wrapSync =
    async.asyncify = function asyncify(func) {
        return _restParam(function (args) {
            var callback = args.pop();
            var result;
            try {
                result = func.apply(this, args);
            } catch (e) {
                return callback(e);
            }
            // if result is Promise object
            if (_isObject(result) && typeof result.then === "function") {
                result.then(function(value) {
                    callback(null, value);
                })["catch"](function(err) {
                    callback(err.message ? err : new Error(err));
                });
            } else {
                callback(null, result);
            }
        });
    };

    // Node.js
    if (typeof module === 'object' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define === 'function' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":17}],16:[function(require,module,exports){
(function (process,global){
/*!
 * Benchmark.js v1.0.0 <http://benchmarkjs.com/>
 * Copyright 2010-2012 Mathias Bynens <http://mths.be/>
 * Based on JSLitmus.js, copyright Robert Kieffer <http://broofa.com/>
 * Modified by John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <http://mths.be/mit>
 */
;(function(window, undefined) {
  'use strict';

  /** Used to assign each benchmark an incrimented id */
  var counter = 0;

  /** Detect DOM document object */
  var doc = isHostType(window, 'document') && document;

  /** Detect free variable `define` */
  var freeDefine = typeof define == 'function' &&
    typeof define.amd == 'object' && define.amd && define;

  /** Detect free variable `exports` */
  var freeExports = typeof exports == 'object' && exports &&
    (typeof global == 'object' && global && global == global.global && (window = global), exports);

  /** Detect free variable `require` */
  var freeRequire = typeof require == 'function' && require;

  /** Used to crawl all properties regardless of enumerability */
  var getAllKeys = Object.getOwnPropertyNames;

  /** Used to get property descriptors */
  var getDescriptor = Object.getOwnPropertyDescriptor;

  /** Used in case an object doesn't have its own method */
  var hasOwnProperty = {}.hasOwnProperty;

  /** Used to check if an object is extensible */
  var isExtensible = Object.isExtensible || function() { return true; };

  /** Used to access Wade Simmons' Node microtime module */
  var microtimeObject = req('microtime');

  /** Used to access the browser's high resolution timer */
  var perfObject = isHostType(window, 'performance') && performance;

  /** Used to call the browser's high resolution timer */
  var perfName = perfObject && (
    perfObject.now && 'now' ||
    perfObject.webkitNow && 'webkitNow'
  );

  /** Used to access Node's high resolution timer */
  var processObject = isHostType(window, 'process') && process;

  /** Used to check if an own property is enumerable */
  var propertyIsEnumerable = {}.propertyIsEnumerable;

  /** Used to set property descriptors */
  var setDescriptor = Object.defineProperty;

  /** Used to resolve a value's internal [[Class]] */
  var toString = {}.toString;

  /** Used to prevent a `removeChild` memory leak in IE < 9 */
  var trash = doc && doc.createElement('div');

  /** Used to integrity check compiled tests */
  var uid = 'uid' + (+new Date);

  /** Used to avoid infinite recursion when methods call each other */
  var calledBy = {};

  /** Used to avoid hz of Infinity */
  var divisors = {
    '1': 4096,
    '2': 512,
    '3': 64,
    '4': 8,
    '5': 0
  };

  /**
   * T-Distribution two-tailed critical values for 95% confidence
   * http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm
   */
  var tTable = {
    '1':  12.706,'2':  4.303, '3':  3.182, '4':  2.776, '5':  2.571, '6':  2.447,
    '7':  2.365, '8':  2.306, '9':  2.262, '10': 2.228, '11': 2.201, '12': 2.179,
    '13': 2.16,  '14': 2.145, '15': 2.131, '16': 2.12,  '17': 2.11,  '18': 2.101,
    '19': 2.093, '20': 2.086, '21': 2.08,  '22': 2.074, '23': 2.069, '24': 2.064,
    '25': 2.06,  '26': 2.056, '27': 2.052, '28': 2.048, '29': 2.045, '30': 2.042,
    'infinity': 1.96
  };

  /**
   * Critical Mann-Whitney U-values for 95% confidence
   * http://www.saburchill.com/IBbiology/stats/003.html
   */
  var uTable = {
    '5':  [0, 1, 2],
    '6':  [1, 2, 3, 5],
    '7':  [1, 3, 5, 6, 8],
    '8':  [2, 4, 6, 8, 10, 13],
    '9':  [2, 4, 7, 10, 12, 15, 17],
    '10': [3, 5, 8, 11, 14, 17, 20, 23],
    '11': [3, 6, 9, 13, 16, 19, 23, 26, 30],
    '12': [4, 7, 11, 14, 18, 22, 26, 29, 33, 37],
    '13': [4, 8, 12, 16, 20, 24, 28, 33, 37, 41, 45],
    '14': [5, 9, 13, 17, 22, 26, 31, 36, 40, 45, 50, 55],
    '15': [5, 10, 14, 19, 24, 29, 34, 39, 44, 49, 54, 59, 64],
    '16': [6, 11, 15, 21, 26, 31, 37, 42, 47, 53, 59, 64, 70, 75],
    '17': [6, 11, 17, 22, 28, 34, 39, 45, 51, 57, 63, 67, 75, 81, 87],
    '18': [7, 12, 18, 24, 30, 36, 42, 48, 55, 61, 67, 74, 80, 86, 93, 99],
    '19': [7, 13, 19, 25, 32, 38, 45, 52, 58, 65, 72, 78, 85, 92, 99, 106, 113],
    '20': [8, 14, 20, 27, 34, 41, 48, 55, 62, 69, 76, 83, 90, 98, 105, 112, 119, 127],
    '21': [8, 15, 22, 29, 36, 43, 50, 58, 65, 73, 80, 88, 96, 103, 111, 119, 126, 134, 142],
    '22': [9, 16, 23, 30, 38, 45, 53, 61, 69, 77, 85, 93, 101, 109, 117, 125, 133, 141, 150, 158],
    '23': [9, 17, 24, 32, 40, 48, 56, 64, 73, 81, 89, 98, 106, 115, 123, 132, 140, 149, 157, 166, 175],
    '24': [10, 17, 25, 33, 42, 50, 59, 67, 76, 85, 94, 102, 111, 120, 129, 138, 147, 156, 165, 174, 183, 192],
    '25': [10, 18, 27, 35, 44, 53, 62, 71, 80, 89, 98, 107, 117, 126, 135, 145, 154, 163, 173, 182, 192, 201, 211],
    '26': [11, 19, 28, 37, 46, 55, 64, 74, 83, 93, 102, 112, 122, 132, 141, 151, 161, 171, 181, 191, 200, 210, 220, 230],
    '27': [11, 20, 29, 38, 48, 57, 67, 77, 87, 97, 107, 118, 125, 138, 147, 158, 168, 178, 188, 199, 209, 219, 230, 240, 250],
    '28': [12, 21, 30, 40, 50, 60, 70, 80, 90, 101, 111, 122, 132, 143, 154, 164, 175, 186, 196, 207, 218, 228, 239, 250, 261, 272],
    '29': [13, 22, 32, 42, 52, 62, 73, 83, 94, 105, 116, 127, 138, 149, 160, 171, 182, 193, 204, 215, 226, 238, 249, 260, 271, 282, 294],
    '30': [13, 23, 33, 43, 54, 65, 76, 87, 98, 109, 120, 131, 143, 154, 166, 177, 189, 200, 212, 223, 235, 247, 258, 270, 282, 293, 305, 317]
  };

  /**
   * An object used to flag environments/features.
   *
   * @static
   * @memberOf Benchmark
   * @type Object
   */
  var support = {};

  (function() {

    /**
     * Detect Adobe AIR.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.air = isClassOf(window.runtime, 'ScriptBridgingProxyObject');

    /**
     * Detect if `arguments` objects have the correct internal [[Class]] value.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.argumentsClass = isClassOf(arguments, 'Arguments');

    /**
     * Detect if in a browser environment.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.browser = doc && isHostType(window, 'navigator');

    /**
     * Detect if strings support accessing characters by index.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.charByIndex =
      // IE 8 supports indexes on string literals but not string objects
      ('x'[0] + Object('x')[0]) == 'xx';

    /**
     * Detect if strings have indexes as own properties.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.charByOwnIndex =
      // Narwhal, Rhino, RingoJS, IE 8, and Opera < 10.52 support indexes on
      // strings but don't detect them as own properties
      support.charByIndex && hasKey('x', '0');

    /**
     * Detect if Java is enabled/exposed.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.java = isClassOf(window.java, 'JavaPackage');

    /**
     * Detect if the Timers API exists.
     *
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.timeout = isHostType(window, 'setTimeout') && isHostType(window, 'clearTimeout');

    /**
     * Detect if functions support decompilation.
     *
     * @name decompilation
     * @memberOf Benchmark.support
     * @type Boolean
     */
    try {
      // Safari 2.x removes commas in object literals
      // from Function#toString results
      // http://webk.it/11609
      // Firefox 3.6 and Opera 9.25 strip grouping
      // parentheses from Function#toString results
      // http://bugzil.la/559438
      support.decompilation = Function(
        'return (' + (function(x) { return { 'x': '' + (1 + x) + '', 'y': 0 }; }) + ')'
      )()(0).x === '1';
    } catch(e) {
      support.decompilation = false;
    }

    /**
     * Detect ES5+ property descriptor API.
     *
     * @name descriptors
     * @memberOf Benchmark.support
     * @type Boolean
     */
    try {
      var o = {};
      support.descriptors = (setDescriptor(o, o, o), 'value' in getDescriptor(o, o));
    } catch(e) {
      support.descriptors = false;
    }

    /**
     * Detect ES5+ Object.getOwnPropertyNames().
     *
     * @name getAllKeys
     * @memberOf Benchmark.support
     * @type Boolean
     */
    try {
      support.getAllKeys = /\bvalueOf\b/.test(getAllKeys(Object.prototype));
    } catch(e) {
      support.getAllKeys = false;
    }

    /**
     * Detect if own properties are iterated before inherited properties (all but IE < 9).
     *
     * @name iteratesOwnLast
     * @memberOf Benchmark.support
     * @type Boolean
     */
    support.iteratesOwnFirst = (function() {
      var props = [];
      function ctor() { this.x = 1; }
      ctor.prototype = { 'y': 1 };
      for (var prop in new ctor) { props.push(prop); }
      return props[0] == 'x';
    }());

    /**
     * Detect if a node's [[Class]] is resolvable (all but IE < 9)
     * and that the JS engine errors when attempting to coerce an object to a
     * string without a `toString` property value of `typeof` "function".
     *
     * @name nodeClass
     * @memberOf Benchmark.support
     * @type Boolean
     */
    try {
      support.nodeClass = ({ 'toString': 0 } + '', toString.call(doc || 0) != '[object Object]');
    } catch(e) {
      support.nodeClass = true;
    }
  }());

  /**
   * Timer object used by `clock()` and `Deferred#resolve`.
   *
   * @private
   * @type Object
   */
  var timer = {

   /**
    * The timer namespace object or constructor.
    *
    * @private
    * @memberOf timer
    * @type Function|Object
    */
    'ns': Date,

   /**
    * Starts the deferred timer.
    *
    * @private
    * @memberOf timer
    * @param {Object} deferred The deferred instance.
    */
    'start': null, // lazy defined in `clock()`

   /**
    * Stops the deferred timer.
    *
    * @private
    * @memberOf timer
    * @param {Object} deferred The deferred instance.
    */
    'stop': null // lazy defined in `clock()`
  };

  /** Shortcut for inverse results */
  var noArgumentsClass = !support.argumentsClass,
      noCharByIndex = !support.charByIndex,
      noCharByOwnIndex = !support.charByOwnIndex;

  /** Math shortcuts */
  var abs   = Math.abs,
      floor = Math.floor,
      max   = Math.max,
      min   = Math.min,
      pow   = Math.pow,
      sqrt  = Math.sqrt;

  /*--------------------------------------------------------------------------*/

  /**
   * The Benchmark constructor.
   *
   * @constructor
   * @param {String} name A name to identify the benchmark.
   * @param {Function|String} fn The test to benchmark.
   * @param {Object} [options={}] Options object.
   * @example
   *
   * // basic usage (the `new` operator is optional)
   * var bench = new Benchmark(fn);
   *
   * // or using a name first
   * var bench = new Benchmark('foo', fn);
   *
   * // or with options
   * var bench = new Benchmark('foo', fn, {
   *
   *   // displayed by Benchmark#toString if `name` is not available
   *   'id': 'xyz',
   *
   *   // called when the benchmark starts running
   *   'onStart': onStart,
   *
   *   // called after each run cycle
   *   'onCycle': onCycle,
   *
   *   // called when aborted
   *   'onAbort': onAbort,
   *
   *   // called when a test errors
   *   'onError': onError,
   *
   *   // called when reset
   *   'onReset': onReset,
   *
   *   // called when the benchmark completes running
   *   'onComplete': onComplete,
   *
   *   // compiled/called before the test loop
   *   'setup': setup,
   *
   *   // compiled/called after the test loop
   *   'teardown': teardown
   * });
   *
   * // or name and options
   * var bench = new Benchmark('foo', {
   *
   *   // a flag to indicate the benchmark is deferred
   *   'defer': true,
   *
   *   // benchmark test function
   *   'fn': function(deferred) {
   *     // call resolve() when the deferred test is finished
   *     deferred.resolve();
   *   }
   * });
   *
   * // or options only
   * var bench = new Benchmark({
   *
   *   // benchmark name
   *   'name': 'foo',
   *
   *   // benchmark test as a string
   *   'fn': '[1,2,3,4].sort()'
   * });
   *
   * // a test's `this` binding is set to the benchmark instance
   * var bench = new Benchmark('foo', function() {
   *   'My name is '.concat(this.name); // My name is foo
   * });
   */
  function Benchmark(name, fn, options) {
    var me = this;

    // allow instance creation without the `new` operator
    if (me == null || me.constructor != Benchmark) {
      return new Benchmark(name, fn, options);
    }
    // juggle arguments
    if (isClassOf(name, 'Object')) {
      // 1 argument (options)
      options = name;
    }
    else if (isClassOf(name, 'Function')) {
      // 2 arguments (fn, options)
      options = fn;
      fn = name;
    }
    else if (isClassOf(fn, 'Object')) {
      // 2 arguments (name, options)
      options = fn;
      fn = null;
      me.name = name;
    }
    else {
      // 3 arguments (name, fn [, options])
      me.name = name;
    }
    setOptions(me, options);
    me.id || (me.id = ++counter);
    me.fn == null && (me.fn = fn);
    me.stats = deepClone(me.stats);
    me.times = deepClone(me.times);
  }

  /**
   * The Deferred constructor.
   *
   * @constructor
   * @memberOf Benchmark
   * @param {Object} clone The cloned benchmark instance.
   */
  function Deferred(clone) {
    var me = this;
    if (me == null || me.constructor != Deferred) {
      return new Deferred(clone);
    }
    me.benchmark = clone;
    clock(me);
  }

  /**
   * The Event constructor.
   *
   * @constructor
   * @memberOf Benchmark
   * @param {String|Object} type The event type.
   */
  function Event(type) {
    var me = this;
    return (me == null || me.constructor != Event)
      ? new Event(type)
      : (type instanceof Event)
          ? type
          : extend(me, { 'timeStamp': +new Date }, typeof type == 'string' ? { 'type': type } : type);
  }

  /**
   * The Suite constructor.
   *
   * @constructor
   * @memberOf Benchmark
   * @param {String} name A name to identify the suite.
   * @param {Object} [options={}] Options object.
   * @example
   *
   * // basic usage (the `new` operator is optional)
   * var suite = new Benchmark.Suite;
   *
   * // or using a name first
   * var suite = new Benchmark.Suite('foo');
   *
   * // or with options
   * var suite = new Benchmark.Suite('foo', {
   *
   *   // called when the suite starts running
   *   'onStart': onStart,
   *
   *   // called between running benchmarks
   *   'onCycle': onCycle,
   *
   *   // called when aborted
   *   'onAbort': onAbort,
   *
   *   // called when a test errors
   *   'onError': onError,
   *
   *   // called when reset
   *   'onReset': onReset,
   *
   *   // called when the suite completes running
   *   'onComplete': onComplete
   * });
   */
  function Suite(name, options) {
    var me = this;

    // allow instance creation without the `new` operator
    if (me == null || me.constructor != Suite) {
      return new Suite(name, options);
    }
    // juggle arguments
    if (isClassOf(name, 'Object')) {
      // 1 argument (options)
      options = name;
    } else {
      // 2 arguments (name [, options])
      me.name = name;
    }
    setOptions(me, options);
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Note: Some array methods have been implemented in plain JavaScript to avoid
   * bugs in IE, Opera, Rhino, and Mobile Safari.
   *
   * IE compatibility mode and IE < 9 have buggy Array `shift()` and `splice()`
   * functions that fail to remove the last element, `object[0]`, of
   * array-like-objects even though the `length` property is set to `0`.
   * The `shift()` method is buggy in IE 8 compatibility mode, while `splice()`
   * is buggy regardless of mode in IE < 9 and buggy in compatibility mode in IE 9.
   *
   * In Opera < 9.50 and some older/beta Mobile Safari versions using `unshift()`
   * generically to augment the `arguments` object will pave the value at index 0
   * without incrimenting the other values's indexes.
   * https://github.com/documentcloud/underscore/issues/9
   *
   * Rhino and environments it powers, like Narwhal and RingoJS, may have
   * buggy Array `concat()`, `reverse()`, `shift()`, `slice()`, `splice()` and
   * `unshift()` functions that make sparse arrays non-sparse by assigning the
   * undefined indexes a value of undefined.
   * https://github.com/mozilla/rhino/commit/702abfed3f8ca043b2636efd31c14ba7552603dd
   */

  /**
   * Creates an array containing the elements of the host array followed by the
   * elements of each argument in order.
   *
   * @memberOf Benchmark.Suite
   * @returns {Array} The new array.
   */
  function concat() {
    var value,
        j = -1,
        length = arguments.length,
        result = slice.call(this),
        index = result.length;

    while (++j < length) {
      value = arguments[j];
      if (isClassOf(value, 'Array')) {
        for (var k = 0, l = value.length; k < l; k++, index++) {
          if (k in value) {
            result[index] = value[k];
          }
        }
      } else {
        result[index++] = value;
      }
    }
    return result;
  }

  /**
   * Utility function used by `shift()`, `splice()`, and `unshift()`.
   *
   * @private
   * @param {Number} start The index to start inserting elements.
   * @param {Number} deleteCount The number of elements to delete from the insert point.
   * @param {Array} elements The elements to insert.
   * @returns {Array} An array of deleted elements.
   */
  function insert(start, deleteCount, elements) {
    // `result` should have its length set to the `deleteCount`
    // see https://bugs.ecmascript.org/show_bug.cgi?id=332
    var deleteEnd = start + deleteCount,
        elementCount = elements ? elements.length : 0,
        index = start - 1,
        length = start + elementCount,
        object = this,
        result = Array(deleteCount),
        tail = slice.call(object, deleteEnd);

    // delete elements from the array
    while (++index < deleteEnd) {
      if (index in object) {
        result[index - start] = object[index];
        delete object[index];
      }
    }
    // insert elements
    index = start - 1;
    while (++index < length) {
      object[index] = elements[index - start];
    }
    // append tail elements
    start = index--;
    length = max(0, (object.length >>> 0) - deleteCount + elementCount);
    while (++index < length) {
      if ((index - start) in tail) {
        object[index] = tail[index - start];
      } else if (index in object) {
        delete object[index];
      }
    }
    // delete excess elements
    deleteCount = deleteCount > elementCount ? deleteCount - elementCount : 0;
    while (deleteCount--) {
      index = length + deleteCount;
      if (index in object) {
        delete object[index];
      }
    }
    object.length = length;
    return result;
  }

  /**
   * Rearrange the host array's elements in reverse order.
   *
   * @memberOf Benchmark.Suite
   * @returns {Array} The reversed array.
   */
  function reverse() {
    var upperIndex,
        value,
        index = -1,
        object = Object(this),
        length = object.length >>> 0,
        middle = floor(length / 2);

    if (length > 1) {
      while (++index < middle) {
        upperIndex = length - index - 1;
        value = upperIndex in object ? object[upperIndex] : uid;
        if (index in object) {
          object[upperIndex] = object[index];
        } else {
          delete object[upperIndex];
        }
        if (value != uid) {
          object[index] = value;
        } else {
          delete object[index];
        }
      }
    }
    return object;
  }

  /**
   * Removes the first element of the host array and returns it.
   *
   * @memberOf Benchmark.Suite
   * @returns {Mixed} The first element of the array.
   */
  function shift() {
    return insert.call(this, 0, 1)[0];
  }

  /**
   * Creates an array of the host array's elements from the start index up to,
   * but not including, the end index.
   *
   * @memberOf Benchmark.Suite
   * @param {Number} start The starting index.
   * @param {Number} end The end index.
   * @returns {Array} The new array.
   */
  function slice(start, end) {
    var index = -1,
        object = Object(this),
        length = object.length >>> 0,
        result = [];

    start = toInteger(start);
    start = start < 0 ? max(length + start, 0) : min(start, length);
    start--;
    end = end == null ? length : toInteger(end);
    end = end < 0 ? max(length + end, 0) : min(end, length);

    while ((++index, ++start) < end) {
      if (start in object) {
        result[index] = object[start];
      }
    }
    return result;
  }

  /**
   * Allows removing a range of elements and/or inserting elements into the
   * host array.
   *
   * @memberOf Benchmark.Suite
   * @param {Number} start The start index.
   * @param {Number} deleteCount The number of elements to delete.
   * @param {Mixed} [val1, val2, ...] values to insert at the `start` index.
   * @returns {Array} An array of removed elements.
   */
  function splice(start, deleteCount) {
    var object = Object(this),
        length = object.length >>> 0;

    start = toInteger(start);
    start = start < 0 ? max(length + start, 0) : min(start, length);

    // support the de-facto SpiderMonkey extension
    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/splice#Parameters
    // https://bugs.ecmascript.org/show_bug.cgi?id=429
    deleteCount = arguments.length == 1
      ? length - start
      : min(max(toInteger(deleteCount), 0), length - start);

    return insert.call(object, start, deleteCount, slice.call(arguments, 2));
  }

  /**
   * Converts the specified `value` to an integer.
   *
   * @private
   * @param {Mixed} value The value to convert.
   * @returns {Number} The resulting integer.
   */
  function toInteger(value) {
    value = +value;
    return value === 0 || !isFinite(value) ? value || 0 : value - (value % 1);
  }

  /**
   * Appends arguments to the host array.
   *
   * @memberOf Benchmark.Suite
   * @returns {Number} The new length.
   */
  function unshift() {
    var object = Object(this);
    insert.call(object, 0, 0, arguments);
    return object.length;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * A generic `Function#bind` like method.
   *
   * @private
   * @param {Function} fn The function to be bound to `thisArg`.
   * @param {Mixed} thisArg The `this` binding for the given function.
   * @returns {Function} The bound function.
   */
  function bind(fn, thisArg) {
    return function() { fn.apply(thisArg, arguments); };
  }

  /**
   * Creates a function from the given arguments string and body.
   *
   * @private
   * @param {String} args The comma separated function arguments.
   * @param {String} body The function body.
   * @returns {Function} The new function.
   */
  function createFunction() {
    // lazy define
    createFunction = function(args, body) {
      var result,
          anchor = freeDefine ? define.amd : Benchmark,
          prop = uid + 'createFunction';

      runScript((freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '=function(' + args + '){' + body + '}');
      result = anchor[prop];
      delete anchor[prop];
      return result;
    };
    // fix JaegerMonkey bug
    // http://bugzil.la/639720
    createFunction = support.browser && (createFunction('', 'return"' + uid + '"') || noop)() == uid ? createFunction : Function;
    return createFunction.apply(null, arguments);
  }

  /**
   * Delay the execution of a function based on the benchmark's `delay` property.
   *
   * @private
   * @param {Object} bench The benchmark instance.
   * @param {Object} fn The function to execute.
   */
  function delay(bench, fn) {
    bench._timerId = setTimeout(fn, bench.delay * 1e3);
  }

  /**
   * Destroys the given element.
   *
   * @private
   * @param {Element} element The element to destroy.
   */
  function destroyElement(element) {
    trash.appendChild(element);
    trash.innerHTML = '';
  }

  /**
   * Iterates over an object's properties, executing the `callback` for each.
   * Callbacks may terminate the loop by explicitly returning `false`.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function executed per own property.
   * @param {Object} options The options object.
   * @returns {Object} Returns the object iterated over.
   */
  function forProps() {
    var forShadowed,
        skipSeen,
        forArgs = true,
        shadowed = ['constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf'];

    (function(enumFlag, key) {
      // must use a non-native constructor to catch the Safari 2 issue
      function Klass() { this.valueOf = 0; };
      Klass.prototype.valueOf = 0;
      // check various for-in bugs
      for (key in new Klass) {
        enumFlag += key == 'valueOf' ? 1 : 0;
      }
      // check if `arguments` objects have non-enumerable indexes
      for (key in arguments) {
        key == '0' && (forArgs = false);
      }
      // Safari 2 iterates over shadowed properties twice
      // http://replay.waybackmachine.org/20090428222941/http://tobielangel.com/2007/1/29/for-in-loop-broken-in-safari/
      skipSeen = enumFlag == 2;
      // IE < 9 incorrectly makes an object's properties non-enumerable if they have
      // the same name as other non-enumerable properties in its prototype chain.
      forShadowed = !enumFlag;
    }(0));

    // lazy define
    forProps = function(object, callback, options) {
      options || (options = {});

      var result = object;
      object = Object(object);

      var ctor,
          key,
          keys,
          skipCtor,
          done = !result,
          which = options.which,
          allFlag = which == 'all',
          index = -1,
          iteratee = object,
          length = object.length,
          ownFlag = allFlag || which == 'own',
          seen = {},
          skipProto = isClassOf(object, 'Function'),
          thisArg = options.bind;

      if (thisArg !== undefined) {
        callback = bind(callback, thisArg);
      }
      // iterate all properties
      if (allFlag && support.getAllKeys) {
        for (index = 0, keys = getAllKeys(object), length = keys.length; index < length; index++) {
          key = keys[index];
          if (callback(object[key], key, object) === false) {
            break;
          }
        }
      }
      // else iterate only enumerable properties
      else {
        for (key in object) {
          // Firefox < 3.6, Opera > 9.50 - Opera < 11.60, and Safari < 5.1
          // (if the prototype or a property on the prototype has been set)
          // incorrectly set a function's `prototype` property [[Enumerable]] value
          // to `true`. Because of this we standardize on skipping the `prototype`
          // property of functions regardless of their [[Enumerable]] value.
          if ((done =
              !(skipProto && key == 'prototype') &&
              !(skipSeen && (hasKey(seen, key) || !(seen[key] = true))) &&
              (!ownFlag || ownFlag && hasKey(object, key)) &&
              callback(object[key], key, object) === false)) {
            break;
          }
        }
        // in IE < 9 strings don't support accessing characters by index
        if (!done && (forArgs && isArguments(object) ||
            ((noCharByIndex || noCharByOwnIndex) && isClassOf(object, 'String') &&
              (iteratee = noCharByIndex ? object.split('') : object)))) {
          while (++index < length) {
            if ((done =
                callback(iteratee[index], String(index), object) === false)) {
              break;
            }
          }
        }
        if (!done && forShadowed) {
          // Because IE < 9 can't set the `[[Enumerable]]` attribute of an existing
          // property and the `constructor` property of a prototype defaults to
          // non-enumerable, we manually skip the `constructor` property when we
          // think we are iterating over a `prototype` object.
          ctor = object.constructor;
          skipCtor = ctor && ctor.prototype && ctor.prototype.constructor === ctor;
          for (index = 0; index < 7; index++) {
            key = shadowed[index];
            if (!(skipCtor && key == 'constructor') &&
                hasKey(object, key) &&
                callback(object[key], key, object) === false) {
              break;
            }
          }
        }
      }
      return result;
    };
    return forProps.apply(null, arguments);
  }

  /**
   * Gets the name of the first argument from a function's source.
   *
   * @private
   * @param {Function} fn The function.
   * @returns {String} The argument name.
   */
  function getFirstArgument(fn) {
    return (!hasKey(fn, 'toString') &&
      (/^[\s(]*function[^(]*\(([^\s,)]+)/.exec(fn) || 0)[1]) || '';
  }

  /**
   * Computes the arithmetic mean of a sample.
   *
   * @private
   * @param {Array} sample The sample.
   * @returns {Number} The mean.
   */
  function getMean(sample) {
    return reduce(sample, function(sum, x) {
      return sum + x;
    }) / sample.length || 0;
  }

  /**
   * Gets the source code of a function.
   *
   * @private
   * @param {Function} fn The function.
   * @param {String} altSource A string used when a function's source code is unretrievable.
   * @returns {String} The function's source code.
   */
  function getSource(fn, altSource) {
    var result = altSource;
    if (isStringable(fn)) {
      result = String(fn);
    } else if (support.decompilation) {
      // escape the `{` for Firefox 1
      result = (/^[^{]+\{([\s\S]*)}\s*$/.exec(fn) || 0)[1];
    }
    // trim string
    result = (result || '').replace(/^\s+|\s+$/g, '');

    // detect strings containing only the "use strict" directive
    return /^(?:\/\*+[\w|\W]*?\*\/|\/\/.*?[\n\r\u2028\u2029]|\s)*(["'])use strict\1;?$/.test(result)
      ? ''
      : result;
  }

  /**
   * Checks if a value is an `arguments` object.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the value is an `arguments` object, else `false`.
   */
  function isArguments() {
    // lazy define
    isArguments = function(value) {
      return toString.call(value) == '[object Arguments]';
    };
    if (noArgumentsClass) {
      isArguments = function(value) {
        return hasKey(value, 'callee') &&
          !(propertyIsEnumerable && propertyIsEnumerable.call(value, 'callee'));
      };
    }
    return isArguments(arguments[0]);
  }

  /**
   * Checks if an object is of the specified class.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @param {String} name The name of the class.
   * @returns {Boolean} Returns `true` if the value is of the specified class, else `false`.
   */
  function isClassOf(value, name) {
    return value != null && toString.call(value) == '[object ' + name + ']';
  }

  /**
   * Host objects can return type values that are different from their actual
   * data type. The objects we are concerned with usually return non-primitive
   * types of object, function, or unknown.
   *
   * @private
   * @param {Mixed} object The owner of the property.
   * @param {String} property The property to check.
   * @returns {Boolean} Returns `true` if the property value is a non-primitive, else `false`.
   */
  function isHostType(object, property) {
    var type = object != null ? typeof object[property] : 'number';
    return !/^(?:boolean|number|string|undefined)$/.test(type) &&
      (type == 'object' ? !!object[property] : true);
  }

  /**
   * Checks if a given `value` is an object created by the `Object` constructor
   * assuming objects created by the `Object` constructor have no inherited
   * enumerable properties and that there are no `Object.prototype` extensions.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a plain `Object` object, else `false`.
   */
  function isPlainObject(value) {
    // avoid non-objects and false positives for `arguments` objects in IE < 9
    var result = false;
    if (!(value && typeof value == 'object') || (noArgumentsClass && isArguments(value))) {
      return result;
    }
    // IE < 9 presents DOM nodes as `Object` objects except they have `toString`
    // methods that are `typeof` "string" and still can coerce nodes to strings.
    // Also check that the constructor is `Object` (i.e. `Object instanceof Object`)
    var ctor = value.constructor;
    if ((support.nodeClass || !(typeof value.toString != 'function' && typeof (value + '') == 'string')) &&
        (!isClassOf(ctor, 'Function') || ctor instanceof ctor)) {
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      if (support.iteratesOwnFirst) {
        forProps(value, function(subValue, subKey) {
          result = subKey;
        });
        return result === false || hasKey(value, result);
      }
      // IE < 9 iterates inherited properties before own properties. If the first
      // iterated property is an object's own property then there are no inherited
      // enumerable properties.
      forProps(value, function(subValue, subKey) {
        result = !hasKey(value, subKey);
        return false;
      });
      return result === false;
    }
    return result;
  }

  /**
   * Checks if a value can be safely coerced to a string.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the value can be coerced, else `false`.
   */
  function isStringable(value) {
    return hasKey(value, 'toString') || isClassOf(value, 'String');
  }

  /**
   * Wraps a function and passes `this` to the original function as the
   * first argument.
   *
   * @private
   * @param {Function} fn The function to be wrapped.
   * @returns {Function} The new function.
   */
  function methodize(fn) {
    return function() {
      var args = [this];
      args.push.apply(args, arguments);
      return fn.apply(null, args);
    };
  }

  /**
   * A no-operation function.
   *
   * @private
   */
  function noop() {
    // no operation performed
  }

  /**
   * A wrapper around require() to suppress `module missing` errors.
   *
   * @private
   * @param {String} id The module id.
   * @returns {Mixed} The exported module or `null`.
   */
  function req(id) {
    try {
      var result = freeExports && freeRequire(id);
    } catch(e) { }
    return result || null;
  }

  /**
   * Runs a snippet of JavaScript via script injection.
   *
   * @private
   * @param {String} code The code to run.
   */
  function runScript(code) {
    var anchor = freeDefine ? define.amd : Benchmark,
        script = doc.createElement('script'),
        sibling = doc.getElementsByTagName('script')[0],
        parent = sibling.parentNode,
        prop = uid + 'runScript',
        prefix = '(' + (freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '||function(){})();';

    // Firefox 2.0.0.2 cannot use script injection as intended because it executes
    // asynchronously, but that's OK because script injection is only used to avoid
    // the previously commented JaegerMonkey bug.
    try {
      // remove the inserted script *before* running the code to avoid differences
      // in the expected script element count/order of the document.
      script.appendChild(doc.createTextNode(prefix + code));
      anchor[prop] = function() { destroyElement(script); };
    } catch(e) {
      parent = parent.cloneNode(false);
      sibling = null;
      script.text = code;
    }
    parent.insertBefore(script, sibling);
    delete anchor[prop];
  }

  /**
   * A helper function for setting options/event handlers.
   *
   * @private
   * @param {Object} bench The benchmark instance.
   * @param {Object} [options={}] Options object.
   */
  function setOptions(bench, options) {
    options = extend({}, bench.constructor.options, options);
    bench.options = forOwn(options, function(value, key) {
      if (value != null) {
        // add event listeners
        if (/^on[A-Z]/.test(key)) {
          forEach(key.split(' '), function(key) {
            bench.on(key.slice(2).toLowerCase(), value);
          });
        } else if (!hasKey(bench, key)) {
          bench[key] = deepClone(value);
        }
      }
    });
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Handles cycling/completing the deferred benchmark.
   *
   * @memberOf Benchmark.Deferred
   */
  function resolve() {
    var me = this,
        clone = me.benchmark,
        bench = clone._original;

    if (bench.aborted) {
      // cycle() -> clone cycle/complete event -> compute()'s invoked bench.run() cycle/complete
      me.teardown();
      clone.running = false;
      cycle(me);
    }
    else if (++me.cycles < clone.count) {
      // continue the test loop
      if (support.timeout) {
        // use setTimeout to avoid a call stack overflow if called recursively
        setTimeout(function() { clone.compiled.call(me, timer); }, 0);
      } else {
        clone.compiled.call(me, timer);
      }
    }
    else {
      timer.stop(me);
      me.teardown();
      delay(clone, function() { cycle(me); });
    }
  }

  /*--------------------------------------------------------------------------*/

  /**
   * A deep clone utility.
   *
   * @static
   * @memberOf Benchmark
   * @param {Mixed} value The value to clone.
   * @returns {Mixed} The cloned value.
   */
  function deepClone(value) {
    var accessor,
        circular,
        clone,
        ctor,
        descriptor,
        extensible,
        key,
        length,
        markerKey,
        parent,
        result,
        source,
        subIndex,
        data = { 'value': value },
        index = 0,
        marked = [],
        queue = { 'length': 0 },
        unmarked = [];

    /**
     * An easily detectable decorator for cloned values.
     */
    function Marker(object) {
      this.raw = object;
    }

    /**
     * The callback used by `forProps()`.
     */
    function forPropsCallback(subValue, subKey) {
      // exit early to avoid cloning the marker
      if (subValue && subValue.constructor == Marker) {
        return;
      }
      // add objects to the queue
      if (subValue === Object(subValue)) {
        queue[queue.length++] = { 'key': subKey, 'parent': clone, 'source': value };
      }
      // assign non-objects
      else {
        try {
          // will throw an error in strict mode if the property is read-only
          clone[subKey] = subValue;
        } catch(e) { }
      }
    }

    /**
     * Gets an available marker key for the given object.
     */
    function getMarkerKey(object) {
      // avoid collisions with existing keys
      var result = uid;
      while (object[result] && object[result].constructor != Marker) {
        result += 1;
      }
      return result;
    }

    do {
      key = data.key;
      parent = data.parent;
      source = data.source;
      clone = value = source ? source[key] : data.value;
      accessor = circular = descriptor = false;

      // create a basic clone to filter out functions, DOM elements, and
      // other non `Object` objects
      if (value === Object(value)) {
        // use custom deep clone function if available
        if (isClassOf(value.deepClone, 'Function')) {
          clone = value.deepClone();
        } else {
          ctor = value.constructor;
          switch (toString.call(value)) {
            case '[object Array]':
              clone = new ctor(value.length);
              break;

            case '[object Boolean]':
              clone = new ctor(value == true);
              break;

            case '[object Date]':
              clone = new ctor(+value);
              break;

            case '[object Object]':
              isPlainObject(value) && (clone = {});
              break;

            case '[object Number]':
            case '[object String]':
              clone = new ctor(value);
              break;

            case '[object RegExp]':
              clone = ctor(value.source,
                (value.global     ? 'g' : '') +
                (value.ignoreCase ? 'i' : '') +
                (value.multiline  ? 'm' : ''));
          }
        }
        // continue clone if `value` doesn't have an accessor descriptor
        // http://es5.github.com/#x8.10.1
        if (clone && clone != value &&
            !(descriptor = source && support.descriptors && getDescriptor(source, key),
              accessor = descriptor && (descriptor.get || descriptor.set))) {
          // use an existing clone (circular reference)
          if ((extensible = isExtensible(value))) {
            markerKey = getMarkerKey(value);
            if (value[markerKey]) {
              circular = clone = value[markerKey].raw;
            }
          } else {
            // for frozen/sealed objects
            for (subIndex = 0, length = unmarked.length; subIndex < length; subIndex++) {
              data = unmarked[subIndex];
              if (data.object === value) {
                circular = clone = data.clone;
                break;
              }
            }
          }
          if (!circular) {
            // mark object to allow quickly detecting circular references and tie it to its clone
            if (extensible) {
              value[markerKey] = new Marker(clone);
              marked.push({ 'key': markerKey, 'object': value });
            } else {
              // for frozen/sealed objects
              unmarked.push({ 'clone': clone, 'object': value });
            }
            // iterate over object properties
            forProps(value, forPropsCallback, { 'which': 'all' });
          }
        }
      }
      if (parent) {
        // for custom property descriptors
        if (accessor || (descriptor && !(descriptor.configurable && descriptor.enumerable && descriptor.writable))) {
          if ('value' in descriptor) {
            descriptor.value = clone;
          }
          setDescriptor(parent, key, descriptor);
        }
        // for default property descriptors
        else {
          parent[key] = clone;
        }
      } else {
        result = clone;
      }
    } while ((data = queue[index++]));

    // remove markers
    for (index = 0, length = marked.length; index < length; index++) {
      data = marked[index];
      delete data.object[data.key];
    }
    return result;
  }

  /**
   * An iteration utility for arrays and objects.
   * Callbacks may terminate the loop by explicitly returning `false`.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array|Object} object The object to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} thisArg The `this` binding for the callback.
   * @returns {Array|Object} Returns the object iterated over.
   */
  function each(object, callback, thisArg) {
    var result = object;
    object = Object(object);

    var fn = callback,
        index = -1,
        length = object.length,
        isSnapshot = !!(object.snapshotItem && (length = object.snapshotLength)),
        isSplittable = (noCharByIndex || noCharByOwnIndex) && isClassOf(object, 'String'),
        isConvertable = isSnapshot || isSplittable || 'item' in object,
        origObject = object;

    // in Opera < 10.5 `hasKey(object, 'length')` returns `false` for NodeLists
    if (length === length >>> 0) {
      if (isConvertable) {
        // the third argument of the callback is the original non-array object
        callback = function(value, index) {
          return fn.call(this, value, index, origObject);
        };
        // in IE < 9 strings don't support accessing characters by index
        if (isSplittable) {
          object = object.split('');
        } else {
          object = [];
          while (++index < length) {
            // in Safari 2 `index in object` is always `false` for NodeLists
            object[index] = isSnapshot ? result.snapshotItem(index) : result[index];
          }
        }
      }
      forEach(object, callback, thisArg);
    } else {
      forOwn(object, callback, thisArg);
    }
    return result;
  }

  /**
   * Copies enumerable properties from the source(s) object to the destination object.
   *
   * @static
   * @memberOf Benchmark
   * @param {Object} destination The destination object.
   * @param {Object} [source={}] The source object.
   * @returns {Object} The destination object.
   */
  function extend(destination, source) {
    // Chrome < 14 incorrectly sets `destination` to `undefined` when we `delete arguments[0]`
    // http://code.google.com/p/v8/issues/detail?id=839
    var result = destination;
    delete arguments[0];

    forEach(arguments, function(source) {
      forProps(source, function(value, key) {
        result[key] = value;
      });
    });
    return result;
  }

  /**
   * A generic `Array#filter` like method.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {Function|String} callback The function/alias called per iteration.
   * @param {Mixed} thisArg The `this` binding for the callback.
   * @returns {Array} A new array of values that passed callback filter.
   * @example
   *
   * // get odd numbers
   * Benchmark.filter([1, 2, 3, 4, 5], function(n) {
   *   return n % 2;
   * }); // -> [1, 3, 5];
   *
   * // get fastest benchmarks
   * Benchmark.filter(benches, 'fastest');
   *
   * // get slowest benchmarks
   * Benchmark.filter(benches, 'slowest');
   *
   * // get benchmarks that completed without erroring
   * Benchmark.filter(benches, 'successful');
   */
  function filter(array, callback, thisArg) {
    var result;

    if (callback == 'successful') {
      // callback to exclude those that are errored, unrun, or have hz of Infinity
      callback = function(bench) { return bench.cycles && isFinite(bench.hz); };
    }
    else if (callback == 'fastest' || callback == 'slowest') {
      // get successful, sort by period + margin of error, and filter fastest/slowest
      result = filter(array, 'successful').sort(function(a, b) {
        a = a.stats; b = b.stats;
        return (a.mean + a.moe > b.mean + b.moe ? 1 : -1) * (callback == 'fastest' ? 1 : -1);
      });
      result = filter(result, function(bench) {
        return result[0].compare(bench) == 0;
      });
    }
    return result || reduce(array, function(result, value, index) {
      return callback.call(thisArg, value, index, array) ? (result.push(value), result) : result;
    }, []);
  }

  /**
   * A generic `Array#forEach` like method.
   * Callbacks may terminate the loop by explicitly returning `false`.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} thisArg The `this` binding for the callback.
   * @returns {Array} Returns the array iterated over.
   */
  function forEach(array, callback, thisArg) {
    var index = -1,
        length = (array = Object(array)).length >>> 0;

    if (thisArg !== undefined) {
      callback = bind(callback, thisArg);
    }
    while (++index < length) {
      if (index in array &&
          callback(array[index], index, array) === false) {
        break;
      }
    }
    return array;
  }

  /**
   * Iterates over an object's own properties, executing the `callback` for each.
   * Callbacks may terminate the loop by explicitly returning `false`.
   *
   * @static
   * @memberOf Benchmark
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function executed per own property.
   * @param {Mixed} thisArg The `this` binding for the callback.
   * @returns {Object} Returns the object iterated over.
   */
  function forOwn(object, callback, thisArg) {
    return forProps(object, callback, { 'bind': thisArg, 'which': 'own' });
  }

  /**
   * Converts a number to a more readable comma-separated string representation.
   *
   * @static
   * @memberOf Benchmark
   * @param {Number} number The number to convert.
   * @returns {String} The more readable string representation.
   */
  function formatNumber(number) {
    number = String(number).split('.');
    return number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') +
      (number[1] ? '.' + number[1] : '');
  }

  /**
   * Checks if an object has the specified key as a direct property.
   *
   * @static
   * @memberOf Benchmark
   * @param {Object} object The object to check.
   * @param {String} key The key to check for.
   * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
   */
  function hasKey() {
    // lazy define for worst case fallback (not as accurate)
    hasKey = function(object, key) {
      var parent = object != null && (object.constructor || Object).prototype;
      return !!parent && key in Object(object) && !(key in parent && object[key] === parent[key]);
    };
    // for modern browsers
    if (isClassOf(hasOwnProperty, 'Function')) {
      hasKey = function(object, key) {
        return object != null && hasOwnProperty.call(object, key);
      };
    }
    // for Safari 2
    else if ({}.__proto__ == Object.prototype) {
      hasKey = function(object, key) {
        var result = false;
        if (object != null) {
          object = Object(object);
          object.__proto__ = [object.__proto__, object.__proto__ = null, result = key in object][0];
        }
        return result;
      };
    }
    return hasKey.apply(this, arguments);
  }

  /**
   * A generic `Array#indexOf` like method.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {Mixed} value The value to search for.
   * @param {Number} [fromIndex=0] The index to start searching from.
   * @returns {Number} The index of the matched value or `-1`.
   */
  function indexOf(array, value, fromIndex) {
    var index = toInteger(fromIndex),
        length = (array = Object(array)).length >>> 0;

    index = (index < 0 ? max(0, length + index) : index) - 1;
    while (++index < length) {
      if (index in array && value === array[index]) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Modify a string by replacing named tokens with matching object property values.
   *
   * @static
   * @memberOf Benchmark
   * @param {String} string The string to modify.
   * @param {Object} object The template object.
   * @returns {String} The modified string.
   */
  function interpolate(string, object) {
    forOwn(object, function(value, key) {
      // escape regexp special characters in `key`
      string = string.replace(RegExp('#\\{' + key.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1') + '\\}', 'g'), value);
    });
    return string;
  }

  /**
   * Invokes a method on all items in an array.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} benches Array of benchmarks to iterate over.
   * @param {String|Object} name The name of the method to invoke OR options object.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
   * @returns {Array} A new array of values returned from each method invoked.
   * @example
   *
   * // invoke `reset` on all benchmarks
   * Benchmark.invoke(benches, 'reset');
   *
   * // invoke `emit` with arguments
   * Benchmark.invoke(benches, 'emit', 'complete', listener);
   *
   * // invoke `run(true)`, treat benchmarks as a queue, and register invoke callbacks
   * Benchmark.invoke(benches, {
   *
   *   // invoke the `run` method
   *   'name': 'run',
   *
   *   // pass a single argument
   *   'args': true,
   *
   *   // treat as queue, removing benchmarks from front of `benches` until empty
   *   'queued': true,
   *
   *   // called before any benchmarks have been invoked.
   *   'onStart': onStart,
   *
   *   // called between invoking benchmarks
   *   'onCycle': onCycle,
   *
   *   // called after all benchmarks have been invoked.
   *   'onComplete': onComplete
   * });
   */
  function invoke(benches, name) {
    var args,
        bench,
        queued,
        index = -1,
        eventProps = { 'currentTarget': benches },
        options = { 'onStart': noop, 'onCycle': noop, 'onComplete': noop },
        result = map(benches, function(bench) { return bench; });

    /**
     * Invokes the method of the current object and if synchronous, fetches the next.
     */
    function execute() {
      var listeners,
          async = isAsync(bench);

      if (async) {
        // use `getNext` as the first listener
        bench.on('complete', getNext);
        listeners = bench.events.complete;
        listeners.splice(0, 0, listeners.pop());
      }
      // execute method
      result[index] = isClassOf(bench && bench[name], 'Function') ? bench[name].apply(bench, args) : undefined;
      // if synchronous return true until finished
      return !async && getNext();
    }

    /**
     * Fetches the next bench or executes `onComplete` callback.
     */
    function getNext(event) {
      var cycleEvent,
          last = bench,
          async = isAsync(last);

      if (async) {
        last.off('complete', getNext);
        last.emit('complete');
      }
      // emit "cycle" event
      eventProps.type = 'cycle';
      eventProps.target = last;
      cycleEvent = Event(eventProps);
      options.onCycle.call(benches, cycleEvent);

      // choose next benchmark if not exiting early
      if (!cycleEvent.aborted && raiseIndex() !== false) {
        bench = queued ? benches[0] : result[index];
        if (isAsync(bench)) {
          delay(bench, execute);
        }
        else if (async) {
          // resume execution if previously asynchronous but now synchronous
          while (execute()) { }
        }
        else {
          // continue synchronous execution
          return true;
        }
      } else {
        // emit "complete" event
        eventProps.type = 'complete';
        options.onComplete.call(benches, Event(eventProps));
      }
      // When used as a listener `event.aborted = true` will cancel the rest of
      // the "complete" listeners because they were already called above and when
      // used as part of `getNext` the `return false` will exit the execution while-loop.
      if (event) {
        event.aborted = true;
      } else {
        return false;
      }
    }

    /**
     * Checks if invoking `Benchmark#run` with asynchronous cycles.
     */
    function isAsync(object) {
      // avoid using `instanceof` here because of IE memory leak issues with host objects
      var async = args[0] && args[0].async;
      return Object(object).constructor == Benchmark && name == 'run' &&
        ((async == null ? object.options.async : async) && support.timeout || object.defer);
    }

    /**
     * Raises `index` to the next defined index or returns `false`.
     */
    function raiseIndex() {
      var length = result.length;
      if (queued) {
        // if queued remove the previous bench and subsequent skipped non-entries
        do {
          ++index > 0 && shift.call(benches);
        } while ((length = benches.length) && !('0' in benches));
      }
      else {
        while (++index < length && !(index in result)) { }
      }
      // if we reached the last index then return `false`
      return (queued ? length : index < length) ? index : (index = false);
    }

    // juggle arguments
    if (isClassOf(name, 'String')) {
      // 2 arguments (array, name)
      args = slice.call(arguments, 2);
    } else {
      // 2 arguments (array, options)
      options = extend(options, name);
      name = options.name;
      args = isClassOf(args = 'args' in options ? options.args : [], 'Array') ? args : [args];
      queued = options.queued;
    }

    // start iterating over the array
    if (raiseIndex() !== false) {
      // emit "start" event
      bench = result[index];
      eventProps.type = 'start';
      eventProps.target = bench;
      options.onStart.call(benches, Event(eventProps));

      // end early if the suite was aborted in an "onStart" listener
      if (benches.aborted && benches.constructor == Suite && name == 'run') {
        // emit "cycle" event
        eventProps.type = 'cycle';
        options.onCycle.call(benches, Event(eventProps));
        // emit "complete" event
        eventProps.type = 'complete';
        options.onComplete.call(benches, Event(eventProps));
      }
      // else start
      else {
        if (isAsync(bench)) {
          delay(bench, execute);
        } else {
          while (execute()) { }
        }
      }
    }
    return result;
  }

  /**
   * Creates a string of joined array values or object key-value pairs.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array|Object} object The object to operate on.
   * @param {String} [separator1=','] The separator used between key-value pairs.
   * @param {String} [separator2=': '] The separator used between keys and values.
   * @returns {String} The joined result.
   */
  function join(object, separator1, separator2) {
    var result = [],
        length = (object = Object(object)).length,
        arrayLike = length === length >>> 0;

    separator2 || (separator2 = ': ');
    each(object, function(value, key) {
      result.push(arrayLike ? value : key + separator2 + value);
    });
    return result.join(separator1 || ',');
  }

  /**
   * A generic `Array#map` like method.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} thisArg The `this` binding for the callback.
   * @returns {Array} A new array of values returned by the callback.
   */
  function map(array, callback, thisArg) {
    return reduce(array, function(result, value, index) {
      result[index] = callback.call(thisArg, value, index, array);
      return result;
    }, Array(Object(array).length >>> 0));
  }

  /**
   * Retrieves the value of a specified property from all items in an array.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {String} property The property to pluck.
   * @returns {Array} A new array of property values.
   */
  function pluck(array, property) {
    return map(array, function(object) {
      return object == null ? undefined : object[property];
    });
  }

  /**
   * A generic `Array#reduce` like method.
   *
   * @static
   * @memberOf Benchmark
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} accumulator Initial value of the accumulator.
   * @returns {Mixed} The accumulator.
   */
  function reduce(array, callback, accumulator) {
    var noaccum = arguments.length < 3;
    forEach(array, function(value, index) {
      accumulator = noaccum ? (noaccum = false, value) : callback(accumulator, value, index, array);
    });
    return accumulator;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Aborts all benchmarks in the suite.
   *
   * @name abort
   * @memberOf Benchmark.Suite
   * @returns {Object} The suite instance.
   */
  function abortSuite() {
    var event,
        me = this,
        resetting = calledBy.resetSuite;

    if (me.running) {
      event = Event('abort');
      me.emit(event);
      if (!event.cancelled || resetting) {
        // avoid infinite recursion
        calledBy.abortSuite = true;
        me.reset();
        delete calledBy.abortSuite;

        if (!resetting) {
          me.aborted = true;
          invoke(me, 'abort');
        }
      }
    }
    return me;
  }

  /**
   * Adds a test to the benchmark suite.
   *
   * @memberOf Benchmark.Suite
   * @param {String} name A name to identify the benchmark.
   * @param {Function|String} fn The test to benchmark.
   * @param {Object} [options={}] Options object.
   * @returns {Object} The benchmark instance.
   * @example
   *
   * // basic usage
   * suite.add(fn);
   *
   * // or using a name first
   * suite.add('foo', fn);
   *
   * // or with options
   * suite.add('foo', fn, {
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   *
   * // or name and options
   * suite.add('foo', {
   *   'fn': fn,
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   *
   * // or options only
   * suite.add({
   *   'name': 'foo',
   *   'fn': fn,
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   */
  function add(name, fn, options) {
    var me = this,
        bench = Benchmark(name, fn, options),
        event = Event({ 'type': 'add', 'target': bench });

    if (me.emit(event), !event.cancelled) {
      me.push(bench);
    }
    return me;
  }

  /**
   * Creates a new suite with cloned benchmarks.
   *
   * @name clone
   * @memberOf Benchmark.Suite
   * @param {Object} options Options object to overwrite cloned options.
   * @returns {Object} The new suite instance.
   */
  function cloneSuite(options) {
    var me = this,
        result = new me.constructor(extend({}, me.options, options));

    // copy own properties
    forOwn(me, function(value, key) {
      if (!hasKey(result, key)) {
        result[key] = value && isClassOf(value.clone, 'Function')
          ? value.clone()
          : deepClone(value);
      }
    });
    return result;
  }

  /**
   * An `Array#filter` like method.
   *
   * @name filter
   * @memberOf Benchmark.Suite
   * @param {Function|String} callback The function/alias called per iteration.
   * @returns {Object} A new suite of benchmarks that passed callback filter.
   */
  function filterSuite(callback) {
    var me = this,
        result = new me.constructor;

    result.push.apply(result, filter(me, callback));
    return result;
  }

  /**
   * Resets all benchmarks in the suite.
   *
   * @name reset
   * @memberOf Benchmark.Suite
   * @returns {Object} The suite instance.
   */
  function resetSuite() {
    var event,
        me = this,
        aborting = calledBy.abortSuite;

    if (me.running && !aborting) {
      // no worries, `resetSuite()` is called within `abortSuite()`
      calledBy.resetSuite = true;
      me.abort();
      delete calledBy.resetSuite;
    }
    // reset if the state has changed
    else if ((me.aborted || me.running) &&
        (me.emit(event = Event('reset')), !event.cancelled)) {
      me.running = false;
      if (!aborting) {
        invoke(me, 'reset');
      }
    }
    return me;
  }

  /**
   * Runs the suite.
   *
   * @name run
   * @memberOf Benchmark.Suite
   * @param {Object} [options={}] Options object.
   * @returns {Object} The suite instance.
   * @example
   *
   * // basic usage
   * suite.run();
   *
   * // or with options
   * suite.run({ 'async': true, 'queued': true });
   */
  function runSuite(options) {
    var me = this;

    me.reset();
    me.running = true;
    options || (options = {});

    invoke(me, {
      'name': 'run',
      'args': options,
      'queued': options.queued,
      'onStart': function(event) {
        me.emit(event);
      },
      'onCycle': function(event) {
        var bench = event.target;
        if (bench.error) {
          me.emit({ 'type': 'error', 'target': bench });
        }
        me.emit(event);
        event.aborted = me.aborted;
      },
      'onComplete': function(event) {
        me.running = false;
        me.emit(event);
      }
    });
    return me;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Executes all registered listeners of the specified event type.
   *
   * @memberOf Benchmark, Benchmark.Suite
   * @param {String|Object} type The event type or object.
   * @returns {Mixed} Returns the return value of the last listener executed.
   */
  function emit(type) {
    var listeners,
        me = this,
        event = Event(type),
        events = me.events,
        args = (arguments[0] = event, arguments);

    event.currentTarget || (event.currentTarget = me);
    event.target || (event.target = me);
    delete event.result;

    if (events && (listeners = hasKey(events, event.type) && events[event.type])) {
      forEach(listeners.slice(), function(listener) {
        if ((event.result = listener.apply(me, args)) === false) {
          event.cancelled = true;
        }
        return !event.aborted;
      });
    }
    return event.result;
  }

  /**
   * Returns an array of event listeners for a given type that can be manipulated
   * to add or remove listeners.
   *
   * @memberOf Benchmark, Benchmark.Suite
   * @param {String} type The event type.
   * @returns {Array} The listeners array.
   */
  function listeners(type) {
    var me = this,
        events = me.events || (me.events = {});

    return hasKey(events, type) ? events[type] : (events[type] = []);
  }

  /**
   * Unregisters a listener for the specified event type(s),
   * or unregisters all listeners for the specified event type(s),
   * or unregisters all listeners for all event types.
   *
   * @memberOf Benchmark, Benchmark.Suite
   * @param {String} [type] The event type.
   * @param {Function} [listener] The function to unregister.
   * @returns {Object} The benchmark instance.
   * @example
   *
   * // unregister a listener for an event type
   * bench.off('cycle', listener);
   *
   * // unregister a listener for multiple event types
   * bench.off('start cycle', listener);
   *
   * // unregister all listeners for an event type
   * bench.off('cycle');
   *
   * // unregister all listeners for multiple event types
   * bench.off('start cycle complete');
   *
   * // unregister all listeners for all event types
   * bench.off();
   */
  function off(type, listener) {
    var me = this,
        events = me.events;

    events && each(type ? type.split(' ') : events, function(listeners, type) {
      var index;
      if (typeof listeners == 'string') {
        type = listeners;
        listeners = hasKey(events, type) && events[type];
      }
      if (listeners) {
        if (listener) {
          index = indexOf(listeners, listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        } else {
          listeners.length = 0;
        }
      }
    });
    return me;
  }

  /**
   * Registers a listener for the specified event type(s).
   *
   * @memberOf Benchmark, Benchmark.Suite
   * @param {String} type The event type.
   * @param {Function} listener The function to register.
   * @returns {Object} The benchmark instance.
   * @example
   *
   * // register a listener for an event type
   * bench.on('cycle', listener);
   *
   * // register a listener for multiple event types
   * bench.on('start cycle', listener);
   */
  function on(type, listener) {
    var me = this,
        events = me.events || (me.events = {});

    forEach(type.split(' '), function(type) {
      (hasKey(events, type)
        ? events[type]
        : (events[type] = [])
      ).push(listener);
    });
    return me;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Aborts the benchmark without recording times.
   *
   * @memberOf Benchmark
   * @returns {Object} The benchmark instance.
   */
  function abort() {
    var event,
        me = this,
        resetting = calledBy.reset;

    if (me.running) {
      event = Event('abort');
      me.emit(event);
      if (!event.cancelled || resetting) {
        // avoid infinite recursion
        calledBy.abort = true;
        me.reset();
        delete calledBy.abort;

        if (support.timeout) {
          clearTimeout(me._timerId);
          delete me._timerId;
        }
        if (!resetting) {
          me.aborted = true;
          me.running = false;
        }
      }
    }
    return me;
  }

  /**
   * Creates a new benchmark using the same test and options.
   *
   * @memberOf Benchmark
   * @param {Object} options Options object to overwrite cloned options.
   * @returns {Object} The new benchmark instance.
   * @example
   *
   * var bizarro = bench.clone({
   *   'name': 'doppelganger'
   * });
   */
  function clone(options) {
    var me = this,
        result = new me.constructor(extend({}, me, options));

    // correct the `options` object
    result.options = extend({}, me.options, options);

    // copy own custom properties
    forOwn(me, function(value, key) {
      if (!hasKey(result, key)) {
        result[key] = deepClone(value);
      }
    });
    return result;
  }

  /**
   * Determines if a benchmark is faster than another.
   *
   * @memberOf Benchmark
   * @param {Object} other The benchmark to compare.
   * @returns {Number} Returns `-1` if slower, `1` if faster, and `0` if indeterminate.
   */
  function compare(other) {
    var critical,
        zStat,
        me = this,
        sample1 = me.stats.sample,
        sample2 = other.stats.sample,
        size1 = sample1.length,
        size2 = sample2.length,
        maxSize = max(size1, size2),
        minSize = min(size1, size2),
        u1 = getU(sample1, sample2),
        u2 = getU(sample2, sample1),
        u = min(u1, u2);

    function getScore(xA, sampleB) {
      return reduce(sampleB, function(total, xB) {
        return total + (xB > xA ? 0 : xB < xA ? 1 : 0.5);
      }, 0);
    }

    function getU(sampleA, sampleB) {
      return reduce(sampleA, function(total, xA) {
        return total + getScore(xA, sampleB);
      }, 0);
    }

    function getZ(u) {
      return (u - ((size1 * size2) / 2)) / sqrt((size1 * size2 * (size1 + size2 + 1)) / 12);
    }

    // exit early if comparing the same benchmark
    if (me == other) {
      return 0;
    }
    // reject the null hyphothesis the two samples come from the
    // same population (i.e. have the same median) if...
    if (size1 + size2 > 30) {
      // ...the z-stat is greater than 1.96 or less than -1.96
      // http://www.statisticslectures.com/topics/mannwhitneyu/
      zStat = getZ(u);
      return abs(zStat) > 1.96 ? (zStat > 0 ? -1 : 1) : 0;
    }
    // ...the U value is less than or equal the critical U value
    // http://www.geoib.com/mann-whitney-u-test.html
    critical = maxSize < 5 || minSize < 3 ? 0 : uTable[maxSize][minSize - 3];
    return u <= critical ? (u == u1 ? 1 : -1) : 0;
  }

  /**
   * Reset properties and abort if running.
   *
   * @memberOf Benchmark
   * @returns {Object} The benchmark instance.
   */
  function reset() {
    var data,
        event,
        me = this,
        index = 0,
        changes = { 'length': 0 },
        queue = { 'length': 0 };

    if (me.running && !calledBy.abort) {
      // no worries, `reset()` is called within `abort()`
      calledBy.reset = true;
      me.abort();
      delete calledBy.reset;
    }
    else {
      // a non-recursive solution to check if properties have changed
      // http://www.jslab.dk/articles/non.recursive.preorder.traversal.part4
      data = { 'destination': me, 'source': extend({}, me.constructor.prototype, me.options) };
      do {
        forOwn(data.source, function(value, key) {
          var changed,
              destination = data.destination,
              currValue = destination[key];

          if (value && typeof value == 'object') {
            if (isClassOf(value, 'Array')) {
              // check if an array value has changed to a non-array value
              if (!isClassOf(currValue, 'Array')) {
                changed = currValue = [];
              }
              // or has changed its length
              if (currValue.length != value.length) {
                changed = currValue = currValue.slice(0, value.length);
                currValue.length = value.length;
              }
            }
            // check if an object has changed to a non-object value
            else if (!currValue || typeof currValue != 'object') {
              changed = currValue = {};
            }
            // register a changed object
            if (changed) {
              changes[changes.length++] = { 'destination': destination, 'key': key, 'value': currValue };
            }
            queue[queue.length++] = { 'destination': currValue, 'source': value };
          }
          // register a changed primitive
          else if (value !== currValue && !(value == null || isClassOf(value, 'Function'))) {
            changes[changes.length++] = { 'destination': destination, 'key': key, 'value': value };
          }
        });
      }
      while ((data = queue[index++]));

      // if changed emit the `reset` event and if it isn't cancelled reset the benchmark
      if (changes.length && (me.emit(event = Event('reset')), !event.cancelled)) {
        forEach(changes, function(data) {
          data.destination[data.key] = data.value;
        });
      }
    }
    return me;
  }

  /**
   * Displays relevant benchmark information when coerced to a string.
   *
   * @name toString
   * @memberOf Benchmark
   * @returns {String} A string representation of the benchmark instance.
   */
  function toStringBench() {
    var me = this,
        error = me.error,
        hz = me.hz,
        id = me.id,
        stats = me.stats,
        size = stats.sample.length,
        pm = support.java ? '+/-' : '\xb1',
        result = me.name || (isNaN(id) ? id : '<Test #' + id + '>');

    if (error) {
      result += ': ' + join(error);
    } else {
      result += ' x ' + formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) + ' ops/sec ' + pm +
        stats.rme.toFixed(2) + '% (' + size + ' run' + (size == 1 ? '' : 's') + ' sampled)';
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Clocks the time taken to execute a test per cycle (secs).
   *
   * @private
   * @param {Object} bench The benchmark instance.
   * @returns {Number} The time taken.
   */
  function clock() {
    var applet,
        options = Benchmark.options,
        template = { 'begin': 's$=new n$', 'end': 'r$=(new n$-s$)/1e3', 'uid': uid },
        timers = [{ 'ns': timer.ns, 'res': max(0.0015, getRes('ms')), 'unit': 'ms' }];

    // lazy define for hi-res timers
    clock = function(clone) {
      var deferred;
      if (clone instanceof Deferred) {
        deferred = clone;
        clone = deferred.benchmark;
      }

      var bench = clone._original,
          fn = bench.fn,
          fnArg = deferred ? getFirstArgument(fn) || 'deferred' : '',
          stringable = isStringable(fn);

      var source = {
        'setup': getSource(bench.setup, preprocess('m$.setup()')),
        'fn': getSource(fn, preprocess('m$.fn(' + fnArg + ')')),
        'fnArg': fnArg,
        'teardown': getSource(bench.teardown, preprocess('m$.teardown()'))
      };

      var count = bench.count = clone.count,
          decompilable = support.decompilation || stringable,
          id = bench.id,
          isEmpty = !(source.fn || stringable),
          name = bench.name || (typeof id == 'number' ? '<Test #' + id + '>' : id),
          ns = timer.ns,
          result = 0;

      // init `minTime` if needed
      clone.minTime = bench.minTime || (bench.minTime = bench.options.minTime = options.minTime);

      // repair nanosecond timer
      // (some Chrome builds erase the `ns` variable after millions of executions)
      if (applet) {
        try {
          ns.nanoTime();
        } catch(e) {
          // use non-element to avoid issues with libs that augment them
          ns = timer.ns = new applet.Packages.nano;
        }
      }

      // Compile in setup/teardown functions and the test loop.
      // Create a new compiled test, instead of using the cached `bench.compiled`,
      // to avoid potential engine optimizations enabled over the life of the test.
      var compiled = bench.compiled = createFunction(preprocess('t$'), interpolate(
        preprocess(deferred
          ? 'var d$=this,#{fnArg}=d$,m$=d$.benchmark._original,f$=m$.fn,su$=m$.setup,td$=m$.teardown;' +
            // when `deferred.cycles` is `0` then...
            'if(!d$.cycles){' +
            // set `deferred.fn`
            'd$.fn=function(){var #{fnArg}=d$;if(typeof f$=="function"){try{#{fn}\n}catch(e$){f$(d$)}}else{#{fn}\n}};' +
            // set `deferred.teardown`
            'd$.teardown=function(){d$.cycles=0;if(typeof td$=="function"){try{#{teardown}\n}catch(e$){td$()}}else{#{teardown}\n}};' +
            // execute the benchmark's `setup`
            'if(typeof su$=="function"){try{#{setup}\n}catch(e$){su$()}}else{#{setup}\n};' +
            // start timer
            't$.start(d$);' +
            // execute `deferred.fn` and return a dummy object
            '}d$.fn();return{}'

          : 'var r$,s$,m$=this,f$=m$.fn,i$=m$.count,n$=t$.ns;#{setup}\n#{begin};' +
            'while(i$--){#{fn}\n}#{end};#{teardown}\nreturn{elapsed:r$,uid:"#{uid}"}'),
        source
      ));

      try {
        if (isEmpty) {
          // Firefox may remove dead code from Function#toString results
          // http://bugzil.la/536085
          throw new Error('The test "' + name + '" is empty. This may be the result of dead code removal.');
        }
        else if (!deferred) {
          // pretest to determine if compiled code is exits early, usually by a
          // rogue `return` statement, by checking for a return object with the uid
          bench.count = 1;
          compiled = (compiled.call(bench, timer) || {}).uid == uid && compiled;
          bench.count = count;
        }
      } catch(e) {
        compiled = null;
        clone.error = e || new Error(String(e));
        bench.count = count;
      }
      // fallback when a test exits early or errors during pretest
      if (decompilable && !compiled && !deferred && !isEmpty) {
        compiled = createFunction(preprocess('t$'), interpolate(
          preprocess(
            (clone.error && !stringable
              ? 'var r$,s$,m$=this,f$=m$.fn,i$=m$.count'
              : 'function f$(){#{fn}\n}var r$,s$,m$=this,i$=m$.count'
            ) +
            ',n$=t$.ns;#{setup}\n#{begin};m$.f$=f$;while(i$--){m$.f$()}#{end};' +
            'delete m$.f$;#{teardown}\nreturn{elapsed:r$}'
          ),
          source
        ));

        try {
          // pretest one more time to check for errors
          bench.count = 1;
          compiled.call(bench, timer);
          bench.compiled = compiled;
          bench.count = count;
          delete clone.error;
        }
        catch(e) {
          bench.count = count;
          if (clone.error) {
            compiled = null;
          } else {
            bench.compiled = compiled;
            clone.error = e || new Error(String(e));
          }
        }
      }
      // assign `compiled` to `clone` before calling in case a deferred benchmark
      // immediately calls `deferred.resolve()`
      clone.compiled = compiled;
      // if no errors run the full test loop
      if (!clone.error) {
        result = compiled.call(deferred || bench, timer).elapsed;
      }
      return result;
    };

    /*------------------------------------------------------------------------*/

    /**
     * Gets the current timer's minimum resolution (secs).
     */
    function getRes(unit) {
      var measured,
          begin,
          count = 30,
          divisor = 1e3,
          ns = timer.ns,
          sample = [];

      // get average smallest measurable time
      while (count--) {
        if (unit == 'us') {
          divisor = 1e6;
          if (ns.stop) {
            ns.start();
            while (!(measured = ns.microseconds())) { }
          } else if (ns[perfName]) {
            divisor = 1e3;
            measured = Function('n', 'var r,s=n.' + perfName + '();while(!(r=n.' + perfName + '()-s)){};return r')(ns);
          } else {
            begin = ns();
            while (!(measured = ns() - begin)) { }
          }
        }
        else if (unit == 'ns') {
          divisor = 1e9;
          if (ns.nanoTime) {
            begin = ns.nanoTime();
            while (!(measured = ns.nanoTime() - begin)) { }
          } else {
            begin = (begin = ns())[0] + (begin[1] / divisor);
            while (!(measured = ((measured = ns())[0] + (measured[1] / divisor)) - begin)) { }
            divisor = 1;
          }
        }
        else {
          begin = new ns;
          while (!(measured = new ns - begin)) { }
        }
        // check for broken timers (nanoTime may have issues)
        // http://alivebutsleepy.srnet.cz/unreliable-system-nanotime/
        if (measured > 0) {
          sample.push(measured);
        } else {
          sample.push(Infinity);
          break;
        }
      }
      // convert to seconds
      return getMean(sample) / divisor;
    }

    /**
     * Replaces all occurrences of `$` with a unique number and
     * template tokens with content.
     */
    function preprocess(code) {
      return interpolate(code, template).replace(/\$/g, /\d+/.exec(uid));
    }

    /*------------------------------------------------------------------------*/

    // detect nanosecond support from a Java applet
    each(doc && doc.applets || [], function(element) {
      return !(timer.ns = applet = 'nanoTime' in element && element);
    });

    // check type in case Safari returns an object instead of a number
    try {
      if (typeof timer.ns.nanoTime() == 'number') {
        timers.push({ 'ns': timer.ns, 'res': getRes('ns'), 'unit': 'ns' });
      }
    } catch(e) { }

    // detect Chrome's microsecond timer:
    // enable benchmarking via the --enable-benchmarking command
    // line switch in at least Chrome 7 to use chrome.Interval
    try {
      if ((timer.ns = new (window.chrome || window.chromium).Interval)) {
        timers.push({ 'ns': timer.ns, 'res': getRes('us'), 'unit': 'us' });
      }
    } catch(e) { }

    // detect `performance.now` microsecond resolution timer
    if ((timer.ns = perfName && perfObject)) {
      timers.push({ 'ns': timer.ns, 'res': getRes('us'), 'unit': 'us' });
    }

    // detect Node's nanosecond resolution timer available in Node >= 0.8
    if (processObject && typeof (timer.ns = processObject.hrtime) == 'function') {
      timers.push({ 'ns': timer.ns, 'res': getRes('ns'), 'unit': 'ns' });
    }

    // detect Wade Simmons' Node microtime module
    if (microtimeObject && typeof (timer.ns = microtimeObject.now) == 'function') {
      timers.push({ 'ns': timer.ns,  'res': getRes('us'), 'unit': 'us' });
    }

    // pick timer with highest resolution
    timer = reduce(timers, function(timer, other) {
      return other.res < timer.res ? other : timer;
    });

    // remove unused applet
    if (timer.unit != 'ns' && applet) {
      applet = destroyElement(applet);
    }
    // error if there are no working timers
    if (timer.res == Infinity) {
      throw new Error('Benchmark.js was unable to find a working timer.');
    }
    // use API of chosen timer
    if (timer.unit == 'ns') {
      if (timer.ns.nanoTime) {
        extend(template, {
          'begin': 's$=n$.nanoTime()',
          'end': 'r$=(n$.nanoTime()-s$)/1e9'
        });
      } else {
        extend(template, {
          'begin': 's$=n$()',
          'end': 'r$=n$(s$);r$=r$[0]+(r$[1]/1e9)'
        });
      }
    }
    else if (timer.unit == 'us') {
      if (timer.ns.stop) {
        extend(template, {
          'begin': 's$=n$.start()',
          'end': 'r$=n$.microseconds()/1e6'
        });
      } else if (perfName) {
        extend(template, {
          'begin': 's$=n$.' + perfName + '()',
          'end': 'r$=(n$.' + perfName + '()-s$)/1e3'
        });
      } else {
        extend(template, {
          'begin': 's$=n$()',
          'end': 'r$=(n$()-s$)/1e6'
        });
      }
    }

    // define `timer` methods
    timer.start = createFunction(preprocess('o$'),
      preprocess('var n$=this.ns,#{begin};o$.elapsed=0;o$.timeStamp=s$'));

    timer.stop = createFunction(preprocess('o$'),
      preprocess('var n$=this.ns,s$=o$.timeStamp,#{end};o$.elapsed=r$'));

    // resolve time span required to achieve a percent uncertainty of at most 1%
    // http://spiff.rit.edu/classes/phys273/uncert/uncert.html
    options.minTime || (options.minTime = max(timer.res / 2 / 0.01, 0.05));
    return clock.apply(null, arguments);
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Computes stats on benchmark results.
   *
   * @private
   * @param {Object} bench The benchmark instance.
   * @param {Object} options The options object.
   */
  function compute(bench, options) {
    options || (options = {});

    var async = options.async,
        elapsed = 0,
        initCount = bench.initCount,
        minSamples = bench.minSamples,
        queue = [],
        sample = bench.stats.sample;

    /**
     * Adds a clone to the queue.
     */
    function enqueue() {
      queue.push(bench.clone({
        '_original': bench,
        'events': {
          'abort': [update],
          'cycle': [update],
          'error': [update],
          'start': [update]
        }
      }));
    }

    /**
     * Updates the clone/original benchmarks to keep their data in sync.
     */
    function update(event) {
      var clone = this,
          type = event.type;

      if (bench.running) {
        if (type == 'start') {
          // Note: `clone.minTime` prop is inited in `clock()`
          clone.count = bench.initCount;
        }
        else {
          if (type == 'error') {
            bench.error = clone.error;
          }
          if (type == 'abort') {
            bench.abort();
            bench.emit('cycle');
          } else {
            event.currentTarget = event.target = bench;
            bench.emit(event);
          }
        }
      } else if (bench.aborted) {
        // clear abort listeners to avoid triggering bench's abort/cycle again
        clone.events.abort.length = 0;
        clone.abort();
      }
    }

    /**
     * Determines if more clones should be queued or if cycling should stop.
     */
    function evaluate(event) {
      var critical,
          df,
          mean,
          moe,
          rme,
          sd,
          sem,
          variance,
          clone = event.target,
          done = bench.aborted,
          now = +new Date,
          size = sample.push(clone.times.period),
          maxedOut = size >= minSamples && (elapsed += now - clone.times.timeStamp) / 1e3 > bench.maxTime,
          times = bench.times,
          varOf = function(sum, x) { return sum + pow(x - mean, 2); };

      // exit early for aborted or unclockable tests
      if (done || clone.hz == Infinity) {
        maxedOut = !(size = sample.length = queue.length = 0);
      }

      if (!done) {
        // sample mean (estimate of the population mean)
        mean = getMean(sample);
        // sample variance (estimate of the population variance)
        variance = reduce(sample, varOf, 0) / (size - 1) || 0;
        // sample standard deviation (estimate of the population standard deviation)
        sd = sqrt(variance);
        // standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean)
        sem = sd / sqrt(size);
        // degrees of freedom
        df = size - 1;
        // critical value
        critical = tTable[Math.round(df) || 1] || tTable.infinity;
        // margin of error
        moe = sem * critical;
        // relative margin of error
        rme = (moe / mean) * 100 || 0;

        extend(bench.stats, {
          'deviation': sd,
          'mean': mean,
          'moe': moe,
          'rme': rme,
          'sem': sem,
          'variance': variance
        });

        // Abort the cycle loop when the minimum sample size has been collected
        // and the elapsed time exceeds the maximum time allowed per benchmark.
        // We don't count cycle delays toward the max time because delays may be
        // increased by browsers that clamp timeouts for inactive tabs.
        // https://developer.mozilla.org/en/window.setTimeout#Inactive_tabs
        if (maxedOut) {
          // reset the `initCount` in case the benchmark is rerun
          bench.initCount = initCount;
          bench.running = false;
          done = true;
          times.elapsed = (now - times.timeStamp) / 1e3;
        }
        if (bench.hz != Infinity) {
          bench.hz = 1 / mean;
          times.cycle = mean * bench.count;
          times.period = mean;
        }
      }
      // if time permits, increase sample size to reduce the margin of error
      if (queue.length < 2 && !maxedOut) {
        enqueue();
      }
      // abort the invoke cycle when done
      event.aborted = done;
    }

    // init queue and begin
    enqueue();
    invoke(queue, {
      'name': 'run',
      'args': { 'async': async },
      'queued': true,
      'onCycle': evaluate,
      'onComplete': function() { bench.emit('complete'); }
    });
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Cycles a benchmark until a run `count` can be established.
   *
   * @private
   * @param {Object} clone The cloned benchmark instance.
   * @param {Object} options The options object.
   */
  function cycle(clone, options) {
    options || (options = {});

    var deferred;
    if (clone instanceof Deferred) {
      deferred = clone;
      clone = clone.benchmark;
    }

    var clocked,
        cycles,
        divisor,
        event,
        minTime,
        period,
        async = options.async,
        bench = clone._original,
        count = clone.count,
        times = clone.times;

    // continue, if not aborted between cycles
    if (clone.running) {
      // `minTime` is set to `Benchmark.options.minTime` in `clock()`
      cycles = ++clone.cycles;
      clocked = deferred ? deferred.elapsed : clock(clone);
      minTime = clone.minTime;

      if (cycles > bench.cycles) {
        bench.cycles = cycles;
      }
      if (clone.error) {
        event = Event('error');
        event.message = clone.error;
        clone.emit(event);
        if (!event.cancelled) {
          clone.abort();
        }
      }
    }

    // continue, if not errored
    if (clone.running) {
      // time taken to complete last test cycle
      bench.times.cycle = times.cycle = clocked;
      // seconds per operation
      period = bench.times.period = times.period = clocked / count;
      // ops per second
      bench.hz = clone.hz = 1 / period;
      // avoid working our way up to this next time
      bench.initCount = clone.initCount = count;
      // do we need to do another cycle?
      clone.running = clocked < minTime;

      if (clone.running) {
        // tests may clock at `0` when `initCount` is a small number,
        // to avoid that we set its count to something a bit higher
        if (!clocked && (divisor = divisors[clone.cycles]) != null) {
          count = floor(4e6 / divisor);
        }
        // calculate how many more iterations it will take to achive the `minTime`
        if (count <= clone.count) {
          count += Math.ceil((minTime - clocked) / period);
        }
        clone.running = count != Infinity;
      }
    }
    // should we exit early?
    event = Event('cycle');
    clone.emit(event);
    if (event.aborted) {
      clone.abort();
    }
    // figure out what to do next
    if (clone.running) {
      // start a new cycle
      clone.count = count;
      if (deferred) {
        clone.compiled.call(deferred, timer);
      } else if (async) {
        delay(clone, function() { cycle(clone, options); });
      } else {
        cycle(clone);
      }
    }
    else {
      // fix TraceMonkey bug associated with clock fallbacks
      // http://bugzil.la/509069
      if (support.browser) {
        runScript(uid + '=1;delete ' + uid);
      }
      // done
      clone.emit('complete');
    }
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Runs the benchmark.
   *
   * @memberOf Benchmark
   * @param {Object} [options={}] Options object.
   * @returns {Object} The benchmark instance.
   * @example
   *
   * // basic usage
   * bench.run();
   *
   * // or with options
   * bench.run({ 'async': true });
   */
  function run(options) {
    var me = this,
        event = Event('start');

    // set `running` to `false` so `reset()` won't call `abort()`
    me.running = false;
    me.reset();
    me.running = true;

    me.count = me.initCount;
    me.times.timeStamp = +new Date;
    me.emit(event);

    if (!event.cancelled) {
      options = { 'async': ((options = options && options.async) == null ? me.async : options) && support.timeout };

      // for clones created within `compute()`
      if (me._original) {
        if (me.defer) {
          Deferred(me);
        } else {
          cycle(me, options);
        }
      }
      // for original benchmarks
      else {
        compute(me, options);
      }
    }
    return me;
  }

  /*--------------------------------------------------------------------------*/

  // Firefox 1 erroneously defines variable and argument names of functions on
  // the function itself as non-configurable properties with `undefined` values.
  // The bugginess continues as the `Benchmark` constructor has an argument
  // named `options` and Firefox 1 will not assign a value to `Benchmark.options`,
  // making it non-writable in the process, unless it is the first property
  // assigned by for-in loop of `extend()`.
  extend(Benchmark, {

    /**
     * The default options copied by benchmark instances.
     *
     * @static
     * @memberOf Benchmark
     * @type Object
     */
    'options': {

      /**
       * A flag to indicate that benchmark cycles will execute asynchronously
       * by default.
       *
       * @memberOf Benchmark.options
       * @type Boolean
       */
      'async': false,

      /**
       * A flag to indicate that the benchmark clock is deferred.
       *
       * @memberOf Benchmark.options
       * @type Boolean
       */
      'defer': false,

      /**
       * The delay between test cycles (secs).
       * @memberOf Benchmark.options
       * @type Number
       */
      'delay': 0.005,

      /**
       * Displayed by Benchmark#toString when a `name` is not available
       * (auto-generated if absent).
       *
       * @memberOf Benchmark.options
       * @type String
       */
      'id': undefined,

      /**
       * The default number of times to execute a test on a benchmark's first cycle.
       *
       * @memberOf Benchmark.options
       * @type Number
       */
      'initCount': 1,

      /**
       * The maximum time a benchmark is allowed to run before finishing (secs).
       * Note: Cycle delays aren't counted toward the maximum time.
       *
       * @memberOf Benchmark.options
       * @type Number
       */
      'maxTime': 5,

      /**
       * The minimum sample size required to perform statistical analysis.
       *
       * @memberOf Benchmark.options
       * @type Number
       */
      'minSamples': 5,

      /**
       * The time needed to reduce the percent uncertainty of measurement to 1% (secs).
       *
       * @memberOf Benchmark.options
       * @type Number
       */
      'minTime': 0,

      /**
       * The name of the benchmark.
       *
       * @memberOf Benchmark.options
       * @type String
       */
      'name': undefined,

      /**
       * An event listener called when the benchmark is aborted.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onAbort': undefined,

      /**
       * An event listener called when the benchmark completes running.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onComplete': undefined,

      /**
       * An event listener called after each run cycle.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onCycle': undefined,

      /**
       * An event listener called when a test errors.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onError': undefined,

      /**
       * An event listener called when the benchmark is reset.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onReset': undefined,

      /**
       * An event listener called when the benchmark starts running.
       *
       * @memberOf Benchmark.options
       * @type Function
       */
      'onStart': undefined
    },

    /**
     * Platform object with properties describing things like browser name,
     * version, and operating system.
     *
     * @static
     * @memberOf Benchmark
     * @type Object
     */
    'platform': req('platform') || window.platform || {

      /**
       * The platform description.
       *
       * @memberOf Benchmark.platform
       * @type String
       */
      'description': window.navigator && navigator.userAgent || null,

      /**
       * The name of the browser layout engine.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'layout': null,

      /**
       * The name of the product hosting the browser.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'product': null,

      /**
       * The name of the browser/environment.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'name': null,

      /**
       * The name of the product's manufacturer.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'manufacturer': null,

      /**
       * The name of the operating system.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'os': null,

      /**
       * The alpha/beta release indicator.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'prerelease': null,

      /**
       * The browser/environment version.
       *
       * @memberOf Benchmark.platform
       * @type String|Null
       */
      'version': null,

      /**
       * Return platform description when the platform object is coerced to a string.
       *
       * @memberOf Benchmark.platform
       * @type Function
       * @returns {String} The platform description.
       */
      'toString': function() {
        return this.description || '';
      }
    },

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf Benchmark
     * @type String
     */
    'version': '1.0.0',

    // an object of environment/feature detection flags
    'support': support,

    // clone objects
    'deepClone': deepClone,

    // iteration utility
    'each': each,

    // augment objects
    'extend': extend,

    // generic Array#filter
    'filter': filter,

    // generic Array#forEach
    'forEach': forEach,

    // generic own property iteration utility
    'forOwn': forOwn,

    // converts a number to a comma-separated string
    'formatNumber': formatNumber,

    // generic Object#hasOwnProperty
    // (trigger hasKey's lazy define before assigning it to Benchmark)
    'hasKey': (hasKey(Benchmark, ''), hasKey),

    // generic Array#indexOf
    'indexOf': indexOf,

    // template utility
    'interpolate': interpolate,

    // invokes a method on each item in an array
    'invoke': invoke,

    // generic Array#join for arrays and objects
    'join': join,

    // generic Array#map
    'map': map,

    // retrieves a property value from each item in an array
    'pluck': pluck,

    // generic Array#reduce
    'reduce': reduce
  });

  /*--------------------------------------------------------------------------*/

  extend(Benchmark.prototype, {

    /**
     * The number of times a test was executed.
     *
     * @memberOf Benchmark
     * @type Number
     */
    'count': 0,

    /**
     * The number of cycles performed while benchmarking.
     *
     * @memberOf Benchmark
     * @type Number
     */
    'cycles': 0,

    /**
     * The number of executions per second.
     *
     * @memberOf Benchmark
     * @type Number
     */
    'hz': 0,

    /**
     * The compiled test function.
     *
     * @memberOf Benchmark
     * @type Function|String
     */
    'compiled': undefined,

    /**
     * The error object if the test failed.
     *
     * @memberOf Benchmark
     * @type Object
     */
    'error': undefined,

    /**
     * The test to benchmark.
     *
     * @memberOf Benchmark
     * @type Function|String
     */
    'fn': undefined,

    /**
     * A flag to indicate if the benchmark is aborted.
     *
     * @memberOf Benchmark
     * @type Boolean
     */
    'aborted': false,

    /**
     * A flag to indicate if the benchmark is running.
     *
     * @memberOf Benchmark
     * @type Boolean
     */
    'running': false,

    /**
     * Compiled into the test and executed immediately **before** the test loop.
     *
     * @memberOf Benchmark
     * @type Function|String
     * @example
     *
     * // basic usage
     * var bench = Benchmark({
     *   'setup': function() {
     *     var c = this.count,
     *         element = document.getElementById('container');
     *     while (c--) {
     *       element.appendChild(document.createElement('div'));
     *     }
     *   },
     *   'fn': function() {
     *     element.removeChild(element.lastChild);
     *   }
     * });
     *
     * // compiles to something like:
     * var c = this.count,
     *     element = document.getElementById('container');
     * while (c--) {
     *   element.appendChild(document.createElement('div'));
     * }
     * var start = new Date;
     * while (count--) {
     *   element.removeChild(element.lastChild);
     * }
     * var end = new Date - start;
     *
     * // or using strings
     * var bench = Benchmark({
     *   'setup': '\
     *     var a = 0;\n\
     *     (function() {\n\
     *       (function() {\n\
     *         (function() {',
     *   'fn': 'a += 1;',
     *   'teardown': '\
     *          }())\n\
     *        }())\n\
     *      }())'
     * });
     *
     * // compiles to something like:
     * var a = 0;
     * (function() {
     *   (function() {
     *     (function() {
     *       var start = new Date;
     *       while (count--) {
     *         a += 1;
     *       }
     *       var end = new Date - start;
     *     }())
     *   }())
     * }())
     */
    'setup': noop,

    /**
     * Compiled into the test and executed immediately **after** the test loop.
     *
     * @memberOf Benchmark
     * @type Function|String
     */
    'teardown': noop,

    /**
     * An object of stats including mean, margin or error, and standard deviation.
     *
     * @memberOf Benchmark
     * @type Object
     */
    'stats': {

      /**
       * The margin of error.
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'moe': 0,

      /**
       * The relative margin of error (expressed as a percentage of the mean).
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'rme': 0,

      /**
       * The standard error of the mean.
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'sem': 0,

      /**
       * The sample standard deviation.
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'deviation': 0,

      /**
       * The sample arithmetic mean.
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'mean': 0,

      /**
       * The array of sampled periods.
       *
       * @memberOf Benchmark#stats
       * @type Array
       */
      'sample': [],

      /**
       * The sample variance.
       *
       * @memberOf Benchmark#stats
       * @type Number
       */
      'variance': 0
    },

    /**
     * An object of timing data including cycle, elapsed, period, start, and stop.
     *
     * @memberOf Benchmark
     * @type Object
     */
    'times': {

      /**
       * The time taken to complete the last cycle (secs).
       *
       * @memberOf Benchmark#times
       * @type Number
       */
      'cycle': 0,

      /**
       * The time taken to complete the benchmark (secs).
       *
       * @memberOf Benchmark#times
       * @type Number
       */
      'elapsed': 0,

      /**
       * The time taken to execute the test once (secs).
       *
       * @memberOf Benchmark#times
       * @type Number
       */
      'period': 0,

      /**
       * A timestamp of when the benchmark started (ms).
       *
       * @memberOf Benchmark#times
       * @type Number
       */
      'timeStamp': 0
    },

    // aborts benchmark (does not record times)
    'abort': abort,

    // creates a new benchmark using the same test and options
    'clone': clone,

    // compares benchmark's hertz with another
    'compare': compare,

    // executes listeners
    'emit': emit,

    // get listeners
    'listeners': listeners,

    // unregister listeners
    'off': off,

    // register listeners
    'on': on,

    // reset benchmark properties
    'reset': reset,

    // runs the benchmark
    'run': run,

    // pretty print benchmark info
    'toString': toStringBench
  });

  /*--------------------------------------------------------------------------*/

  extend(Deferred.prototype, {

    /**
     * The deferred benchmark instance.
     *
     * @memberOf Benchmark.Deferred
     * @type Object
     */
    'benchmark': null,

    /**
     * The number of deferred cycles performed while benchmarking.
     *
     * @memberOf Benchmark.Deferred
     * @type Number
     */
    'cycles': 0,

    /**
     * The time taken to complete the deferred benchmark (secs).
     *
     * @memberOf Benchmark.Deferred
     * @type Number
     */
    'elapsed': 0,

    /**
     * A timestamp of when the deferred benchmark started (ms).
     *
     * @memberOf Benchmark.Deferred
     * @type Number
     */
    'timeStamp': 0,

    // cycles/completes the deferred benchmark
    'resolve': resolve
  });

  /*--------------------------------------------------------------------------*/

  extend(Event.prototype, {

    /**
     * A flag to indicate if the emitters listener iteration is aborted.
     *
     * @memberOf Benchmark.Event
     * @type Boolean
     */
    'aborted': false,

    /**
     * A flag to indicate if the default action is cancelled.
     *
     * @memberOf Benchmark.Event
     * @type Boolean
     */
    'cancelled': false,

    /**
     * The object whose listeners are currently being processed.
     *
     * @memberOf Benchmark.Event
     * @type Object
     */
    'currentTarget': undefined,

    /**
     * The return value of the last executed listener.
     *
     * @memberOf Benchmark.Event
     * @type Mixed
     */
    'result': undefined,

    /**
     * The object to which the event was originally emitted.
     *
     * @memberOf Benchmark.Event
     * @type Object
     */
    'target': undefined,

    /**
     * A timestamp of when the event was created (ms).
     *
     * @memberOf Benchmark.Event
     * @type Number
     */
    'timeStamp': 0,

    /**
     * The event type.
     *
     * @memberOf Benchmark.Event
     * @type String
     */
    'type': ''
  });

  /*--------------------------------------------------------------------------*/

  /**
   * The default options copied by suite instances.
   *
   * @static
   * @memberOf Benchmark.Suite
   * @type Object
   */
  Suite.options = {

    /**
     * The name of the suite.
     *
     * @memberOf Benchmark.Suite.options
     * @type String
     */
    'name': undefined
  };

  /*--------------------------------------------------------------------------*/

  extend(Suite.prototype, {

    /**
     * The number of benchmarks in the suite.
     *
     * @memberOf Benchmark.Suite
     * @type Number
     */
    'length': 0,

    /**
     * A flag to indicate if the suite is aborted.
     *
     * @memberOf Benchmark.Suite
     * @type Boolean
     */
    'aborted': false,

    /**
     * A flag to indicate if the suite is running.
     *
     * @memberOf Benchmark.Suite
     * @type Boolean
     */
    'running': false,

    /**
     * An `Array#forEach` like method.
     * Callbacks may terminate the loop by explicitly returning `false`.
     *
     * @memberOf Benchmark.Suite
     * @param {Function} callback The function called per iteration.
     * @returns {Object} The suite iterated over.
     */
    'forEach': methodize(forEach),

    /**
     * An `Array#indexOf` like method.
     *
     * @memberOf Benchmark.Suite
     * @param {Mixed} value The value to search for.
     * @returns {Number} The index of the matched value or `-1`.
     */
    'indexOf': methodize(indexOf),

    /**
     * Invokes a method on all benchmarks in the suite.
     *
     * @memberOf Benchmark.Suite
     * @param {String|Object} name The name of the method to invoke OR options object.
     * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
     * @returns {Array} A new array of values returned from each method invoked.
     */
    'invoke': methodize(invoke),

    /**
     * Converts the suite of benchmarks to a string.
     *
     * @memberOf Benchmark.Suite
     * @param {String} [separator=','] A string to separate each element of the array.
     * @returns {String} The string.
     */
    'join': [].join,

    /**
     * An `Array#map` like method.
     *
     * @memberOf Benchmark.Suite
     * @param {Function} callback The function called per iteration.
     * @returns {Array} A new array of values returned by the callback.
     */
    'map': methodize(map),

    /**
     * Retrieves the value of a specified property from all benchmarks in the suite.
     *
     * @memberOf Benchmark.Suite
     * @param {String} property The property to pluck.
     * @returns {Array} A new array of property values.
     */
    'pluck': methodize(pluck),

    /**
     * Removes the last benchmark from the suite and returns it.
     *
     * @memberOf Benchmark.Suite
     * @returns {Mixed} The removed benchmark.
     */
    'pop': [].pop,

    /**
     * Appends benchmarks to the suite.
     *
     * @memberOf Benchmark.Suite
     * @returns {Number} The suite's new length.
     */
    'push': [].push,

    /**
     * Sorts the benchmarks of the suite.
     *
     * @memberOf Benchmark.Suite
     * @param {Function} [compareFn=null] A function that defines the sort order.
     * @returns {Object} The sorted suite.
     */
    'sort': [].sort,

    /**
     * An `Array#reduce` like method.
     *
     * @memberOf Benchmark.Suite
     * @param {Function} callback The function called per iteration.
     * @param {Mixed} accumulator Initial value of the accumulator.
     * @returns {Mixed} The accumulator.
     */
    'reduce': methodize(reduce),

    // aborts all benchmarks in the suite
    'abort': abortSuite,

    // adds a benchmark to the suite
    'add': add,

    // creates a new suite with cloned benchmarks
    'clone': cloneSuite,

    // executes listeners of a specified type
    'emit': emit,

    // creates a new suite of filtered benchmarks
    'filter': filterSuite,

    // get listeners
    'listeners': listeners,

    // unregister listeners
    'off': off,

   // register listeners
    'on': on,

    // resets all benchmarks in the suite
    'reset': resetSuite,

    // runs all benchmarks in the suite
    'run': runSuite,

    // array methods
    'concat': concat,

    'reverse': reverse,

    'shift': shift,

    'slice': slice,

    'splice': splice,

    'unshift': unshift
  });

  /*--------------------------------------------------------------------------*/

  // expose Deferred, Event and Suite
  extend(Benchmark, {
    'Deferred': Deferred,
    'Event': Event,
    'Suite': Suite
  });

  // expose Benchmark
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // define as an anonymous module so, through path mapping, it can be aliased
    define(function() {
      return Benchmark;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports) {
    // in Node.js or RingoJS v0.8.0+
    if (typeof module == 'object' && module && module.exports == freeExports) {
      (module.exports = Benchmark).Benchmark = Benchmark;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports.Benchmark = Benchmark;
    }
  }
  // in a browser or Rhino
  else {
    // use square bracket notation so Closure Compiler won't munge `Benchmark`
    // http://code.google.com/closure/compiler/docs/api-tutorial3.html#export
    window['Benchmark'] = Benchmark;
  }

  // trigger clock's lazy define early to avoid a security error
  if (support.air) {
    clock({ '_original': { 'fn': noop, 'count': 1, 'options': {} } });
  }
}(this));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":17}],17:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
