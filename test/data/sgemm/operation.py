"""SGEMM operation
"""
import numpy as np

def execute(options, matrices):
	alpha = options['alpha'] if 'alpha' in options else 1.0

	A = matrices[0]
	B = matrices[1]

	return alpha * np.dot(A, B)
