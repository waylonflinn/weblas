var tape = require('tape'),
	test = require('../index').test,
	WebGL = require('../index').WebGL,
	GEMMFloatCalculator = require("../index").GEMMFloatCalculator;

/*  run in a browser with testling

		browserify test/*.js | testling -x google-chrome

	on Ubuntu, requires

		sudo apt-get install xvfb
 */

var webgl = new WebGL(),
	calculator = new GEMMFloatCalculator(webgl);

var dataDirectory = 'test/data/';

var highp = webgl.context.getShaderPrecisionFormat(webgl.context.FRAGMENT_SHADER, webgl.context.HIGH_FLOAT);

if(highp.precision == 0)
	console.log("# high precision not supported, expect precision related failures.");

function generateTestCase(prefix){
	return function(t){
		t.plan(1);

		var A, B, C; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		test.load(testDirectory, function(err, a, b, c){

			if(!(a[0] && a[0].length && b && a[0].length == b.length
				&& a.length == c.length && b[0].length == c[0].length ))
				throw new Error("malformed data");

			A = WebGL.fromArray(a);
			B = WebGL.fromArray(b);
			C = WebGL.fromArray(c);

			var m = a.length,
				k = b.length,
				n = b[0].length,
				alpha = 1.0,
				beta = 0.0;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = calculator.calculate(m, n, k, alpha, A, B, beta, null);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			t.assert(test.allclose(C, result), "allclose");
		});
	};
}

var suite = require('./data/small.json');

// suite configuration file uses directory name as key
for(directory in suite){

	var m = suite[directory][0],
		n = suite[directory][1],
		k = suite[directory][2];

	tape(m + "x" + k + " times " + k + "x" + n, generateTestCase(directory));
}
