/* join parts of two pixels into one, selecting four continguous elements
  starting at channel.
*/
void join_pixels(inout vec4 x, vec4 x0, vec4 x1, float channel){
	if(channel == 1.0){
		x.rgb = x0.gba;
		x.a = x1.r;
	} else if(channel == 2.0){
		x.rg = x0.ba;
		x.ba = x1.rg;
	} else if(channel == 3.0){
		x.r = x0.a;
		x.gba = x1.rgb;
	}
}
#pragma glslify: export(join_pixels)
