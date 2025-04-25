FROM golang:1.24.2-alpine AS builder

# Установка зависимостей для сборки
RUN apk --no-cache add ca-certificates git findutils build-base

WORKDIR /build

# Сначала копируем только файлы go.mod и go.sum для кэширования зависимостей
# Копируем из корня контекста (.)
COPY go.mod go.sum* ./

# Загружаем зависимости перед копированием кода
# Это позволит Docker кэшировать слой зависимостей
RUN go mod download

# Копируем все файлы исходного кода сервера
# Копируем из корня контекста (.)
COPY . .

# Копируем остальные файлы (например, config)
# Путь /app/config/ будет создан в финальном образе
# Эта строка здесь не нужна, конфиг копируется позже
# COPY config/ /app/config/

# Обновляем зависимости до последних версий, указанных в go.mod
RUN go mod tidy

# Проверяем исходный код перед сборкой
RUN go vet ./...

# Собираем приложение
# Используем -trimpath для уменьшения размера и удаления информации о путях сборки
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -trimpath -o /build/messenger-server .

# Финальный образ
FROM alpine:latest

WORKDIR /app

# Установка необходимых пакетов
RUN apk --no-cache add ca-certificates tzdata

# Создаем директории
RUN mkdir -p /app/config /app/uploads /app/logs

# Копирование бинарника и конфигурации из builder
COPY --from=builder /build/messenger-server .
# Копируем конфиг из исходного кода в контексте builder
COPY --from=builder /build/config/config.json /app/config/config.json

# Копируем миграции, если они нужны во время выполнения
COPY --from=builder /build/migrations /app/migrations

# Устанавливаем права (если нужно)
# RUN chown -R appuser:appgroup /app
# USER appuser

# Порт для HTTP API и WebSocket
EXPOSE 9095
EXPOSE 9091

# Запуск
CMD ["./messenger-server"]