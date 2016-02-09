precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D X;		// texture with data from padded X
uniform float     N;		// number of columns
uniform float     pad;		// additional columns to nearest multiple of four
uniform float     N_in;		// number of columns (input)
uniform float     pad_in;	// additional columns to nearest multiple of four (input)
uniform float     offset;


#pragma glslify: fix_pad = require(./fix_pad)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float col = (col_t * (N + pad) - 2.0); // index of first element in pixel (output matrix space)

	// direct usage of col requires output be padded exactly like input
	vec4 x = texture2D( X, vec2((col + 2.0 + offset) / (N_in + pad_in) , row_t));

	// fix padded region
	if(pad > 0.0 && col + 4.0 > N ) {
		fix_pad(x, int(pad));
	}

	gl_FragColor = x;
}
