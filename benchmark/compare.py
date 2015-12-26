#!/usr/bin/env python
# coding: utf-8
import timeit

def run_benchmark(M, N, K, n):
	count = 50

	setup_string = 'import numpy as np; a = np.random.random_sample(({0}, {2})); b = np.random.random_sample(({2}, {1}))'.format(M, N, K)
	#print(setup_string)
	elapsed = timeit.timeit(
		setup=setup_string,
		stmt='np.dot(a, b)',
		number=count)

	average_millis = (elapsed / count) * 1000
	# 1.11 ops/sec  ±0.22%  n = 7 µ = 904ms
	# 235 ops/sec  ±2.86%  n = 59 µ = 4ms
	print("ok {3} {0}x{2} . {2}x{1}".format(M, N, K, n))
	print("# {0:.2f} ops/sec n = {1} µ = {2:.2f}ms".format(count / elapsed, count, average_millis))

print("TAP version 13")
run_benchmark( 128,  128,  128, 1)
run_benchmark( 128,  128,  256, 2)
run_benchmark( 256,  256,  256, 3)
run_benchmark( 512,  512,  256, 4)
run_benchmark( 256,  256,  512, 5)
run_benchmark( 512,  512,  512, 6)
run_benchmark(1024, 1024,  512, 7)
run_benchmark(1024, 1024,  512, 8)
run_benchmark(1024, 1024, 1024, 9)
run_benchmark(2048, 2048, 2048, 10)


print("\n1..9")
print("# tests 9")
print("# pass  9")

print("\n# ok\n")
