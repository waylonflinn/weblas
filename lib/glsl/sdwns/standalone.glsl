// TODO: unroll loop for stride == factor and small values (2, 3)
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D X;		// texture with data from padded A
uniform int       factor; // width of image patch
uniform float     stride; // width between image patches
uniform float     c; 	  // number of channels
uniform float     M;
uniform float     N;
uniform float     N_out;
uniform float     M_out;


#pragma glslify: encode_float = require(../encode_float)
#pragma glslify: select_index = require(../select_index)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate and translate to input texture space.
	float row_p = floor(outTex.y * M_out);   // row on output texture (pixel space)
	float col_p = outTex.x * N_out; // column on output texture (pixel space)
	float vcol_p = floor(col_p / c);   // virtual column on input texture (pixel space)
	float vchannel_p = floor(mod(col_p, c)); // virtual channel on input texture


	const float min = -1.0e+08;
	vec4 currentMax = vec4(min, min, min, min);

	float deltaY = 1.0/M;
	float deltaX = 1.0/N;
	float y = ((row_p * stride) + 0.5)*deltaY; // position of input row
	float x;
	float z = vchannel_p * deltaX;
	for (int i = 0; i < 100; i += 1) {
		if (i >= factor) {
			break;
		}
		x = ((vcol_p * stride * c) + 0.5) * deltaX; // position of input column

		for (int j = 0; j < 100; j += 1) {
			if (j >= factor) {
				break;
			}

			vec2 coords = vec2(x + z, y);
			vec4 x_v = texture2D(X, coords);
			currentMax = max(currentMax, x_v);

			x += (deltaX * c);
		}
		y += deltaY;
	}
	int chan = int(mod(outTex.x * N_out, 4.0 ));
	float val = select_index(currentMax, int(chan));
	if (val == 0.) {
		gl_FragColor = vec4(0.,0.,0.,0.);
		return;
	}

	gl_FragColor = encode_float(val);
}
