var WebGL = require("./lib/webgl"),
    SGEMMCalculator = require("./lib/sgemmcalculator"),
    test = require("./lib/test");



var gl = new WebGL(),
    gemm = new SGEMMCalculator(gl);


module.exports = {
    "sgemm" : gemm.calculate.bind(gemm),
    "saxpy" : saxpy,
    "gl" : gl,
    "util" : { "fromArray" : fromArray, "transpose" : transpose},
    "test" : test
};

function saxpy(n, a, x, y){
    var i = 0,
        result = new Float32Array(n);

    // assert n = a.length
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

}

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
