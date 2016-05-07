float get_channel_value( sampler2D texture, int channel, vec2 xy ) {	
	if ( channel == 0 ) {
		return texture2D( texture, xy ).r;
	}
	if ( channel == 1 ) {
		return texture2D( texture, xy ).g;
	}
	if ( channel == 2 ) {
		return texture2D( texture, xy ).b;
	}
	if ( channel == 3 ) {
		return texture2D( texture, xy ).a;
	}	
	return 0.0;	// should not happen
}
#pragma glslify: export(get_channel_value)