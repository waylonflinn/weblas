var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');


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
tape("saxpy: " + N , function(t){
	t.plan(1);

	var a = 2.0,
		x = new Float32Array([1.0, 2.0, 3.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 5.5, 7.5]);

	try{
		result = weblas.saxpy(3, a, x, y);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("saxpy: " + N , function(t){
	t.plan(1);

	var a = 2.0,
		x = new Float32Array([1.0, 2.0, 3.0, 4.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 5.5, 7.5, 9.5]);

	try{
		result = weblas.saxpy(N, a, x, y);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("saxpy: " + 7 , function(t){
	t.plan(1);

	var a = 3.2,
		x = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0, 9.0, 11.0]),
		y = 5.6,
		expected = new Float32Array([8.8, 15.2, 12.0, 18.4, 28.0, 34.4, 40.8]);

	try{
		result = weblas.saxpy(7, a, x, y);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
