var Benchmark = require('benchmark'),
	test = require('../index').test,
	WebGL = require('../index').WebGL,
	GEMMFloatCalculator = require("../index").GEMMFloatCalculator;

var suite = new Benchmark.Suite();

var webgl = new WebGL(),
	calculator = new GEMMFloatCalculator(webgl);

var dataDirectory = 'test/data/';

var testDirectory = dataDirectory + '0004/';

test.load(testDirectory, function(err, a, b, c){
	var A, B, C;

	if(!(a[0] && a[0].length && b && a[0].length == b.length
		&& a.length == c.length && b[0].length == c[0].length ))
		throw new Error("malformed data");

	A = WebGL.fromArray(a);
	B = WebGL.fromArray(b);

	var m = a.length,
		k = b.length,
		n = b[0].length,
		alpha = 1.0,
		beta = 0.0;

	suite.add(m + "x" + k, function(){
		result = calculator.calculate(m, n, k, alpha, A, B, beta, null);
	})// add listeners
	.on('cycle', function(event) {
		console.log(String(event.target));
	})
	.on('complete', function() {
		var fastest = this.filter('fastest')[0];
		console.log('Mean run time ' + (fastest.stats.mean * 1000).toFixed(0) + 'ms');
	})
	// run async
	.run({ 'async': true });

});
