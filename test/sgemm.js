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


var matrixFiles = ['a.json', 'b.json', 'c.json'];

function generateTestCase(prefix, alpha){
	return function(t){
		t.plan(1);

		var A, B, C; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var a = matrices[0],
				b = matrices[1],
				c = matrices[2];

			if(!(a[0] && a[0].length && b && a[0].length == b.length
				&& a.length == c.length && b[0].length == c[0].length ))
				throw new Error("malformed data");

			A = weblas.util.fromArray(a);
			B = weblas.util.fromArray(b);
			C = weblas.util.fromArray(c);

			var m = a.length,
				k = b.length,
				n = b[0].length,
				beta = 0.0;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sgemm(m, n, k, alpha, A, B, beta, null);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, C, null, RTOL, ATOL);
		});
	};
}

loader.load(dataDirectory + testFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(directory in suite){

		var sizes = suite[directory]['sizes'];

		var m = sizes[0],
			n = sizes[1],
			k = sizes[2],
			alpha = suite[directory]['alpha'] || 1.0;

		tape("sgemm: " + m + "x" + k + " . " + k + "x" + n, generateTestCase(directory, alpha));
	}

});
