// fragment shader that calculates the matrix product and writes each
// element to a pixel component in a floating point texture.
// the output RGBA canvas.
// readPixel is used to read the bytes.

precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform sampler2D B_t;		// texture with data from padded transpose of B
uniform int       K;		// number of elements in shared dimension
uniform int       N;		// number of columns in output
uniform int       pad;		//
uniform float     alpha; 	// coefficient to multiplication

#pragma glslify: dot_rowcol = require(./dot_rowcol)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	vec4 sum_v = vec4(0.0, 0.0, 0.0, 0.0);
	float col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)
	sum_v.r = alpha * dot_rowcol(row_t, (col + 0.5)/float(N), A, B_t, K);
	// is last element in pixel past row length?
	if(pad > 0 && (col + 4.0) > float(N) ) {
		// compute elements in padded region
		if(pad < 3){
			sum_v.g = alpha * dot_rowcol(row_t, (col + 1.5)/float(N), A, B_t, K);
		}
		if(pad < 2){
			sum_v.b = alpha * dot_rowcol(row_t, (col + 2.5)/float(N), A, B_t, K);
		}
	} else {
		sum_v.g = alpha * dot_rowcol(row_t, (col + 1.5)/float(N), A, B_t, K);
		sum_v.b = alpha * dot_rowcol(row_t, (col + 2.5)/float(N), A, B_t, K);
		sum_v.a = alpha * dot_rowcol(row_t, (col + 3.5)/float(N), A, B_t, K);
	}


	gl_FragColor = sum_v;
}
