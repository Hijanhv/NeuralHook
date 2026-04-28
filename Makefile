.PHONY: test build agents frontend clean

## Contracts
test:
	cd contracts && forge test -v

build-contracts:
	cd contracts && forge build

deploy:
	cd contracts && forge script script/Deploy.s.sol --rpc-url unichain_sepolia --broadcast --verify

## Agents
install-agents:
	cd agents && npm install

agents:
	cd agents && npm start

## Frontend
install-frontend:
	cd frontend && npm install

frontend:
	cd frontend && npm run dev -- --port 3001

build-frontend:
	cd frontend && npm run build

## Docker
up:
	docker compose up --build

down:
	docker compose down

## All
install: install-agents install-frontend

clean:
	cd contracts && forge clean
	cd frontend && rm -rf .next
