var WebGL = require("./lib/webgl"),
    GEMMFloatCalculator = require("./lib/gemmfloatcalculator"),
    test = require("./lib/test");



var gl = new WebGL(),
    gemm = new GEMMFloatCalculator(gl);


module.exports = {
    "sgemm" : gemm.calculate.bind(gemm),
    "gl" : gl,
    "util" : { "fromArray" : fromArray},
    "test" : test
};


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
