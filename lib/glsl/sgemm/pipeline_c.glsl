// fragment shader that calculates the matrix product and writes each
// element to a pixel component in a floating point texture.
// the output RGBA canvas.
// readPixel is used to read the bytes.

precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform sampler2D B_t;		// texture with data from padded transpose of B
uniform sampler2D C;		// texture with data from C
uniform int       K;		// number of elements in shared dimension
uniform int       N;		// number of columns in output
uniform int       pad;		//
uniform float     alpha; 	// coefficient to multiplication
uniform float     beta; 	// coefficient to addition

#pragma glslify: dot_rowcol = require(./dot_rowcol)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	vec4 c_v = texture2D(C, vec2(col_t, 0.5));

	vec4 sum_v;
	float col_p = col_t * float(N + pad)/4.0;
	float col = 4.0*floor(col_p) + 0.5;
	sum_v.r = alpha * dot_rowcol(row_t, col/float(N), A, B_t, K);
	// in the padding region?
	if(col_t * float(N + pad) > float(N) ) {
		// pad
		if(pad < 3){
			sum_v.g = alpha * dot_rowcol(row_t, (col + 1.0)/float(N), A, B_t, K);
		}
		if(pad < 2){
			sum_v.b = alpha * dot_rowcol(row_t, (col + 2.0)/float(N), A, B_t, K);
		}
	} else {
		sum_v.g = alpha * dot_rowcol(row_t, (col + 1.0)/float(N), A, B_t, K);
		sum_v.b = alpha * dot_rowcol(row_t, (col + 2.0)/float(N), A, B_t, K);
		sum_v.a = alpha * dot_rowcol(row_t, (col + 3.0)/float(N), A, B_t, K);
	}


	gl_FragColor = sum_v + beta*c_v;
}
