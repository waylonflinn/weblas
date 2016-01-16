var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

/*  run in a browser with testling

		browserify test/*.js | testling -x google-chrome

	on Ubuntu, requires

		sudo apt-get install xvfb
 */


var RTOL = 1e-05,
	ATOL = 1e-12;

var dataDirectory = 'test/data/sgemm/',
	testFile = 'small.json';

if(window)
	console.log("# User Agent: " + window.navigator.userAgent);

var debugInfo = weblas.gl.context.getExtension('WEBGL_debug_renderer_info');
if(debugInfo)
	console.log("# Renderer:              \t" + weblas.gl.context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));

console.log("# OES_float_texture support: \t" + (weblas.gl.hasFloat ? "YES" : "NO"));
console.log("# MAX_TEXTURE_SIZE:      \t" + weblas.gl.context.getParameter(weblas.gl.context.MAX_TEXTURE_SIZE));
console.log("# MAX_RENDERBUFFER_SIZE: \t" + weblas.gl.context.getParameter(weblas.gl.context.MAX_RENDERBUFFER_SIZE));
console.log("# highp support:         \t" + (weblas.gl.hasHighPrecision ? "YES" : "NO"));
console.log("# highp.precision:       \t" + JSON.stringify(weblas.gl.highp.precision));


var matrixFiles = ['a.json', 'b.json', 'out.json'];

function generateTestCase(prefix, m, n, k, alpha){
	return function(t){
		t.plan(1);

		var A, B, expected; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var a = matrices[0],
				b = matrices[1],
				out = matrices[2];

			if(!(a && a.length && a.length == m * k &&
				b && b.length && b.length == k * n &&
				out && out.length && out.length == m * n)){

				throw new Error("malformed data");
			}

			A = new Float32Array(a);
			B = new Float32Array(b);
			expected = new Float32Array(out);

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

loader.load(dataDirectory + testFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(var i = 0; i < suite.length; i++){

		directory = String("0000" + (i + 1)).slice(-4);

		var test = suite[i];
		test['arg'] = test['arg'] || {};

		var input = test['in'],
			sizes = input['shape'];

		var m = input[0]['shape'][0],
			n = input[1]['shape'][1],
			k = input[0]['shape'][1],
			alpha = test['arg']['alpha'] || 1.0;

		var testName = "sgemm: " + m + "x" + k + " . " + k + "x" + n;
		tape(testName, generateTestCase(directory, m, n, k, alpha));
	}

});
