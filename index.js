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
