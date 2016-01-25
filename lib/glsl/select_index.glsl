// select an element from a vector based on index
float select_index(vec4 v, int index){
	float val;
	if (index == 0) {
		val = v.r;
	} else if(index == 1) {
		val = v.g;
	} else if(index == 2) {
		val = v.b;
	} else if(index == 3){
		val = v.a;
	} else {
		// should never be here
		val = 0.0;
	}

	return val;
}
#pragma glslify: export(select_index)
