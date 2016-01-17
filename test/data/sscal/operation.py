"""SCAL operation
"""
import numpy as np

def execute(options, matrices):
	a = options['a'] if 'a' in options else 1.0
	b = options['b'] if 'b' in options else 0.0

	A = matrices[0]

	return (a * A) + b
