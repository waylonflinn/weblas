
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
#pragma glslify: linear_index_coords = require(./linear_index_coords)


void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;

	float row = floor(row_t * M);
	float col_0 = (col_t * (N + pad) - 2.0); // index of first element in pixel (matrix space)
	//float col_0 = floor(col_t * (N + pad)/4.0)*4.0; // index of first element in pixel (matrix space)
	float lin_index_0 = row * N + col_0; // linearized index of first element in pixel in output

	vec4 pixel_in = vec4(0.0, 0.0, 0.0, 0.0);
	vec4 result = vec4(0.0, 0.0, 0.0, 0.0);
	vec2 coords = linear_index_coords(lin_index_0, N_in);
	vec2 ncoords;
	int channel_in = int(mod(coords.x, 4.0));

	vec2 scale_in = vec2(1.0/(N_in + pad_in), 1.0/M_in); // scale from matrix to input texture coords
	vec2 offset_in = vec2(0.5, 0.5); // move away from edge of pixel
	const vec2 pixel_scale = vec2(1.0/4.0, 1.0); // scale from matrix to pixel coords

	pixel_in = texture2D(A, (coords + offset_in) * scale_in);

	// go through channels for current output pixel
	for(int channel = 0; channel < 4; channel++){

		// are we on a new input pixel?
		ncoords = linear_index_coords(lin_index_0 + float(channel), N_in);
		if(floor(ncoords * pixel_scale) != floor(coords * pixel_scale)){
			coords = ncoords;
			pixel_in = texture2D(A, (coords + offset_in) * scale_in);
			channel_in = 0;
		}

		if(channel == 0){
			result.r = select_index(pixel_in, channel_in);
		} else if(channel == 1){
			result.g = select_index(pixel_in, channel_in);
		} else if(channel == 2){
			result.b = select_index(pixel_in, channel_in);
		} else {
			result.a = select_index(pixel_in, channel_in);
		}

		channel_in++;
	}

	// are we in the padded (output) region?
	if(pad > 0.0 && col_0 + 3.5 > N ) {
		fix_pad(result, int(pad));
	}

	gl_FragColor = result;
}
