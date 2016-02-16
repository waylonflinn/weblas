
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform float     M;		// number of rows in output
uniform float     N;		// number of columns in output
uniform float     M_in;		// number of rows in input
uniform float     N_in;		// number of columns in input

#pragma glslify: linear_index_coords = require(./linear_index_coords)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	float row = floor(row_t * M);
	float col_0 = floor(col_t * N - 1.5); // index of first element in pixel (matrix space)
	float lin_index_0 = row * N + col_0; // linearized index of first element in pixel in output

	vec4 result;
	vec2 coords = linear_index_coords(lin_index_0, N_in);

	vec2 scale_in = vec2(1.0/N_in, 1.0/M_in); // scale from matrix to input texture coords
	vec2 offset_in = vec2(0.5, 0.5); // move away from edge of pixel

	result = texture2D(A, (coords + offset_in) * scale_in);

	gl_FragColor = result;
}
