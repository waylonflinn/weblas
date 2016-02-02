
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform int       M;		// number of rows in output
uniform int       N;		// number of columns in output
uniform int       pad;		// column padding in output
uniform int       M_in;		// number of rows in input
uniform int       N_in;		// number of columns in input
uniform int       pad_in;	// column padding in input

#pragma glslify: select_index = require(./select_index)
#pragma glslify: fix_pad = require(./fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	float row = (row_t * float(M) - 0.5);
	float col_0 = (col_t * float(N + pad) - 2.0); // index of first element in pixel (matrix space)
	//float col_0 = floor((col_t * float(N + pad))/4.0)*4.0; // index of first element in pixel (matrix space)
	float lin_index_0 = row * float(N) + col_0; // linearized index of first element in pixel in output

	float row_in_0 = floor(lin_index_0 / float(N_in)); // row in input containing first element in pixel
	float col_in_0 = floor(mod(lin_index_0, float(N_in))); // column in input containing first element in pixel
	float row_in_3 = floor((lin_index_0 + 4.0) / float(N_in)); // row in input containing last element in pixel
	float col_in_3 = floor(mod((lin_index_0 + 4.0), float(N_in))); // column in input containing last element in pixel

	// get the pixel in the input containing the first element in the output
	vec4 pixel_0 = texture2D(A, vec2((col_in_0 + 2.0)/float(N_in + pad_in), (row_in_0 + 0.5)/float(M_in)));
	vec4 pixel;

	int channel_in_0 = int(mod(col_in_0, 4.0));

	if(channel_in_0 == 0){
		pixel = pixel_0;
	} else {
		// get the pixel in the input containing the last (fourth) element in the output
		vec4 pixel_3 = texture2D(A, vec2((col_in_3 + 2.0)/float(N_in + pad_in), (row_in_3 + 0.5)/float(M_in)));

		if(channel_in_0 == 1){
			pixel.rgb = pixel_0.gba;
			pixel.a = pixel_3.r;
		} else if(channel_in_0 == 2){
			pixel.rg = pixel_0.ba;
			pixel.ba = pixel_3.rg;
		} else { // channel_in_0 == 3
			pixel.r = pixel_0.a;
			pixel.gba = pixel_3.rgb;
		}
	}

	// fix padded region
	if(pad > 0 && col_0 + 4.0 > float(N) ) {
		fix_pad(pixel, pad);
	}

	//gl_FragColor = vec4(channel, 0., 0., 0.);
	gl_FragColor = pixel;
}
