
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform int       M;		// number of rows in output
uniform int       N;		// number of columns in output
uniform int       mpad;		//
uniform int       npad;		//

#pragma glslify: select_index = require(./select_index)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float col = (col_t * float(N + npad) - 2.0); // index of first element in pixel (matrix space)

	// get rows in the input, each containing one element in the output
	vec4 row_1 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 0.5)/float(N)));
	vec4 row_2 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 1.5)/float(N)));
	vec4 row_3 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 2.5)/float(N)));
	vec4 row_4 = texture2D(A, vec2((row_t * float(M))/float(M + mpad), (col + 3.5)/float(N)));

	// package into output vector
	int channel = int(mod(row_t * float(M), 4.0 ));

	vec4 col_v = vec4(0.0, 0.0, 0.0, 0.0); // vec4 representing four elements in a column in the input

	// extract relevent element from each input row
	col_v.r = select_index(row_1, channel);
	if(npad > 0 && (col + 4.0) > float(N) ) {
		// compute elements in padded region
		if(npad < 3){
			col_v.g = select_index(row_2, channel);
		}
		if(npad < 2){
			col_v.b = select_index(row_3, channel);
		}
	} else {
		col_v.g = select_index(row_2, channel);
		col_v.b = select_index(row_3, channel);
		col_v.a = select_index(row_4, channel);
	}


	gl_FragColor = col_v;
}
