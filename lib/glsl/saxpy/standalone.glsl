precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D X;		// texture with data from padded A
uniform sampler2D Y;		// texture with data from padded transpose of B
uniform int       N;
uniform float     a; 		// coefficient to multiplication


#pragma glslify: encode_float = require(../encode_float)
#pragma glslify: select_index = require(../select_index)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
 	float row = outTex.y;
	float col = outTex.x;

	// direct usage of col requires output be padded exactly like input
	vec4 x = texture2D( X, vec2(col, row));
	vec4 y = texture2D( Y, vec2(col, row));
	vec4 sum_v = (a * x) + y;
	int channel = int(mod(col * float(N), 4.0 ));
	float sum = select_index(sum_v, channel);

	if (sum == 0.) {
		gl_FragColor = vec4(0.,0.,0.,0.);
		return;
	}

 	// output vec4 with bytes for an IEEE754 32-bit floating point number
	gl_FragColor = encode_float(sum);
}
