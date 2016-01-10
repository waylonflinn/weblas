var WebGL = require("./lib/webgl"),
    SGEMMCalculator = require("./lib/sgemmcalculator"),
    SAXPYCalculator = require("./lib/saxpycalculator"),
    test = require("./lib/test");



var gl = new WebGL(),
    sgemmcalculator = new SGEMMCalculator(gl),
    saxpycalculator = new SAXPYCalculator(gl);


module.exports = {
    "sgemm" : sgemm,
    "saxpy" : saxpy,
    "gl" : gl,
    "util" : { "fromArray" : fromArray, "transpose" : transpose},
    "test" : test
};

// RGBA is the standard input/ouput texture
var COMPONENTS_PER_TEXEL = 4;

/* Wrap the GL calculation object in a (relatively) user friendly function that
    accepts TypedArrays

    * pack the data
    * convert to textures in GPU memory
    * execute calculation
    * read result into an array, and return
 */
function sgemm(M, N, K, alpha, A, B, beta, C){

    // pack each matrix into a single RGBA texel array, with the second transposed
    var texels0 = A,
    	texels1;

    var rem = (K % COMPONENTS_PER_TEXEL),
    	pad = rem == 0 ? 0 : COMPONENTS_PER_TEXEL - rem;

    texels1 = transpose(K, N, B);

    // create input textures from data
    var texture0 = gl.createDataTexture(M, K, texels0);
    var texture1 = gl.createDataTexture(N, K, texels1);

    var texture3 = gl.createOutputTexture(M, N);

    sgemmcalculator.calculate(M, N, K + pad, alpha, texture0, texture1, null, null, texture3);

    // retrieve data
    rawBuffer = gl.readData(M, N);

    // clean up
    gl.context.deleteTexture(texture0);
    gl.context.deleteTexture(texture1);
    gl.context.deleteTexture(texture3);

    // return result
    return new Float32Array(rawBuffer);

}

function saxpy(N, a, X, Y){

    var rawBuffer;

	var mod = (N % COMPONENTS_PER_TEXEL),
		pad = mod == 0 ? 0 : COMPONENTS_PER_TEXEL - mod;

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

    var texture3 = gl.createOutputTexture(1, N + pad);

    saxpycalculator.calculate(N + pad, a, texture0, texture1, texture3);

    // retrieve data
    rawBuffer = gl.readData(1, N);

    // clean up
    gl.context.deleteTexture(texture0);
    gl.context.deleteTexture(texture1);
    gl.context.deleteTexture(texture3);

    // return result
    return new Float32Array(rawBuffer);

}
/*
    load textures
    pass to sgemmcalculator shader
    run floatdecode shader
    return extracted result
 */
function isFloat32Array(obj) { return Object.prototype.toString.call(obj) === "[object Float32Array]"; }


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
