precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform sampler2D B;		// texture with data from padded B
uniform float     N_in;		// number of columns
uniform float     pad_in;		// additional columns to nearest multiple of four

#pragma glslify: fix_pad = require(./fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float N = N_in * 2.0;
	float pad = mod(N, 4.0);
	float col = (col_t * (N + pad) - 2.0); // index of first element in pixel (output matrix space)

	vec4 x;
	// which input texture are getting this pixel from?
	if(col < N_in){
		x = texture2D( A, vec2((col + 2.0) / (N_in + pad_in) , row_t));
	} else {
		x = texture2D( B, vec2((col + 2.0 - N_in) / (N_in + pad_in) , row_t));
	}

	// fix padded region
	if(pad > 0.0 && col + 4.0 > N ) {
		fix_pad(x, int(pad));
	}

	gl_FragColor = x;
}
