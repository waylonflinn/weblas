// fragment shader that calculates the matrix product and renders each
// element to the bytes representing a 32-bit IEEE754 floating point in
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
#pragma glslify: encode_float = require(../encode_float)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	// sum row x col for the passed pixel
	float sum = alpha * dot_rowcol(row_t, col_t * float(N + pad)/float(N), A, B_t, K);

	if (sum == 0.) {
		gl_FragColor = vec4(0.,0.,0.,0.);
		return;
	}

	// output vec4 with bytes for an IEEE754 32-bit floating point number
	gl_FragColor = encode_float(sum);
}
