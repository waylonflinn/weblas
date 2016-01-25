
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform int       N;		// number of columns in output
uniform int       pad;		//

#pragma glslify: encode_float = require(./encode_float)
#pragma glslify: select_index = require(./select_index)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	vec4 val_v = texture2D(A, vec2(col_t * float(N)/float(N + pad), row_t));
	int channel = int(mod(col_t * float(N), 4.0 ));
	float val = select_index(val_v, channel);

	if (val == 0.) {
		gl_FragColor = vec4(0.,0.,0.,0.);
		return;
	}

 	// output vec4 with bytes for an IEEE754 32-bit floating point number
	gl_FragColor = encode_float(val);
}
