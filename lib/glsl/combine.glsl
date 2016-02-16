precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform sampler2D B;		// texture with data from padded B
uniform float     N_in;		// number of columns
uniform float     pad_in;	// additional columns to nearest multiple of four
uniform float     stride;

#pragma glslify: fix_pad = require(./fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float N = N_in * 2.0;
	float pad = mod(N, 4.0);
	float col = floor(col_t * (N + pad) - 1.5); // index of first element in pixel (output matrix space)

	float stripe = floor(col / stride);
	float sub_col = floor(mod(col, stride));

	float tex_select = mod(stripe, 2.0);
	float col_in = floor(stripe / 2.0) * stride + sub_col;

	vec4 x;
	float channel = mod(col_in, 4.0); // channel in the input of first element in output

	// which input texture are we getting this pixel from?
	if(tex_select == 0.0){
		x = texture2D( A, vec2((col_in + 2.0) / (N_in + pad_in) , row_t));
	} else {
		x = texture2D( B, vec2((col_in + 2.0) / (N_in + pad_in) , row_t));
	}

	// fix padded region
	if(pad > 0.0 && col + 4.0 > N ) {
		fix_pad(x, int(pad));
	}

	gl_FragColor = x;
}
