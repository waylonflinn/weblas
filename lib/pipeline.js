var globals = require('./globals'),
	SGEMMCalculator = require("./sgemmcalculator"),
	SAXPYCalculator = require("./saxpycalculator"),
	SSCALCalculator = require("./sscalcalculator"),
	SDWNSCalculator = require("./sdwnscalculator"),
	SCLMPCalculator = require("./sclmpcalculator"),
	Tensor = require('./tensor');


var gl = globals.gl,
	sgemmcalculator = new SGEMMCalculator(gl, false),
	saxpycalculator = new SAXPYCalculator(gl, false),
	sscalcalculator = new SSCALCalculator(gl, false),
	sdwnscalculator = new SDWNSCalculator(gl, false),
	sclmpcalculator = new SCLMPCalculator(gl, false);

module.exports = {
	"Tensor" : Tensor,
	"sscal" : sscal,
	"sgemm" : sgemm,
	"sdwns" : sdwns,
	"sclmp" : sclmp,

	"sgemmcalculator" : sgemmcalculator,
	"saxpycalculator" : saxpycalculator,
	"sscalcalculator" : sscalcalculator,
	"sdwnscalculator" : sdwnscalculator,
	"sclmpcalculator" : sclmpcalculator
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
