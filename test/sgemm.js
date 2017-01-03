var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');

/*  run in a browser with testling

		browserify test/*.js | testling -x google-chrome

	on Ubuntu, requires

		sudo apt-get install xvfb
 */


var RTOL = 1e-05,
	ATOL = 1e-12;

var dataDirectory = 'test/data/sgemm/',
	testFile = 'small.json';

var gl = weblas.gpu.gl;

if(window)
	console.log("# User Agent: " + window.navigator.userAgent);

var debugInfo = weblas.gpu.gl.context.getExtension('WEBGL_debug_renderer_info');
if(debugInfo)
	console.log("# Renderer:              \t" + gl.context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));

console.log("# OES_float_texture support: \t" + (gl.hasFloat ? "YES" : "NO"));
console.log("# MAX_TEXTURE_SIZE:      \t" + gl.context.getParameter(gl.context.MAX_TEXTURE_SIZE));
console.log("# MAX_RENDERBUFFER_SIZE: \t" + gl.context.getParameter(gl.context.MAX_RENDERBUFFER_SIZE));
console.log("# highp support:         \t" + (gl.hasHighPrecision ? "YES" : "NO"));
console.log("# highp.precision:       \t" + JSON.stringify(gl.highp.precision));


var matrixFiles = ['a.arr', 'b.arr', 'out.arr'];

function generateTestCase(prefix, m, n, k, alpha){
	return function(t){
		t.plan(1);

		var A, B, expected; // typed arrays

		// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var A = matrices[0],
				B = matrices[1],
				expected = matrices[2];

			if(!(A && A.length && A.length == m * k &&
				B && B.length && B.length == k * n &&
				expected && expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			var beta = 0.0;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sgemm(m, n, k, alpha, A, B, beta, null);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
		});
	};
}

var extendedMatrixFiles = ['a.arr', 'b.arr', 'c.arr', 'out.arr'];

function generateExtendedTestCase(prefix, m, n, k, alpha, beta, transposed){
	return function(t){
		t.plan(1);

		var A, B, C, expected; // typed arrays

		// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, extendedMatrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var A = matrices[0],
				B = matrices[1],
				C = matrices[2],
				expected = matrices[3];

			if(!(A && A.length && A.length == m * k &&
				B && B.length && B.length == k * n &&
				expected && expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			if(transposed){
				B = weblas.util.transpose(n, k, B);
			}

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sgemm(m, n, k, alpha, A, B, beta, C);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
		});
	};
}

loader.load(dataDirectory + testFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(var i = 0; i < suite.length; i++){

		directory = String("0000" + (i + 1)).slice(-4);

		var test = suite[i];

		var input = test['in'],
			arg = test['arg'] || {};

		// get base matrix dimensions
		var m1 = input[0]['shape'][0],
			n1 = input[0]['shape'][1],
			m2 = input[1]['shape'][0],
			n2 = input[1]['shape'][1];

		var m = m1,
			transposed;

		// is the second matrix already transposed?
		if(n1 === m2){
			transposed = false;
			k = m2;
			n = n2;
		} else if(n1 === n2){
			transposed = true;
			k = n2;
			n = m2;
		} else {
			throw new Error("Matrices not compatible");
		}

		var alpha = (arg['alpha'] != null) ? arg['alpha'] : 1.0,
			beta = (arg['beta'] != null) ? arg['beta'] : 1.0;

		var testName = "sgemm: " + m + "x" + k + " . " + k + "x" + n;
		if(input.length == 2){
			tape(testName, generateTestCase(directory, m, n, k, alpha, null, transposed));
		} else {
			testName += " + 1x" + n;
			tape(testName, generateExtendedTestCase(directory, m, n, k, alpha, beta, transposed));
		}
	}

});
