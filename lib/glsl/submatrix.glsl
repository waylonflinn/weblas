precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D X;		// texture with data from padded X
uniform float     N;		// number of columns
uniform float     pad;		// additional columns to nearest multiple of four
uniform float     N_in;		// number of columns (input)
uniform float     pad_in;	// additional columns to nearest multiple of four (input)
uniform float     stride;
uniform float     offset;   // zero or one


#pragma glslify: fix_pad = require(./fix_pad)
#pragma glslify: join_pixels = require(./join_pixels)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float col = floor(col_t * (N + pad) - 1.5); // index of first element in pixel (output matrix space)

	float stripe = floor(col / stride);
	float sub_col = floor(mod(col, stride));

	float col_in = (offset + (2.0 * stripe)) * stride + sub_col;

	vec4 x;
	float channel = mod(col_in, 4.0); // channel in the input of first element in output

	// are we at the beggining of an input pixel?
	if(channel == 0.0){
		// yes, select the whole thing
		x = texture2D( X, vec2((col_in + 2.0 - channel) / (N_in + pad_in) , row_t));
	} else {
		// no, select parts from two pixels
		vec4 x0, x1;
		x0 = texture2D( X, vec2((col_in + 2.0 - channel) / (N_in + pad_in) , row_t));
		x1 = texture2D( X, vec2((col_in + 6.0 - channel) / (N_in + pad_in) , row_t));

		join_pixels(x, x0, x1, channel);

	}

	// fix padded region
	if(pad > 0.0 && col + 4.0 > N ) {
		fix_pad(x, int(pad));
	}

	gl_FragColor = x;
}
