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

/* matrix multiply on t0 and t1 with additive t2. t1 must be tranposed
 */
function sgemm(alpha, t0, t1, beta, t2){

	if(t1.shape[1] !== t0.shape[1])
		throw new Error("Second dimension must be of same size for input Tensors (second tensor is tranposed).");

	var M = t0.shape[0],
		N = t1.shape[0],
		K = t0.shape[1];

	t2 = t2 || { "texture" : null };

	// create an empty output Tensor
	var tOut = new Tensor([M, N], null);

	sgemmcalculator.calculate(M, N, K, alpha, t0.texture, t1.texture, beta, t2.texture, tOut.texture);

	return tOut;
}
