var tape = require('tape'),
	async = require('async'),
	loader = require('floader'), // browserify aware file loader (xhr in browser)
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

var dataDirectory = 'test/data/',
	matrixFiles = ['a.json', 'b.json', 'c.json'];

function generateTestCase(prefix){
	return function(t){
		t.plan(1);
		var a, b, c, // javascript arrays
			A, B, C; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/',
			// array of paths to matrix data files for current test
			testFiles = matrixFiles.map(function(item){ return testDirectory + item;});


		//console.log(testFiles);
		async.map(testFiles, loader.load,
			function(err, results){

				// results contains three strings.
				// each string contains the contents of a file
				// files contain JSON describing a matrix (2D array)
				a = JSON.parse(results[0]);
				b = JSON.parse(results[1]);
				c = JSON.parse(results[2]);

				if(!(a[0] && a[0].length && b && a[0].length == b.length))
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
			}
		);
	};
}

var suite = require('./data/micro.json');

// suite configuration file uses directory name as key
for(directory in suite){

	var m = suite[directory][0],
		n = suite[directory][1],
		k = suite[directory][2];

	tape(m + "x" + k + " times " + k + "x" + n, generateTestCase(directory));
}
