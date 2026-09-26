.PHONY: test test-python test-vision test-oracle test-contracts demo lint format-check clean

test: test-python test-contracts

test-python:
	python3 -m unittest discover -s vision/tests -t . -v
	python3 -m unittest discover -s oracle/tests -t . -v

test-vision:
	python3 -m unittest discover -s vision/tests -t . -v

test-oracle:
	python3 -m unittest discover -s oracle/tests -t . -v

test-contracts:
	cd contracts && forge test

demo:
	python3 -m oracle.demo

lint:
	python3 -m compileall -q vision oracle
	cd contracts && forge fmt --check

format-check: lint

clean:
	cd contracts && forge clean

