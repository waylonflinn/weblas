#!/usr/bin/env python
"""Create two randomly generated matrices, of the specified sizes and write them
to JSON files.

"""
import json
import numpy as np


def read(path):

	with open(path, 'rb') as f:
		matrix = np.fromfile(f, dtype=np.float32)

	return matrix

def write(path, matrix):

	with open(path, 'wb') as f:
		f.write(matrix.astype(np.float32).tostring())

	return matrix
