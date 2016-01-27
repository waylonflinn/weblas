// set pad values to 0.0, if in padded region of output texture
void fix_pad(inout vec4 v, int pad){
	v.a = 0.0;
	if(pad == 2){
		v.b = 0.0;
	} else if(pad == 3){
		v.b = 0.0;
		v.g = 0.0;
	}
}
#pragma glslify: export(fix_pad)
