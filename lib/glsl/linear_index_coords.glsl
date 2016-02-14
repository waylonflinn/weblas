// translate a linear index into x, y coordinates for a matrix
vec2 linear_index_coords(float linear_index, float row_length){
	vec2 coords;

	coords.x = floor(mod(linear_index + 0.5, row_length)); // column
	coords.y = floor((linear_index + 0.5) / row_length); // row

	return coords;
}
#pragma glslify: export(linear_index_coords)
