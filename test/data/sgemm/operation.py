"""GEMM operation
"""
import numpy as np

def execute(options, matrices):
	alpha = options['alpha'] if 'alpha' in options else 1.0
	beta = options['beta'] if 'beta' in options else 1.0

	A = matrices[0]
	B = matrices[1]

	if len(matrices) == 2:
		return alpha * np.dot(A, B)
	else:
		C = matrices[2]
		return alpha * np.dot(A, B) + beta * C
