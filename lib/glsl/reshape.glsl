
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

// translate a linear index into x, y coordinates for a matrix
vec2 linear_index_coords(float linear_index, float row_length){
	vec2 coords;

	coords.x = floor(mod(linear_index + 0.5, row_length)); // column
	coords.y = floor((linear_index + 0.5) / row_length); // row

	return coords;
}

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
	int current_pixel_index = int(mod(coords.x, 4.0));

	pixel_in = texture2D(A, vec2((coords.x + 0.5)/(N_in + pad_in), (coords.y + 0.5)/M_in));

	// go through channels for current output pixel
	for(int i = 0; i < 4; i++){

		// are we on a new input pixel?
		ncoords = linear_index_coords(lin_index_0 + float(i), N_in);
		if(floor(coords.x/4.0) != floor(ncoords.x/4.0) || coords.y != ncoords.y){
			coords = ncoords;
			pixel_in = texture2D(A, vec2((coords.x + 0.5)/(N_in + pad_in), (coords.y + 0.5)/M_in));
			current_pixel_index = 0;
		}

		if(i == 0){
			result.r = select_index(pixel_in, current_pixel_index);
		} else if(i == 1){
			result.g = select_index(pixel_in, current_pixel_index);
		} else if(i == 2){
			result.b = select_index(pixel_in, current_pixel_index);
		} else {
			result.a = select_index(pixel_in, current_pixel_index);
		}

		current_pixel_index++;
	}

	// are we in the padded (output) region?
	if(pad > 0.0 && col_0 + 3.5 > N ) {
		fix_pad(result, int(pad));
	}


	//gl_FragColor = vec4(channel, 0., 0., 0.);
	gl_FragColor = result;
}
