precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D X;		// texture with data from padded A
uniform int       N;		// number of columns
uniform int       pad;		// additional columns to nearest multiple of four
uniform float     a; 		// lower bound
uniform float     b; 		// upper bound


#pragma glslify: fix_pad = require(../fix_pad)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float col = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)

	// direct usage of col requires output be padded exactly like input
	vec4 x = texture2D( X, vec2(col_t, row_t));
	vec4 val_v = clamp(x, a, b);

	// is last element in pixel past row length?
	if(pad > 0 && (col + 4.0) > float(N) ) {
		// fix elements in padded region
		fix_pad(val_v, pad);
	}

	gl_FragColor = val_v;
}
