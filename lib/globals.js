var WebGL = require("./webgl"),
	SGEMMCalculator = require("./sgemmcalculator"),
	SAXPYCalculator = require("./saxpycalculator"),
	SSCALCalculator = require("./sscalcalculator"),
	SDWNSCalculator = require("./sdwnscalculator"),
	SCLMPCalculator = require("./sclmpcalculator");

var gl = new WebGL();

module.exports = {

	"gl" : gl,

	"sgemmcalculator" : new SGEMMCalculator(gl),
	"saxpycalculator" : new SAXPYCalculator(gl),
	"sscalcalculator" : new SSCALCalculator(gl),
	"sdwnscalculator" : new SDWNSCalculator(gl),
	"sclmpcalculator" : new SCLMPCalculator(gl),

	"pipeline_sscal" : new SSCALCalculator(gl, false),
	"pipeline_sclmp" : new SCLMPCalculator(gl, false),
	"pipeline_sdwns" : new SDWNSCalculator(gl, false),
	"pipeline_sgemm" : new SGEMMCalculator(gl, false)
}
