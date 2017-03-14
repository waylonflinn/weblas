#!/usr/bin/env python
"""Create two randomly generated matrices, of the specified sizes and write them
to JSON files.

"""
import json
import numpy as np
import os


type_map = {
	'.i32' : np.int32,
	'.u32' : np.uint32,
	'.f32' : np.float32,
	'.i64' : np.int64,
	'.u64' : np.uint64,
	'.f64' : np.float64
}

def get_extension(path):
	filename, file_extension = os.path.splitext(path)
	return file_extension

def read(path, dtype=np.float32):

	extension = get_extension(path)
	if extension in type_map:
		dtype = type_map[extension]

	with open(path, 'rb') as f:
		matrix = np.fromfile(f, dtype=dtype)

	return matrix

def write(path, matrix, dtype=np.float32):

	extension = get_extension(path)
	if extension in type_map:
		dtype = type_map[extension]

	with open(path, 'wb') as f:
		f.write(matrix.astype(dtype=dtype).tostring())

	return matrix
