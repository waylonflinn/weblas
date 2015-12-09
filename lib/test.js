/* Collection of helper methods for testing numerical computation
 */
test = {};

/* Check all entries in two TypedArrays of identical length for approximate
    equality.
    If the following equation is element-wise true, returns true

    absolute(a - b) <= (atol + rtol * absolute(b))

    from numpy.allclose
 */
test.allclose = function(a, b, RTOL, ATOL){
    RTOL= RTOL || 1e-05;  // for 32 bit precision: 1e-06
    ATOL= ATOL || 1e-12;

    if(a.length != b.length){
        console.log("lengths not equal: " + a.length + ", " + b.length);
        return false;
    }

    var result;
    for(var i = 0; i < a.length; i++){

        result = Math.abs(a[i] - b[i]) <= ATOL + RTOL * Math.abs(b[i]);

        if(!result) return result;
    }

    return true;
};

test.randomArray = function(N, M){

	var data = [];

	for(var i = 0; i < N; i++){
		var row = [];
		for(var j = 0; j < M; j++){
			row[j] = Math.random() / Math.sqrt(N);
		}
		data.push(row);
	}

	return data;
};

module.exports = test;
