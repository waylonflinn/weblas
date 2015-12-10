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

var dataDirectory = 'test/data/';

tape("allclose", function(t){
	t.plan(1);
	var a, b, c;
	var A, B, C;
	var testDirectory = dataDirectory + '001/';


	loader.load(testDirectory + 'a.json', function(err, content){
		a = JSON.parse(content);
		loader.load(testDirectory + 'b.json', function(err, content){
			b = JSON.parse(content);
			loader.load(testDirectory + 'c.json', function(err, content){
				c = JSON.parse(content);

				A = WebGL.fromArray(a);
				B = WebGL.fromArray(b);
				C = WebGL.fromArray(c);

				var h1 = a.length,
					w1 = a[0].length,
					h2 = b.length,
					w2 = b[0].length,
					alpha = 1.0,
					beta = 0.0;

				result = calculator.calculate(h1, w1, h2, w2, alpha, beta, A, B, null);

				t.assert(test.allclose(C, result), h1 + "x" + w1 + " times " + h2 + "x" + w2);
			});
		});
	});
});
