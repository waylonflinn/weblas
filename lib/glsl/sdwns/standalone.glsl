// TODO: unroll loop for stride == factor and small values (2, 3)
precision highp float;

varying vec2      outTex;  // texture coords of row/column to calculate
uniform sampler2D X;       // texture with data from padded A
uniform int       factor;  // width of image patch
uniform float     stride;  // width between image patches
uniform float     C;       // number of channels
uniform float     M;
uniform float     N;
uniform float     N_out;
uniform float     M_out;


#pragma glslify: encode_float = require(../encode_float)
#pragma glslify: select_index = require(../select_index)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate and translate to output pixel space.
	float row = floor(outTex.y * M_out);   // row on output texture (matrix space)
	float col = floor(outTex.x * N_out); // column on output texture (matrix space)
	float vcol = floor(col / C);   // virtual column on output texture (matrix space)
	float vchannel = floor(mod(col, C)); // virtual channel on output texture


	const float min = -1.0e+08;
	vec4 currentMax = vec4(min, min, min, min);

	float deltaY = 1.0/M;
	float deltaX = 1.0/N;
	float y = ((row * stride) + 0.5)*deltaY; // texture position of input row
	float x;
	float z = vchannel * deltaX;
	for (int i = 0; i < 100; i += 1) {
		if (i >= factor) {
			break;
		}
		x = ((vcol * stride * C) + 0.5) * deltaX; // texture position of input column

		for (int j = 0; j < 100; j += 1) {
			if (j >= factor) {
				break;
			}

			vec2 coords = vec2(x + z, y);
			vec4 x_v = texture2D(X, coords);
			currentMax = max(currentMax, x_v);

			x += (deltaX * C);
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
