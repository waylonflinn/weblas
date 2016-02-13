precision highp float;

varying vec2      outTex;  // texture coords of row/column to calculate
uniform sampler2D X;       // texture with data from padded A
uniform float     factor;  // width of image patch
uniform float     stride;  // width between image patches
uniform float     N_p;     // patches across
uniform float     M;
uniform float     N;
uniform float     pad;
uniform float     M_in;
uniform float     N_in;
uniform float     channels;
uniform float     pad_in;

#pragma glslify: join_pixels = require(../join_pixels)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate
	float row_t = outTex.y;
	float col_t = outTex.x;

	// row corresponds to patch
	float row = floor(row_t * M);
	// column corresponds to placement in patch
	float col_0 = floor(col_t * (N + pad) - 1.5); // index of first element in output pixel (matrix space)

	// p_x = patches across
	float col_patch = floor(mod(row, N_p));
	float row_patch = floor(row / N_p);
	float col_in_0 = col_patch * stride; // column index of top left element in patch
	float row_in_0 = row_patch * stride; // row index of " "

	float patch_col = floor(mod(col_0, factor * channels)); // index of column inside patch
	float patch_row = floor(col_0 / (factor * channels)); // index of row inside patch

	float col_in = col_in_0 + patch_col; // column in input
	float row_in = row_in_0 + patch_row; // row in input

	//float col_in = row * stride +

	vec4 x;
	float channel = mod(col_in, 4.0); // channel in the input of first element in output

	// are we at the beggining of an input pixel?
	if(channel == 0.0){
		// yes, select the whole thing
		x = texture2D(X, vec2((col_in + 2.0) / (N_in + pad_in), (row_in + 0.5) / M_in));
	} else {
		// no, select parts from two pixels
		vec4 x0 = texture2D(X, vec2((col_in + 2.0 - channel) / (N_in + pad_in), (row_in + 0.5) / M_in));
		vec4 x1 = texture2D(X, vec2((col_in + 6.0 - channel) / (N_in + pad_in), (row_in + 0.5) / M_in));

		join_pixels(x, x0, x1, channel);
	}

	//gl_FragColor = vec4(col_in, row_in, channel, N_p);
	gl_FragColor = x;
}
