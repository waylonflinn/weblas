var tape = require('tape'),
	test = require('../index').test,
	WebGL = require('../index').WebGL,
	GEMMFloatCalculator = require("../index").GEMMFloatCalculator,
	loader = require('floader'); // browserify aware file loader (xhr in browser)

// First, checks if it isn't implemented yet.
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
/*  run in a browser with testling

		browserify test/*.js | testling -x google-chrome

	on Ubuntu, requires

		sudo apt-get install xvfb
 */

var webgl = new WebGL(),
	calculator = new GEMMFloatCalculator(webgl);

var RTOL = 1e-05,
	ATOL = 1e-12;

var dataDirectory = 'test/data/';

if(window)
	console.log("# User Agent: " + window.navigator.userAgent);

var debugInfo = webgl.context.getExtension('WEBGL_debug_renderer_info');
if(debugInfo)
	console.log("# Renderer:              \t" + webgl.context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));

console.log("# OES_float_texture support: \t" + (webgl.hasFloat ? "YES" : "NO"));
console.log("# MAX_TEXTURE_SIZE:      \t" + webgl.context.getParameter(webgl.context.MAX_TEXTURE_SIZE));
console.log("# MAX_RENDERBUFFER_SIZE: \t" + webgl.context.getParameter(webgl.context.MAX_RENDERBUFFER_SIZE));
console.log("# highp support:         \t" + (webgl.hasHighPrecision ? "YES" : "NO"));
console.log("# highp.precision:       \t" + JSON.stringify(webgl.highp.precision));


function generateTestCase(prefix, alpha){
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
				beta = 0.0;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = calculator.calculate(m, n, k, alpha, A, B, beta, null);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			allclose(t, result, C);
		});
	};
}

/* create a tape compatible assert */
function allclose(t, a, b, msg, extra) {

	var ok = test.allclose(a, b, RTOL, ATOL),
		actual = "[..., ",
		expected = "[..., ";

	if(!ok.result){
		for(var i = ok.index; i < ok.index + 4 && i < a.length; i++ ){
			actual += a[i] + ", ";
			expected += b[i] + ", ";
		}
		actual += "...]";
		expected += "...]";
		msg = msg || 'should be allclose at ' + ok.index;
	}

    t._assert(ok.result, {
        message : msg || 'should be allclose',
        operator : 'allclose',
        actual : actual,
        expected : expected,
        extra : extra
    });
}


var configFile = 'small.json';

loader.load(dataDirectory + configFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(directory in suite){

		var sizes = suite[directory]['sizes'];

		var m = sizes[0],
			n = sizes[1],
			k = sizes[2],
			alpha = suite[directory]['alpha'] || 1.0;

		tape(m + "x" + k + " . " + k + "x" + n, generateTestCase(directory, alpha));
	}

});
