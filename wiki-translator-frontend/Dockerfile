# Используем Node 22 на базе Alpine для легкости
FROM node:22-alpine AS build
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Ключевой момент: устанавливаем зависимости с флагами для Linux
RUN npm install --include=optional --arch=x64 --platform=linux

# Копируем остальной код и собираем
COPY . .
RUN npm run build

# Используем легкий сервер Caddy для раздачи фронтенда
FROM caddy:alpine
COPY --from=build /app/dist /usr/share/caddy
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":80"]
