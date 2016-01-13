#!/usr/bin/env python
"""Create two randomly generated matrices, of the specified sizes and write them
to JSON files.

"""
import json
import numpy as np


def read(path):

	with open(path, 'r') as f:
		matrix =  np.array(json.load(f))

	return matrix

def write(path, matrix):

	with open(path, 'w') as f:
		json.dump(matrix.tolist(), f)

	return matrix
