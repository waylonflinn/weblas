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

var CHANNELS_PER_TEXEL = 4;

/* Wrap the GL calculation object in a (relatively) user friendly function that
    accepts TypedArrays

    * pack the data
    * convert to textures in GPU memory
    * execute calculation
    * read result into an array, and return
 */
function sgemm(M, N, K, alpha, A, B, beta, C){

    // pack each matrix into a single RGBA texel array, with the second transposed
    var texels0 = packData(M, K, A, false),
    	texels1 = packData(K, N, B, true);

    var mod = (K % CHANNELS_PER_TEXEL),
    	pad = mod == 0 ? 0 : CHANNELS_PER_TEXEL - mod;

    // create input textures from data
    var texture0 = gl.createInputTexture(M, K + pad, texels0);
    var texture1 = gl.createInputTexture(N, K + pad, texels1);

    var destTexture = gl.createDestinationTexture(M, N);

    sgemmcalculator.calculate(M, N, K + pad, alpha, texture0, texture1, null, destTexture);

    return new Float32Array(gl.readData(M, N));

}

function saxpy(N, a, X, Y){

    var rawBuffer;

	var mod = (N % CHANNELS_PER_TEXEL),
		pad = mod == 0 ? 0 : CHANNELS_PER_TEXEL - mod;

    // replace with ArrayBuffer.transfer, when available
	var texels0,// = new Float32Array(N + pad);//packData(1, N, X, false),
		texels1;// = new Float32Array(N + pad);//packData(1, N, Y, false);


    if(pad == 0){
        texels0 = X;
    } else {
        texels0 = new Float32Array(N + pad);
        texels0.set(X);
    }
    texels1 = new Float32Array(N + pad);
    texels1.fill(Y);

    // create input textures from data
    var texture0 = gl.createInputTexture(1, N + pad, texels0);
    var texture1 = gl.createInputTexture(1, N + pad, texels1);

    var destTexture = gl.createDestinationTexture(1, N + pad);

    saxpycalculator.calculate(N + pad, a, texture0, texture1, destTexture);

    rawBuffer = gl.readData(1, N);
    return new Float32Array(rawBuffer);

}
/*
    load textures
    pass to sgemmcalculator shader
    run floatdecode shader
    return extracted result
 */
/* Pack the given matrix data into texel layout for use by texture shader.

   This layout places consecutive elements of the input data into separate
   channels, padding to a multiple of four (with zeros) where necessary to fill
   out the final RGBA texel in a column.

   r - row count
   c - column count
   data - TypedArray containing matrix data
   transpose - whether or not to transpose the data when packing
 */
function packData(r, c, data, transpose) {

	var CHANNELS_PER_TEXEL = 4; // RGBA: four channels, one per color

	var k = !transpose ? c : r,
        isArray = isFloat32Array(data);

	var mod = (k % CHANNELS_PER_TEXEL),
		pad = mod == 0 ? 0 : CHANNELS_PER_TEXEL - mod;

	if (mod === 0 && !transpose && isArray) {
		// special case if column count is a multiple of number of channels
		return data;
	}

	// dimensions
	var i, j, p;

	var texelcount = !transpose ? r*(c + pad) : c*(r + pad);

	// create Float32Array to hold padded texel data
	var texels = new Float32Array(texelcount);

	for(i = 0; i < r; i++){

		if(!transpose){

            if(isArray){
    			// copy actual data
    			for(j = 0; j < c; j++){
    				texels[i * (c + pad) + j] = data[i * c + j];
    			}
            } else {
    			// assume it's a constant
    			for(j = 0; j < c; j++){
    				texels[i * (c + pad) + j] = data;
    			}
            }

			// pad last texel in this row with zeros
			for(p = 0; p < pad; p++){
				texels[i * (c + pad) + j + p] = 0.0;
			}
		} else {

			// copy actual data, transposed
			for(j = 0; j < c; j++){
				texels[j * (r + pad) + i] = data[i * c + j];
			}

			// pad last texel in this row with zeros
			for(p = 0; p < pad; p++){
				texels[j * (r + pad) + i + p] = 0.0;
			}

		}

	}

	return texels;
};

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
