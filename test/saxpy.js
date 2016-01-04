var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)



var RTOL = 1e-05,
	ATOL = 1e-12;

var N = 4;

tape("saxpy: " + N , function(t){
	t.plan(1);

	var a = 2.0,
		x = new Float32Array([1.0, 1.0, 1.0, 1.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 3.5, 3.5, 3.5]);

	try{
		result = weblas.saxpy(N, a, x, y);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
