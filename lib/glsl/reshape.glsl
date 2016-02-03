
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform float     M;		// number of rows in output
uniform float     N;		// number of columns in output
uniform float     pad;		// column padding in output
uniform float     M_in;		// number of rows in input
uniform float     N_in;		// number of columns in input
uniform float     pad_in;	// column padding in input

/* number of input pixels
   origin index (channel) for each
   termination index (channel) for each
   destination origin index (channel) for each
 */
#pragma glslify: select_index = require(./select_index)
#pragma glslify: fix_pad = require(./fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	float row = floor(row_t * M);
	//float col_0 = (col_t * (N + pad) - 2.0); // index of first element in pixel (matrix space)
	float col_0 = floor((col_t * (N + pad))/4.0)*4.0; // index of first element in pixel (matrix space)
	float lin_index_0 = row * N + col_0; // linearized index of first element in pixel in output

	float row_in_0 = floor(lin_index_0 / N_in); // row in input containing first element in pixel
	float col_in_0 = floor(mod(lin_index_0, N_in)); // column in input containing first element in pixel
	float row_in_3 = floor((lin_index_0 + 3.0) / N_in); // row in input containing last element in pixel
	float col_in_3 = floor(mod((lin_index_0 + 3.0), N_in)); // column in input containing last element in pixel

	// get the pixel in the input containing the first element in the output
	vec4 pixel_0 = texture2D(A, vec2((col_in_0 + 2.0)/(N_in + pad_in), (row_in_0 + 0.5)/M_in));
	vec4 pixel;

	int channel_in_0 = int(mod(col_in_0, 4.0)); // channel in input of first element in pixel
	int channel_in_3 = int(mod(col_in_3, 4.0));// channel in input of last element in pixel

	// are we spanning the whole pixel?
	if(channel_in_0 == 0 && channel_in_3 == 3){
		// yes, use it directly for the output
		pixel = pixel_0;
	} else {
		// no, get the next pixel, and extract what we need
		// get the pixel in the input containing the last (fourth) element in the output
		vec4 pixel_3 = texture2D(A, vec2((col_in_3 + 2.0)/(N_in + pad_in), (row_in_3 + 0.5)/M_in));

		int pixel_3_len = channel_in_0;

		// are we in the padded (input) region?
		if(pad_in > 0.0 && col_in_0 + 4.0 > N_in){
			pixel_3_len = pixel_3_len + int(pad_in);
		}

		if(channel_in_0 == 1){
			pixel.rgb = pixel_0.gba;
		} else if(channel_in_0 == 2){
			pixel.rg = pixel_0.ba;
		} else { // channel_in_0 == 3
			pixel.r = pixel_0.a;
		}

		if(channel_in_3 == 0){
			if(pixel_3_len == 3){
				pixel.gba = pixel_3.rgb;
			} else if(pixel_3_len == 2){
				pixel.ba = pixel_3.rg;
			} else {
				pixel.a = pixel_3.r;
			}
		} else if(channel_in_3 == 1){
			if(pixel_3_len == 3){
				pixel.gba = pixel_3.gba;
			} else if(pixel_3_len == 2){
				pixel.ba = pixel_3.gb;
			} else {
				pixel.a = pixel_3.g;
			}
		} else if(channel_in_3 == 2){
			if(pixel_3_len == 2){
				pixel.ba = pixel_3.ba;
			} else {
				pixel.a = pixel_3.b;
			}
		} else {
			pixel.a = pixel_3.a;
		}
	}

	// are we in the padded (output) region?
	if(pad > 0.0 && col_0 + 4.0 > N ) {
		fix_pad(pixel, int(pad));
	}

	//gl_FragColor = vec4(channel, 0., 0., 0.);
	gl_FragColor = pixel;
}
