.PHONY: up down logs install dev test smoke

install:
	npm install

up:
	docker-compose up --build -d

down:
	docker-compose down -v

logs:
	docker-compose logs -f api

dev:
	cp -n .env.example .env || true
	docker-compose up postgres redis -d
	npm run start:dev

test:
	npm test

test-cov:
	npm run test:cov

smoke:
	@echo "=== Register device ==="
	@curl -s -X POST http://localhost:3000/api/v1/devices \
		-H "Content-Type: application/json" \
		-d '{"name":"Sensor-01","status":"active"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
