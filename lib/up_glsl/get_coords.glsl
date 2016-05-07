vec2 get_coords( float index, float cols, float cols_hstep, float rows, float row_hstep ) {
	float col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops
	float row_index = floor( (index + 0.1) / cols );
	
	//float index = row_index * cols + col_index;
	
	return vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );
}
#pragma glslify: export(get_coords)