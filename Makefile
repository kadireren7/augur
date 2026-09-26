.PHONY: install test test-python test-vision test-oracle test-contracts test-web test-indexer demo dev-web build-web lint format-check clean

install:
	python3 -m pip install -e .
	cd web && pnpm install
	cd indexer && pnpm install

test: test-python test-contracts test-web test-indexer

test-python:
	python3 -m unittest discover -s vision/tests -t . -v
	python3 -m unittest discover -s oracle/tests -t . -v

test-vision:
	python3 -m unittest discover -s vision/tests -t . -v

test-oracle:
	python3 -m unittest discover -s oracle/tests -t . -v

test-contracts:
	cd contracts && forge test

test-web:
	cd web && pnpm test

test-indexer:
	cd indexer && pnpm codegen && pnpm typecheck

demo:
	python3 -m oracle.demo

dev-web:
	cd web && pnpm dev

build-web:
	cd web && pnpm build

lint:
	python3 -m compileall -q vision oracle
	cd contracts && forge fmt --check
	cd web && pnpm typecheck && pnpm lint
	cd indexer && pnpm codegen && pnpm typecheck

format-check: lint

clean:
	cd contracts && forge clean
	cd web && rm -rf .next coverage
